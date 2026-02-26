import { Router } from 'express';
import { supabaseAdmin } from './supabase-admin';
import { sendPushToMultipleUsers } from './push-notifications';

const BRACKET_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS bracket_contests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    season text,
    year integer,
    status text DEFAULT 'draft' CHECK (status IN ('draft','open','active','concluded','cancelled')),
    sponsor_id uuid,
    prize_pool_crowns integer DEFAULT 0,
    max_entries integer,
    lock_time timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS bracket_teams (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    bracket_contest_id uuid REFERENCES bracket_contests(id) ON DELETE CASCADE,
    team_name text NOT NULL,
    seed integer NOT NULL,
    region text NOT NULL,
    eliminated boolean DEFAULT false,
    eliminated_round integer
  );
  CREATE TABLE IF NOT EXISTS bracket_rounds (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    bracket_contest_id uuid REFERENCES bracket_contests(id) ON DELETE CASCADE,
    round_number integer NOT NULL,
    status text DEFAULT 'pending',
    points_per_correct_pick integer DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS bracket_games (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    bracket_contest_id uuid REFERENCES bracket_contests(id) ON DELETE CASCADE,
    round_number integer NOT NULL,
    region text,
    team1_id uuid REFERENCES bracket_teams(id),
    team2_id uuid REFERENCES bracket_teams(id),
    winner_team_id uuid REFERENCES bracket_teams(id),
    game_date timestamptz,
    balldontlie_game_id text
  );
  CREATE TABLE IF NOT EXISTS bracket_entries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    bracket_contest_id uuid REFERENCES bracket_contests(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    total_score integer DEFAULT 0,
    rank integer,
    crowns_awarded integer DEFAULT 0,
    submitted_at timestamptz DEFAULT now(),
    UNIQUE(bracket_contest_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS bracket_picks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    bracket_contest_id uuid REFERENCES bracket_contests(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    team_id uuid REFERENCES bracket_teams(id),
    round_number integer NOT NULL,
    matchup_key text,
    is_correct boolean,
    UNIQUE(bracket_contest_id, user_id, team_id, round_number)
  );
`;

export async function ensureBracketTables() {
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    const { error } = await supabaseAdmin.from('bracket_contests').select('id').limit(1);
    if (!error) {
      console.log('[Bracket] Tables already exist');
      return;
    }
    if (i < maxRetries - 1) {
      console.log(`[Bracket] Tables not found in schema cache (attempt ${i + 1}/${maxRetries}), retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
      try { await (supabaseAdmin.rpc as any)('pgrst_reload'); } catch (_) {}
    }
  }
  console.log('[Bracket] Bracket tables not found in Supabase schema cache. Please create them via the Supabase SQL Editor.');
}

export function registerBracketRoutes(router: Router) {

  async function getUserFromToken(authHeader?: string): Promise<string | null> {
    if (!authHeader?.startsWith('Bearer ')) return null;
    try {
      const token = authHeader.slice(7);
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error) return null;
      return user?.id || null;
    } catch { return null; }
  }

  async function isAdmin(userId: string): Promise<boolean> {
    const { data } = await supabaseAdmin.from('user_profiles').select('is_admin').eq('id', userId).single();
    return data?.is_admin === true;
  }

  const ROUND_POINTS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16, 6: 32 };

  // 0. POST /api/admin/bracket-setup-tables (admin) — Create bracket tables in Supabase
  router.post('/api/admin/bracket-setup-tables', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const dbUrl = process.env.SUPABASE_DB_URL;
      if (!dbUrl) return res.status(500).json({ error: 'SUPABASE_DB_URL not configured' });

      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
      await pool.query(BRACKET_TABLES_SQL);
      await pool.end();

      // Reload Supabase schema cache by restarting PostgREST (notification)
      await supabaseAdmin.rpc('pgrst_reload' as any).catch(() => {});

      res.json({ success: true, message: 'Bracket tables created successfully' });
    } catch (err: any) {
      console.error('[Bracket] setup tables error:', err);
      res.status(500).json({ error: err.message || 'Failed to create tables' });
    }
  });

  // 1. GET /api/bracket-contests (public) — List all bracket contests with entry counts
  router.get('/api/bracket-contests', async (_req, res) => {
    try {
      const { data: contests, error } = await supabaseAdmin
        .from('bracket_contests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        if (error.code === 'PGRST205') {
          return res.json([]);
        }
        throw error;
      }

      const contestIds = (contests || []).map((c: any) => c.id);
      let entryCounts: Record<string, number> = {};
      if (contestIds.length > 0) {
        const { data: entries } = await supabaseAdmin
          .from('bracket_entries')
          .select('bracket_contest_id');
        if (entries) {
          for (const e of entries) {
            entryCounts[e.bracket_contest_id] = (entryCounts[e.bracket_contest_id] || 0) + 1;
          }
        }
      }

      const result = (contests || []).map((c: any) => ({
        ...c,
        entry_count: entryCounts[c.id] || 0,
      }));

      res.json(result);
    } catch (err: any) {
      console.error('[Bracket] list contests error:', err);
      res.status(500).json({ error: 'Failed to load bracket contests' });
    }
  });

  // 2. GET /api/bracket-contests/:id (public) — Get bracket contest details with teams, rounds, and games
  router.get('/api/bracket-contests/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const [contestResult, teamsResult, roundsResult, gamesResult] = await Promise.all([
        supabaseAdmin.from('bracket_contests').select('*').eq('id', id).single(),
        supabaseAdmin.from('bracket_teams').select('*').eq('bracket_contest_id', id).order('seed', { ascending: true }),
        supabaseAdmin.from('bracket_rounds').select('*').eq('bracket_contest_id', id).order('round_number', { ascending: true }),
        supabaseAdmin.from('bracket_games').select('*').eq('bracket_contest_id', id).order('round_number', { ascending: true }),
      ]);

      if (contestResult.error || !contestResult.data) {
        return res.status(404).json({ error: 'Bracket contest not found' });
      }

      res.json({
        ...contestResult.data,
        teams: teamsResult.data || [],
        rounds: roundsResult.data || [],
        games: gamesResult.data || [],
      });
    } catch (err: any) {
      console.error('[Bracket] get contest error:', err);
      res.status(500).json({ error: 'Failed to load bracket contest' });
    }
  });

  // 3. GET /api/bracket-contests/:id/teams (public) — Get all teams for a contest grouped by region
  router.get('/api/bracket-contests/:id/teams', async (req, res) => {
    try {
      const { id } = req.params;
      const { data: teams, error } = await supabaseAdmin
        .from('bracket_teams')
        .select('*')
        .eq('bracket_contest_id', id)
        .order('seed', { ascending: true });
      if (error) throw error;

      const grouped: Record<string, any[]> = {};
      for (const team of (teams || [])) {
        const region = team.region || 'Unknown';
        if (!grouped[region]) grouped[region] = [];
        grouped[region].push(team);
      }

      res.json({ regions: grouped });
    } catch (err: any) {
      console.error('[Bracket] get teams error:', err);
      res.status(500).json({ error: 'Failed to load teams' });
    }
  });

  // 4. GET /api/bracket-contests/:id/standings (public) — Get leaderboard
  router.get('/api/bracket-contests/:id/standings', async (req, res) => {
    try {
      const { id } = req.params;
      const { data: entries, error } = await supabaseAdmin
        .from('bracket_entries')
        .select('*')
        .eq('bracket_contest_id', id)
        .order('total_score', { ascending: false });
      if (error) throw error;

      if (!entries || entries.length === 0) return res.json([]);

      const userIds = entries.map((e: any) => e.user_id);
      const { data: profiles } = await supabaseAdmin
        .from('user_profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

      const profileMap: Record<string, any> = {};
      for (const p of (profiles || [])) {
        profileMap[p.id] = p;
      }

      const standings = entries.map((e: any, idx: number) => ({
        ...e,
        rank: idx + 1,
        username: profileMap[e.user_id]?.username || 'Player',
        avatar_url: profileMap[e.user_id]?.avatar_url || null,
      }));

      res.json(standings);
    } catch (err: any) {
      console.error('[Bracket] standings error:', err);
      res.status(500).json({ error: 'Failed to load standings' });
    }
  });

  // 5. GET /api/bracket-contests/:id/my-picks (auth) — Get current user's picks
  router.get('/api/bracket-contests/:id/my-picks', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;
      const { data: picks, error } = await supabaseAdmin
        .from('bracket_picks')
        .select('*')
        .eq('bracket_contest_id', id)
        .eq('user_id', userId)
        .order('round_number', { ascending: true });
      if (error) throw error;

      const { data: entry } = await supabaseAdmin
        .from('bracket_entries')
        .select('*')
        .eq('bracket_contest_id', id)
        .eq('user_id', userId)
        .single();

      res.json({ picks: picks || [], entry: entry || null });
    } catch (err: any) {
      console.error('[Bracket] my-picks error:', err);
      res.status(500).json({ error: 'Failed to load picks' });
    }
  });

  // 6. POST /api/bracket-contests/:id/submit (auth) — Submit a full bracket
  router.post('/api/bracket-contests/:id/submit', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;
      const { picks } = req.body;

      if (!picks || !Array.isArray(picks) || picks.length === 0) {
        return res.status(400).json({ error: 'Picks array is required' });
      }

      const { data: contest, error: contestError } = await supabaseAdmin
        .from('bracket_contests')
        .select('*')
        .eq('id', id)
        .single();
      if (contestError || !contest) return res.status(404).json({ error: 'Contest not found' });

      if (contest.lock_time && new Date(contest.lock_time) <= new Date()) {
        return res.status(400).json({ error: 'Bracket submissions are locked' });
      }

      const { data: existingEntry } = await supabaseAdmin
        .from('bracket_entries')
        .select('id')
        .eq('bracket_contest_id', id)
        .eq('user_id', userId)
        .maybeSingle();

      let entry: any;

      if (existingEntry) {
        const { data: existingPicks } = await supabaseAdmin
          .from('bracket_picks')
          .select('id')
          .eq('bracket_contest_id', id)
          .eq('user_id', userId)
          .limit(1);

        if (existingPicks && existingPicks.length > 0) {
          return res.status(409).json({ error: 'You have already submitted a bracket for this contest' });
        }

        entry = existingEntry;
        await supabaseAdmin
          .from('bracket_entries')
          .update({ submitted_at: new Date().toISOString(), total_score: 0, rank: 0 })
          .eq('id', existingEntry.id);
      } else {
        if (contest.max_entries) {
          const { count } = await supabaseAdmin
            .from('bracket_entries')
            .select('*', { count: 'exact', head: true })
            .eq('bracket_contest_id', id);
          if ((count || 0) >= contest.max_entries) {
            return res.status(400).json({ error: 'This contest has reached maximum entries' });
          }
        }

        const { data: newEntry, error: entryError } = await supabaseAdmin
          .from('bracket_entries')
          .insert({
            user_id: userId,
            bracket_contest_id: id,
            total_score: 0,
            rank: 0,
            crowns_awarded: 0,
            submitted_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (entryError) throw entryError;
        entry = newEntry;
      }

      const pickRows = picks.map((p: any) => ({
        user_id: userId,
        bracket_contest_id: id,
        team_id: p.team_id,
        round_number: p.round_number,
        matchup_key: p.matchup_key || null,
        is_correct: null,
      }));

      const { error: picksError } = await supabaseAdmin
        .from('bracket_picks')
        .insert(pickRows);
      if (picksError) throw picksError;

      res.json({ success: true, entry });
    } catch (err: any) {
      console.error('[Bracket] submit error:', err);
      res.status(500).json({ error: 'Failed to submit bracket' });
    }
  });

  // 7. POST /api/admin/bracket-contests (admin) — Create a bracket contest
  router.post('/api/admin/bracket-contests', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { title, sponsor_id, prize_pool_crowns, max_entries, lock_time, season, year } = req.body;
      if (!title) return res.status(400).json({ error: 'Title is required' });

      const { data, error } = await supabaseAdmin
        .from('bracket_contests')
        .insert({
          title,
          sponsor_id: sponsor_id || null,
          status: 'open',
          prize_pool_crowns: prize_pool_crowns || 0,
          max_entries: max_entries || null,
          lock_time: lock_time || null,
          season: season || null,
          year: year || null,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;

      res.status(201).json(data);
    } catch (err: any) {
      console.error('[Bracket] create contest error:', err);
      res.status(500).json({ error: 'Failed to create bracket contest' });
    }
  });

  // 8. PUT /api/admin/bracket-contests/:id (admin) — Update bracket contest fields
  router.put('/api/admin/bracket-contests/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { id } = req.params;
      const updates = req.body;

      const allowedFields = ['title', 'sponsor_id', 'status', 'prize_pool_crowns', 'max_entries', 'lock_time', 'season', 'year'];
      const filtered: Record<string, any> = {};
      for (const key of allowedFields) {
        if (updates[key] !== undefined) filtered[key] = updates[key];
      }

      if (Object.keys(filtered).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const { data, error } = await supabaseAdmin
        .from('bracket_contests')
        .update(filtered)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Contest not found' });

      res.json(data);
    } catch (err: any) {
      console.error('[Bracket] update contest error:', err);
      res.status(500).json({ error: 'Failed to update bracket contest' });
    }
  });

  // 8b. DELETE /api/admin/bracket-contests/:id (admin) — Delete a bracket contest and all related data
  router.delete('/api/admin/bracket-contests/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { id } = req.params;

      await Promise.all([
        supabaseAdmin.from('bracket_picks').delete().eq('bracket_contest_id', id),
        supabaseAdmin.from('bracket_games').delete().eq('bracket_contest_id', id),
      ]);
      await supabaseAdmin.from('bracket_entries').delete().eq('bracket_contest_id', id);
      await supabaseAdmin.from('bracket_teams').delete().eq('bracket_contest_id', id);
      await supabaseAdmin.from('bracket_rounds').delete().eq('bracket_contest_id', id);

      const { error } = await supabaseAdmin
        .from('bracket_contests')
        .delete()
        .eq('id', id);
      if (error) throw error;

      res.json({ success: true });
    } catch (err: any) {
      console.error('[Bracket] delete contest error:', err);
      res.status(500).json({ error: err.message || 'Failed to delete bracket contest' });
    }
  });

  // 9. POST /api/admin/bracket-contests/:id/teams (admin) — Bulk add teams
  router.post('/api/admin/bracket-contests/:id/teams', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { id } = req.params;
      const { teams } = req.body;

      if (!teams || !Array.isArray(teams) || teams.length === 0) {
        return res.status(400).json({ error: 'Teams array is required' });
      }

      const teamRows = teams.map((t: any) => ({
        bracket_contest_id: id,
        team_name: t.team_name,
        seed: t.seed,
        region: t.region,
        eliminated: false,
        eliminated_round: null,
      }));

      const { data, error } = await supabaseAdmin
        .from('bracket_teams')
        .insert(teamRows)
        .select();
      if (error) throw error;

      res.status(201).json(data);
    } catch (err: any) {
      console.error('[Bracket] add teams error:', err);
      res.status(500).json({ error: 'Failed to add teams' });
    }
  });

  // 10. POST /api/admin/bracket-contests/:id/games (admin) — Bulk create games for a round
  router.post('/api/admin/bracket-contests/:id/games', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { id } = req.params;
      const { round_number, games } = req.body;

      if (!round_number || !games || !Array.isArray(games) || games.length === 0) {
        return res.status(400).json({ error: 'round_number and games array are required' });
      }

      const gameRows = games.map((g: any) => ({
        bracket_contest_id: id,
        round_number,
        region: g.region || null,
        team1_id: g.team1_id,
        team2_id: g.team2_id,
        winner_team_id: null,
        game_date: g.game_date || null,
        balldontlie_game_id: g.balldontlie_game_id || null,
      }));

      const { data, error } = await supabaseAdmin
        .from('bracket_games')
        .insert(gameRows)
        .select();
      if (error) throw error;

      res.status(201).json(data);
    } catch (err: any) {
      console.error('[Bracket] add games error:', err);
      res.status(500).json({ error: 'Failed to add games' });
    }
  });

  // 11. POST /api/admin/bracket-contests/:id/grade-round (admin) — Grade a round
  router.post('/api/admin/bracket-contests/:id/grade-round', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { id } = req.params;
      const { round_number } = req.body;

      if (!round_number) return res.status(400).json({ error: 'round_number is required' });

      const { data: games, error: gamesError } = await supabaseAdmin
        .from('bracket_games')
        .select('*')
        .eq('bracket_contest_id', id)
        .eq('round_number', round_number);
      if (gamesError) throw gamesError;

      const decidedGames = (games || []).filter((g: any) => g.winner_team_id);
      if (decidedGames.length === 0) {
        return res.status(400).json({ error: 'No games with winners in this round' });
      }

      const winnerTeamIds = new Set(decidedGames.map((g: any) => g.winner_team_id));

      const { data: picks, error: picksError } = await supabaseAdmin
        .from('bracket_picks')
        .select('*')
        .eq('bracket_contest_id', id)
        .eq('round_number', round_number);
      if (picksError) throw picksError;

      let correctCount = 0;
      let incorrectCount = 0;
      for (const pick of (picks || [])) {
        const isCorrect = winnerTeamIds.has(pick.team_id);
        const { error: updateError } = await supabaseAdmin
          .from('bracket_picks')
          .update({ is_correct: isCorrect })
          .eq('id', pick.id);
        if (updateError) console.error('[Bracket] pick update error:', updateError);
        if (isCorrect) correctCount++;
        else incorrectCount++;
      }

      const pointsForRound = ROUND_POINTS[round_number] || 1;

      const { data: entries, error: entriesError } = await supabaseAdmin
        .from('bracket_entries')
        .select('*')
        .eq('bracket_contest_id', id);
      if (entriesError) throw entriesError;

      for (const entry of (entries || [])) {
        const { data: userPicks } = await supabaseAdmin
          .from('bracket_picks')
          .select('is_correct, round_number')
          .eq('bracket_contest_id', id)
          .eq('user_id', entry.user_id)
          .not('is_correct', 'is', null);

        const totalScore = (userPicks || []).reduce((sum: number, p: any) => {
          if (p.is_correct) {
            return sum + (ROUND_POINTS[p.round_number] || 1);
          }
          return sum;
        }, 0);

        await supabaseAdmin
          .from('bracket_entries')
          .update({ total_score: totalScore })
          .eq('id', entry.id);
      }

      const { data: updatedEntries } = await supabaseAdmin
        .from('bracket_entries')
        .select('*')
        .eq('bracket_contest_id', id)
        .order('total_score', { ascending: false });

      for (let i = 0; i < (updatedEntries || []).length; i++) {
        await supabaseAdmin
          .from('bracket_entries')
          .update({ rank: i + 1 })
          .eq('id', updatedEntries![i].id);
      }

      await supabaseAdmin
        .from('bracket_rounds')
        .update({ status: 'complete' })
        .eq('bracket_contest_id', id)
        .eq('round_number', round_number);

      res.json({
        success: true,
        graded: decidedGames.length,
        correct_picks: correctCount,
        incorrect_picks: incorrectCount,
        points_per_correct: pointsForRound,
      });
    } catch (err: any) {
      console.error('[Bracket] grade round error:', err);
      res.status(500).json({ error: 'Failed to grade round' });
    }
  });

  // 12. PUT /api/admin/bracket-games/:gameId/winner (admin) — Set winner of a game
  router.put('/api/admin/bracket-games/:gameId/winner', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { gameId } = req.params;
      const { winner_team_id } = req.body;

      if (!winner_team_id) return res.status(400).json({ error: 'winner_team_id is required' });

      const { data: game, error: gameError } = await supabaseAdmin
        .from('bracket_games')
        .select('*')
        .eq('id', gameId)
        .single();
      if (gameError || !game) return res.status(404).json({ error: 'Game not found' });

      if (winner_team_id !== game.team1_id && winner_team_id !== game.team2_id) {
        return res.status(400).json({ error: 'winner_team_id must be one of the teams in this game' });
      }

      const loserId = winner_team_id === game.team1_id ? game.team2_id : game.team1_id;

      const [updateGame, updateLoser] = await Promise.all([
        supabaseAdmin
          .from('bracket_games')
          .update({ winner_team_id })
          .eq('id', gameId)
          .select()
          .single(),
        supabaseAdmin
          .from('bracket_teams')
          .update({ eliminated: true, eliminated_round: game.round_number })
          .eq('id', loserId),
      ]);

      if (updateGame.error) throw updateGame.error;

      res.json(updateGame.data);
    } catch (err: any) {
      console.error('[Bracket] set winner error:', err);
      res.status(500).json({ error: 'Failed to set game winner' });
    }
  });

  // 13. POST /api/admin/bracket-contests/:id/setup-rounds (admin) — Auto-create 6 rounds
  router.post('/api/admin/bracket-contests/:id/setup-rounds', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { id } = req.params;

      const { data: existing } = await supabaseAdmin
        .from('bracket_rounds')
        .select('id')
        .eq('bracket_contest_id', id);

      if (existing && existing.length > 0) {
        return res.status(400).json({ error: 'Rounds already exist for this contest' });
      }

      const roundRows = Object.entries(ROUND_POINTS).map(([roundNum, points]) => ({
        bracket_contest_id: id,
        round_number: parseInt(roundNum),
        status: 'pending',
        points_per_correct_pick: points,
      }));

      const { data, error } = await supabaseAdmin
        .from('bracket_rounds')
        .insert(roundRows)
        .select();
      if (error) throw error;

      res.status(201).json(data);
    } catch (err: any) {
      console.error('[Bracket] setup rounds error:', err);
      res.status(500).json({ error: 'Failed to setup rounds' });
    }
  });

  // 14. POST /api/admin/bracket-contests/:id/setup-mock (admin) — Create 64 mock teams, 6 rounds, 32 R1 games
  router.post('/api/admin/bracket-contests/:id/setup-mock', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { id } = req.params;

      const { data: contest, error: contestError } = await supabaseAdmin
        .from('bracket_contests')
        .select('*')
        .eq('id', id)
        .single();
      if (contestError || !contest) return res.status(404).json({ error: 'Bracket contest not found' });

      await Promise.all([
        supabaseAdmin.from('bracket_games').delete().eq('bracket_contest_id', id),
        supabaseAdmin.from('bracket_picks').delete().eq('bracket_contest_id', id),
      ]);
      await supabaseAdmin.from('bracket_teams').delete().eq('bracket_contest_id', id);
      await supabaseAdmin.from('bracket_rounds').delete().eq('bracket_contest_id', id);

      const regionTeams: Record<string, string[]> = {
        East: [
          'UConn', 'Stetson', 'FAU', 'Northwestern', 'San Diego State', 'Yale',
          'Clemson', 'New Mexico', 'Baylor', 'Colgate', 'Virginia', 'Colorado State',
          'Marquette', 'Vermont', 'Kansas', 'Montana State',
        ],
        West: [
          'North Carolina', 'Wagner', 'Arizona', 'Long Beach St', "Saint Mary's", 'Ole Miss',
          'Iowa State', 'South Dakota St', 'Oregon', 'South Carolina', 'Gonzaga', 'McNeese',
          'Purdue', 'Grambling', 'Tennessee', "Saint Peter's",
        ],
        South: [
          'Houston', 'Longwood', 'Nebraska', 'Texas A&M', 'Wisconsin', 'James Madison',
          'Duke', 'Oakland', 'Texas Tech', 'NC State', 'Kentucky', 'Troy',
          'Auburn', 'Morehead St', 'Illinois', 'Samford',
        ],
        Midwest: [
          'Alabama', 'Howard', 'Creighton', 'Akron', 'BYU', 'Duquesne',
          'Michigan State', 'Mississippi St', 'Florida', 'Grand Canyon', 'Dayton', 'Nevada',
          'Drake', 'Western Ky', 'Rutgers', 'UCSB',
        ],
      };

      const teamRows: { bracket_contest_id: string; team_name: string; seed: number; region: string; eliminated: boolean }[] = [];
      for (const [region, names] of Object.entries(regionTeams)) {
        names.forEach((name, idx) => {
          teamRows.push({
            bracket_contest_id: id,
            team_name: name,
            seed: idx + 1,
            region,
            eliminated: false,
          });
        });
      }

      const { data: teams, error: teamsError } = await supabaseAdmin
        .from('bracket_teams')
        .insert(teamRows)
        .select();
      if (teamsError) throw teamsError;

      const roundRows = Object.entries(ROUND_POINTS).map(([roundNum, points]) => ({
        bracket_contest_id: id,
        round_number: parseInt(roundNum),
        status: 'pending',
        points_per_correct_pick: points,
      }));
      const { error: roundsError } = await supabaseAdmin
        .from('bracket_rounds')
        .insert(roundRows);
      if (roundsError) throw roundsError;

      const teamLookup: Record<string, Record<number, any>> = {};
      for (const t of (teams || [])) {
        if (!teamLookup[t.region]) teamLookup[t.region] = {};
        teamLookup[t.region][t.seed] = t;
      }

      const seedMatchups = [
        [1, 16], [8, 9], [5, 12], [4, 13],
        [6, 11], [3, 14], [7, 10], [2, 15],
      ];

      const gameRows: any[] = [];
      let gameIdx = 0;
      for (const region of ['East', 'West', 'South', 'Midwest']) {
        for (const [s1, s2] of seedMatchups) {
          gameRows.push({
            bracket_contest_id: id,
            round_number: 1,
            region,
            team1_id: teamLookup[region][s1].id,
            team2_id: teamLookup[region][s2].id,
            winner_team_id: null,
            game_date: new Date(Date.now() + gameIdx * 1000).toISOString(),
          });
          gameIdx++;
        }
      }

      const { data: games, error: gamesError } = await supabaseAdmin
        .from('bracket_games')
        .insert(gameRows)
        .select();
      if (gamesError) throw gamesError;

      res.json({
        success: true,
        contest,
        teams_created: (teams || []).length,
        games_created: (games || []).length,
        rounds_created: 6,
      });
    } catch (err: any) {
      console.error('[Bracket] setup-mock error:', err);
      res.status(500).json({ error: err.message || 'Failed to setup mock bracket' });
    }
  });

  // DEBUG: Check picks and games data
  router.get('/api/bracket-contests/:id/debug', async (req, res) => {
    try {
      const { id } = req.params;
      const { data: picks } = await supabaseAdmin.from('bracket_picks').select('*').eq('bracket_contest_id', id).limit(10);
      const { data: games } = await supabaseAdmin.from('bracket_games').select('*').eq('bracket_contest_id', id).eq('round_number', 1).limit(5);
      const { data: entries } = await supabaseAdmin.from('bracket_entries').select('*').eq('bracket_contest_id', id);
      res.json({ picks_sample: picks, games_sample: games, entries });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // 15. POST /api/bracket-contests/:id/simulate-all — Simulate all rounds, grade picks, update scores
  router.post('/api/bracket-contests/:id/simulate-all', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;

      const { data: contest } = await supabaseAdmin
        .from('bracket_contests')
        .select('*')
        .eq('id', id)
        .single();
      if (!contest) return res.status(404).json({ error: 'Bracket contest not found' });

      const { data: allTeams } = await supabaseAdmin
        .from('bracket_teams')
        .select('*')
        .eq('bracket_contest_id', id);
      if (!allTeams || allTeams.length === 0) return res.status(400).json({ error: 'No teams found' });

      const teamMap: Record<string, any> = {};
      for (const t of allTeams) teamMap[t.id] = t;

      await supabaseAdmin.from('bracket_games').delete().eq('bracket_contest_id', id).neq('round_number', 1);
      await supabaseAdmin.from('bracket_games').update({ winner_team_id: null }).eq('bracket_contest_id', id).eq('round_number', 1);
      await supabaseAdmin.from('bracket_teams').update({ eliminated: false, eliminated_round: null }).eq('bracket_contest_id', id);

      const results: Record<number, { games: number; winners: string[] }> = {};

      for (let round = 1; round <= 6; round++) {
        const { data: games } = await supabaseAdmin
          .from('bracket_games')
          .select('*')
          .eq('bracket_contest_id', id)
          .eq('round_number', round)
          .order('region', { ascending: true })
          .order('game_date', { ascending: true });

        if (!games || games.length === 0) break;

        const roundWinners: string[] = [];
        for (const game of games) {
          if (!game.team1_id || !game.team2_id) continue;
          const t1 = teamMap[game.team1_id];
          const t2 = teamMap[game.team2_id];
          const t1Seed = t1?.seed ?? 8;
          const t2Seed = t2?.seed ?? 8;
          const higherSeedId = t1Seed <= t2Seed ? game.team1_id : game.team2_id;
          const lowerSeedId = t1Seed <= t2Seed ? game.team2_id : game.team1_id;
          const winnerId = Math.random() < 0.65 ? higherSeedId : lowerSeedId;
          const loserId = winnerId === game.team1_id ? game.team2_id : game.team1_id;

          await supabaseAdmin.from('bracket_games').update({ winner_team_id: winnerId }).eq('id', game.id);
          await supabaseAdmin.from('bracket_teams').update({ eliminated: true, eliminated_round: round }).eq('id', loserId);
          roundWinners.push(winnerId);
        }

        results[round] = { games: games.length, winners: roundWinners };

        if (round < 6) {
          const { data: decidedGames } = await supabaseAdmin
            .from('bracket_games')
            .select('*')
            .eq('bracket_contest_id', id)
            .eq('round_number', round)
            .not('winner_team_id', 'is', null)
            .order('region', { ascending: true })
            .order('game_date', { ascending: true });

          if (decidedGames && decidedGames.length > 0) {
            const nextRound = round + 1;
            const nextGames: any[] = [];
            let nextIdx = 0;

            if (round <= 3) {
              const byRegion: Record<string, any[]> = {};
              for (const g of decidedGames) {
                const r = g.region || 'Unknown';
                if (!byRegion[r]) byRegion[r] = [];
                byRegion[r].push(g);
              }
              for (const region of ['East', 'West', 'South', 'Midwest']) {
                const regionGames = byRegion[region] || [];
                for (let i = 0; i < regionGames.length; i += 2) {
                  if (i + 1 < regionGames.length) {
                    nextGames.push({
                      bracket_contest_id: id,
                      round_number: nextRound,
                      region,
                      team1_id: regionGames[i].winner_team_id,
                      team2_id: regionGames[i + 1].winner_team_id,
                      winner_team_id: null,
                      game_date: new Date(Date.now() + nextIdx * 1000).toISOString(),
                    });
                    nextIdx++;
                  }
                }
              }
            } else if (round === 4) {
              const regionWinners: Record<string, string> = {};
              for (const g of decidedGames) {
                if (g.region) regionWinners[g.region] = g.winner_team_id;
              }
              if (regionWinners['East'] && regionWinners['West'] && regionWinners['South'] && regionWinners['Midwest']) {
                nextGames.push({
                  bracket_contest_id: id, round_number: nextRound, region: 'Final Four',
                  team1_id: regionWinners['East'], team2_id: regionWinners['West'],
                  winner_team_id: null, game_date: new Date(Date.now()).toISOString(),
                });
                nextGames.push({
                  bracket_contest_id: id, round_number: nextRound, region: 'Final Four',
                  team1_id: regionWinners['South'], team2_id: regionWinners['Midwest'],
                  winner_team_id: null, game_date: new Date(Date.now() + 1000).toISOString(),
                });
              }
            } else if (round === 5) {
              const winners = decidedGames.map((g: any) => g.winner_team_id).filter(Boolean);
              if (winners.length >= 2) {
                nextGames.push({
                  bracket_contest_id: id, round_number: nextRound, region: 'Championship',
                  team1_id: winners[0], team2_id: winners[1],
                  winner_team_id: null, game_date: new Date(Date.now()).toISOString(),
                });
              }
            }

            if (nextGames.length > 0) {
              await supabaseAdmin.from('bracket_games').insert(nextGames);
            }
          }
        }
      }

      // Grade all picks
      const { data: allGames } = await supabaseAdmin
        .from('bracket_games')
        .select('*')
        .eq('bracket_contest_id', id)
        .not('winner_team_id', 'is', null);

      const winnersByRound: Record<number, Set<string>> = {};
      for (const g of (allGames || [])) {
        if (!winnersByRound[g.round_number]) winnersByRound[g.round_number] = new Set();
        winnersByRound[g.round_number].add(g.winner_team_id);
      }

      const { data: picks } = await supabaseAdmin
        .from('bracket_picks')
        .select('*')
        .eq('bracket_contest_id', id);

      let totalGraded = 0;
      let totalCorrectPicks = 0;
      console.log(`[Bracket] Grading picks. Winners by round:`, Object.fromEntries(Object.entries(winnersByRound).map(([r, s]) => [r, Array.from(s)])));
      console.log(`[Bracket] Total picks to grade: ${(picks || []).length}`);
      for (const pick of (picks || [])) {
        const roundWinners = winnersByRound[pick.round_number];
        const isCorrect = roundWinners ? roundWinners.has(pick.team_id) : false;
        if (isCorrect) totalCorrectPicks++;
        if (totalGraded < 5) {
          console.log(`[Bracket] Pick: team=${pick.team_id}, round=${pick.round_number}, winners=${roundWinners ? Array.from(roundWinners).slice(0, 3) : 'none'}, correct=${isCorrect}`);
        }
        await supabaseAdmin.from('bracket_picks').update({ is_correct: isCorrect }).eq('id', pick.id);
        totalGraded++;
      }
      console.log(`[Bracket] Grading complete: ${totalCorrectPicks} correct out of ${totalGraded} picks`);

      // Update entry scores
      const { data: entries } = await supabaseAdmin
        .from('bracket_entries')
        .select('*')
        .eq('bracket_contest_id', id);

      for (const entry of (entries || [])) {
        const { data: userPicks } = await supabaseAdmin
          .from('bracket_picks')
          .select('is_correct, round_number')
          .eq('bracket_contest_id', id)
          .eq('user_id', entry.user_id)
          .not('is_correct', 'is', null);

        const totalScore = (userPicks || []).reduce((sum: number, p: any) => {
          if (p.is_correct) return sum + (ROUND_POINTS[p.round_number] || 1);
          return sum;
        }, 0);

        const correctCount = (userPicks || []).filter((p: any) => p.is_correct).length;
        console.log(`[Bracket] User ${entry.user_id}: ${correctCount} correct picks, score=${totalScore}, picks_checked=${(userPicks || []).length}`);

        await supabaseAdmin.from('bracket_entries').update({ total_score: totalScore }).eq('id', entry.id);
      }

      // Update rankings
      const { data: updatedEntries } = await supabaseAdmin
        .from('bracket_entries')
        .select('*')
        .eq('bracket_contest_id', id)
        .order('total_score', { ascending: false });

      for (let i = 0; i < (updatedEntries || []).length; i++) {
        await supabaseAdmin.from('bracket_entries').update({ rank: i + 1 }).eq('id', updatedEntries![i].id);
      }

      // Mark all rounds complete
      await supabaseAdmin
        .from('bracket_rounds')
        .update({ status: 'complete' })
        .eq('bracket_contest_id', id);

      // Auto-conclude the contest
      await supabaseAdmin
        .from('bracket_contests')
        .update({ status: 'concluded', updated_at: new Date().toISOString() })
        .eq('id', id);

      // Send push notifications to all participants
      try {
        const finalEntries = updatedEntries || [];
        if (finalEntries.length > 0) {
          const userIds = finalEntries.map((e: any) => e.user_id);
          for (const entry of finalEntries) {
            const rank = finalEntries.indexOf(entry) + 1;
            const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
            const title = rank <= 3 ? `🏆 You placed ${rank}${suffix}!` : `Bracket Challenge Complete`;
            const body = `You scored ${entry.total_score || 0} points and finished ${rank}${suffix} out of ${finalEntries.length} entries.`;
            await sendPushToMultipleUsers([entry.user_id], title, body, 'results', { bracketContestId: id, rank, score: entry.total_score });
          }
        }
      } catch (pushErr) {
        console.error('[Bracket] Push notification error (non-fatal):', pushErr);
      }

      res.json({
        success: true,
        rounds_simulated: Object.keys(results).length,
        total_games: Object.values(results).reduce((s, r) => s + r.games, 0),
        picks_graded: totalGraded,
        entries_scored: (entries || []).length,
      });
    } catch (err: any) {
      console.error('[Bracket] simulate-all error:', err);
      res.status(500).json({ error: err.message || 'Failed to simulate' });
    }
  });
}
