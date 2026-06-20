import { getApiCodesForEnabled, TOURNAMENT_CODES } from './competitions.js';
import { getSettings, setMatchesCache, getMatchesCache, clearMatchesCache } from './storage.js';
import { addDays, toDateString } from './utils.js';

const API_BASE = 'https://api.football-data.org/v4';
const CACHE_TTL_MS = 5 * 60 * 1000;
const LIVE_CACHE_TTL_MS = 60 * 1000;
const BATCH_SIZE = 8;

export function normalizeMatch(raw) {
  const status = mapStatus(raw.status);
  return {
    id: raw.id,
    homeTeam: {
      id: raw.homeTeam?.id,
      name: raw.homeTeam?.name || 'TBD',
      shortName: raw.homeTeam?.shortName || raw.homeTeam?.tla,
      crest: raw.homeTeam?.crest,
    },
    awayTeam: {
      id: raw.awayTeam?.id,
      name: raw.awayTeam?.name || 'TBD',
      shortName: raw.awayTeam?.shortName || raw.awayTeam?.tla,
      crest: raw.awayTeam?.crest,
    },
    competition: {
      id: raw.competition?.code || raw.competition?.id,
      name: raw.competition?.name,
      emblem: raw.competition?.emblem,
    },
    utcDate: raw.utcDate,
    status,
    rawStatus: raw.status,
    minute: raw.minute ?? null,
    score: {
      home: raw.score?.fullTime?.home ?? raw.score?.regularTime?.home,
      away: raw.score?.fullTime?.away ?? raw.score?.regularTime?.away,
      halftimeHome: raw.score?.halfTime?.home,
      halftimeAway: raw.score?.halfTime?.away,
    },
    matchday: raw.matchday,
    stage: raw.stage,
  };
}

function mapStatus(apiStatus) {
  switch (apiStatus) {
    case 'IN_PLAY':
    case 'LIVE':
    case 'PAUSED':
    case 'EXTRA_TIME':
    case 'PENALTY_SHOOTOUT':
      return 'live';
    case 'FINISHED':
    case 'AWARDED':
      return 'finished';
    case 'POSTPONED':
    case 'SUSPENDED':
    case 'CANCELLED':
      return apiStatus.toLowerCase();
    default:
      return 'upcoming';
  }
}

function getDateWindow() {
  return {
    dateFrom: toDateString(addDays(new Date(), -1)),
    dateTo: toDateString(addDays(new Date(), 14)),
  };
}

function getSeasonYears() {
  const year = new Date().getFullYear();
  return [year, year - 1];
}

function pruneStaleMatches(matches) {
  const cutoff = Date.now() - 36 * 60 * 60 * 1000;
  const horizon = addDays(new Date(), 15).getTime();

  return matches.filter((m) => {
    const kickoff = new Date(m.utcDate).getTime();
    if (kickoff > horizon) return false;
    if (m.status === 'live') return true;
    if (m.status === 'upcoming') return kickoff >= Date.now() - 30 * 60 * 1000;
    if (m.status === 'finished') return kickoff >= cutoff;
    return kickoff >= cutoff;
  });
}

function isCacheStillRelevant(cached, cacheTime) {
  if (!cached?.length) return false;
  const age = Date.now() - cacheTime;
  if (age > 24 * 60 * 60 * 1000) return false;

  const pruned = pruneStaleMatches(cached);
  if (!pruned.length) return false;

  const hasLive = pruned.some((m) => m.status === 'live');
  if (hasLive) return age < LIVE_CACHE_TTL_MS;

  const hasUpcoming = pruned.some(
    (m) => m.status === 'upcoming' && new Date(m.utcDate) > new Date()
  );
  if (hasUpcoming) return age < CACHE_TTL_MS;

  const hasRecentFinished = pruned.some((m) => {
    if (m.status !== 'finished') return false;
    return new Date(m.utcDate) >= addDays(new Date(), -1);
  });
  return hasRecentFinished && age < CACHE_TTL_MS;
}

async function apiFetch(url, apiKey) {
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': apiKey },
  });

  if (res.status === 403 || res.status === 404) {
    return [];
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body.slice(0, 160)}`);
  }

  const data = await res.json();
  return data.matches || [];
}

async function fetchLeagueBatch(apiKey, codes, dateFrom, dateTo, bucket) {
  for (let i = 0; i < codes.length; i += BATCH_SIZE) {
    const batch = codes.slice(i, i + BATCH_SIZE);
    const url = `${API_BASE}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&competitions=${batch.join(',')}`;
    const raw = await apiFetch(url, apiKey);
    for (const match of raw) {
      bucket.set(match.id, match);
    }
  }
}

async function fetchTournamentMatches(apiKey, code, dateFrom, dateTo, bucket) {
  for (const season of getSeasonYears()) {
    const url = `${API_BASE}/competitions/${code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&season=${season}`;
    const raw = await apiFetch(url, apiKey);
    for (const match of raw) {
      bucket.set(match.id, match);
    }
    if (raw.length) break;
  }
}

async function fetchFromApi(apiKey, enabledCompetitionIds) {
  const codes = [...new Set(getApiCodesForEnabled(enabledCompetitionIds))];
  if (!codes.length) return [];

  const { dateFrom, dateTo } = getDateWindow();
  const bucket = new Map();

  const leagueCodes = codes.filter((c) => !TOURNAMENT_CODES.has(c));
  const tournamentCodes = codes.filter((c) => TOURNAMENT_CODES.has(c));

  if (leagueCodes.length) {
    await fetchLeagueBatch(apiKey, leagueCodes, dateFrom, dateTo, bucket);
  }

  for (const code of tournamentCodes) {
    await fetchTournamentMatches(apiKey, code, dateFrom, dateTo, bucket);
  }

  const matches = [...bucket.values()]
    .map(normalizeMatch)
    .filter((m) => {
      const kickoff = m.utcDate.slice(0, 10);
      return kickoff >= dateFrom && kickoff <= dateTo;
    });

  return pruneStaleMatches(matches);
}

function getDemoMatches() {
  const now = Date.now();
  const hour = 3600000;

  return [
    {
      id: 900101,
      homeTeam: { id: 770, name: 'United States', shortName: 'USA', crest: 'https://crests.football-data.org/770.svg' },
      awayTeam: { id: 769, name: 'Mexico', shortName: 'Mexico', crest: 'https://crests.football-data.org/769.svg' },
      competition: { id: 'WC', name: 'FIFA World Cup', emblem: 'https://crests.football-data.org/WC.png' },
      utcDate: new Date(now + 3 * hour).toISOString(),
      status: 'upcoming',
      rawStatus: 'TIMED',
      minute: null,
      score: { home: null, away: null },
      stage: 'GROUP_STAGE',
    },
    {
      id: 900102,
      homeTeam: { id: 764, name: 'Brazil', shortName: 'Brazil', crest: 'https://crests.football-data.org/764.svg' },
      awayTeam: { id: 758, name: 'Germany', shortName: 'Germany', crest: 'https://crests.football-data.org/758.svg' },
      competition: { id: 'WC', name: 'FIFA World Cup', emblem: 'https://crests.football-data.org/WC.png' },
      utcDate: new Date(now + 45 * 60000).toISOString(),
      status: 'live',
      rawStatus: 'IN_PLAY',
      minute: 72,
      score: { home: 1, away: 1, halftimeHome: 0, halftimeAway: 1 },
      stage: 'GROUP_STAGE',
    },
    {
      id: 900103,
      homeTeam: { id: 760, name: 'Spain', shortName: 'Spain', crest: 'https://crests.football-data.org/760.svg' },
      awayTeam: { id: 759, name: 'France', shortName: 'France', crest: 'https://crests.football-data.org/759.svg' },
      competition: { id: 'WC', name: 'FIFA World Cup', emblem: 'https://crests.football-data.org/WC.png' },
      utcDate: new Date(addDays(new Date(), 1).setHours(19, 0, 0, 0)).toISOString(),
      status: 'upcoming',
      rawStatus: 'SCHEDULED',
      minute: null,
      score: { home: null, away: null },
      stage: 'GROUP_STAGE',
    },
    {
      id: 900104,
      homeTeam: { id: 771, name: 'England', shortName: 'England', crest: 'https://crests.football-data.org/770.svg' },
      awayTeam: { id: 772, name: 'Netherlands', shortName: 'Netherlands', crest: 'https://crests.football-data.org/771.svg' },
      competition: { id: 'QUFA', name: 'WC Qualification UEFA', emblem: 'https://crests.football-data.org/QUFA.png' },
      utcDate: new Date(addDays(new Date(), 2).setHours(20, 45, 0, 0)).toISOString(),
      status: 'upcoming',
      rawStatus: 'SCHEDULED',
      minute: null,
      score: { home: null, away: null },
      stage: 'QUALIFICATION',
    },
    {
      id: 900001,
      homeTeam: { id: 57, name: 'Arsenal FC', shortName: 'Arsenal', crest: 'https://crests.football-data.org/57.png' },
      awayTeam: { id: 61, name: 'Chelsea FC', shortName: 'Chelsea', crest: 'https://crests.football-data.org/61.png' },
      competition: { id: 'PL', name: 'Premier League', emblem: 'https://crests.football-data.org/PL.png' },
      utcDate: new Date(addDays(new Date(), 3).setHours(15, 0, 0, 0)).toISOString(),
      status: 'upcoming',
      rawStatus: 'SCHEDULED',
      minute: null,
      score: { home: null, away: null },
    },
  ];
}

export async function fetchMatches({ force = false } = {}) {
  const settings = await getSettings();
  const { matches: cached, time: cacheTime } = await getMatchesCache();
  const hasLive = cached?.some((m) => m.status === 'live');
  const ttl = hasLive ? LIVE_CACHE_TTL_MS : CACHE_TTL_MS;

  const cacheOk =
    !force &&
    cached?.length &&
    isCacheStillRelevant(cached, cacheTime) &&
    Date.now() - cacheTime < ttl;

  if (cacheOk) {
    return { matches: pruneStaleMatches(cached), fromCache: true, cacheTime };
  }

  if (settings.demoMode || !settings.apiKey) {
    const demo = getDemoMatches();
    await setMatchesCache(demo);
    return { matches: demo, fromCache: false, demo: true, cacheTime: Date.now() };
  }

  try {
    const matches = await fetchFromApi(settings.apiKey, settings.enabledCompetitions);
    matches.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
    await setMatchesCache(matches);
    return { matches, fromCache: false, cacheTime: Date.now() };
  } catch (err) {
    const pruned = cached ? pruneStaleMatches(cached) : [];
    if (pruned.length && isCacheStillRelevant(pruned, cacheTime)) {
      return { matches: pruned, fromCache: true, error: err.message, cacheTime };
    }
    await clearMatchesCache();
    await chrome.storage.local.set({ lastRefreshError: err.message });
    throw err;
  }
}

export async function searchTeams(query, apiKey) {
  if (!apiKey || !query || query.length < 2) return [];
  const res = await fetch(`${API_BASE}/teams?name=${encodeURIComponent(query)}`, {
    headers: { 'X-Auth-Token': apiKey },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.teams || []).slice(0, 10).map((t) => ({
    id: t.id,
    name: t.name,
    crest: t.crest,
    type: 'club',
  }));
}
