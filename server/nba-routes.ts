import { Router } from 'express';
import { BalldontlieAPI } from '@balldontlie/sdk';

const api = new BalldontlieAPI({ apiKey: process.env.BALLDONTLIE_API_KEY || '' });
const BALLDONTLIE_BASE = 'https://api.balldontlie.io';
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

let cachedNBAGames: any[] = [];
let nbaCacheTimestamp = 0;
let cachedNCAABGames: any[] = [];
let ncaabCacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000;
let ncaabDisabled = false;

let cachedOdds: Record<string, any> = {};
let oddsCacheTimestamp = 0;
const ODDS_CACHE_DURATION = 10 * 60 * 1000;

const rangeCache: Map<string, { data: any[]; timestamp: number }> = new Map();
const RANGE_CACHE_DURATION = 5 * 60 * 1000;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeTeamName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

async function fetchNBAOdds(): Promise<Record<string, any>> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return {};

  const now = Date.now();
  if (Object.keys(cachedOdds).length > 0 && now - oddsCacheTimestamp < ODDS_CACHE_DURATION) {
    return cachedOdds;
  }

  try {
    const url = `${ODDS_API_BASE}/sports/basketball_nba/odds/?apiKey=${apiKey}&regions=us&markets=h2h,totals&oddsFormat=american`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[Odds] API error: ${response.status}`);
      return cachedOdds;
    }
    const data = await response.json();
    const oddsMap: Record<string, any> = {};

    for (const event of data) {
      const homeKey = normalizeTeamName(event.home_team || '');
      const awayKey = normalizeTeamName(event.away_team || '');
      const matchKey = `${awayKey}_${homeKey}`;

      let totalLine: number | null = null;
      let overPrice: number | null = null;
      let underPrice: number | null = null;
      let homeMoneyline: number | null = null;
      let awayMoneyline: number | null = null;

      for (const bookmaker of (event.bookmakers || [])) {
        for (const market of (bookmaker.markets || [])) {
          if (market.key === 'totals' && totalLine === null) {
            for (const outcome of (market.outcomes || [])) {
              if (outcome.name === 'Over') {
                totalLine = outcome.point;
                overPrice = outcome.price;
              } else if (outcome.name === 'Under') {
                underPrice = outcome.price;
              }
            }
          }
          if (market.key === 'h2h' && homeMoneyline === null) {
            for (const outcome of (market.outcomes || [])) {
              if (outcome.name === event.home_team) {
                homeMoneyline = outcome.price;
              } else if (outcome.name === event.away_team) {
                awayMoneyline = outcome.price;
              }
            }
          }
        }
        if (totalLine !== null && homeMoneyline !== null) break;
      }

      if (totalLine !== null || homeMoneyline !== null) {
        oddsMap[matchKey] = {
          total: totalLine,
          over_price: overPrice,
          under_price: underPrice,
          home_moneyline: homeMoneyline,
          away_moneyline: awayMoneyline,
          home_team: event.home_team,
          away_team: event.away_team,
          commence_time: event.commence_time,
        };
      }
    }

    cachedOdds = oddsMap;
    oddsCacheTimestamp = now;
    console.log(`[Odds] Fetched ${Object.keys(oddsMap).length} NBA over/under lines`);
    return oddsMap;
  } catch (err: any) {
    console.error('[Odds] Failed to fetch:', err.message);
    return cachedOdds;
  }
}

function findOddsForGame(oddsMap: Record<string, any>, homeTeam: string, awayTeam: string): any | null {
  const homeKey = normalizeTeamName(homeTeam);
  const awayKey = normalizeTeamName(awayTeam);

  const directKey = `${awayKey}_${homeKey}`;
  if (oddsMap[directKey]) return oddsMap[directKey];

  for (const [, odds] of Object.entries(oddsMap)) {
    const oddsHome = normalizeTeamName(odds.home_team || '');
    const oddsAway = normalizeTeamName(odds.away_team || '');
    if (
      (homeKey.includes(oddsHome) || oddsHome.includes(homeKey)) &&
      (awayKey.includes(oddsAway) || oddsAway.includes(awayKey))
    ) {
      return odds;
    }
  }
  return null;
}

function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatGameTime(isoString: string): string | null {
  if (!isoString) return null;
  const match = isoString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  if (!match) return null;
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
    }) + ' ET';
  } catch {
    return null;
  }
}

function formatNBAGameForTicker(game: any): string {
  const away = game.visitor_team?.abbreviation || game.visitor_team?.name || 'AWAY';
  const home = game.home_team?.abbreviation || game.home_team?.name || 'HOME';
  const status = game.status || '';

  if (status === 'Final') {
    return `${away} ${game.visitor_team_score} - ${home} ${game.home_team_score} (Final)`;
  }

  if (status.includes('Q') || status.includes('Half') || status.includes('OT') || game.period > 0) {
    return `${away} ${game.visitor_team_score} - ${home} ${game.home_team_score} (${status})`;
  }

  const formattedTime = formatGameTime(status) || formatGameTime(game.datetime || '');
  if (formattedTime) {
    return `${away} @ ${home} (${formattedTime})`;
  }

  const timeStr = game.time || '';
  if (timeStr && timeStr !== 'TBD') {
    return `${away} @ ${home} (${timeStr})`;
  }

  return `${away} @ ${home}`;
}

function formatNCAABGameForTicker(game: any): string {
  const away = game.visitor_team?.abbreviation || game.visitor_team?.college || 'AWAY';
  const home = game.home_team?.abbreviation || game.home_team?.college || 'HOME';
  const status = game.status || '';

  if (status === 'post' || status === 'Final') {
    return `${away} ${game.away_score} - ${home} ${game.home_score} (Final)`;
  }

  if (status === 'in' || status === 'halftime' || (game.period && game.period > 0)) {
    const periodLabel = status === 'halftime' ? 'Half' : game.period ? `H${game.period}` : 'Live';
    return `${away} ${game.away_score} - ${home} ${game.home_score} (${periodLabel})`;
  }

  const formattedTime = formatGameTime(game.datetime || '') || formatGameTime(game.time || '');
  if (formattedTime) {
    return `${away} @ ${home} (${formattedTime})`;
  }

  return `${away} @ ${home}`;
}

async function fetchNCAABGames(date: string): Promise<any[]> {
  if (ncaabDisabled) return [];
  const apiKey = process.env.BALLDONTLIE_API_KEY || '';
  const url = `${BALLDONTLIE_BASE}/ncaab/v1/games?dates[]=${date}&per_page=100`;
  const response = await fetch(url, {
    headers: { Authorization: apiKey },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      console.warn('[NCAAB] API key does not have NCAAB access — disabling NCAAB calls for this session');
      ncaabDisabled = true;
      return [];
    }
    const text = await response.text();
    throw new Error(`NCAAB API ${response.status}: ${text}`);
  }

  const json = await response.json();
  return json.data || [];
}

export function registerNBARoutes(router: Router) {
  router.get('/api/nba/today', async (_req, res) => {
    try {
      const now = Date.now();
      if (cachedNBAGames.length > 0 && now - nbaCacheTimestamp < CACHE_DURATION) {
        return res.json(cachedNBAGames);
      }

      const today = getTodayDate();
      const response = await api.nba.getGames({ dates: [today] });
      const games = response.data || [];

      const formatted = games.map((game: any) => ({
        id: game.id,
        league: 'NBA',
        status: game.status,
        period: game.period,
        time: game.time,
        home_team: game.home_team?.abbreviation || game.home_team?.name || '',
        home_team_full: game.home_team?.full_name || '',
        home_score: game.home_team_score,
        away_team: game.visitor_team?.abbreviation || game.visitor_team?.name || '',
        away_team_full: game.visitor_team?.full_name || '',
        away_score: game.visitor_team_score,
        ticker_text: formatNBAGameForTicker(game),
      }));

      cachedNBAGames = formatted;
      nbaCacheTimestamp = now;

      res.json(formatted);
    } catch (err: any) {
      console.error('[NBA] Failed to fetch games:', err.message);
      if (cachedNBAGames.length > 0) {
        return res.json(cachedNBAGames);
      }
      res.status(500).json({ error: 'Failed to fetch NBA games' });
    }
  });

  router.get('/api/ncaab/today', async (_req, res) => {
    try {
      const now = Date.now();
      if (cachedNCAABGames.length > 0 && now - ncaabCacheTimestamp < CACHE_DURATION) {
        return res.json(cachedNCAABGames);
      }

      const today = getTodayDate();
      const games = await fetchNCAABGames(today);

      const formatted = games.map((game: any) => ({
        id: game.id,
        league: 'NCAAB',
        status: game.status,
        period: game.period,
        home_team: game.home_team?.abbreviation || game.home_team?.college || '',
        home_team_full: game.home_team?.full_name || '',
        home_score: game.home_score ?? 0,
        away_team: game.visitor_team?.abbreviation || game.visitor_team?.college || '',
        away_team_full: game.visitor_team?.full_name || '',
        away_score: game.away_score ?? 0,
        ticker_text: formatNCAABGameForTicker(game),
      }));

      cachedNCAABGames = formatted;
      ncaabCacheTimestamp = now;

      res.json(formatted);
    } catch (err: any) {
      console.error('[NCAAB] Failed to fetch games:', err.message);
      if (cachedNCAABGames.length > 0) {
        return res.json(cachedNCAABGames);
      }
      res.status(500).json({ error: 'Failed to fetch NCAAB games' });
    }
  });

  router.get('/api/games/today', async (_req, res) => {
    try {
      const now = Date.now();
      const today = getTodayDate();

      let nbaGames = cachedNBAGames;
      if (cachedNBAGames.length === 0 || now - nbaCacheTimestamp >= CACHE_DURATION) {
        try {
          const response = await api.nba.getGames({ dates: [today] });
          const games = response.data || [];
          nbaGames = games.map((game: any) => ({
            id: game.id,
            league: 'NBA',
            status: game.status,
            period: game.period,
            time: game.time,
            home_team: game.home_team?.abbreviation || game.home_team?.name || '',
            home_team_full: game.home_team?.full_name || '',
            home_score: game.home_team_score,
            away_team: game.visitor_team?.abbreviation || game.visitor_team?.name || '',
            away_team_full: game.visitor_team?.full_name || '',
            away_score: game.visitor_team_score,
            ticker_text: formatNBAGameForTicker(game),
          }));
          cachedNBAGames = nbaGames;
          nbaCacheTimestamp = now;
        } catch (e: any) {
          console.error('[NBA] Error in combined endpoint:', e.message);
        }
      }

      let ncaabGames = cachedNCAABGames;
      if (cachedNCAABGames.length === 0 || now - ncaabCacheTimestamp >= CACHE_DURATION) {
        try {
          const rawGames = await fetchNCAABGames(today);
          ncaabGames = rawGames.map((game: any) => ({
            id: game.id,
            league: 'NCAAB',
            status: game.status,
            period: game.period,
            home_team: game.home_team?.abbreviation || game.home_team?.college || '',
            home_team_full: game.home_team?.full_name || '',
            home_score: game.home_score ?? 0,
            away_team: game.visitor_team?.abbreviation || game.visitor_team?.college || '',
            away_team_full: game.visitor_team?.full_name || '',
            away_score: game.away_score ?? 0,
            ticker_text: formatNCAABGameForTicker(game),
          }));
          cachedNCAABGames = ncaabGames;
          ncaabCacheTimestamp = now;
        } catch (e: any) {
          console.error('[NCAAB] Error in combined endpoint:', e.message);
        }
      }

      res.json({ nba: nbaGames, ncaab: ncaabGames });
    } catch (err: any) {
      console.error('[Games] Failed to fetch combined games:', err.message);
      res.json({ nba: cachedNBAGames, ncaab: cachedNCAABGames });
    }
  });

  router.get('/api/games/range', async (req, res) => {
    try {
      const { start_date, end_date, league } = req.query as { start_date?: string; end_date?: string; league?: string };
      if (!start_date || !end_date || !league) {
        return res.status(400).json({ error: 'start_date, end_date, and league are required (YYYY-MM-DD)' });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
        return res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format' });
      }

      const dates: string[] = [];
      const cur = new Date(start_date + 'T00:00:00Z');
      const last = new Date(end_date + 'T00:00:00Z');
      if (last < cur) return res.status(400).json({ error: 'end_date must be >= start_date' });
      const maxDays = 60;
      while (cur <= last && dates.length < maxDays) {
        const y = cur.getUTCFullYear();
        const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
        const d = String(cur.getUTCDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      const cacheKey = `${league}_${start_date}_${end_date}`;
      const cached = rangeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < RANGE_CACHE_DURATION) {
        return res.json({ games: cached.data, dates_fetched: dates.length, total: cached.data.length, cached: true });
      }

      let allGames: any[] = [];

      if (league.toUpperCase() === 'NBA') {
        for (let i = 0; i < dates.length; i++) {
          const date = dates[i];
          if (i > 0) await delay(350);
          let retries = 0;
          while (retries < 3) {
            try {
              const response = await api.nba.getGames({ dates: [date] });
              const games = response.data || [];
              const formatted = games.map((game: any) => ({
                id: game.id,
                league: 'NBA',
                date,
                status: game.status,
                period: game.period,
                time: game.time,
                home_team: game.home_team?.abbreviation || game.home_team?.name || '',
                home_team_full: game.home_team?.full_name || '',
                home_score: game.home_team_score,
                away_team: game.visitor_team?.abbreviation || game.visitor_team?.name || '',
                away_team_full: game.visitor_team?.full_name || '',
                away_score: game.visitor_team_score,
                ticker_text: formatNBAGameForTicker(game),
              }));
              allGames = allGames.concat(formatted);
              break;
            } catch (e: any) {
              if (e.message?.includes('Too many requests') && retries < 2) {
                retries++;
                console.log(`[NBA range] Rate limited on ${date}, retrying (${retries}/3)...`);
                await delay(1500 * retries);
              } else {
                console.error(`[NBA range] Error fetching ${date}:`, e.message);
                break;
              }
            }
          }
        }
      } else if (league.toUpperCase() === 'NCAAB') {
        for (let i = 0; i < dates.length; i++) {
          const date = dates[i];
          if (i > 0) await delay(350);
          try {
            const rawGames = await fetchNCAABGames(date);
            const formatted = rawGames.map((game: any) => ({
              id: game.id,
              league: 'NCAAB',
              date,
              status: game.status,
              period: game.period,
              home_team: game.home_team?.abbreviation || game.home_team?.college || '',
              home_team_full: game.home_team?.full_name || '',
              home_score: game.home_score ?? 0,
              away_team: game.visitor_team?.abbreviation || game.visitor_team?.college || '',
              away_team_full: game.visitor_team?.full_name || '',
              away_score: game.away_score ?? 0,
              ticker_text: formatNCAABGameForTicker(game),
            }));
            allGames = allGames.concat(formatted);
          } catch (e: any) {
            console.error(`[NCAAB range] Error fetching ${date}:`, e.message);
          }
        }
      } else {
        return res.status(400).json({ error: 'league must be NBA or NCAAB' });
      }

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      const filteredGames = allGames.filter((game: any) => {
        const gameDate = game.date || '';
        if (gameDate !== todayStr) return true;

        const status = game.status || '';
        if (status === 'Final' || status === 'post') return false;
        if (status.includes('Q') || status.includes('Half') || status.includes('OT') || status === 'in' || status === 'halftime') return false;

        const statusDate = new Date(status);
        if (!isNaN(statusDate.getTime()) && statusDate <= oneHourFromNow) return false;

        return true;
      });

      let oddsMap: Record<string, any> = {};
      if (league.toUpperCase() === 'NBA') {
        oddsMap = await fetchNBAOdds();
      }

      const enrichedGames = filteredGames.map((game: any) => {
        const odds = findOddsForGame(oddsMap, game.home_team_full || game.home_team, game.away_team_full || game.away_team);
        return {
          ...game,
          home_moneyline: odds?.home_moneyline ?? null,
          away_moneyline: odds?.away_moneyline ?? null,
          over_under: odds?.total ?? null,
          over_price: odds?.over_price ?? null,
          under_price: odds?.under_price ?? null,
          game_time: odds?.commence_time ?? null,
        };
      });

      if (enrichedGames.length > 0) {
        rangeCache.set(cacheKey, { data: enrichedGames, timestamp: Date.now() });
      }

      res.json({ games: enrichedGames, dates_fetched: dates.length, total: enrichedGames.length });
    } catch (err: any) {
      console.error('[Games range] Failed:', err.message);
      res.status(500).json({ error: 'Failed to fetch games for date range' });
    }
  });

  router.get('/api/odds/nba', async (_req, res) => {
    try {
      const oddsMap = await fetchNBAOdds();
      res.json({ odds: Object.values(oddsMap), count: Object.keys(oddsMap).length });
    } catch (err: any) {
      console.error('[Odds] Route error:', err.message);
      res.status(500).json({ error: 'Failed to fetch odds' });
    }
  });

  router.get('/api/sports/seasons', async (_req, res) => {
    const currentYear = new Date().getFullYear();
    const seasons: number[] = [];
    for (let y = currentYear + 1; y >= 2015; y--) {
      seasons.push(y);
    }
    res.json({ seasons });
  });

  router.get('/api/sports/teams', async (req, res) => {
    try {
      const league = ((req.query.league as string) || 'NBA').toUpperCase();
      const apiKey = process.env.BALLDONTLIE_API_KEY || '';

      if (league === 'NBA') {
        const response = await api.nba.getTeams();
        const teams = (response.data || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          full_name: t.full_name,
          abbreviation: t.abbreviation,
          city: t.city,
          conference: t.conference,
          division: t.division,
        }));
        return res.json({ teams, league: 'NBA' });
      }

      if (league === 'NCAAB') {
        if (ncaabDisabled) return res.status(403).json({ error: 'NCAAB access not available with current API key' });
        const url = `${BALLDONTLIE_BASE}/ncaab/v1/teams?per_page=100`;
        const response = await fetch(url, { headers: { Authorization: apiKey } });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) { ncaabDisabled = true; }
          const text = await response.text();
          return res.status(response.status).json({ error: `NCAAB teams API: ${text}` });
        }
        const json = await response.json();
        const teams = (json.data || []).map((t: any) => ({
          id: t.id,
          name: t.name || t.college || t.school,
          full_name: t.full_name || t.college || t.school || t.name,
          abbreviation: t.abbreviation || '',
          conference: t.conference || '',
        }));
        return res.json({ teams, league: 'NCAAB' });
      }

      res.status(400).json({ error: 'Unsupported league. Use NBA or NCAAB.' });
    } catch (err: any) {
      console.error('[Sports teams] Error:', err.message);
      res.status(500).json({ error: 'Failed to fetch teams' });
    }
  });

  router.get('/api/sports/players', async (req, res) => {
    try {
      const league = ((req.query.league as string) || 'NBA').toUpperCase();
      const search = (req.query.search as string) || '';
      const teamId = req.query.team_id as string;
      const season = req.query.season as string;
      const cursor = req.query.cursor as string;
      const apiKey = process.env.BALLDONTLIE_API_KEY || '';

      if (league === 'NBA') {
        const params: any = { per_page: 50 };
        if (search) params.search = search;
        if (cursor) params.cursor = parseInt(cursor);
        const response = await api.nba.getPlayers(params);
        const players = (response.data || []).map((p: any) => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          position: p.position,
          team_id: p.team_id,
          jersey_number: p.jersey_number,
          college: p.college,
          country: p.country,
          height: p.height,
          weight: p.weight,
        }));
        return res.json({ players, league: 'NBA', meta: response.meta || {} });
      }

      if (league === 'NCAAB') {
        if (ncaabDisabled) return res.status(403).json({ error: 'NCAAB access not available with current API key' });
        const queryParts = [`per_page=50`];
        if (search) queryParts.push(`search=${encodeURIComponent(search)}`);
        if (cursor) queryParts.push(`cursor=${cursor}`);
        const url = `${BALLDONTLIE_BASE}/ncaab/v1/players?${queryParts.join('&')}`;
        const response = await fetch(url, { headers: { Authorization: apiKey } });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) { ncaabDisabled = true; }
          const text = await response.text();
          return res.status(response.status).json({ error: `NCAAB players API: ${text}` });
        }
        const json = await response.json();
        const players = (json.data || []).map((p: any) => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          position: p.position,
          team: p.team?.college || p.team?.name || '',
          team_id: p.team?.id,
        }));
        return res.json({ players, league: 'NCAAB', meta: json.meta || {} });
      }

      res.status(400).json({ error: 'Unsupported league. Use NBA or NCAAB.' });
    } catch (err: any) {
      console.error('[Sports players] Error:', err.message);
      res.status(500).json({ error: 'Failed to fetch players' });
    }
  });
}

export { fetchNBAOdds, findOddsForGame };
