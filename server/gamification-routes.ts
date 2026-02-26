import { Router } from 'express';
import { gamificationService } from './gamification-service';
import { supabaseAdmin } from './supabase-admin';
import { serverCache } from './cache';
import { publicRateLimit, authRateLimit, writeRateLimit } from './rate-limiter';
import { fetchNBAOdds, findOddsForGame } from './nba-routes';

export function registerGamificationRoutes(router: Router) {

  function mapUnlockCondition(unlock_condition_json: any) {
    if (!unlock_condition_json) return {};
    return {
      unlock_type: unlock_condition_json.type || null,
      unlock_value: unlock_condition_json.value != null ? unlock_condition_json.value : null,
      unlock_contest_id: unlock_condition_json.contestId || null,
      unlock_achievement_id: unlock_condition_json.achievementId || null,
      unlock_season_id: unlock_condition_json.seasonId || null,
      unlock_giveaway_id: unlock_condition_json.giveawayId || null,
      unlock_elo_rank: unlock_condition_json.eloRank != null ? unlock_condition_json.eloRank : null,
    };
  }

  function buildUnlockConditionJson(item: any) {
    return {
      type: item.unlock_type || 'free',
      value: item.unlock_value || undefined,
      contestId: item.unlock_contest_id || undefined,
      achievementId: item.unlock_achievement_id || undefined,
      seasonId: item.unlock_season_id || undefined,
      giveawayId: item.unlock_giveaway_id || undefined,
      eloRank: item.unlock_elo_rank || undefined,
    };
  }

  async function getUserFromToken(authHeader?: string): Promise<string | null> {
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('[Auth] Missing or malformed Authorization header');
      return null;
    }
    try {
      const token = authHeader.slice(7);
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error) {
        console.log(`[Auth] Token validation failed: ${error.message}`);
        return null;
      }
      return user?.id || null;
    } catch (e: any) {
      console.log(`[Auth] Token error: ${e.message || 'unknown'}`);
      return null;
    }
  }

  async function isAdmin(userId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
      .from('user_profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();
    return data?.is_admin === true;
  }

  // ==================== Auth Signup (no email verification) ====================

  router.post('/api/auth/signup', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
          return res.status(409).json({ error: 'An account with this email already exists' });
        }
        console.error('[Auth] signup error:', authError);
        return res.status(400).json({ error: authError.message || 'Failed to create account' });
      }

      const userId = authData.user.id;
      const username = email.split('@')[0] || 'Player';

      await supabaseAdmin
        .from('user_profiles')
        .upsert({
          id: userId,
          username,
          role: 'user',
          is_admin: false,
          is_banned: false,
          crowns: 0,
          member_since: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      res.json({ success: true, userId });
    } catch (err: any) {
      console.error('[Auth] signup error:', err);
      res.status(500).json({ error: 'Failed to create account' });
    }
  });

  // ==================== Auth Provision Endpoint ====================

  router.post('/api/auth/provision-profile', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { data: existing } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (existing) {
        return res.json({ success: true, created: false });
      }

      const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
      const username = authUser?.user_metadata?.username || authUser?.email?.split('@')[0] || 'Player';

      const { error: createErr } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
          id: userId,
          username,
          role: 'user',
          is_admin: false,
          is_banned: false,
          crowns: 0,
          member_since: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (createErr) {
        console.error('[Auth] provision profile error:', createErr);
        return res.status(500).json({ error: 'Failed to create profile' });
      }

      console.log(`[Auth] Provisioned profile for user ${userId} (${username})`);
      res.json({ success: true, created: true });
    } catch (err: any) {
      console.error('[Auth] provision error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // ==================== Public Data Endpoints ====================

  router.get('/api/contests', publicRateLimit, async (req, res) => {
    try {
      const cached = serverCache.get<any[]>('public:contests');
      if (cached) {
        if (req.headers['if-none-match'] === cached.etag) return res.status(304).end();
        res.setHeader('ETag', cached.etag);
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.json(cached.data);
      }
      const { data, error } = await supabaseAdmin
        .from('contests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const result = (data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        sponsor: row.sponsor,
        sponsorLogo: row.sponsor_logo || '',
        league: row.league,
        prizePool: row.prize_pool,
        entries: row.entries || 0,
        maxEntries: row.max_entries,
        startsAt: row.opens_at,
        endsAt: row.ends_at,
        crowns: row.crowns,
        isPremier: row.is_premier,
        backgroundImage: row.background_image,
        status: row.status,
        scoring_json: row.scoring_json,
        contest_type: row.contest_type,
      }));
      const entry = serverCache.set('public:contests', result);
      res.setHeader('ETag', entry.etag);
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json(result);
    } catch (err: any) {
      console.error('[Route] contests list error:', err);
      res.status(500).json({ error: 'Failed to load contests' });
    }
  });

  router.get('/api/me/contests', authRateLimit, async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { data: entries, error } = await supabaseAdmin
        .from('picks')
        .select('id, contest_id, pick_json, submitted_at')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      if (!entries || entries.length === 0) return res.json([]);

      const contestIds = [...new Set(entries.map((e: any) => e.contest_id))];
      const { data: contests } = await supabaseAdmin
        .from('contests')
        .select('id, title, sponsor, status, ends_at')
        .in('id', contestIds);

      const contestMap: Record<string, any> = {};
      for (const c of contests || []) {
        contestMap[c.id] = c;
      }

      const { data: scores } = await supabaseAdmin
        .from('contest_scores')
        .select('contest_id, user_id, total_score, rank')
        .eq('user_id', userId)
        .in('contest_id', contestIds);

      const scoreMap: Record<string, any> = {};
      for (const s of scores || []) {
        scoreMap[s.contest_id] = s;
      }

      const result = entries.map((e: any) => {
        const contest = contestMap[e.contest_id];
        const score = scoreMap[e.contest_id];
        let status: string = 'pending';
        if (contest?.status === 'concluded') status = 'completed';
        else if (contest?.status === 'live' || contest?.status === 'grading') status = 'live';

        const pickJson = e.pick_json || {};
        const { _tiebreaker, ...picks } = pickJson;

        return {
          id: e.id,
          contest_id: e.contest_id,
          contestId: e.contest_id,
          contestTitle: contest?.title || 'Unknown Contest',
          sponsor: contest?.sponsor || 'Fantasy Royale',
          status,
          picks,
          crownsEarned: score?.total_score || 0,
          position: score?.rank || null,
        };
      });

      res.json(result);
    } catch (err: any) {
      console.error('[Route] user contests error:', err);
      res.status(500).json({ error: 'Failed to load your contests' });
    }
  });

  router.get('/api/products', publicRateLimit, async (req, res) => {
    try {
      const cached = serverCache.get<any[]>('public:products');
      if (cached) {
        if (req.headers['if-none-match'] === cached.etag) return res.status(304).end();
        res.setHeader('ETag', cached.etag);
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.json(cached.data);
      }
      const { data, error } = await supabaseAdmin
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const result = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        price: Number(row.price),
        originalPrice: row.original_price ? Number(row.original_price) : undefined,
        image: row.image,
        rating: Number(row.rating),
        reviews: row.reviews,
        badge: row.badge,
        category: row.category,
        sizes: row.sizes,
        description: row.description,
      }));
      const entry = serverCache.set('public:products', result);
      res.setHeader('ETag', entry.etag);
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json(result);
    } catch (err: any) {
      console.error('[Route] products list error:', err);
      res.status(500).json({ error: 'Failed to load products' });
    }
  });

  router.get('/api/news', publicRateLimit, async (req, res) => {
    try {
      const cached = serverCache.get<any[]>('public:news');
      if (cached) {
        if (req.headers['if-none-match'] === cached.etag) return res.status(304).end();
        res.setHeader('ETag', cached.etag);
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.json(cached.data);
      }
      const { data, error } = await supabaseAdmin
        .from('news')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const result = data || [];
      const entry = serverCache.set('public:news', result);
      res.setHeader('ETag', entry.etag);
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json(result);
    } catch (err: any) {
      console.error('[Route] news list error:', err);
      res.status(500).json({ error: 'Failed to load news' });
    }
  });

  router.get('/api/videos', publicRateLimit, async (req, res) => {
    try {
      const cached = serverCache.get<any[]>('public:videos');
      if (cached) {
        if (req.headers['if-none-match'] === cached.etag) return res.status(304).end();
        res.setHeader('ETag', cached.etag);
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.json(cached.data);
      }
      const { data, error } = await supabaseAdmin
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const result = data || [];
      const entry = serverCache.set('public:videos', result);
      res.setHeader('ETag', entry.etag);
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json(result);
    } catch (err: any) {
      console.error('[Route] videos list error:', err);
      res.status(500).json({ error: 'Failed to load videos' });
    }
  });

  router.get('/api/promo-slides', publicRateLimit, async (req, res) => {
    try {
      const cached = serverCache.get<any[]>('public:promo-slides');
      if (cached) {
        if (req.headers['if-none-match'] === cached.etag) return res.status(304).end();
        res.setHeader('ETag', cached.etag);
        res.setHeader('Cache-Control', 'public, max-age=120');
        return res.json(cached.data);
      }
      const { data, error } = await supabaseAdmin
        .from('promo_slides')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const result = data || [];
      const entry = serverCache.set('public:promo-slides', result);
      res.setHeader('ETag', entry.etag);
      res.setHeader('Cache-Control', 'public, max-age=120');
      res.json(result);
    } catch (err: any) {
      console.error('[Route] promo slides error:', err);
      res.status(500).json({ error: 'Failed to load promo slides' });
    }
  });

  router.get('/api/ticker-items', publicRateLimit, async (req, res) => {
    try {
      const cached = serverCache.get<any[]>('public:ticker-items');
      if (cached) {
        if (req.headers['if-none-match'] === cached.etag) return res.status(304).end();
        res.setHeader('ETag', cached.etag);
        res.setHeader('Cache-Control', 'public, max-age=120');
        return res.json(cached.data);
      }
      const { data, error } = await supabaseAdmin
        .from('ticker_items')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const result = (data || []).map((row: any) => row.text);
      const entry = serverCache.set('public:ticker-items', result);
      res.setHeader('ETag', entry.etag);
      res.setHeader('Cache-Control', 'public, max-age=120');
      res.json(result);
    } catch (err: any) {
      console.error('[Route] ticker items error:', err);
      res.status(500).json({ error: 'Failed to load ticker items' });
    }
  });

  router.get('/api/leaderboard', publicRateLimit, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);

      const { data: users, error } = await supabaseAdmin
        .from('user_profiles')
        .select('id, username, avatar_url, crowns')
        .order('crowns', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const userIds = (users || []).map((u: any) => u.id);

      let contestCounts: Record<string, number> = {};
      let winCounts: Record<string, number> = {};

      if (userIds.length > 0) {
        const { data: picks } = await supabaseAdmin
          .from('picks')
          .select('user_id')
          .in('user_id', userIds);

        if (picks) {
          for (const p of picks) {
            contestCounts[p.user_id] = (contestCounts[p.user_id] || 0) + 1;
          }
        }

        const { data: scores } = await supabaseAdmin
          .from('contest_scores')
          .select('user_id, rank_int')
          .in('user_id', userIds)
          .eq('rank_int', 1);

        if (scores) {
          for (const s of scores) {
            winCounts[s.user_id] = (winCounts[s.user_id] || 0) + 1;
          }
        }
      }

      const leaderboard = (users || []).map((u: any, idx: number) => ({
        rank: idx + 1,
        userId: u.id,
        username: u.username || 'Player',
        avatar: u.avatar_url || null,
        crowns: u.crowns || 0,
        contestsEntered: contestCounts[u.id] || 0,
        wins: winCounts[u.id] || 0,
      }));

      res.json(leaderboard);
    } catch (err: any) {
      console.error('[Route] leaderboard error:', err);
      res.status(500).json({ error: 'Failed to load leaderboard' });
    }
  });

  // ==================== Gamification Endpoints ====================

  router.get('/api/gamification/crown-balance', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const balance = await gamificationService.getCrownBalance(userId);
      res.json(balance);
    } catch (err: any) {
      console.error('[Route] crown-balance error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/gamification/crown-ledger', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const limit = parseInt(req.query.limit as string) || 50;
      const ledger = await gamificationService.getCrownLedger(userId, limit);
      res.json(ledger);
    } catch (err: any) {
      console.error('[Route] crown-ledger error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/gamification/streak', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const streak = await gamificationService.getStreak(userId);
      res.json(streak);
    } catch (err: any) {
      console.error('[Route] streak error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/gamification/elo/:sportId/:seasonId', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const elo = await gamificationService.getElo(userId, req.params.sportId, req.params.seasonId);
      if (!elo) return res.status(404).json({ error: 'No ELO record found' });
      res.json(elo);
    } catch (err: any) {
      console.error('[Route] elo error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/gamification/badges', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const badges = await gamificationService.getUserBadges(userId);
      res.json(badges);
    } catch (err: any) {
      console.error('[Route] badges error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/gamification/config', async (_req, res) => {
    try {
      const config = await gamificationService.getGamificationConfig();
      res.json(config || {});
    } catch (err: any) {
      console.error('[Route] config error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/gamification/leaderboard/champion/:sportId/:seasonId', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const leaderboard = await gamificationService.getChampionLeaderboard(
        req.params.sportId,
        req.params.seasonId,
        limit
      );
      res.json(leaderboard);
    } catch (err: any) {
      console.error('[Route] leaderboard error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/gamification/giveaway/:monthKey', async (req, res) => {
    try {
      const { data: month } = await supabaseAdmin
        .from('giveaway_months')
        .select('*')
        .eq('month_key', req.params.monthKey)
        .single();

      if (!month) return res.status(404).json({ error: 'Giveaway month not found' });

      const { data: winners } = await supabaseAdmin
        .from('giveaway_winners')
        .select('*')
        .eq('giveaway_month_id', month.id);

      res.json({ ...month, winners: winners || [] });
    } catch (err: any) {
      console.error('[Route] giveaway error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/contests/:contestId/enter', writeRateLimit, async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { contestId } = req.params;
      const { picks: picksData, tiebreaker } = req.body;

      const [contestResult, existingEntryResult, configResult] = await Promise.all([
        supabaseAdmin.from('contests').select('id, status, scoring_json').eq('id', contestId).single(),
        supabaseAdmin.from('picks').select('id').eq('contest_id', contestId).eq('user_id', userId).maybeSingle(),
        gamificationService.getGamificationConfig(),
      ]);

      if (!contestResult.data) return res.status(404).json({ error: 'Contest not found' });
      if (existingEntryResult.data) return res.status(409).json({ error: 'Already entered this contest' });

      const config = configResult;

      const [, , totalEntriesResult] = await Promise.all([
        gamificationService.awardCrowns(userId, config?.entry_crowns_per_contest || 10, 'CONTEST_ENTRY', 'contest', contestId),
        gamificationService.recordWeeklyActivity(userId),
        supabaseAdmin.from('picks').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      ]);

      if ((totalEntriesResult.count || 0) === 0) {
        await gamificationService.awardCrowns(userId, config?.first_time_bonus || 50, 'FIRST_ENTRY_BONUS', 'user', userId);
      }

      const tiebreakerVal = tiebreaker != null ? parseInt(String(tiebreaker)) : null;
      const pickJsonData: Record<string, any> = { ...(picksData || {}) };
      if (tiebreakerVal != null && !isNaN(tiebreakerVal)) {
        pickJsonData._tiebreaker = tiebreakerVal;
      }

      await supabaseAdmin.from('picks').delete().eq('contest_id', contestId).eq('user_id', userId);
      const { error: insertError } = await supabaseAdmin.from('picks').insert({
        contest_id: contestId,
        user_id: userId,
        pick_json: pickJsonData,
      });
      if (insertError) {
        console.error('[Route] contest enter - picks insert error:', insertError);
      }

      const { count: newEntries } = await supabaseAdmin
        .from('picks')
        .select('*', { count: 'exact', head: true })
        .eq('contest_id', contestId);

      await Promise.all([
        gamificationService.evaluateStreak(userId),
        gamificationService.checkAndAwardBadges(userId),
        supabaseAdmin.from('contests').update({ entries: newEntries || 0 }).eq('id', contestId),
      ]);

      serverCache.invalidate('public:contests');

      res.json({ success: true, message: 'Picks submitted! You are entered.', entries: newEntries || 0 });
    } catch (err: any) {
      console.error('[Route] contest enter error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/contests/:contestId/picks', writeRateLimit, async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { contestId } = req.params;
      const { picks: picksData } = req.body;

      if (!picksData || typeof picksData !== 'object' || Object.keys(picksData).length === 0) {
        return res.status(400).json({ error: 'picks data is required' });
      }

      const { data: contest } = await supabaseAdmin
        .from('contests')
        .select('id')
        .eq('id', contestId)
        .single();

      if (!contest) return res.status(404).json({ error: 'Contest not found' });

      const { data: existingPick } = await supabaseAdmin
        .from('picks')
        .select('id, pick_json')
        .eq('contest_id', contestId)
        .eq('user_id', userId)
        .maybeSingle();

      const existingTiebreaker = existingPick?.pick_json?._tiebreaker;
      const pickJsonData: Record<string, any> = { ...picksData };
      if (existingTiebreaker != null) {
        pickJsonData._tiebreaker = existingTiebreaker;
      }

      await supabaseAdmin
        .from('picks')
        .delete()
        .eq('contest_id', contestId)
        .eq('user_id', userId);

      const { error } = await supabaseAdmin.from('picks').insert({
        contest_id: contestId,
        user_id: userId,
        pick_json: pickJsonData,
      });

      if (error) throw error;

      res.json({ success: true, message: 'Picks saved successfully' });
    } catch (err: any) {
      console.error('[Route] contest picks error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/contests/:contestId/my-picks', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { contestId } = req.params;

      const { data: pickRow, error } = await supabaseAdmin
        .from('picks')
        .select('pick_json')
        .eq('contest_id', contestId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!pickRow) {
        return res.json({ entered: false, picks: {}, tiebreaker: null });
      }

      const pickJson = pickRow.pick_json || {};
      const { _tiebreaker, ...picks } = pickJson;

      res.json({ entered: true, picks, tiebreaker: _tiebreaker ?? null });
    } catch (err: any) {
      console.error('[Route] my-picks error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/api/admin/contests/:contestId/picks', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { contestId } = req.params;
      const { error } = await supabaseAdmin.from('picks').delete().eq('contest_id', contestId);
      if (error) throw error;
      serverCache.invalidate('public:contests');
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Route] admin clear picks error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.get('/api/contests/:contestId/games', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { contestId } = req.params;

      const { data: contest } = await supabaseAdmin
        .from('contests')
        .select('scoring_json, contest_type')
        .eq('id', contestId)
        .single();

      if (!contest) return res.status(404).json({ error: 'Contest not found' });

      const games = contest.scoring_json?.games || [];
      const isOverUnder = contest.contest_type === 'over_under';

      if (isOverUnder) {
        let oddsMap: Record<string, any> = {};
        try {
          oddsMap = await fetchNBAOdds();
        } catch (e) {}

        const gamesWithOdds = games.map((g: any) => {
          const homeTeam = g.home_team_full || g.home_team || '';
          const awayTeam = g.away_team_full || g.away_team || '';
          const odds = findOddsForGame(oddsMap, homeTeam, awayTeam);
          return {
            ...g,
            over_under: odds ? odds.total : null,
            over_price: odds ? odds.over_price : null,
            under_price: odds ? odds.under_price : null,
          };
        });
        return res.json({ games: gamesWithOdds, contest_type: 'over_under' });
      }

      res.json({ games, contest_type: contest.contest_type });
    } catch (err: any) {
      console.error('[Route] contest games error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/api/admin/gamification/config', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      await gamificationService.updateGamificationConfig(req.body);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Route] admin config update error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/admin/contests/:contestId/grade', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { contestId } = req.params;
      const { grades } = req.body;

      if (!grades || !Array.isArray(grades)) {
        return res.status(400).json({ error: 'grades array is required' });
      }

      const { data: contest } = await supabaseAdmin
        .from('contests')
        .select('sport_id, season_id, elo_points_override')
        .eq('id', contestId)
        .single();

      const results: any[] = [];
      for (const grade of grades) {
        const { pick_id, is_correct, details } = grade;

        const { data: result } = await supabaseAdmin
          .from('pick_results')
          .upsert({
            pick_id,
            is_correct,
            graded_at: new Date().toISOString(),
            grade_details_json: details || null,
          }, { onConflict: 'pick_id' })
          .select()
          .single();

        results.push(result);

        if (contest?.sport_id && contest?.season_id) {
          const { data: pick } = await supabaseAdmin
            .from('picks')
            .select('user_id')
            .eq('id', pick_id)
            .single();

          if (pick) {
            await gamificationService.updateEloFromPickGrade(
              pick.user_id,
              contest.sport_id,
              contest.season_id,
              is_correct,
              contest.elo_points_override || undefined
            );
          }
        }
      }

      res.json({ success: true, results });
    } catch (err: any) {
      console.error('[Route] admin grade error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/admin/contests/:contestId/conclude', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { contestId } = req.params;

      await gamificationService.computeContestScores(contestId);

      await supabaseAdmin
        .from('contests')
        .update({ status: 'concluded' })
        .eq('id', contestId);

      const { data: scores } = await supabaseAdmin
        .from('contest_scores')
        .select('user_id')
        .eq('contest_id', contestId);

      if (scores) {
        for (const score of scores) {
          await gamificationService.checkAndAwardBadges(score.user_id);
        }
      }

      res.json({ success: true, message: 'Contest concluded and scores computed' });
    } catch (err: any) {
      console.error('[Route] admin conclude error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/admin/contests/:contestId/award-crowns', async (req, res) => {
    try {
      const adminUserId = await getUserFromToken(req.headers.authorization);
      if (!adminUserId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(adminUserId))) return res.status(403).json({ error: 'Forbidden' });

      const { contestId } = req.params;
      const { user_ids, amount, reason } = req.body;

      if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({ error: 'user_ids array is required' });
      }
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'amount must be a positive number' });
      }

      const results: { user_id: string; success: boolean; error?: string }[] = [];
      for (const uid of user_ids) {
        try {
          const result = await gamificationService.awardCrowns(
            uid, amount, 'CONTEST_PRIZE', 'contest', contestId,
            { reason: reason || `Contest prize for ${contestId}`, awarded_by: adminUserId }
          );
          results.push({ user_id: uid, success: result.success, error: result.error });
        } catch (e: any) {
          results.push({ user_id: uid, success: false, error: e.message });
        }
      }

      await gamificationService.createAuditEntry(adminUserId, 'award_contest_crowns', 'contest', contestId, null, {
        user_ids, amount, reason, results_summary: `${results.filter(r => r.success).length}/${results.length} succeeded`,
      });

      res.json({ success: true, results });
    } catch (err: any) {
      console.error('[Route] admin contest award-crowns error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.post('/api/admin/giveaways/:monthKey/lock', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const result = await gamificationService.lockGiveawayMonth(req.params.monthKey);
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error('[Route] admin giveaway lock error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.post('/api/admin/giveaways/:monthKey/draw', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { numWinners } = req.body;
      if (!numWinners || numWinners < 1) {
        return res.status(400).json({ error: 'numWinners is required and must be >= 1' });
      }

      const winners = await gamificationService.drawGiveawayWinners(req.params.monthKey, numWinners);
      res.json({ success: true, winners });
    } catch (err: any) {
      console.error('[Route] admin giveaway draw error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.get('/api/admin/elo/configs', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { data, error } = await supabaseAdmin
        .from('elo_config')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (err: any) {
      console.error('[Route] admin list elo configs error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/admin/elo/config', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { sport_id, season_id, thresholds_json, points_per_correct_pick_default_int, points_per_incorrect_pick_champion_int, visibility_json, contest_ids } = req.body;

      if (!sport_id || !season_id) {
        return res.status(400).json({ error: 'sport_id and season_id are required' });
      }

      const { data, error } = await supabaseAdmin
        .from('elo_config')
        .upsert({
          sport_id,
          season_id,
          thresholds_json: thresholds_json || { Bronze: 0, Silver: 500, Gold: 1500, Champion: 3000 },
          points_per_correct_pick_default_int: points_per_correct_pick_default_int || 25,
          points_per_incorrect_pick_champion_int: points_per_incorrect_pick_champion_int || -15,
          visibility_json: visibility_json || null,
          contest_ids: contest_ids || null,
        }, { onConflict: 'sport_id,season_id' })
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, config: data });
    } catch (err: any) {
      console.error('[Route] admin elo config error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/admin/badges', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { data, error } = await supabaseAdmin
        .from('badge_definitions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data || []);
    } catch (err: any) {
      console.error('[Route] admin badges list error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/admin/badges', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { code, name, description, type, icon_asset_ref, rules_json } = req.body;

      if (!code || !name) {
        return res.status(400).json({ error: 'code and name are required' });
      }

      const { data, error } = await supabaseAdmin
        .from('badge_definitions')
        .upsert({
          code,
          name,
          description: description || null,
          type: type || 'TROPHY_ONLY',
          icon_asset_ref: icon_asset_ref || null,
          rules_json: rules_json || null,
          is_active: true,
        }, { onConflict: 'code' })
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, badge: data });
    } catch (err: any) {
      console.error('[Route] admin badge create error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/admin/crown-ledger/:userId', async (req, res) => {
    try {
      const adminUserId = await getUserFromToken(req.headers.authorization);
      if (!adminUserId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(adminUserId))) return res.status(403).json({ error: 'Forbidden' });

      const limit = parseInt(req.query.limit as string) || 100;
      const ledger = await gamificationService.getCrownLedger(req.params.userId, limit);
      res.json(ledger);
    } catch (err: any) {
      console.error('[Route] admin crown ledger error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/me/summary', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const summary = await gamificationService.getUserSummary(userId);
      res.json(summary);
    } catch (err: any) {
      console.error('[Route] user summary error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/notifications', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const limit = parseInt(req.query.limit as string) || 50;
      const unreadOnly = req.query.unreadOnly === 'true';
      const notifications = await gamificationService.getUserNotifications(userId, limit, unreadOnly);
      res.json(notifications);
    } catch (err: any) {
      console.error('[Route] notifications error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/notifications/count', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const count = await gamificationService.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (err: any) {
      console.error('[Route] notifications count error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/notifications/read', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'ids array is required' });
      await gamificationService.markNotificationsRead(userId, ids);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Route] notifications read error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/api/notifications', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array is required' });
      const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('user_id', userId)
        .in('id', ids);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Route] delete notifications error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/activity-feed', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const userId = req.query.userId as string | undefined;
      const feed = await gamificationService.getActivityFeed(limit, userId);
      res.json(feed);
    } catch (err: any) {
      console.error('[Route] activity feed error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/leaderboards/contest/:id', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const leaderboard = await gamificationService.getContestLeaderboard(req.params.id, limit);
      res.json(leaderboard);
    } catch (err: any) {
      console.error('[Route] contest leaderboard error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/referral/generate', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const code = await gamificationService.generateReferralCode(userId);
      res.json({ success: true, code });
    } catch (err: any) {
      console.error('[Route] referral generate error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/referral/apply', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: 'code is required' });
      const result = await gamificationService.processReferral(userId, code);
      res.json(result);
    } catch (err: any) {
      console.error('[Route] referral apply error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/admin/audit-log', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const limit = parseInt(req.query.limit as string) || 100;
      const entityType = req.query.entityType as string | undefined;
      const entityId = req.query.entityId as string | undefined;
      const log = await gamificationService.getAuditLog(limit, entityType, entityId);
      res.json(log);
    } catch (err: any) {
      console.error('[Route] admin audit log error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/admin/fraud-flags', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const unresolvedOnly = req.query.unresolvedOnly !== 'false';
      const limit = parseInt(req.query.limit as string) || 100;
      const flags = await gamificationService.getFraudFlags(unresolvedOnly, limit);
      res.json(flags);
    } catch (err: any) {
      console.error('[Route] admin fraud flags error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/admin/fraud-flags/:id/resolve', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { note } = req.body;
      if (!note) return res.status(400).json({ error: 'note is required' });

      const { data: flag } = await supabaseAdmin
        .from('fraud_flags')
        .select('id')
        .eq('id', req.params.id)
        .single();
      if (!flag) return res.status(404).json({ error: 'Fraud flag not found' });

      await gamificationService.resolveFraudFlag(req.params.id, userId, note);
      await gamificationService.createAuditEntry(userId, 'resolve_fraud_flag', 'fraud_flag', req.params.id, null, { note });
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Route] admin fraud flag resolve error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/admin/rule-sets', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { data, error } = await supabaseAdmin
        .from('rule_sets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data || []);
    } catch (err: any) {
      console.error('[Route] admin rule sets error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/admin/rule-sets', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { scope_type, scope_id, rules_json } = req.body;
      if (!scope_type || !rules_json) return res.status(400).json({ error: 'scope_type and rules_json are required' });
      const { data, error } = await supabaseAdmin
        .from('rule_sets')
        .insert({
          scope_type,
          scope_id: scope_id || null,
          rules_json,
          is_active: false,
        })
        .select()
        .single();
      if (error) throw error;
      await gamificationService.createAuditEntry(userId, 'create_rule_set', 'rule_set', data.id, null, data);
      res.json({ success: true, ruleSet: data });
    } catch (err: any) {
      console.error('[Route] admin create rule set error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/api/admin/rule-sets/:id/activate', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { data: ruleSet } = await supabaseAdmin
        .from('rule_sets')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (!ruleSet) return res.status(404).json({ error: 'Rule set not found' });

      await supabaseAdmin
        .from('rule_sets')
        .update({ is_active: false })
        .eq('scope_type', ruleSet.scope_type)
        .eq('scope_id', ruleSet.scope_id || '');

      const { error } = await supabaseAdmin
        .from('rule_sets')
        .update({ is_active: true })
        .eq('id', req.params.id);

      if (error) throw error;
      await gamificationService.createAuditEntry(userId, 'activate_rule_set', 'rule_set', req.params.id, { is_active: false }, { is_active: true });
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Route] admin activate rule set error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ==================== Avatar Parts Catalog CRUD ====================

  router.get('/api/admin/avatar-parts', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { data, error } = await supabaseAdmin
        .from('avatar_parts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const enriched = (data || []).map((item: any) => ({
        ...item,
        unlock_condition_json: buildUnlockConditionJson(item),
      }));
      res.json(enriched);
    } catch (err: any) {
      console.error('[Route] admin avatar parts list error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.post('/api/admin/avatar-parts', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { name, category, image, price, rarity, unlock_condition_json } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });
      const { data, error } = await supabaseAdmin
        .from('avatar_parts')
        .insert({ name, category: category || null, image: image || null, price: price || 0, rarity: rarity || 'common', ...mapUnlockCondition(unlock_condition_json) })
        .select()
        .single();
      if (error) throw error;
      await gamificationService.createAuditEntry(userId, 'create_avatar_part', 'avatar_part', data.id, null, data);
      res.json({ success: true, avatarPart: data });
    } catch (err: any) {
      console.error('[Route] admin avatar part create error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.put('/api/admin/avatar-parts/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { data: existing } = await supabaseAdmin
        .from('avatar_parts')
        .select('*')
        .eq('id', req.params.id)
        .single();
      if (!existing) return res.status(404).json({ error: 'Avatar part not found' });
      const { unlock_condition_json, id, ...rest } = req.body;
      const updateData = { ...rest, ...mapUnlockCondition(unlock_condition_json) };
      delete updateData.unlock_condition_json;
      const { data, error } = await supabaseAdmin
        .from('avatar_parts')
        .update(updateData)
        .eq('id', req.params.id)
        .select()
        .single();
      if (error) throw error;
      await gamificationService.createAuditEntry(userId, 'update_avatar_part', 'avatar_part', req.params.id, existing, data);
      res.json({ success: true, avatarPart: data });
    } catch (err: any) {
      console.error('[Route] admin avatar part update error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.delete('/api/admin/avatar-parts/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { data: existing } = await supabaseAdmin
        .from('avatar_parts')
        .select('*')
        .eq('id', req.params.id)
        .single();
      if (!existing) return res.status(404).json({ error: 'Avatar part not found' });
      const { error } = await supabaseAdmin
        .from('avatar_parts')
        .delete()
        .eq('id', req.params.id);
      if (error) throw error;
      await gamificationService.createAuditEntry(userId, 'delete_avatar_part', 'avatar_part', req.params.id, existing, null);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Route] admin avatar part delete error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // ==================== Room Items Catalog CRUD ====================

  router.get('/api/admin/room-items', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { data, error } = await supabaseAdmin
        .from('room_items')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const enriched = (data || []).map((item: any) => ({
        ...item,
        unlock_condition_json: buildUnlockConditionJson(item),
      }));
      res.json(enriched);
    } catch (err: any) {
      console.error('[Route] admin room items list error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.post('/api/admin/room-items', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { name, category, image, price, rarity, unlock_condition_json, url, width, depth, z_height, placement_surface, is_stackable, wall_side } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });
      const { data, error } = await supabaseAdmin
        .from('room_items')
        .insert({
          name, category: category || null, image: image || null, price: price || 0,
          rarity: rarity || 'common', ...mapUnlockCondition(unlock_condition_json),
          url: url || null, width: width || null, depth: depth || null, z_height: z_height || null,
          placement_surface: placement_surface || null, is_stackable: is_stackable || false, wall_side: wall_side || null,
        })
        .select()
        .single();
      if (error) throw error;
      await gamificationService.createAuditEntry(userId, 'create_room_item', 'room_item', data.id, null, data);
      res.json({ success: true, roomItem: data });
    } catch (err: any) {
      console.error('[Route] admin room item create error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.put('/api/admin/room-items/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { data: existing } = await supabaseAdmin
        .from('room_items')
        .select('*')
        .eq('id', req.params.id)
        .single();
      if (!existing) return res.status(404).json({ error: 'Room item not found' });
      const { unlock_condition_json, id, ...rest } = req.body;
      const updateData = { ...rest, ...mapUnlockCondition(unlock_condition_json) };
      delete updateData.unlock_condition_json;
      const { data, error } = await supabaseAdmin
        .from('room_items')
        .update(updateData)
        .eq('id', req.params.id)
        .select()
        .single();
      if (error) throw error;
      await gamificationService.createAuditEntry(userId, 'update_room_item', 'room_item', req.params.id, existing, data);
      res.json({ success: true, roomItem: data });
    } catch (err: any) {
      console.error('[Route] admin room item update error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.delete('/api/admin/room-items/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { data: existing } = await supabaseAdmin
        .from('room_items')
        .select('*')
        .eq('id', req.params.id)
        .single();
      if (!existing) return res.status(404).json({ error: 'Room item not found' });
      const { error } = await supabaseAdmin
        .from('room_items')
        .delete()
        .eq('id', req.params.id);
      if (error) throw error;
      await gamificationService.createAuditEntry(userId, 'delete_room_item', 'room_item', req.params.id, existing, null);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Route] admin room item delete error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // ==================== Room Categories CRUD ====================

  router.get('/api/admin/room-categories', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { data, error } = await supabaseAdmin
        .from('room_categories')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      res.json(data || []);
    } catch (err: any) {
      console.error('[Route] admin room categories list error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.post('/api/admin/room-categories', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });
      const { data, error } = await supabaseAdmin
        .from('room_categories')
        .insert({ name })
        .select()
        .single();
      if (error) throw error;
      res.json({ success: true, category: data });
    } catch (err: any) {
      console.error('[Route] admin room category create error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.put('/api/admin/room-categories/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });
      const { data: existing } = await supabaseAdmin
        .from('room_categories')
        .select('*')
        .eq('id', req.params.id)
        .single();
      if (!existing) return res.status(404).json({ error: 'Category not found' });
      const { data, error } = await supabaseAdmin
        .from('room_categories')
        .update({ name })
        .eq('id', req.params.id)
        .select()
        .single();
      if (error) throw error;
      res.json({ success: true, category: data });
    } catch (err: any) {
      console.error('[Route] admin room category update error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.delete('/api/admin/room-categories/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { data: existing } = await supabaseAdmin
        .from('room_categories')
        .select('*')
        .eq('id', req.params.id)
        .single();
      if (!existing) return res.status(404).json({ error: 'Category not found' });
      const { error } = await supabaseAdmin
        .from('room_categories')
        .delete()
        .eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Route] admin room category delete error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // ==================== Badges Edit/Delete ====================

  router.put('/api/admin/badges/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { data: existing } = await supabaseAdmin
        .from('badge_definitions')
        .select('*')
        .eq('id', req.params.id)
        .single();
      if (!existing) return res.status(404).json({ error: 'Badge not found' });
      const { name, description, type, icon_asset_ref, rules_json, is_active } = req.body;
      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (type !== undefined) updateData.type = type;
      if (icon_asset_ref !== undefined) updateData.icon_asset_ref = icon_asset_ref;
      if (rules_json !== undefined) updateData.rules_json = rules_json;
      if (is_active !== undefined) updateData.is_active = is_active;
      const { data, error } = await supabaseAdmin
        .from('badge_definitions')
        .update(updateData)
        .eq('id', req.params.id)
        .select()
        .single();
      if (error) throw error;
      await gamificationService.createAuditEntry(userId, 'update_badge', 'badge', req.params.id, existing, data);
      res.json({ success: true, badge: data });
    } catch (err: any) {
      console.error('[Route] admin badge update error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.delete('/api/admin/badges/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { data: existing } = await supabaseAdmin
        .from('badge_definitions')
        .select('*')
        .eq('id', req.params.id)
        .single();
      if (!existing) return res.status(404).json({ error: 'Badge not found' });
      const { error } = await supabaseAdmin
        .from('badge_definitions')
        .update({ is_active: false })
        .eq('id', req.params.id);
      if (error) throw error;
      await gamificationService.createAuditEntry(userId, 'delete_badge', 'badge', req.params.id, existing, { is_active: false });
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Route] admin badge delete error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // ==================== Contests Admin CRUD ====================

  router.post('/api/admin/contests', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { title, sport_id, season_id, league, status, starts_at, ends_at, elo_points_override, game_ids, prize_pool, max_entries, sponsor, contest_type } = req.body;
      if (!title) return res.status(400).json({ error: 'title is required' });
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const safeSportId = sport_id && uuidRegex.test(sport_id) ? sport_id : null;
      const safeSeasonId = season_id && uuidRegex.test(season_id) ? season_id : null;
      const { data, error } = await supabaseAdmin
        .from('contests')
        .insert({
          title, sport_id: safeSportId, season_id: safeSeasonId,
          league: league || null, status: status || 'draft',
          opens_at: starts_at || new Date().toISOString(), ends_at: ends_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          elo_points_override: elo_points_override || null,
          scoring_json: game_ids ? { games: game_ids } : null,
          prize_pool: prize_pool || 0,
          max_entries: max_entries || 100,
          sponsor: sponsor || 'Fantasy Royale',
          contest_type: contest_type || 'nightly_slate',
        })
        .select()
        .single();
      if (error) throw error;
      await gamificationService.createAuditEntry(userId, 'create_contest', 'contest', data.id, null, data);
      serverCache.invalidate('public:contests');
      res.json({ success: true, contest: data });
    } catch (err: any) {
      console.error('[Route] admin contest create error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.put('/api/admin/contests/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { data: existing } = await supabaseAdmin
        .from('contests')
        .select('*')
        .eq('id', req.params.id)
        .single();
      if (!existing) return res.status(404).json({ error: 'Contest not found' });
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const updatePayload = { ...req.body };
      if (updatePayload.sport_id !== undefined && !uuidRegex.test(updatePayload.sport_id)) {
        updatePayload.sport_id = null;
      }
      if (updatePayload.season_id !== undefined && !uuidRegex.test(updatePayload.season_id)) {
        updatePayload.season_id = null;
      }
      if (updatePayload.game_ids !== undefined) {
        updatePayload.scoring_json = updatePayload.game_ids ? { games: updatePayload.game_ids } : null;
        delete updatePayload.game_ids;
      }
      if (updatePayload.starts_at !== undefined) {
        updatePayload.opens_at = updatePayload.starts_at;
        delete updatePayload.starts_at;
      }
      const { data, error } = await supabaseAdmin
        .from('contests')
        .update(updatePayload)
        .eq('id', req.params.id)
        .select()
        .single();
      if (error) throw error;
      await gamificationService.createAuditEntry(userId, 'update_contest', 'contest', req.params.id, existing, data);
      serverCache.invalidate('public:contests');
      res.json({ success: true, contest: data });
    } catch (err: any) {
      console.error('[Route] admin contest update error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.delete('/api/admin/contests/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { data: existing } = await supabaseAdmin
        .from('contests')
        .select('*')
        .eq('id', req.params.id)
        .single();
      if (!existing) return res.status(404).json({ error: 'Contest not found' });
      await supabaseAdmin.from('picks').delete().eq('contest_id', req.params.id);
      await supabaseAdmin.from('contest_scores').delete().eq('contest_id', req.params.id);
      const { error } = await supabaseAdmin
        .from('contests')
        .delete()
        .eq('id', req.params.id);
      if (error) throw error;
      await gamificationService.createAuditEntry(userId, 'delete_contest', 'contest', req.params.id, existing, null);
      serverCache.invalidate('public:contests');
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Route] admin contest delete error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // ==================== Rule Sets Edit/Delete ====================

  router.put('/api/admin/rule-sets/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { data: existing } = await supabaseAdmin
        .from('rule_sets')
        .select('*')
        .eq('id', req.params.id)
        .single();
      if (!existing) return res.status(404).json({ error: 'Rule set not found' });
      const { scope_type, scope_id, rules_json } = req.body;
      const updateData: Record<string, any> = {};
      if (scope_type !== undefined) updateData.scope_type = scope_type;
      if (scope_id !== undefined) updateData.scope_id = scope_id;
      if (rules_json !== undefined) updateData.rules_json = rules_json;
      const { data, error } = await supabaseAdmin
        .from('rule_sets')
        .update(updateData)
        .eq('id', req.params.id)
        .select()
        .single();
      if (error) throw error;
      await gamificationService.createAuditEntry(userId, 'update_rule_set', 'rule_set', req.params.id, existing, data);
      res.json({ success: true, ruleSet: data });
    } catch (err: any) {
      console.error('[Route] admin rule set update error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.delete('/api/admin/rule-sets/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { data: existing } = await supabaseAdmin
        .from('rule_sets')
        .select('*')
        .eq('id', req.params.id)
        .single();
      if (!existing) return res.status(404).json({ error: 'Rule set not found' });
      if (existing.is_active) return res.status(400).json({ error: 'Cannot delete an active rule set' });
      const { error } = await supabaseAdmin
        .from('rule_sets')
        .delete()
        .eq('id', req.params.id);
      if (error) throw error;
      await gamificationService.createAuditEntry(userId, 'delete_rule_set', 'rule_set', req.params.id, existing, null);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Route] admin rule set delete error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // ==================== Giveaway Listing ====================

  router.get('/api/admin/giveaways', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { data: months, error } = await supabaseAdmin
        .from('giveaway_months')
        .select('*')
        .order('month_key', { ascending: false });
      if (error) throw error;
      const results = [];
      for (const month of months || []) {
        const { count } = await supabaseAdmin
          .from('giveaway_winners')
          .select('*', { count: 'exact', head: true })
          .eq('giveaway_month_id', month.id);
        results.push({ ...month, winner_count: count || 0 });
      }
      res.json(results);
    } catch (err: any) {
      console.error('[Route] admin giveaways list error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // ==================== Referral Listing ====================

  router.get('/api/admin/referrals', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const { data, error } = await supabaseAdmin
        .from('referral_tracking')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data || []);
    } catch (err: any) {
      console.error('[Route] admin referrals list error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // ==================== User Management ====================

  router.get('/api/admin/users', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      const search = req.query.search as string | undefined;
      let query = supabaseAdmin
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;

      const userIds = (data || []).map((u: any) => u.id);
      let crownMap: Record<string, number> = {};
      if (userIds.length > 0) {
        const { data: crowns } = await supabaseAdmin
          .from('crown_balance_cache')
          .select('user_id, total_crowns_int')
          .in('user_id', userIds);
        for (const c of crowns || []) {
          crownMap[c.user_id] = c.total_crowns_int;
        }
      }

      let emailMap: Record<string, string> = {};
      try {
        const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        if (authData?.users) {
          for (const au of authData.users) {
            emailMap[au.id] = au.email || '';
          }
        }
      } catch (e) {
        console.warn('[Route] Could not fetch auth emails:', e);
      }

      let users = (data || []).map((u: any) => ({
        ...u,
        email: emailMap[u.id] || u.email || '',
        crown_balance: crownMap[u.id] || 0,
      }));

      if (search) {
        const searchLower = search.toLowerCase();
        users = users.filter((u: any) =>
          (u.username || '').toLowerCase().includes(searchLower) ||
          (u.email || '').toLowerCase().includes(searchLower)
        );
      }

      res.json(users);
    } catch (err: any) {
      console.error('[Route] admin users list error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.post('/api/admin/users/:userId/adjust-crowns', async (req, res) => {
    try {
      const adminUserId = await getUserFromToken(req.headers.authorization);
      if (!adminUserId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(adminUserId))) return res.status(403).json({ error: 'Forbidden' });
      const { amount, reason } = req.body;
      if (amount === undefined || amount === null) return res.status(400).json({ error: 'amount is required' });
      if (!reason) return res.status(400).json({ error: 'reason is required' });
      const result = await gamificationService.awardCrowns(
        req.params.userId,
        amount,
        'ADMIN_ADJUSTMENT',
        'admin',
        `adj_${Date.now()}`,
        { reason, adjusted_by: adminUserId }
      );
      if (!result.success) return res.status(400).json({ error: result.error || 'Failed to adjust crowns' });
      await gamificationService.createAuditEntry(adminUserId, 'adjust_crowns', 'user', req.params.userId, null, { amount, reason });
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Route] admin adjust crowns error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.put('/api/admin/users/:userId/ban', async (req, res) => {
    try {
      const adminUserId = await getUserFromToken(req.headers.authorization);
      if (!adminUserId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(adminUserId))) return res.status(403).json({ error: 'Forbidden' });
      const { error } = await supabaseAdmin
        .from('user_profiles')
        .update({ is_banned: true })
        .eq('id', req.params.userId);
      if (error) throw error;
      await gamificationService.createAuditEntry(adminUserId, 'ban_user', 'user', req.params.userId, { is_banned: false }, { is_banned: true });
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Route] admin ban user error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.put('/api/admin/users/:userId/unban', async (req, res) => {
    try {
      const adminUserId = await getUserFromToken(req.headers.authorization);
      if (!adminUserId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(adminUserId))) return res.status(403).json({ error: 'Forbidden' });
      const { error } = await supabaseAdmin
        .from('user_profiles')
        .update({ is_banned: false })
        .eq('id', req.params.userId);
      if (error) throw error;
      await gamificationService.createAuditEntry(adminUserId, 'unban_user', 'user', req.params.userId, { is_banned: true }, { is_banned: false });
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Route] admin unban user error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.put('/api/admin/users/:userId/toggle-admin', async (req, res) => {
    try {
      const adminUserId = await getUserFromToken(req.headers.authorization);
      if (!adminUserId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(adminUserId))) return res.status(403).json({ error: 'Forbidden' });
      const { data: targetUser } = await supabaseAdmin
        .from('user_profiles')
        .select('is_admin')
        .eq('id', req.params.userId)
        .single();
      if (!targetUser) return res.status(404).json({ error: 'User not found' });
      const newIsAdmin = !targetUser.is_admin;
      const { error } = await supabaseAdmin
        .from('user_profiles')
        .update({ is_admin: newIsAdmin })
        .eq('id', req.params.userId);
      if (error) throw error;
      await gamificationService.createAuditEntry(adminUserId, 'toggle_admin', 'user', req.params.userId, { is_admin: targetUser.is_admin }, { is_admin: newIsAdmin });
      res.json({ success: true, is_admin: newIsAdmin });
    } catch (err: any) {
      console.error('[Route] admin toggle admin error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.post('/api/admin/users', async (req, res) => {
    try {
      const adminUserId = await getUserFromToken(req.headers.authorization);
      if (!adminUserId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(adminUserId))) return res.status(403).json({ error: 'Forbidden' });
      const { email, password, username, is_admin: makeAdmin, role } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username: username || email.split('@')[0] }
      });
      if (authError) throw authError;
      const userId = authData.user.id;
      await new Promise(r => setTimeout(r, 500));
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
          id: userId,
          username: username || email.split('@')[0],
          is_admin: makeAdmin || false,
          role: role || 'user',
          crowns: 2450,
        }, { onConflict: 'id' });
      if (profileError) throw profileError;
      await gamificationService.createAuditEntry(adminUserId, 'create_user', 'user', userId, null, { email, username, is_admin: makeAdmin, role });
      res.json({ success: true, user: { id: userId, email, username: username || email.split('@')[0], is_admin: makeAdmin || false, role: role || 'user' } });
    } catch (err: any) {
      console.error('[Route] admin create user error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.put('/api/admin/users/:userId', async (req, res) => {
    try {
      const adminUserId = await getUserFromToken(req.headers.authorization);
      if (!adminUserId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(adminUserId))) return res.status(403).json({ error: 'Forbidden' });
      const { username, role, is_admin: newIsAdmin, email, password } = req.body;
      const { data: existing } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', req.params.userId)
        .single();
      if (!existing) return res.status(404).json({ error: 'User not found' });
      const profileUpdates: any = { updated_at: new Date().toISOString() };
      if (username !== undefined) profileUpdates.username = username;
      if (role !== undefined) profileUpdates.role = role;
      if (newIsAdmin !== undefined) profileUpdates.is_admin = newIsAdmin;
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .update(profileUpdates)
        .eq('id', req.params.userId);
      if (profileError) throw profileError;
      if (email || password) {
        const authUpdates: any = {};
        if (email) authUpdates.email = email;
        if (password) authUpdates.password = password;
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(req.params.userId, authUpdates);
        if (authError) throw authError;
      }
      await gamificationService.createAuditEntry(adminUserId, 'edit_user', 'user', req.params.userId, existing, profileUpdates);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Route] admin edit user error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.delete('/api/admin/users/:userId', async (req, res) => {
    try {
      const adminUserId = await getUserFromToken(req.headers.authorization);
      if (!adminUserId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(adminUserId))) return res.status(403).json({ error: 'Forbidden' });
      if (req.params.userId === adminUserId) return res.status(400).json({ error: 'Cannot delete yourself' });
      const { data: existing } = await supabaseAdmin
        .from('user_profiles')
        .select('username, is_admin')
        .eq('id', req.params.userId)
        .single();
      if (!existing) return res.status(404).json({ error: 'User not found' });
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .delete()
        .eq('id', req.params.userId);
      if (profileError) throw profileError;
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(req.params.userId);
      if (authError) console.error('[Route] Warning: auth user deletion failed:', authError.message);
      await gamificationService.createAuditEntry(adminUserId, 'delete_user', 'user', req.params.userId, existing, null);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Route] admin delete user error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // ==================== Catalog & Purchase Endpoints ====================

  router.get('/api/catalog/avatar-parts', async (_req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('avatar_parts')
        .select('*');
      if (error) throw error;
      const items = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        image: row.image_url,
        price: row.price,
        rarity: row.rarity,
        isDefault: row.is_default,
        unlockCondition: buildUnlockConditionJson(row),
        width: row.width,
        depth: row.depth,
        zHeight: row.z_height,
        placementSurface: row.placement_surface,
        isStackable: row.is_stackable,
        wallSide: row.wall_side,
        url: row.url,
      }));
      res.json(items);
    } catch (err: any) {
      console.error('[Route] catalog avatar-parts error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/catalog/room-items', async (_req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('room_items')
        .select('*');
      if (error) throw error;
      const items = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        image: row.image_url,
        price: row.price,
        rarity: row.rarity,
        isDefault: row.is_default,
        unlockCondition: buildUnlockConditionJson(row),
        width: row.width,
        depth: row.depth,
        zHeight: row.z_height,
        placementSurface: row.placement_surface,
        isStackable: row.is_stackable,
        wallSide: row.wall_side,
        url: row.url,
      }));
      res.json(items);
    } catch (err: any) {
      console.error('[Route] catalog room-items error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/catalog/room-categories', async (_req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('room_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      res.json(data || []);
    } catch (err: any) {
      console.error('[Route] catalog room-categories error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/gamification/purchase', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { itemType, itemId, price } = req.body;
      if (!itemType || !itemId || price == null) {
        return res.status(400).json({ error: 'itemType, itemId, and price are required' });
      }
      if (itemType !== 'avatar_part' && itemType !== 'room_item') {
        return res.status(400).json({ error: 'itemType must be avatar_part or room_item' });
      }

      const balance = await gamificationService.getCrownBalance(userId);
      if (balance.total < price) {
        return res.status(400).json({ error: 'Insufficient crown balance' });
      }

      await gamificationService.awardCrowns(userId, -price, 'PURCHASE', itemType, itemId);

      const { data: configRow } = await supabaseAdmin
        .from('user_avatar_configs')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (itemType === 'avatar_part') {
        const ownedParts: string[] = configRow?.owned_avatar_parts || [];
        if (!ownedParts.includes(itemId)) {
          ownedParts.push(itemId);
        }
        await supabaseAdmin
          .from('user_avatar_configs')
          .upsert({
            user_id: userId,
            owned_avatar_parts: ownedParts,
            owned_room_items: configRow?.owned_room_items || [],
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
      } else {
        const ownedItems: string[] = configRow?.owned_room_items || [];
        if (!ownedItems.includes(itemId)) {
          ownedItems.push(itemId);
        }
        await supabaseAdmin
          .from('user_avatar_configs')
          .upsert({
            user_id: userId,
            owned_room_items: ownedItems,
            owned_avatar_parts: configRow?.owned_avatar_parts || [],
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
      }

      const newBalance = await gamificationService.getCrownBalance(userId);
      res.json({ success: true, newBalance: newBalance.total });
    } catch (err: any) {
      console.error('[Route] purchase error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/me/unlock-status', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const [badgesResult, eloResult, giveawayResult, referralResult, contestsResult] = await Promise.all([
        supabaseAdmin
          .from('badge_awards')
          .select('badge_id')
          .eq('user_id', userId),
        supabaseAdmin
          .from('user_sport_elo')
          .select('sport_id, season_id, current_elo_int, current_tier')
          .eq('user_id', userId),
        supabaseAdmin
          .from('giveaway_winners_v2')
          .select('giveaway_id')
          .eq('user_id', userId),
        supabaseAdmin
          .from('referral_tracking')
          .select('*', { count: 'exact', head: true })
          .eq('referrer_user_id', userId)
          .eq('status', 'completed'),
        supabaseAdmin
          .from('picks')
          .select('contest_id')
          .eq('user_id', userId),
      ]);

      const badges = (badgesResult.data || []).map((r: any) => r.badge_id);
      const elo = (eloResult.data || []).map((r: any) => ({
        sport_id: r.sport_id,
        season_id: r.season_id,
        current_elo_int: r.current_elo_int,
        current_tier: r.current_tier,
      }));
      const giveawayWins = (giveawayResult.data || []).map((r: any) => r.giveaway_id);
      const referralCount = referralResult.count || 0;
      const contestsEntered = [...new Set((contestsResult.data || []).map((r: any) => r.contest_id))];

      res.json({ badges, elo, giveawayWins, referralCount, contestsEntered });
    } catch (err: any) {
      console.error('[Route] unlock-status error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ==================== Player Data Sync ====================
  
  router.get('/api/me/avatar-config', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { data, error } = await supabaseAdmin
        .from('user_avatar_configs')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (error && error.code === 'PGRST116') {
        return res.json({ user_id: userId, avatar: {}, owned_avatar_parts: [], owned_room_items: [], contests_entered: [] });
      }
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      console.error('[Route] get avatar config error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/api/me/avatar-config', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { avatar, owned_avatar_parts, owned_room_items, contests_entered } = req.body;
      const payload: any = { user_id: userId, updated_at: new Date().toISOString() };
      if (avatar !== undefined) payload.avatar = avatar;
      if (owned_avatar_parts !== undefined) payload.owned_avatar_parts = owned_avatar_parts;
      if (owned_room_items !== undefined) payload.owned_room_items = owned_room_items;
      if (contests_entered !== undefined) payload.contests_entered = contests_entered;
      const { data, error } = await supabaseAdmin
        .from('user_avatar_configs')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      console.error('[Route] put avatar config error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/me/profile', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const [profileResult, authResult, crownResult, activityResult, contestsResult, badgeCountResult] = await Promise.all([
        supabaseAdmin.from('user_profiles').select('*').eq('id', userId).single(),
        supabaseAdmin.auth.admin.getUserById(userId),
        supabaseAdmin.from('crown_balance_cache').select('total_crowns_int').eq('user_id', userId).single(),
        supabaseAdmin.from('user_weekly_activity').select('week_key').eq('user_id', userId).order('week_key', { ascending: false }),
        supabaseAdmin.from('picks').select('contest_id', { count: 'exact', head: false }).eq('user_id', userId),
        supabaseAdmin.from('badge_awards').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      ]);

      const authUser = authResult.data?.user;
      let data = profileResult.data;

      if (!data) {
        const newUsername = authUser?.user_metadata?.username || authUser?.email?.split('@')[0] || 'Player';
        const { data: newProfile, error: createErr } = await supabaseAdmin
          .from('user_profiles')
          .upsert({
            id: userId,
            username: newUsername,
            role: 'user',
            is_admin: false,
            is_banned: false,
            crowns: 0,
            member_since: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' })
          .select('*')
          .single();
        if (createErr || !newProfile) {
          console.error('[Route] auto-provision profile error:', createErr);
          return res.status(500).json({ error: 'Failed to create profile' });
        }
        data = newProfile;
      }

      const crowns = crownResult.data?.total_crowns_int ?? 0;

      const weeks = (activityResult.data || []).map((a: any) => a.week_key).sort().reverse();
      let currentStreak = 0;
      let bestStreak = 0;
      if (weeks.length > 0) {
        const now = new Date();
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
        const week1 = new Date(d.getFullYear(), 0, 4);
        const currentWeekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
        let checkWeek = `${d.getFullYear()}-W${String(currentWeekNum).padStart(2, '0')}`;

        for (const week of weeks) {
          if (week === checkWeek) {
            currentStreak++;
            const [y, w] = checkWeek.split('-W').map(Number);
            const prevWeekNum = w - 1;
            checkWeek = prevWeekNum > 0
              ? `${y}-W${String(prevWeekNum).padStart(2, '0')}`
              : `${y - 1}-W52`;
          }
        }
        let tempStreak = 0;
        const allWeeksSorted = [...weeks].sort().reverse();
        for (let i = 0; i < allWeeksSorted.length; i++) {
          if (i === 0) { tempStreak = 1; continue; }
          const [y1, w1] = allWeeksSorted[i - 1].split('-W').map(Number);
          const [y2, w2] = allWeeksSorted[i].split('-W').map(Number);
          const expectedPrev = w1 - 1 > 0 ? `${y1}-W${String(w1 - 1).padStart(2, '0')}` : `${y1 - 1}-W52`;
          if (allWeeksSorted[i] === expectedPrev) {
            tempStreak++;
          } else {
            tempStreak = 1;
          }
          bestStreak = Math.max(bestStreak, tempStreak);
        }
        bestStreak = Math.max(bestStreak, currentStreak);
      }

      const uniqueContests = new Set((contestsResult.data || []).map((p: any) => p.contest_id));
      const contestsEntered = uniqueContests.size;

      let wins = 0;
      if (uniqueContests.size > 0) {
        const { count } = await supabaseAdmin
          .from('contest_scores')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('rank_int', 1);
        wins = count || 0;
      }

      const displayName = data.username || authUser?.email?.split('@')[0] || 'Player';
      res.json({
        id: data.id,
        username: displayName,
        avatar: data.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6C63FF&color=fff&size=200&bold=true&format=png`,
        crowns,
        memberSince: data.member_since || data.created_at,
        contestsEntered,
        wins,
        currentStreak,
        bestStreak,
        badgeCount: badgeCountResult.count || 0,
        role: data.role || 'user',
        is_admin: data.is_admin || false,
      });
    } catch (err: any) {
      console.error('[Route] get profile error:', err);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  router.put('/api/me/profile', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { username } = req.body;
      if (!username || typeof username !== 'string' || !username.trim()) {
        return res.status(400).json({ error: 'Username is required' });
      }

      const trimmed = username.trim();
      if (trimmed.length < 2 || trimmed.length > 30) {
        return res.status(400).json({ error: 'Username must be 2-30 characters' });
      }

      const { error } = await supabaseAdmin
        .from('user_profiles')
        .update({ username: trimmed })
        .eq('id', userId);

      if (error) throw error;

      res.json({ success: true, username: trimmed });
    } catch (err: any) {
      console.error('[Route] update profile error:', err);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  router.post('/api/me/avatar-upload', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { type, base64, avatarUrl } = req.body;

      if (!type || (type !== 'photo' && type !== 'avatar')) {
        return res.status(400).json({ error: 'type must be "photo" or "avatar"' });
      }

      let finalAvatarUrl: string;

      if (type === 'photo') {
        if (!base64 || typeof base64 !== 'string') {
          return res.status(400).json({ error: 'base64 image data is required' });
        }

        let base64Data = base64;
        let contentType = 'image/jpeg';
        if (base64Data.startsWith('data:image')) {
          const match = base64Data.match(/^data:(image\/\w+);base64,/);
          if (match) contentType = match[1];
          base64Data = base64Data.split(',')[1];
        }

        const buffer = Buffer.from(base64Data, 'base64');

        const maxSize = 5 * 1024 * 1024;
        if (buffer.length > maxSize) {
          return res.status(400).json({ error: 'Image is too large. Please choose a smaller photo (max 5MB).' });
        }

        const ext = contentType === 'image/png' ? 'png' : 'jpg';
        const filePath = `${userId}/profile_${Date.now()}.${ext}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('avatars')
          .upload(filePath, buffer, {
            upsert: true,
            contentType,
          });

        if (uploadError) {
          console.error('[Route] Supabase storage upload error:', uploadError);
          if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
            return res.status(500).json({ error: 'Storage bucket not configured. Please contact support.' });
          }
          return res.status(500).json({ error: `Upload failed: ${uploadError.message}` });
        }

        const { data: publicUrlData } = supabaseAdmin.storage
          .from('avatars')
          .getPublicUrl(filePath);

        finalAvatarUrl = publicUrlData.publicUrl;
      } else {
        if (!avatarUrl || typeof avatarUrl !== 'string') {
          return res.status(400).json({ error: 'avatarUrl is required for type "avatar"' });
        }
        finalAvatarUrl = avatarUrl;
      }

      const { error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .update({ avatar_url: finalAvatarUrl })
        .eq('id', userId);

      if (updateError) {
        console.error('[Route] avatar profile update error:', updateError);
        return res.status(500).json({ error: `Failed to save avatar: ${updateError.message}` });
      }

      res.json({ success: true, avatar_url: finalAvatarUrl });
    } catch (err: any) {
      console.error('[Route] avatar upload error:', err?.message || err);
      res.status(500).json({ error: err?.message || 'Internal server error' });
    }
  });

  const defaultPreferences = {
    notif_contest_reminders: true, notif_contest_results: true,
    notif_giveaway_alerts: true, notif_badge_awards: true,
    notif_streak_reminders: true, notif_crown_updates: true,
    notif_social_activity: false, notif_marketing_emails: false,
    privacy_profile_public: true, privacy_show_contest_history: true,
    privacy_show_badges: true, privacy_show_streak: true,
    privacy_show_crown_status: false, privacy_show_in_leaderboards: true,
    privacy_allow_referrals: true,
  };

  router.get('/api/me/preferences', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { data, error } = await supabaseAdmin
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (error && (error.code === 'PGRST116' || error.code === '42501' || error.code === '42P01')) {
        return res.json(defaultPreferences);
      }
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      console.error('[Route] get preferences error:', err);
      res.json(defaultPreferences);
    }
  });

  router.put('/api/me/preferences', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const allowedFields = [
        'notif_contest_reminders', 'notif_contest_results', 'notif_giveaway_alerts',
        'notif_badge_awards', 'notif_streak_reminders', 'notif_crown_updates',
        'notif_live_game_updates', 'notif_social_activity', 'notif_marketing_emails',
        'privacy_profile_public', 'privacy_show_contest_history', 'privacy_show_badges',
        'privacy_show_streak', 'privacy_show_crown_status', 'privacy_show_in_leaderboards',
        'privacy_allow_referrals',
      ];
      const updates: Record<string, boolean> = {};
      for (const field of allowedFields) {
        if (typeof req.body[field] === 'boolean') updates[field] = req.body[field];
      }
      const { data: existing, error: selectError } = await supabaseAdmin
        .from('user_preferences')
        .select('id')
        .eq('user_id', userId)
        .single();
      if (selectError && (selectError.code === '42501' || selectError.code === '42P01')) {
        console.warn('[Route] user_preferences table not accessible — run SUPABASE_PREFERENCES_TABLE.sql in Supabase SQL Editor');
        return res.json({ success: true, warning: 'Preferences table not yet configured' });
      }
      if (existing) {
        const { error } = await supabaseAdmin
          .from('user_preferences')
          .update(updates)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabaseAdmin
          .from('user_preferences')
          .insert({ user_id: userId, ...updates });
        if (error) throw error;
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Route] update preferences error:', err);
      if (err?.code === '42501' || err?.code === '42P01') {
        return res.json({ success: true, warning: 'Preferences table not yet configured' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/me/push-token', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { push_token } = req.body;
      if (!push_token) return res.status(400).json({ error: 'push_token is required' });
      const { error } = await supabaseAdmin
        .from('user_profiles')
        .update({ push_token })
        .eq('id', userId);
      if (error) throw error;
      console.log(`[Push] Token saved for user ${userId}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Push] save token error:', err);
      res.status(500).json({ error: 'Failed to save push token' });
    }
  });

  router.delete('/api/me/push-token', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { error } = await supabaseAdmin
        .from('user_profiles')
        .update({ push_token: null })
        .eq('id', userId);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Push] remove token error:', err);
      res.status(500).json({ error: 'Failed to remove push token' });
    }
  });

  router.post('/api/admin/contests/:contestId/auto-grade', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { contestId } = req.params;
      const summary = await gamificationService.autoGradeContest(contestId);
      res.json({ success: true, ...summary });
    } catch (err: any) {
      console.error('[Route] auto-grade error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  async function fetchGameResults(games: any[]): Promise<any[]> {
    const apiKey = process.env.BALLDONTLIE_API_KEY || '';
    const results: any[] = [];

    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      const gameId = String(game.id);
      const league = (game.league || 'NBA').toUpperCase();

      if (i > 0) {
        await new Promise(r => setTimeout(r, 250));
      }

      try {
        const url = league === 'NCAAB'
          ? `https://api.balldontlie.io/ncaab/v1/games/${gameId}`
          : `https://api.balldontlie.io/v1/games/${gameId}`;

        const response = await fetch(url, {
          headers: { Authorization: apiKey },
        });

        if (!response.ok) {
          if (response.status === 429) {
            console.error(`[Results] Rate limited on game ${gameId}, waiting...`);
            await new Promise(r => setTimeout(r, 2000));
            const retryResponse = await fetch(url, { headers: { Authorization: apiKey } });
            if (!retryResponse.ok) {
              console.error(`[Results] Retry failed for game ${gameId}: ${retryResponse.status}`);
              results.push({ ...game });
              continue;
            }
            const retryJson = await retryResponse.json();
            const retryData = retryJson.data || retryJson;
            results.push(parseGameResult(game, retryData, league));
            continue;
          }
          console.error(`[Results] Failed to fetch game ${gameId}: ${response.status}`);
          results.push({ ...game });
          continue;
        }

        const jsonResponse = await response.json();
        const rawData = jsonResponse.data || jsonResponse;
        results.push(parseGameResult(game, rawData, league));
      } catch (err: any) {
        console.error(`[Results] Error fetching game ${gameId}:`, err.message);
        results.push({ ...game });
      }
    }

    return results;
  }

  function parseGameResult(game: any, rawData: any, league: string) {
    if (league === 'NCAAB') {
      const homeScore = rawData.home_score ?? 0;
      const awayScore = rawData.away_score ?? 0;
      const status = rawData.status || 'unknown';
      let winner: string | null = null;
      if (status === 'post' || status === 'Final') {
        winner = homeScore > awayScore
          ? (rawData.home_team?.abbreviation || game.home_team)
          : (rawData.visitor_team?.abbreviation || game.away_team);
      }
      return {
        ...game,
        home_team_score: homeScore,
        away_team_score: awayScore,
        status,
        winner,
        time: rawData.time || game.time || '',
      };
    } else {
      const homeScore = rawData.home_team_score ?? 0;
      const awayScore = rawData.visitor_team_score ?? 0;
      const status = rawData.status || 'unknown';
      let winner: string | null = null;
      if (status === 'Final') {
        winner = homeScore > awayScore
          ? (rawData.home_team?.abbreviation || game.home_team)
          : (rawData.visitor_team?.abbreviation || game.away_team);
      }
      return {
        ...game,
        home_team_score: homeScore,
        away_team_score: awayScore,
        status,
        winner,
        time: rawData.time || game.time || '',
      };
    }
  }

  router.get('/api/contests/:contestId/results', publicRateLimit, async (req, res) => {
    try {
      const { contestId } = req.params;

      const cacheKey = `public:contest-results:${contestId}`;
      const cached = serverCache.get<any[]>(cacheKey);
      if (cached) {
        if (req.headers['if-none-match'] === cached.etag) return res.status(304).end();
        res.setHeader('ETag', cached.etag);
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.json({ games: cached.data });
      }

      const { data: contest } = await supabaseAdmin
        .from('contests')
        .select('scoring_json')
        .eq('id', contestId)
        .single();

      if (!contest) return res.status(404).json({ error: 'Contest not found' });

      const games = contest.scoring_json?.games || [];
      if (games.length === 0) {
        return res.json({ games: [] });
      }

      const gamesWithResults = await fetchGameResults(games);

      const entry = serverCache.set(cacheKey, gamesWithResults);
      res.setHeader('ETag', entry.etag);
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json({ games: gamesWithResults });
    } catch (err: any) {
      console.error('[Route] contest results error:', err);
      res.status(500).json({ error: 'Failed to load contest results' });
    }
  });

  router.post('/api/admin/contests/refresh-results', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { data: contests, error } = await supabaseAdmin
        .from('contests')
        .select('id, scoring_json')
        .in('status', ['open', 'active']);

      if (error) throw error;
      if (!contests || contests.length === 0) {
        return res.json({ success: true, contestsUpdated: 0, gamesUpdated: 0 });
      }

      let totalGamesUpdated = 0;

      for (const contest of contests) {
        const games = contest.scoring_json?.games || [];
        if (games.length === 0) continue;

        const gamesWithResults = await fetchGameResults(games);
        totalGamesUpdated += gamesWithResults.length;

        const updatedScoringJson = { ...contest.scoring_json, games: gamesWithResults };
        await supabaseAdmin
          .from('contests')
          .update({ scoring_json: updatedScoringJson })
          .eq('id', contest.id);

        serverCache.invalidate(`public:contest-results:${contest.id}`);
      }

      serverCache.invalidate('public:contests');

      res.json({
        success: true,
        contestsUpdated: contests.length,
        gamesUpdated: totalGamesUpdated,
      });
    } catch (err: any) {
      console.error('[Route] admin refresh-results error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.post('/api/admin/contests/:contestId/full-conclude', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { contestId } = req.params;

      const gradingSummary = await gamificationService.autoGradeContest(contestId);

      await gamificationService.computeContestScores(contestId);

      await supabaseAdmin
        .from('contests')
        .update({ status: 'concluded' })
        .eq('id', contestId);

      const { data: scores } = await supabaseAdmin
        .from('contest_scores')
        .select('user_id')
        .eq('contest_id', contestId);

      const badgesAwarded: string[] = [];
      if (scores) {
        for (const score of scores) {
          const badges = await gamificationService.checkAndAwardBadges(score.user_id);
          badgesAwarded.push(...badges);
        }
      }

      await gamificationService.notifyContestResults(contestId);

      res.json({
        success: true,
        grading: gradingSummary,
        participants: scores?.length || 0,
        badgesAwarded,
        status: 'concluded',
      });
    } catch (err: any) {
      console.error('[Route] full-conclude error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.get('/api/contests/:contestId/entries', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { contestId } = req.params;

      const { data: entries, error } = await supabaseAdmin
        .from('picks')
        .select('id, user_id, pick_json, submitted_at')
        .eq('contest_id', contestId)
        .order('submitted_at', { ascending: true });

      if (error) throw error;
      if (!entries || entries.length === 0) return res.json([]);

      const userIds = entries.map((e: any) => e.user_id);
      const { data: profiles } = await supabaseAdmin
        .from('user_profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const enrichedEntries = entries.map((e: any) => {
        const profile = profileMap.get(e.user_id);
        const pickJson = e.pick_json || {};
        const { _tiebreaker, ...picks } = pickJson;
        return {
          id: e.id,
          user_id: e.user_id,
          username: profile?.username || 'Player',
          avatar_url: profile?.avatar_url || null,
          picks,
          tiebreaker_prediction: _tiebreaker ?? null,
          entered_at: e.submitted_at,
        };
      });

      res.json(enrichedEntries);
    } catch (err: any) {
      console.error('[Route] contest entries error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/contests/:contestId/standings', async (req, res) => {
    try {
      const { contestId } = req.params;

      const [scoresResult, contestResult] = await Promise.all([
        supabaseAdmin
          .from('contest_scores')
          .select('user_id, score_numeric, rank_int, tiebreaker_value')
          .eq('contest_id', contestId)
          .order('rank_int', { ascending: true }),
        supabaseAdmin
          .from('contests')
          .select('scoring_json')
          .eq('id', contestId)
          .single(),
      ]);

      const scores = scoresResult.data;
      if (scoresResult.error) throw scoresResult.error;
      if (!scores || scores.length === 0) return res.json([]);

      const userIds = scores.map((s: any) => s.user_id);
      const { data: profiles } = await supabaseAdmin
        .from('user_profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const games = contestResult.data?.scoring_json?.games || [];
      const totalGames = games.filter((g: any) => g.winner).length;

      const standings = scores.map((s: any) => {
        const profile = profileMap.get(s.user_id);
        return {
          user_id: s.user_id,
          username: profile?.username || 'Player',
          avatar_url: profile?.avatar_url || null,
          score: s.score_numeric,
          rank: s.rank_int,
          tiebreaker: s.tiebreaker_value,
          totalGames,
        };
      });

      res.json(standings);
    } catch (err: any) {
      console.error('[Route] standings error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/me/room-layout', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { data, error } = await supabaseAdmin
        .from('user_room_layouts')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (error && error.code === 'PGRST116') {
        return res.json({ user_id: userId, placed_items: [] });
      }
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      console.error('[Route] get room layout error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/api/me/room-layout', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { placed_items } = req.body;
      const { data, error } = await supabaseAdmin
        .from('user_room_layouts')
        .upsert({ user_id: userId, placed_items: placed_items || [], updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      console.error('[Route] put room layout error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ==================== Asset Image Upload ====================
  
  router.post('/api/admin/upload-image', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });
      
      const contentType = req.headers['content-type'] || '';
      if (!contentType.includes('application/octet-stream') && !contentType.includes('image/')) {
        return res.status(400).json({ error: 'Content-Type must be an image type or application/octet-stream' });
      }
      
      const filename = (req.headers['x-filename'] as string) || `asset_${Date.now()}.webp`;
      const folder = (req.headers['x-folder'] as string) || 'general';
      const filePath = `${folder}/${Date.now()}_${filename}`;
      
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', async () => {
        try {
          const fileBuffer = Buffer.concat(chunks);
          
          const { data, error } = await supabaseAdmin.storage
            .from('assets')
            .upload(filePath, fileBuffer, {
              contentType: contentType.includes('image/') ? contentType : 'image/webp',
              upsert: false,
            });
          
          if (error) throw error;
          
          const { data: urlData } = supabaseAdmin.storage
            .from('assets')
            .getPublicUrl(data.path);
          
          res.json({ url: urlData.publicUrl, path: data.path });
        } catch (uploadErr: any) {
          console.error('[Route] upload processing error:', uploadErr);
          res.status(500).json({ error: uploadErr.message || 'Upload failed' });
        }
      });
    } catch (err: any) {
      console.error('[Route] admin upload image error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // ==================== Giveaway V2 System ====================

  router.get('/api/admin/giveaways-v2', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { data, error } = await supabaseAdmin
        .from('giveaways')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enriched = [];
      for (const g of data || []) {
        const { count: entryCount } = await supabaseAdmin
          .from('giveaway_entries')
          .select('*', { count: 'exact', head: true })
          .eq('giveaway_id', g.id);

        const { data: uniqueUsers } = await supabaseAdmin
          .from('giveaway_entries')
          .select('user_id')
          .eq('giveaway_id', g.id);
        const uniqueUserCount = new Set((uniqueUsers || []).map((u: any) => u.user_id)).size;

        const { data: winners } = await supabaseAdmin
          .from('giveaway_winners_v2')
          .select('*')
          .eq('giveaway_id', g.id)
          .order('place', { ascending: true });

        const winnerUserIds = (winners || []).map((w: any) => w.user_id).filter(Boolean);
        let winnerProfileMap: Record<string, string> = {};
        if (winnerUserIds.length > 0) {
          const { data: profiles } = await supabaseAdmin
            .from('user_profiles')
            .select('id, display_name')
            .in('id', winnerUserIds);
          for (const p of profiles || []) {
            winnerProfileMap[p.id] = p.display_name || p.id;
          }
        }

        enriched.push({
          ...g,
          total_entries: entryCount || 0,
          unique_participants: uniqueUserCount,
          winners: (winners || []).map((w: any) => ({
            ...w,
            username: winnerProfileMap[w.user_id] || w.user_id,
          })),
        });
      }

      res.json(enriched);
    } catch (err: any) {
      console.error('[Route] admin giveaways-v2 list error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/admin/giveaways-v2/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { data: giveaway, error } = await supabaseAdmin
        .from('giveaways')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (error || !giveaway) return res.status(404).json({ error: 'Giveaway not found' });

      const { data: entries } = await supabaseAdmin
        .from('giveaway_entries')
        .select('*')
        .eq('giveaway_id', giveaway.id)
        .order('qualified_at', { ascending: false });

      const { data: winners } = await supabaseAdmin
        .from('giveaway_winners_v2')
        .select('*')
        .eq('giveaway_id', giveaway.id)
        .order('place', { ascending: true });

      const allUserIds = [
        ...new Set([
          ...(entries || []).map((e: any) => e.user_id),
          ...(winners || []).map((w: any) => w.user_id),
        ].filter(Boolean))
      ];
      let profileMap: Record<string, string> = {};
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from('user_profiles')
          .select('id, display_name')
          .in('id', allUserIds);
        for (const p of profiles || []) {
          profileMap[p.id] = p.display_name || p.id;
        }
      }

      const methodBreakdown: Record<string, { count: number; total_entries: number }> = {};
      for (const entry of entries || []) {
        if (!methodBreakdown[entry.entry_method]) {
          methodBreakdown[entry.entry_method] = { count: 0, total_entries: 0 };
        }
        methodBreakdown[entry.entry_method].count++;
        methodBreakdown[entry.entry_method].total_entries += entry.entries_count;
      }

      res.json({
        ...giveaway,
        entries: (entries || []).map((e: any) => ({
          ...e,
          username: profileMap[e.user_id] || e.user_id,
        })),
        winners: (winners || []).map((w: any) => ({
          ...w,
          username: profileMap[w.user_id] || w.user_id,
        })),
        method_breakdown: methodBreakdown,
        unique_participants: new Set((entries || []).map((e: any) => e.user_id)).size,
        total_entries: (entries || []).reduce((sum: number, e: any) => sum + e.entries_count, 0),
      });
    } catch (err: any) {
      console.error('[Route] admin giveaway-v2 detail error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/admin/giveaways-v2', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { title, description, prize_description, prize_value_cents, image_url, entry_methods, max_entries_per_user, max_winners, starts_at, ends_at } = req.body;

      if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

      const { data, error } = await supabaseAdmin
        .from('giveaways')
        .insert({
          title: title.trim(),
          description: description || null,
          prize_description: prize_description || null,
          prize_value_cents: prize_value_cents || null,
          image_url: image_url || null,
          entry_methods: entry_methods || [],
          max_entries_per_user: max_entries_per_user || 1,
          max_winners: max_winners || 1,
          starts_at: starts_at || null,
          ends_at: ends_at || null,
          created_by: userId,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;

      await gamificationService.createAuditEntry(userId, 'giveaway_created', 'giveaways', data.id, null, data);
      res.json(data);
    } catch (err: any) {
      console.error('[Route] admin create giveaway-v2 error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/api/admin/giveaways-v2/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { title, description, prize_description, prize_value_cents, image_url, entry_methods, max_entries_per_user, max_winners, starts_at, ends_at, status } = req.body;

      const updates: any = { updated_at: new Date().toISOString() };
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (prize_description !== undefined) updates.prize_description = prize_description;
      if (prize_value_cents !== undefined) updates.prize_value_cents = prize_value_cents;
      if (image_url !== undefined) updates.image_url = image_url;
      if (entry_methods !== undefined) updates.entry_methods = entry_methods;
      if (max_entries_per_user !== undefined) updates.max_entries_per_user = max_entries_per_user;
      if (max_winners !== undefined) updates.max_winners = max_winners;
      if (starts_at !== undefined) updates.starts_at = starts_at;
      if (ends_at !== undefined) updates.ends_at = ends_at;
      if (status !== undefined) updates.status = status;

      const { data, error } = await supabaseAdmin
        .from('giveaways')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;

      await gamificationService.createAuditEntry(userId, 'giveaway_updated', 'giveaways', req.params.id, null, updates);
      res.json(data);
    } catch (err: any) {
      console.error('[Route] admin update giveaway-v2 error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/api/admin/giveaways-v2/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { error } = await supabaseAdmin
        .from('giveaways')
        .delete()
        .eq('id', req.params.id);

      if (error) throw error;

      await gamificationService.createAuditEntry(userId, 'giveaway_deleted', 'giveaways', req.params.id, null, null);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Route] admin delete giveaway-v2 error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/admin/giveaways-v2/:id/open', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { data, error } = await supabaseAdmin
        .from('giveaways')
        .update({ status: 'open', updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;
      await gamificationService.createAuditEntry(userId, 'giveaway_opened', 'giveaways', req.params.id, null, null);
      res.json(data);
    } catch (err: any) {
      console.error('[Route] admin open giveaway-v2 error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/admin/giveaways-v2/:id/evaluate', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { data: giveaway } = await supabaseAdmin
        .from('giveaways')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (!giveaway) return res.status(404).json({ error: 'Giveaway not found' });
      if (!['open', 'locked'].includes(giveaway.status)) {
        return res.status(400).json({ error: 'Giveaway must be open or locked to evaluate eligibility' });
      }

      const entryMethods = giveaway.entry_methods || [];
      let totalNewEntries = 0;
      const methodResults: Record<string, number> = {};

      for (const method of entryMethods) {
        const qualifiedUsers = await evaluateEntryMethod(method, giveaway);
        methodResults[method.type] = qualifiedUsers.length;

        for (const qu of qualifiedUsers) {
          const { error: upsertError } = await supabaseAdmin
            .from('giveaway_entries')
            .upsert({
              giveaway_id: giveaway.id,
              user_id: qu.user_id,
              entry_method: method.type,
              entries_count: method.entries_awarded || 1,
              metadata: qu.metadata || null,
            }, { onConflict: 'giveaway_id,user_id,entry_method' });

          if (!upsertError) totalNewEntries++;
        }
      }

      const { count } = await supabaseAdmin
        .from('giveaway_entries')
        .select('*', { count: 'exact', head: true })
        .eq('giveaway_id', giveaway.id);

      await gamificationService.createAuditEntry(userId, 'giveaway_evaluated', 'giveaways', giveaway.id, null, { methodResults, totalNewEntries });

      res.json({
        success: true,
        method_results: methodResults,
        new_entries_processed: totalNewEntries,
        total_entries: count || 0,
      });
    } catch (err: any) {
      console.error('[Route] admin evaluate giveaway-v2 error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  router.post('/api/admin/giveaways-v2/:id/lock', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { data: giveaway } = await supabaseAdmin
        .from('giveaways')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (!giveaway) return res.status(404).json({ error: 'Giveaway not found' });
      if (giveaway.status !== 'open') return res.status(400).json({ error: 'Giveaway must be open to lock' });

      const entryMethods = giveaway.entry_methods || [];
      for (const method of entryMethods) {
        const qualifiedUsers = await evaluateEntryMethod(method, giveaway);
        for (const qu of qualifiedUsers) {
          await supabaseAdmin
            .from('giveaway_entries')
            .upsert({
              giveaway_id: giveaway.id,
              user_id: qu.user_id,
              entry_method: method.type,
              entries_count: method.entries_awarded || 1,
              metadata: qu.metadata || null,
            }, { onConflict: 'giveaway_id,user_id,entry_method' });
        }
      }

      const { data, error } = await supabaseAdmin
        .from('giveaways')
        .update({ status: 'locked', locked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;

      const { count } = await supabaseAdmin
        .from('giveaway_entries')
        .select('*', { count: 'exact', head: true })
        .eq('giveaway_id', giveaway.id);

      await gamificationService.createAuditEntry(userId, 'giveaway_locked', 'giveaways', req.params.id, null, { total_entries: count });
      res.json({ ...data, total_entries: count });
    } catch (err: any) {
      console.error('[Route] admin lock giveaway-v2 error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/admin/giveaways-v2/:id/draw', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { data: giveaway } = await supabaseAdmin
        .from('giveaways')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (!giveaway) return res.status(404).json({ error: 'Giveaway not found' });
      if (giveaway.status !== 'locked') return res.status(400).json({ error: 'Giveaway must be locked before drawing' });

      const numWinners = req.body.num_winners || giveaway.max_winners || 1;

      const { data: entries } = await supabaseAdmin
        .from('giveaway_entries')
        .select('user_id, entries_count')
        .eq('giveaway_id', giveaway.id);

      if (!entries || entries.length === 0) {
        return res.status(400).json({ error: 'No entries to draw from' });
      }

      const pool: string[] = [];
      for (const entry of entries) {
        for (let i = 0; i < entry.entries_count; i++) {
          pool.push(entry.user_id);
        }
      }

      const winners: string[] = [];
      const selectedSet = new Set<string>();

      for (let i = 0; i < numWinners && pool.length > 0; i++) {
        let attempts = 0;
        while (attempts < pool.length * 2) {
          const idx = Math.floor(Math.random() * pool.length);
          const candidate = pool[idx];
          if (!selectedSet.has(candidate)) {
            selectedSet.add(candidate);
            winners.push(candidate);
            break;
          }
          attempts++;
        }
      }

      const winnerRecords: any[] = [];
      for (let i = 0; i < winners.length; i++) {
        const { data: record } = await supabaseAdmin
          .from('giveaway_winners_v2')
          .upsert({
            giveaway_id: giveaway.id,
            user_id: winners[i],
            place: i + 1,
          }, { onConflict: 'giveaway_id,user_id' })
          .select()
          .single();

        if (record) winnerRecords.push(record);

        try {
          await gamificationService.createNotification(
            winners[i], 'GIVEAWAY_WIN',
            `You won "${giveaway.title}"!`,
            giveaway.prize_description || 'Check your profile for details',
            { giveaway_id: giveaway.id }
          );
          await gamificationService.createActivityFeedEntry(
            winners[i], 'giveaway', giveaway.id, 'won_giveaway',
            { title: giveaway.title }
          );
        } catch (e) { /* silent */ }
      }

      await supabaseAdmin
        .from('giveaways')
        .update({ status: 'drawn', drawn_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', giveaway.id);

      await gamificationService.createAuditEntry(userId, 'giveaway_drawn', 'giveaways', giveaway.id, null, { winners: winners.length });
      res.json({ success: true, winners: winnerRecords });
    } catch (err: any) {
      console.error('[Route] admin draw giveaway-v2 error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/admin/giveaways-v2/:id/award', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { winner_id, prize_details } = req.body;

      const { data, error } = await supabaseAdmin
        .from('giveaway_winners_v2')
        .update({
          awarded: true,
          awarded_at: new Date().toISOString(),
          prize_details: prize_details || null,
        })
        .eq('giveaway_id', req.params.id)
        .eq('user_id', winner_id)
        .select()
        .single();

      if (error) throw error;

      const { data: allWinners } = await supabaseAdmin
        .from('giveaway_winners_v2')
        .select('awarded')
        .eq('giveaway_id', req.params.id);

      const allAwarded = (allWinners || []).every((w: any) => w.awarded);
      if (allAwarded) {
        await supabaseAdmin
          .from('giveaways')
          .update({ status: 'awarded', updated_at: new Date().toISOString() })
          .eq('id', req.params.id);
      }

      await gamificationService.createAuditEntry(userId, 'giveaway_winner_awarded', 'giveaway_winners_v2', data.id, null, { winner_id, prize_details });
      res.json(data);
    } catch (err: any) {
      console.error('[Route] admin award giveaway-v2 error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/admin/giveaways-v2/:id/cancel', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { data, error } = await supabaseAdmin
        .from('giveaways')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;
      await gamificationService.createAuditEntry(userId, 'giveaway_cancelled', 'giveaways', req.params.id, null, null);
      res.json(data);
    } catch (err: any) {
      console.error('[Route] admin cancel giveaway-v2 error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ==================== Eligibility Engine ====================

  async function evaluateEntryMethod(method: any, giveaway: any): Promise<{ user_id: string; metadata?: any }[]> {
    const config = method.config || {};
    const qualified: { user_id: string; metadata?: any }[] = [];

    switch (method.type) {
      case 'free': {
        const { data: allUsers } = await supabaseAdmin
          .from('user_profiles')
          .select('id')
          .eq('is_banned', false);
        for (const u of allUsers || []) {
          qualified.push({ user_id: u.id });
        }
        break;
      }

      case 'crown_threshold': {
        const minCrowns = config.min_crowns || 0;
        const { data: balances } = await supabaseAdmin
          .from('crown_balance_cache')
          .select('user_id, total_crowns_int')
          .gte('total_crowns_int', minCrowns);
        for (const b of balances || []) {
          qualified.push({ user_id: b.user_id, metadata: { crowns: b.total_crowns_int } });
        }
        break;
      }

      case 'contest_entry': {
        const contestId = config.contest_id;
        if (!contestId) break;
        const { data: entries } = await supabaseAdmin
          .from('picks')
          .select('user_id')
          .eq('contest_id', contestId);
        for (const e of entries || []) {
          qualified.push({ user_id: e.user_id, metadata: { contest_id: contestId } });
        }
        break;
      }

      case 'contest_placement': {
        const contestId = config.contest_id;
        const maxPlace = config.max_place || 10;
        if (!contestId) break;
        const { data: results } = await supabaseAdmin
          .from('contest_results')
          .select('user_id, rank_int')
          .eq('contest_id', contestId)
          .lte('rank_int', maxPlace)
          .order('rank_int', { ascending: true });
        for (const r of results || []) {
          qualified.push({ user_id: r.user_id, metadata: { contest_id: contestId, place: r.rank_int } });
        }
        break;
      }

      case 'referral': {
        const minReferrals = config.min_referrals || 1;
        const { data: referrals } = await supabaseAdmin
          .from('referral_tracking')
          .select('referrer_id')
          .eq('status', 'completed');

        const referralCounts: Record<string, number> = {};
        for (const r of referrals || []) {
          referralCounts[r.referrer_id] = (referralCounts[r.referrer_id] || 0) + 1;
        }
        for (const [uid, count] of Object.entries(referralCounts)) {
          if (count >= minReferrals) {
            qualified.push({ user_id: uid, metadata: { referral_count: count } });
          }
        }
        break;
      }

      case 'streak': {
        const minWeeks = config.min_weeks || 2;
        const { data: activities } = await supabaseAdmin
          .from('user_weekly_activity')
          .select('user_id, iso_week')
          .order('iso_week', { ascending: false });

        const userWeeks: Record<string, string[]> = {};
        for (const a of activities || []) {
          if (!userWeeks[a.user_id]) userWeeks[a.user_id] = [];
          userWeeks[a.user_id].push(a.iso_week);
        }

        for (const [uid, weeks] of Object.entries(userWeeks)) {
          const uniqueWeeks = [...new Set(weeks)].sort().reverse();
          let consecutiveCount = 1;
          for (let i = 1; i < uniqueWeeks.length; i++) {
            const [y1, w1] = uniqueWeeks[i - 1].split('-W').map(Number);
            const [y2, w2] = uniqueWeeks[i].split('-W').map(Number);
            if ((y1 === y2 && w1 - w2 === 1) || (y1 - y2 === 1 && w2 >= 52 && w1 === 1)) {
              consecutiveCount++;
            } else {
              break;
            }
          }
          if (consecutiveCount >= minWeeks) {
            qualified.push({ user_id: uid, metadata: { streak_weeks: consecutiveCount } });
          }
        }
        break;
      }

      case 'social_share': {
        const minShares = config.min_shares || 1;
        const { data: shares } = await supabaseAdmin
          .from('crown_shares')
          .select('user_id');

        const shareCounts: Record<string, number> = {};
        for (const s of shares || []) {
          shareCounts[s.user_id] = (shareCounts[s.user_id] || 0) + 1;
        }
        for (const [uid, count] of Object.entries(shareCounts)) {
          if (count >= minShares) {
            qualified.push({ user_id: uid, metadata: { share_count: count } });
          }
        }
        break;
      }

      case 'badge_holder': {
        const badgeCode = config.badge_code;
        if (!badgeCode) break;
        const { data: badgeDef } = await supabaseAdmin
          .from('badge_definitions')
          .select('id')
          .eq('code', badgeCode)
          .single();

        if (badgeDef) {
          const { data: holders } = await supabaseAdmin
            .from('user_badges')
            .select('user_id')
            .eq('badge_id', badgeDef.id);
          for (const h of holders || []) {
            qualified.push({ user_id: h.user_id, metadata: { badge_code: badgeCode } });
          }
        }
        break;
      }

      default:
        console.warn(`[Giveaway] Unknown entry method type: ${method.type}`);
    }

    return qualified;
  }

  router.delete('/api/admin/users/:userId/reset-data', async (req, res) => {
    try {
      const adminUserId = await getUserFromToken(req.headers.authorization);
      if (!adminUserId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(adminUserId))) return res.status(403).json({ error: 'Forbidden' });

      const { userId } = req.params;
      if (!userId) return res.status(400).json({ error: 'userId is required' });

      const tablesToClear = [
        'badge_awards',
        'crown_balance_cache',
        'crown_ledger',
        'crown_status',
        'streak_tracking',
        'picks',
        'contest_scores',
        'contest_results',
        'pick_results',
        'notifications',
        'giveaway_entries',
        'user_weekly_activity',
        'user_sport_elo',
        'user_avatar_configs',
        'user_room_layouts',
        'user_preferences',
        'referral_tracking',
        'fraud_flags',
        'activity_feed',
      ];

      const clearedTables: string[] = [];

      for (const table of tablesToClear) {
        try {
          const { error } = await supabaseAdmin
            .from(table)
            .delete()
            .eq('user_id', userId);
          if (!error) {
            clearedTables.push(table);
          }
        } catch {
          // table may not exist, skip
        }
      }

      res.json({ success: true, tablesCleared: clearedTables });
    } catch (err: any) {
      console.error('[Route] admin reset user data error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  if (process.env.BALLDONTLIE_API_KEY) {
    setInterval(async () => {
      try {
        console.log('[AutoRefresh] Starting scheduled results refresh...');
        const { data: contests, error } = await supabaseAdmin
          .from('contests')
          .select('id, scoring_json, title, ends_at')
          .in('status', ['open', 'active']);

        if (error) {
          console.error('[AutoRefresh] Error fetching contests:', error);
          return;
        }

        if (!contests || contests.length === 0) {
          console.log('[AutoRefresh] No open/active contests to refresh.');
          return;
        }

        let totalGamesUpdated = 0;
        const autoConcluded: string[] = [];

        for (const contest of contests) {
          const games = contest.scoring_json?.games || [];
          if (games.length === 0) continue;

          const gamesWithResults = await fetchGameResults(games);
          totalGamesUpdated += gamesWithResults.length;

          const updatedScoringJson = { ...contest.scoring_json, games: gamesWithResults };
          await supabaseAdmin
            .from('contests')
            .update({ scoring_json: updatedScoringJson })
            .eq('id', contest.id);

          serverCache.invalidate(`public:contest-results:${contest.id}`);

          const allGamesFinal = gamesWithResults.length > 0 && gamesWithResults.every((g: any) => {
            const s = (g.status || '').toLowerCase();
            return s === 'final' || s === 'post';
          });

          if (allGamesFinal) {
            try {
              console.log(`[AutoConclude] All games final for contest "${contest.title || contest.id}". Auto-concluding...`);

              const gradingSummary = await gamificationService.autoGradeContest(contest.id);
              console.log(`[AutoConclude] Graded contest ${contest.id}:`, gradingSummary);

              await gamificationService.computeContestScores(contest.id);

              await supabaseAdmin
                .from('contests')
                .update({ status: 'concluded' })
                .eq('id', contest.id);

              const { data: scores } = await supabaseAdmin
                .from('contest_scores')
                .select('user_id')
                .eq('contest_id', contest.id);

              if (scores) {
                for (const score of scores) {
                  await gamificationService.checkAndAwardBadges(score.user_id);
                }
              }

              try {
                await gamificationService.notifyContestResults(contest.id);
              } catch (notifyErr: any) {
                console.error(`[AutoConclude] Notification error for ${contest.id}:`, notifyErr.message);
              }

              autoConcluded.push(contest.title || contest.id);
              console.log(`[AutoConclude] Successfully concluded contest "${contest.title || contest.id}"`);
            } catch (concludeErr: any) {
              console.error(`[AutoConclude] Error concluding contest ${contest.id}:`, concludeErr.message);
            }
          }
        }

        serverCache.invalidate('public:contests');
        console.log(`[AutoRefresh] Refreshed ${contests.length} contests, ${totalGamesUpdated} games updated.${autoConcluded.length > 0 ? ` Auto-concluded: ${autoConcluded.join(', ')}` : ''}`);
      } catch (err: any) {
        console.error('[AutoRefresh] Scheduled refresh error:', err.message);
      }
    }, 15 * 60 * 1000);
    console.log('[AutoRefresh] Scheduled results refresh every 15 minutes.');
  }
}
