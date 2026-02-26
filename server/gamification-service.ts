import { supabaseAdmin } from './supabase-admin';
import { sendUserPushNotification } from './push-notifications';

function getWeekKey(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getStatusLevel(totalCrowns: number): string {
  if (totalCrowns >= 10001) return 'Royalty';
  if (totalCrowns >= 5001) return 'Duke';
  if (totalCrowns >= 2001) return 'Baron';
  if (totalCrowns >= 501) return 'Knight';
  return 'Squire';
}

function getTierFromElo(elo: number, thresholds: Record<string, number>): string {
  const sorted = Object.entries(thresholds).sort((a, b) => b[1] - a[1]);
  for (const [tier, threshold] of sorted) {
    if (elo >= threshold) return tier;
  }
  return 'Bronze';
}

const STATUS_RANK: Record<string, number> = {
  'Squire': 0,
  'Knight': 1,
  'Baron': 2,
  'Duke': 3,
  'Royalty': 4,
};

export class GamificationService {

  async awardCrowns(
    userId: string,
    amount: number,
    eventType: string,
    eventRefType: string,
    eventRefId: string,
    meta?: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabaseAdmin
        .from('crown_ledger')
        .insert({
          user_id: userId,
          event_type: eventType,
          event_ref_type: eventRefType,
          event_ref_id: eventRefId,
          amount_int: amount,
          meta_json: meta || null,
        });

      if (error) {
        if (error.code === '23505') {
          console.log(`[Crowns] Duplicate entry skipped: ${eventType}/${eventRefType}/${eventRefId} for user ${userId}`);
          return { success: true };
        }
        console.error(`[Crowns] Error awarding crowns:`, error);
        return { success: false, error: error.message };
      }

      console.log(`[Crowns] Awarded ${amount} crowns to ${userId} for ${eventType}`);
      await this.refreshCrownBalance(userId);
      await this.refreshCrownStatus(userId);
      try {
        await this.createNotification(userId, 'CROWN_AWARD', `+${amount} Crowns`, `Earned for: ${eventType}`, { amount, eventType, eventRefType, eventRefId });
        await this.createActivityFeedEntry(userId, 'crown', eventRefId, 'earned_crowns', { amount, eventType });
      } catch (e) { /* silent */ }
      return { success: true };
    } catch (err: any) {
      console.error(`[Crowns] Exception awarding crowns:`, err);
      return { success: false, error: err.message };
    }
  }

  async refreshCrownBalance(userId: string): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from('crown_ledger')
      .select('amount_int')
      .eq('user_id', userId);

    if (error) {
      console.error(`[Crowns] Error fetching ledger for balance:`, error);
      return 0;
    }

    const total = (data || []).reduce((sum: number, row: any) => sum + (row.amount_int || 0), 0);

    await supabaseAdmin
      .from('crown_balance_cache')
      .upsert({
        user_id: userId,
        total_crowns_int: total,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    return total;
  }

  async refreshCrownStatus(userId: string): Promise<string> {
    const { data: balanceRow } = await supabaseAdmin
      .from('crown_balance_cache')
      .select('total_crowns_int')
      .eq('user_id', userId)
      .single();

    const total = balanceRow?.total_crowns_int || 0;
    const newLevel = getStatusLevel(total);

    const { data: existingStatus } = await supabaseAdmin
      .from('crown_status')
      .select('status_level')
      .eq('user_id', userId)
      .single();

    const currentLevel = existingStatus?.status_level || 'Squire';
    const finalLevel = (STATUS_RANK[newLevel] || 0) >= (STATUS_RANK[currentLevel] || 0)
      ? newLevel
      : currentLevel;

    await supabaseAdmin
      .from('crown_status')
      .upsert({
        user_id: userId,
        status_level: finalLevel,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    return finalLevel;
  }

  async getCrownBalance(userId: string): Promise<{ total: number; status: string }> {
    const [balanceResult, statusResult] = await Promise.all([
      supabaseAdmin
        .from('crown_balance_cache')
        .select('total_crowns_int')
        .eq('user_id', userId)
        .single(),
      supabaseAdmin
        .from('crown_status')
        .select('status_level')
        .eq('user_id', userId)
        .single(),
    ]);

    return {
      total: balanceResult.data?.total_crowns_int || 0,
      status: statusResult.data?.status_level || 'Squire',
    };
  }

  async getCrownLedger(userId: string, limit: number = 50): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('crown_ledger')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`[Crowns] Error fetching ledger:`, error);
      return [];
    }
    return data || [];
  }

  async recordWeeklyActivity(userId: string): Promise<void> {
    const weekKey = getWeekKey();
    const { error } = await supabaseAdmin
      .from('user_weekly_activity')
      .upsert({
        user_id: userId,
        week_key: weekKey,
        has_entry: true,
      }, { onConflict: 'user_id,week_key', ignoreDuplicates: true });

    if (error && error.code !== '23505') {
      console.error(`[Streak] Error recording weekly activity:`, error);
    }
  }

  async evaluateStreak(userId: string): Promise<{ currentStreak: number; milestonesAwarded: string[] }> {
    const { data: activities } = await supabaseAdmin
      .from('user_weekly_activity')
      .select('week_key')
      .eq('user_id', userId)
      .order('week_key', { ascending: false });

    if (!activities || activities.length === 0) {
      return { currentStreak: 0, milestonesAwarded: [] };
    }

    const currentWeekKey = getWeekKey();
    let streak = 0;
    let checkKey = currentWeekKey;

    const activitySet = new Set(activities.map((a: any) => a.week_key));

    for (let i = 0; i < 200; i++) {
      if (activitySet.has(checkKey)) {
        streak++;
        checkKey = getPreviousWeekKey(checkKey);
      } else {
        if (i === 0) {
          const prevKey = getPreviousWeekKey(currentWeekKey);
          if (activitySet.has(prevKey)) {
            checkKey = prevKey;
            continue;
          }
        }
        break;
      }
    }

    const { data: existingStreak } = await supabaseAdmin
      .from('streak_tracking')
      .select('*')
      .eq('user_id', userId)
      .single();

    const bestStreak = Math.max(streak, existingStreak?.best_streak_int || 0);

    await supabaseAdmin
      .from('streak_tracking')
      .upsert({
        user_id: userId,
        current_streak_int: streak,
        best_streak_int: bestStreak,
        last_week_key: currentWeekKey,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    const milestonesAwarded: string[] = [];
    const milestones = [
      { weeks: 2, label: 'streak_2_week' },
      { weeks: 4, label: 'streak_4_week' },
      { weeks: 8, label: 'streak_8_week' },
    ];

    const config = await this.getGamificationConfig();

    for (const milestone of milestones) {
      if (streak >= milestone.weeks) {
        const crownAmount = milestone.weeks === 2
          ? (config?.streak_2_week || 50)
          : milestone.weeks === 4
            ? (config?.streak_4_week || 150)
            : (config?.streak_8_week || 400);

        const weekKey = getWeekKey();
        const result = await this.awardCrowns(
          userId,
          crownAmount,
          'WEEKLY_STREAK_BONUS',
          'streak_milestone',
          `${milestone.weeks}_${weekKey}`
        );

        if (result.success) {
          milestonesAwarded.push(milestone.label);
        }
      }
    }

    return { currentStreak: streak, milestonesAwarded };
  }

  async getStreak(userId: string): Promise<{ current: number; best: number }> {
    const { data: activities } = await supabaseAdmin
      .from('user_weekly_activity')
      .select('week_key')
      .eq('user_id', userId)
      .order('week_key', { ascending: false });

    const weeks = (activities || []).map((a: any) => a.week_key);
    if (weeks.length === 0) return { current: 0, best: 0 };

    const now = new Date();
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    const currentWeekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    let checkWeek = `${d.getFullYear()}-W${String(currentWeekNum).padStart(2, '0')}`;

    let current = 0;
    for (const week of weeks) {
      if (week === checkWeek) {
        current++;
        const [y, w] = checkWeek.split('-W').map(Number);
        checkWeek = w - 1 > 0
          ? `${y}-W${String(w - 1).padStart(2, '0')}`
          : `${y - 1}-W52`;
      }
    }

    let best = current;
    let tempStreak = 0;
    const sorted = [...weeks].sort().reverse();
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) { tempStreak = 1; continue; }
      const [y1, w1] = sorted[i - 1].split('-W').map(Number);
      const expectedPrev = w1 - 1 > 0 ? `${y1}-W${String(w1 - 1).padStart(2, '0')}` : `${y1 - 1}-W52`;
      tempStreak = sorted[i] === expectedPrev ? tempStreak + 1 : 1;
      best = Math.max(best, tempStreak);
    }

    return { current, best };
  }

  async updateEloFromPickGrade(
    userId: string,
    sportId: string,
    seasonId: string,
    isCorrect: boolean,
    contestOverridePoints?: number
  ): Promise<{ newElo: number; tier: string }> {
    let { data: eloRow } = await supabaseAdmin
      .from('user_sport_elo')
      .select('*')
      .eq('user_id', userId)
      .eq('sport_id', sportId)
      .eq('season_id', seasonId)
      .single();

    if (!eloRow) {
      const { data: newRow } = await supabaseAdmin
        .from('user_sport_elo')
        .insert({
          user_id: userId,
          sport_id: sportId,
          season_id: seasonId,
          current_elo_int: 0,
          current_tier: 'Bronze',
          champion_unlocked: false,
        })
        .select()
        .single();
      eloRow = newRow;
    }

    const { data: eloConfig } = await supabaseAdmin
      .from('elo_config')
      .select('*')
      .eq('sport_id', sportId)
      .eq('season_id', seasonId)
      .single();

    const thresholds: Record<string, number> = eloConfig?.thresholds_json || { Bronze: 0, Silver: 500, Gold: 1500, Champion: 3000 };
    const pointsPerCorrect = contestOverridePoints || eloConfig?.points_per_correct_pick_default_int || 25;
    const pointsPerIncorrectChampion = eloConfig?.points_per_incorrect_pick_champion_int || -15;
    const championThreshold = thresholds['Champion'] || 3000;

    let currentElo = eloRow?.current_elo_int || 0;
    let championUnlocked = eloRow?.champion_unlocked || false;
    let newElo = currentElo;

    if (currentElo >= championThreshold) {
      championUnlocked = true;
      if (isCorrect) {
        newElo = currentElo + pointsPerCorrect;
      } else {
        newElo = currentElo + pointsPerIncorrectChampion;
        if (newElo < championThreshold) {
          newElo = championThreshold;
        }
      }
    } else {
      if (isCorrect) {
        newElo = currentElo + pointsPerCorrect;
      }
    }

    const tier = getTierFromElo(newElo, thresholds);
    if (newElo >= championThreshold) {
      championUnlocked = true;
    }

    await supabaseAdmin
      .from('user_sport_elo')
      .update({
        current_elo_int: newElo,
        current_tier: tier,
        champion_unlocked: championUnlocked,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('sport_id', sportId)
      .eq('season_id', seasonId);

    console.log(`[ELO] Updated ${userId} in ${sportId}/${seasonId}: ${currentElo} -> ${newElo} (${tier})`);
    return { newElo, tier };
  }

  async getElo(
    userId: string,
    sportId: string,
    seasonId: string
  ): Promise<{ elo: number; tier: string; championUnlocked: boolean } | null> {
    const { data } = await supabaseAdmin
      .from('user_sport_elo')
      .select('current_elo_int, current_tier, champion_unlocked')
      .eq('user_id', userId)
      .eq('sport_id', sportId)
      .eq('season_id', seasonId)
      .single();

    if (!data) return null;
    return {
      elo: data.current_elo_int,
      tier: data.current_tier,
      championUnlocked: data.champion_unlocked,
    };
  }

  async getChampionLeaderboard(sportId: string, seasonId: string, limit: number = 50): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('user_sport_elo')
      .select('user_id, current_elo_int, current_tier')
      .eq('sport_id', sportId)
      .eq('season_id', seasonId)
      .eq('champion_unlocked', true)
      .order('current_elo_int', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`[ELO] Error fetching champion leaderboard:`, error);
      return [];
    }
    return data || [];
  }

  async computeContestScores(contestId: string): Promise<void> {
    const [entriesResult, contestResult] = await Promise.all([
      supabaseAdmin.from('picks').select('id, user_id, pick_json').eq('contest_id', contestId),
      supabaseAdmin.from('contests').select('scoring_json').eq('id', contestId).single(),
    ]);

    const entries = entriesResult.data;
    if (!entries || entries.length === 0) {
      console.log(`[Scores] No entries found for contest ${contestId}`);
      return;
    }

    const games = contestResult.data?.scoring_json?.games || [];

    const gameWinners = new Map<string, string>();
    let lastGameActualTotal: number | null = null;

    for (const game of games) {
      const gameId = String(game.id);
      if (game.winner) {
        gameWinners.set(gameId, game.winner);
      }
    }

    if (games.length > 0) {
      const lastGame = games[games.length - 1];
      const lastGameId = String(lastGame.id);
      const league = (lastGame.league || 'NBA').toUpperCase();
      try {
        const apiKey = process.env.BALLDONTLIE_API_KEY || '';
        const url = league === 'NCAAB'
          ? `https://api.balldontlie.io/ncaab/v1/games/${lastGameId}`
          : `https://api.balldontlie.io/v1/games/${lastGameId}`;
        const resp = await fetch(url, { headers: { Authorization: apiKey } });
        if (resp.ok) {
          const json = await resp.json();
          const rawData = json.data || json;
          if (league === 'NCAAB' && rawData.status === 'post') {
            lastGameActualTotal = (rawData.home_score ?? 0) + (rawData.away_score ?? 0);
            if (!gameWinners.has(lastGameId)) {
              const winner = (rawData.home_score ?? 0) > (rawData.away_score ?? 0) ? rawData.home_team?.abbreviation : rawData.visitor_team?.abbreviation;
              if (winner) gameWinners.set(lastGameId, winner);
            }
          } else if (rawData.status === 'Final') {
            lastGameActualTotal = (rawData.home_team_score ?? 0) + (rawData.visitor_team_score ?? 0);
            if (!gameWinners.has(lastGameId)) {
              const winner = (rawData.home_team_score ?? 0) > (rawData.visitor_team_score ?? 0) ? rawData.home_team?.abbreviation : rawData.visitor_team?.abbreviation;
              if (winner) gameWinners.set(lastGameId, winner);
            }
          }
        }
      } catch (err: any) {
        console.error(`[Scores] Error fetching last game for tiebreaker:`, err.message);
      }
    }

    if (gameWinners.size === 0 && games.length > 0) {
      const apiKey = process.env.BALLDONTLIE_API_KEY || '';
      for (const game of games) {
        const gameId = String(game.id);
        if (gameWinners.has(gameId)) continue;
        const league = (game.league || 'NBA').toUpperCase();
        try {
          const url = league === 'NCAAB'
            ? `https://api.balldontlie.io/ncaab/v1/games/${gameId}`
            : `https://api.balldontlie.io/v1/games/${gameId}`;
          const resp = await fetch(url, { headers: { Authorization: apiKey } });
          if (resp.ok) {
            const json = await resp.json();
            const rawData = json.data || json;
            if (league === 'NCAAB' && rawData.status === 'post') {
              const winner = (rawData.home_score ?? 0) > (rawData.away_score ?? 0) ? rawData.home_team?.abbreviation : rawData.visitor_team?.abbreviation;
              if (winner) gameWinners.set(gameId, winner);
            } else if (rawData.status === 'Final') {
              const winner = (rawData.home_team_score ?? 0) > (rawData.visitor_team_score ?? 0) ? rawData.home_team?.abbreviation : rawData.visitor_team?.abbreviation;
              if (winner) gameWinners.set(gameId, winner);
            }
          }
        } catch (err: any) {
          console.error(`[Scores] Error fetching game ${gameId}:`, err.message);
        }
      }
    }

    const userScores: { user_id: string; score: number; tiebreakerDiff: number }[] = [];
    for (const entry of entries) {
      const pickJson = entry.pick_json || {};
      let score = 0;
      for (const [gameId, actualWinner] of gameWinners) {
        const userPick = pickJson[gameId];
        if (userPick && userPick === actualWinner) score++;
      }
      const tb = pickJson._tiebreaker != null ? pickJson._tiebreaker : null;
      const tiebreakerDiff = (tb != null && lastGameActualTotal != null) ? Math.abs(tb - lastGameActualTotal) : 999999;
      userScores.push({ user_id: entry.user_id, score, tiebreakerDiff });
    }

    userScores.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.tiebreakerDiff - b.tiebreakerDiff;
    });

    let rank = 1;
    for (let i = 0; i < userScores.length; i++) {
      if (i > 0 && (userScores[i].score < userScores[i - 1].score || 
          (userScores[i].score === userScores[i - 1].score && userScores[i].tiebreakerDiff > userScores[i - 1].tiebreakerDiff))) {
        rank = i + 1;
      }

      const entryForUser = entries.find((e: any) => e.user_id === userScores[i].user_id);
      const entryPickJson = entryForUser?.pick_json || {};
      await supabaseAdmin
        .from('contest_scores')
        .upsert({
          contest_id: contestId,
          user_id: userScores[i].user_id,
          score_numeric: userScores[i].score,
          rank_int: rank,
          tiebreaker_value: entryPickJson._tiebreaker ?? null,
          computed_at: new Date().toISOString(),
        }, { onConflict: 'contest_id,user_id' });
    }

    console.log(`[Scores] Computed scores for contest ${contestId}: ${userScores.length} participants${lastGameActualTotal != null ? `, tiebreaker total: ${lastGameActualTotal}` : ''}`);

    await this.awardPlacementCrowns(contestId);
  }

  async awardPlacementCrowns(contestId: string): Promise<void> {
    const { data: scores } = await supabaseAdmin
      .from('contest_scores')
      .select('user_id, rank_int, score_numeric')
      .eq('contest_id', contestId)
      .order('rank_int', { ascending: true });

    if (!scores || scores.length === 0) return;

    const config = await this.getGamificationConfig();
    const totalParticipants = scores.length;
    const medianRank = Math.ceil(totalParticipants / 2);

    for (const score of scores) {
      let crownAmount = 0;
      let tier = '';

      if (score.rank_int === 1) {
        crownAmount = config?.placement_1st || 200;
        tier = '1st';
      } else if (score.rank_int <= Math.ceil(totalParticipants * 0.1)) {
        crownAmount = config?.placement_top10_pct || 100;
        tier = 'top10pct';
      } else if (score.rank_int <= medianRank) {
        crownAmount = config?.placement_beat_avg || 25;
        tier = 'beat_avg';
      }

      if (crownAmount > 0) {
        await this.awardCrowns(
          score.user_id,
          crownAmount,
          'CONTEST_PLACEMENT',
          'contest',
          `${contestId}_rank${score.rank_int}`
        );
      }
    }

    console.log(`[Crowns] Awarded placement crowns for contest ${contestId}`);
  }

  async checkAndAwardBadges(userId: string): Promise<string[]> {
    const { data: badges } = await supabaseAdmin
      .from('badge_definitions')
      .select('*')
      .eq('is_active', true);

    if (!badges || badges.length === 0) return [];

    const { data: existingAwards } = await supabaseAdmin
      .from('badge_awards')
      .select('badge_id')
      .eq('user_id', userId);

    const awardedBadgeIds = new Set((existingAwards || []).map((a: any) => a.badge_id));
    const newlyAwarded: string[] = [];

    for (const badge of badges) {
      if (awardedBadgeIds.has(badge.id)) continue;

      const rules = badge.rules_json;
      if (!rules) continue;

      let earned = false;

      switch (rules.trigger) {
        case 'contest_entry': {
          const { count } = await supabaseAdmin
            .from('picks')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
          if ((count || 0) >= (rules.threshold || 1)) earned = true;
          break;
        }
        case 'contest_win': {
          const { count } = await supabaseAdmin
            .from('contest_scores')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('rank_int', 1);
          if ((count || 0) >= (rules.threshold || 1)) earned = true;
          break;
        }
        case 'crown_status': {
          const { data: statusRow } = await supabaseAdmin
            .from('crown_status')
            .select('status_level')
            .eq('user_id', userId)
            .single();
          if (statusRow && (STATUS_RANK[statusRow.status_level] || 0) >= (STATUS_RANK[rules.required_status] || 0)) {
            earned = true;
          }
          break;
        }
        case 'streak': {
          const streak = await this.getStreak(userId);
          if (streak.best >= (rules.weeks || 0)) earned = true;
          break;
        }
        case 'elo_tier': {
          const { data: sportRow } = await supabaseAdmin
            .from('sports')
            .select('id')
            .eq('name', rules.sport)
            .single();
          if (sportRow) {
            const { data: eloRows } = await supabaseAdmin
              .from('user_sport_elo')
              .select('current_tier')
              .eq('user_id', userId)
              .eq('sport_id', sportRow.id);
            if (eloRows?.some((r: any) => r.current_tier === rules.required_tier)) {
              earned = true;
            }
          }
          break;
        }
        case 'giveaway_win': {
          const { count } = await supabaseAdmin
            .from('giveaway_winners')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
          if ((count || 0) > 0) earned = true;
          break;
        }
      }

      if (earned) {
        const { error } = await supabaseAdmin
          .from('badge_awards')
          .insert({
            user_id: userId,
            badge_id: badge.id,
            award_reason_json: { trigger: rules.trigger, auto: true },
          });

        if (!error) {
          newlyAwarded.push(badge.code);
          console.log(`[Badges] Awarded badge '${badge.code}' to ${userId}`);
          try {
            await this.createNotification(userId, 'BADGE_AWARD', `New Badge: ${badge.name}`, badge.description, { badgeCode: badge.code, badgeType: badge.type });
            await this.createActivityFeedEntry(userId, 'badge', badge.id, 'earned_badge', { badgeName: badge.name, badgeCode: badge.code });
          } catch (e) { /* silent */ }
        }
      }
    }

    return newlyAwarded;
  }

  async getUserBadges(userId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('badge_awards')
      .select('*, badge_definitions(*)')
      .eq('user_id', userId)
      .order('awarded_at', { ascending: false });

    if (error) {
      console.error(`[Badges] Error fetching user badges:`, error);
      return [];
    }
    return data || [];
  }

  async lockGiveawayMonth(monthKey: string): Promise<{ usersSnapshotted: number }> {
    const { data: month } = await supabaseAdmin
      .from('giveaway_months')
      .select('id')
      .eq('month_key', monthKey)
      .single();

    if (!month) {
      throw new Error(`Giveaway month '${monthKey}' not found`);
    }

    await supabaseAdmin
      .from('giveaway_months')
      .update({ status: 'locked' })
      .eq('month_key', monthKey);

    const { data: balances } = await supabaseAdmin
      .from('crown_balance_cache')
      .select('user_id, total_crowns_int')
      .gt('total_crowns_int', 0);

    let count = 0;
    for (const balance of balances || []) {
      const entries = Math.floor(balance.total_crowns_int / 100) || 1;
      const { error } = await supabaseAdmin
        .from('giveaway_snapshot')
        .upsert({
          giveaway_month_id: month.id,
          user_id: balance.user_id,
          crowns_at_lock_int: balance.total_crowns_int,
          entries_int: entries,
        }, { onConflict: 'giveaway_month_id,user_id' });

      if (!error) count++;
    }

    console.log(`[Giveaway] Locked month ${monthKey}: ${count} users snapshotted`);
    return { usersSnapshotted: count };
  }

  async drawGiveawayWinners(monthKey: string, numWinners: number): Promise<any[]> {
    const { data: month } = await supabaseAdmin
      .from('giveaway_months')
      .select('id')
      .eq('month_key', monthKey)
      .single();

    if (!month) {
      throw new Error(`Giveaway month '${monthKey}' not found`);
    }

    const { data: snapshots } = await supabaseAdmin
      .from('giveaway_snapshot')
      .select('user_id, entries_int')
      .eq('giveaway_month_id', month.id);

    if (!snapshots || snapshots.length === 0) {
      return [];
    }

    const pool: string[] = [];
    for (const snap of snapshots) {
      for (let i = 0; i < snap.entries_int; i++) {
        pool.push(snap.user_id);
      }
    }

    const winners: string[] = [];
    const selectedSet = new Set<string>();

    for (let i = 0; i < numWinners && pool.length > 0; i++) {
      let attempts = 0;
      while (attempts < pool.length) {
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
    for (const winnerId of winners) {
      const { data: record } = await supabaseAdmin
        .from('giveaway_winners')
        .insert({
          giveaway_month_id: month.id,
          user_id: winnerId,
        })
        .select()
        .single();

      if (record) winnerRecords.push(record);

      try {
        await this.createNotification(winnerId, 'GIVEAWAY_WIN', 'You Won the Monthly Giveaway!', 'Check your profile for details', { monthKey });
        await this.createActivityFeedEntry(winnerId, 'giveaway', month.id, 'won_giveaway', { monthKey });
      } catch (e) { /* silent */ }

      await this.checkAndAwardBadges(winnerId);
    }

    await supabaseAdmin
      .from('giveaway_months')
      .update({ status: 'drawn' })
      .eq('month_key', monthKey);

    console.log(`[Giveaway] Drew ${winners.length} winners for month ${monthKey}`);
    return winnerRecords;
  }

  async getGamificationConfig(): Promise<any> {
    const { data } = await supabaseAdmin
      .from('gamification_config')
      .select('*')
      .eq('id', 'global')
      .single();
    return data;
  }

  async updateGamificationConfig(updates: Record<string, any>): Promise<void> {
    const { error } = await supabaseAdmin
      .from('gamification_config')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', 'global');

    if (error) {
      console.error(`[Config] Error updating gamification config:`, error);
      throw error;
    }
    console.log(`[Config] Updated gamification config`);
  }

  async resolveRules(scopeType?: string, scopeId?: string): Promise<Record<string, any>> {
    try {
      const { data: globalRuleSet } = await supabaseAdmin
        .from('rule_sets')
        .select('rules_json')
        .eq('scope_type', 'GLOBAL')
        .eq('is_active', true)
        .single();

      let merged: Record<string, any> = globalRuleSet?.rules_json || {};

      if (scopeType && scopeId) {
        const { data: scopedRuleSet } = await supabaseAdmin
          .from('rule_sets')
          .select('rules_json')
          .eq('scope_type', scopeType)
          .eq('scope_id', scopeId)
          .eq('is_active', true)
          .single();

        if (scopedRuleSet?.rules_json) {
          merged = { ...merged, ...scopedRuleSet.rules_json };
        }
      }

      if (Object.keys(merged).length === 0) {
        const config = await this.getGamificationConfig();
        return config || {};
      }

      return merged;
    } catch (err: any) {
      console.error(`[Rules] Error resolving rules:`, err);
      const config = await this.getGamificationConfig();
      return config || {};
    }
  }

  async createNotification(userId: string, type: string, title: string, body?: string, meta?: Record<string, any>): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: userId,
          type,
          title,
          body: body || null,
          meta: meta || null,
        });
      if (error) {
        console.error(`[Notifications] Insert error for ${type}:`, error.message, error.code);
      }

      const categoryMap: Record<string, string> = {
        'CROWN_AWARD': 'crown_updates',
        'BADGE_AWARD': 'badge_awards',
        'CONTEST_RESULT': 'results',
        'GIVEAWAY_WIN': 'giveaway_alerts',
        'STREAK': 'streak_reminders',
        'REFERRAL_COMPLETE': 'social_activity',
        'REFERRAL_WELCOME': 'marketing',
      };
      const category = categoryMap[type] || 'marketing';
      try {
        await sendUserPushNotification(userId, title, body || '', category as any, meta);
      } catch (pushErr) {
        console.error(`[Push] Error sending push for ${type}:`, pushErr);
      }
    } catch (err: any) {
      console.error(`[Notifications] Error creating notification:`, err);
    }
  }

  async getUserNotifications(userId: string, limit: number = 50, unreadOnly: boolean = false): Promise<any[]> {
    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.is('read_at', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`[Notifications] Error fetching notifications:`, error);
      return [];
    }
    return data || [];
  }

  async markNotificationsRead(userId: string, notificationIds: string[]): Promise<void> {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .in('id', notificationIds);

    if (error) {
      console.error(`[Notifications] Error marking notifications read:`, error);
    }
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) {
      console.error(`[Notifications] Error counting unread:`, error);
      return 0;
    }
    return count || 0;
  }

  async createActivityFeedEntry(userId: string | null, entityType: string, entityId: string, verb: string, meta?: Record<string, any>): Promise<void> {
    try {
      await supabaseAdmin
        .from('activity_feed')
        .insert({
          user_id: userId,
          entity_type: entityType,
          entity_id: entityId,
          verb,
          meta: meta || null,
        });
    } catch (err: any) {
      console.error(`[ActivityFeed] Error creating entry:`, err);
    }
  }

  async getActivityFeed(limit: number = 50, userId?: string): Promise<any[]> {
    let query = supabaseAdmin
      .from('activity_feed')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`[ActivityFeed] Error fetching feed:`, error);
      return [];
    }
    return data || [];
  }

  async createAuditEntry(actorUserId: string, action: string, entityType: string, entityId: string, beforeJson?: any, afterJson?: any): Promise<void> {
    try {
      await supabaseAdmin
        .from('audit_log')
        .insert({
          actor_user_id: actorUserId,
          action,
          entity_type: entityType,
          entity_id: entityId,
          before_json: beforeJson || null,
          after_json: afterJson || null,
        });
    } catch (err: any) {
      console.error(`[Audit] Error creating audit entry:`, err);
    }
  }

  async getAuditLog(limit: number = 100, entityType?: string, entityId?: string): Promise<any[]> {
    let query = supabaseAdmin
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }
    if (entityId) {
      query = query.eq('entity_id', entityId);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`[Audit] Error fetching audit log:`, error);
      return [];
    }
    return data || [];
  }

  async createFraudFlag(userId: string, flagType: string, severity: number, meta?: Record<string, any>): Promise<void> {
    const { error } = await supabaseAdmin
      .from('fraud_flags')
      .insert({
        user_id: userId,
        flag_type: flagType,
        severity,
        meta: meta || null,
      });

    if (error) {
      console.error(`[Fraud] Error creating fraud flag:`, error);
      throw error;
    }
  }

  async getFraudFlags(unresolvedOnly: boolean = true, limit: number = 100): Promise<any[]> {
    let query = supabaseAdmin
      .from('fraud_flags')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unresolvedOnly) {
      query = query.is('resolved_at', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`[Fraud] Error fetching fraud flags:`, error);
      return [];
    }
    return data || [];
  }

  async resolveFraudFlag(flagId: string, resolvedBy: string, note: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('fraud_flags')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy,
        resolution_note: note,
      })
      .eq('id', flagId);

    if (error) {
      console.error(`[Fraud] Error resolving fraud flag:`, error);
      throw error;
    }
  }

  async generateReferralCode(userId: string): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const { error } = await supabaseAdmin
      .from('user_profiles')
      .update({ referral_code: code })
      .eq('id', userId);

    if (error) {
      console.error(`[Referral] Error generating referral code:`, error);
      throw error;
    }

    console.log(`[Referral] Generated code ${code} for user ${userId}`);
    return code;
  }

  async processReferral(referredUserId: string, referralCode: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: referrer } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('referral_code', referralCode)
        .single();

      if (!referrer) {
        return { success: false, error: 'Invalid referral code' };
      }

      if (referrer.id === referredUserId) {
        return { success: false, error: 'Cannot refer yourself' };
      }

      const { data: existing } = await supabaseAdmin
        .from('referral_tracking')
        .select('id')
        .eq('referred_user_id', referredUserId)
        .single();

      if (existing) {
        return { success: false, error: 'Already referred' };
      }

      const { error } = await supabaseAdmin
        .from('referral_tracking')
        .insert({
          referrer_user_id: referrer.id,
          referred_user_id: referredUserId,
          status: 'pending',
        });

      if (error) {
        console.error(`[Referral] Error creating referral tracking:`, error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      console.error(`[Referral] Exception processing referral:`, err);
      return { success: false, error: err.message };
    }
  }

  async completeReferral(referredUserId: string): Promise<void> {
    try {
      const { data: referral } = await supabaseAdmin
        .from('referral_tracking')
        .select('*')
        .eq('referred_user_id', referredUserId)
        .eq('status', 'pending')
        .single();

      if (!referral) return;

      const config = await this.getGamificationConfig();
      const referrerAmount = config?.referral_referrer_crowns || 100;
      const referredAmount = config?.referral_referred_crowns || 50;

      await this.awardCrowns(
        referral.referrer_user_id,
        referrerAmount,
        'REFERRAL_BONUS',
        'referral',
        referral.id
      );

      await this.awardCrowns(
        referredUserId,
        referredAmount,
        'REFERRAL_WELCOME',
        'referral',
        referral.id
      );

      await supabaseAdmin
        .from('referral_tracking')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', referral.id);

      try {
        await this.createNotification(referral.referrer_user_id, 'REFERRAL_COMPLETE', `+${referrerAmount} Crowns`, 'Your referral completed their first contest!', { referredUserId });
        await this.createNotification(referredUserId, 'REFERRAL_WELCOME', `+${referredAmount} Crowns`, 'Welcome bonus from your referral!', { referrerUserId: referral.referrer_user_id });
      } catch (e) { /* silent */ }

      console.log(`[Referral] Completed referral ${referral.id}`);
    } catch (err: any) {
      console.error(`[Referral] Error completing referral:`, err);
    }
  }

  async getUserSummary(userId: string): Promise<{
    crowns: { total: number; status: string };
    streak: { current: number; best: number; nextMilestone: number | null };
    giveaway: { monthKey: string; status: string; eligible: boolean; entries: number } | null;
    elo: Array<{ sportName: string; sportId: string; elo: number; tier: string }>;
    badges: { total: number; recentBadge: string | null };
    notifications: { unreadCount: number };
  }> {
    const [crowns, streak, unreadCount] = await Promise.all([
      this.getCrownBalance(userId),
      this.getStreak(userId),
      this.getUnreadNotificationCount(userId),
    ]);

    let nextMilestone: number | null = null;
    if (streak.current < 2) nextMilestone = 2;
    else if (streak.current < 4) nextMilestone = 4;
    else if (streak.current < 8) nextMilestone = 8;

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let giveaway: { monthKey: string; status: string; eligible: boolean; entries: number } | null = null;
    const { data: month } = await supabaseAdmin
      .from('giveaway_months')
      .select('id, month_key, status')
      .eq('month_key', currentMonthKey)
      .single();

    if (month) {
      const { data: snapshot } = await supabaseAdmin
        .from('giveaway_snapshot')
        .select('entries_int')
        .eq('giveaway_month_id', month.id)
        .eq('user_id', userId)
        .single();

      giveaway = {
        monthKey: month.month_key,
        status: month.status,
        eligible: crowns.total > 0,
        entries: snapshot?.entries_int || 0,
      };
    }

    const { data: eloRows } = await supabaseAdmin
      .from('user_sport_elo')
      .select('sport_id, current_elo_int, current_tier, sports(name)')
      .eq('user_id', userId);

    const elo = (eloRows || []).map((row: any) => ({
      sportName: row.sports?.name || 'Unknown',
      sportId: row.sport_id,
      elo: row.current_elo_int,
      tier: row.current_tier,
    }));

    const { count: badgeCount } = await supabaseAdmin
      .from('badge_awards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { data: recentBadgeRow } = await supabaseAdmin
      .from('badge_awards')
      .select('badge_definitions(name)')
      .eq('user_id', userId)
      .order('awarded_at', { ascending: false })
      .limit(1)
      .single();

    const { data: picksData } = await supabaseAdmin
      .from('picks')
      .select('contest_id')
      .eq('user_id', userId);
    const uniqueContests = new Set((picksData || []).map((p: any) => p.contest_id));
    const contestsEntered = uniqueContests.size;

    let wins = 0;
    if (contestsEntered > 0) {
      const { count } = await supabaseAdmin
        .from('contest_scores')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('rank', 1);
      wins = count || 0;
    }

    return {
      crowns,
      streak: { ...streak, nextMilestone },
      giveaway,
      elo,
      badges: {
        total: badgeCount || 0,
        recentBadge: (recentBadgeRow as any)?.badge_definitions?.name || null,
      },
      notifications: { unreadCount },
      contestsEntered,
      wins,
    };
  }

  async getContestLeaderboard(contestId: string, limit: number = 100): Promise<any[]> {
    const { data: scores, error } = await supabaseAdmin
      .from('contest_scores')
      .select('*')
      .eq('contest_id', contestId)
      .order('rank_int', { ascending: true })
      .limit(limit);

    if (error) {
      console.error(`[Leaderboard] Error fetching contest leaderboard:`, error);
      return [];
    }

    if (!scores || scores.length === 0) return [];

    const userIds = scores.map((s: any) => s.user_id);
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    return scores.map((s: any) => ({
      ...s,
      user_profile: profileMap.get(s.user_id) || null,
    }));
  }
  async autoGradeContest(contestId: string): Promise<{
    gamesGraded: number;
    gamesPending: number;
    picksGraded: number;
    results: any[];
  }> {
    const { data: contest } = await supabaseAdmin
      .from('contests')
      .select('scoring_json, sport_id, season_id, elo_points_override')
      .eq('id', contestId)
      .single();

    if (!contest) throw new Error(`Contest ${contestId} not found`);

    const games = contest.scoring_json?.games || [];
    if (games.length === 0) throw new Error('No games in contest scoring_json');

    const apiKey = process.env.BALLDONTLIE_API_KEY || '';
    const gameResults: Map<string, { winner: string; details: any }> = new Map();
    let gamesPending = 0;

    for (const game of games) {
      const gameId = String(game.id);
      const league = (game.league || 'NBA').toUpperCase();

      try {
        const url = league === 'NCAAB'
          ? `https://api.balldontlie.io/ncaab/v1/games/${gameId}`
          : `https://api.balldontlie.io/v1/games/${gameId}`;

        const response = await fetch(url, {
          headers: { Authorization: apiKey },
        });

        if (!response.ok) {
          console.error(`[AutoGrade] Failed to fetch game ${gameId}: ${response.status}`);
          gamesPending++;
          continue;
        }

        const jsonResponse = await response.json();
        const rawData = jsonResponse.data || jsonResponse;

        if (league === 'NCAAB') {
          if (rawData.status !== 'post') {
            gamesPending++;
            continue;
          }
          const homeScore = rawData.home_score ?? 0;
          const awayScore = rawData.away_score ?? 0;
          const winner = homeScore > awayScore
            ? rawData.home_team?.abbreviation
            : rawData.visitor_team?.abbreviation;
          gameResults.set(gameId, {
            winner,
            details: { home_score: homeScore, away_score: awayScore, status: rawData.status },
          });
        } else {
          if (rawData.status !== 'Final') {
            gamesPending++;
            continue;
          }
          const homeScore = rawData.home_team_score ?? 0;
          const awayScore = rawData.visitor_team_score ?? 0;
          const winner = homeScore > awayScore
            ? rawData.home_team?.abbreviation
            : rawData.visitor_team?.abbreviation;
          gameResults.set(gameId, {
            winner,
            details: { home_team_score: homeScore, visitor_team_score: awayScore, status: rawData.status },
          });
        }
      } catch (err: any) {
        console.error(`[AutoGrade] Error fetching game ${gameId}:`, err.message);
        gamesPending++;
      }
    }

    const { data: entries } = await supabaseAdmin
      .from('picks')
      .select('id, user_id, pick_json')
      .eq('contest_id', contestId);

    if (!entries || entries.length === 0) {
      return { gamesGraded: gameResults.size, gamesPending, picksGraded: 0, results: [] };
    }

    const allResults: any[] = [];

    for (const entry of entries) {
      const picksJson = entry.pick_json || {};
      let correctCount = 0;
      let totalGraded = 0;

      for (const [gameId, result] of gameResults) {
        const userPick = picksJson[gameId];
        if (userPick === undefined) continue;

        const isCorrect = userPick === result.winner;
        if (isCorrect) correctCount++;
        totalGraded++;

        const { data: pickResult } = await supabaseAdmin
          .from('pick_results')
          .upsert({
            pick_id: entry.id,
            game_id: gameId,
            is_correct: isCorrect,
            graded_at: new Date().toISOString(),
            grade_details_json: {
              user_pick: userPick,
              actual_winner: result.winner,
              ...result.details,
            },
          }, { onConflict: 'pick_id,game_id' })
          .select()
          .single();

        allResults.push(pickResult);

        if (contest.sport_id && contest.season_id) {
          await this.updateEloFromPickGrade(
            entry.user_id,
            contest.sport_id,
            contest.season_id,
            isCorrect,
            contest.elo_points_override || undefined
          );
        }
      }

      console.log(`[AutoGrade] User ${entry.user_id}: ${correctCount}/${totalGraded} correct`);
    }

    console.log(`[AutoGrade] Contest ${contestId}: ${gameResults.size} games graded, ${gamesPending} pending, ${entries.length} entries processed`);
    return { gamesGraded: gameResults.size, gamesPending, picksGraded: entries.length, results: allResults };
  }

  async notifyContestResults(contestId: string): Promise<void> {
    const { data: contest } = await supabaseAdmin
      .from('contests')
      .select('title')
      .eq('id', contestId)
      .single();

    const contestTitle = contest?.title || 'Contest';

    const { data: scores } = await supabaseAdmin
      .from('contest_scores')
      .select('user_id, score_numeric, rank_int')
      .eq('contest_id', contestId)
      .order('rank_int', { ascending: true });

    if (!scores || scores.length === 0) return;

    const { data: crownEntries } = await supabaseAdmin
      .from('crown_ledger')
      .select('user_id, amount_int')
      .eq('event_type', 'CONTEST_PLACEMENT')
      .eq('event_ref_type', 'contest')
      .like('event_ref_id', `${contestId}%`);

    const crownMap = new Map<string, number>();
    for (const entry of crownEntries || []) {
      crownMap.set(entry.user_id, (crownMap.get(entry.user_id) || 0) + entry.amount_int);
    }

    for (const score of scores) {
      const rank = score.rank_int;
      const crownsAwarded = crownMap.get(score.user_id) || 0;

      let title: string;
      if (rank === 1) title = '1st Place!';
      else if (rank === 2) title = '2nd Place!';
      else if (rank === 3) title = '3rd Place!';
      else title = `You placed #${rank}`;

      const body = `${contestTitle}: Score ${score.score_numeric}${crownsAwarded > 0 ? ` | +${crownsAwarded} Crowns` : ''}`;

      await this.createNotification(score.user_id, 'CONTEST_RESULT', title, body, {
        contestId,
        rank,
        score: score.score_numeric,
        crownsAwarded,
      });
    }

    console.log(`[Notify] Sent contest result notifications for ${contestId} to ${scores.length} participants`);
  }
}

function getPreviousWeekKey(weekKey: string): string {
  const [yearStr, weekStr] = weekKey.split('-W');
  let year = parseInt(yearStr, 10);
  let week = parseInt(weekStr, 10);

  week--;
  if (week < 1) {
    year--;
    const dec28 = new Date(year, 11, 28);
    const dayOfDec28 = dec28.getDay();
    const lastThursday = new Date(year, 11, 28 - ((dayOfDec28 + 6) % 7) + 3);
    const jan4 = new Date(lastThursday.getFullYear(), 0, 4);
    week = 1 + Math.round(((lastThursday.getTime() - jan4.getTime()) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7);
  }

  return `${year}-W${String(week).padStart(2, '0')}`;
}

export const gamificationService = new GamificationService();
