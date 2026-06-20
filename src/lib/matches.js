import { getSettings } from './storage.js';
import { isSameDay, isTomorrow, isWithinDays } from './utils.js';

export function sortMatches(matches, settings) {
  const favTeams = new Set([
    ...settings.favoriteTeams.map((t) => t.id),
    ...settings.favoriteNationalTeams.map((t) => t.id),
  ]);
  const favComps = new Set(settings.favoriteCompetitions);

  return [...matches].sort((a, b) => {
    const aFav = isFavoriteMatch(a, favTeams, favComps);
    const bFav = isFavoriteMatch(b, favTeams, favComps);
    if (aFav !== bFav) return aFav ? -1 : 1;

    const statusOrder = { live: 0, upcoming: 1, finished: 2 };
    const sa = statusOrder[a.status] ?? 3;
    const sb = statusOrder[b.status] ?? 3;
    if (sa !== sb) return sa - sb;

    return new Date(a.utcDate) - new Date(b.utcDate);
  });
}

function isFavoriteMatch(match, favTeams, favComps) {
  return (
    favTeams.has(match.homeTeam.id) ||
    favTeams.has(match.awayTeam.id) ||
    favComps.has(match.competition.id)
  );
}

export function filterMatches(matches, { tab = 'today', search = '', timezone = 'auto' } = {}) {
  let filtered = matches;

  if (tab === 'live') {
    filtered = filtered.filter((m) => m.status === 'live');
  } else if (tab === 'today') {
    filtered = filtered.filter((m) => isSameDay(m.utcDate, new Date(), timezone));
  } else if (tab === 'tomorrow') {
    filtered = filtered.filter((m) => isTomorrow(m.utcDate, timezone));
  } else if (tab === 'week') {
    filtered = filtered.filter(
      (m) =>
        isWithinDays(m.utcDate, 7, timezone) &&
        (m.status === 'live' || m.status === 'upcoming' || m.status === 'finished')
    );
  } else if (tab === 'upcoming') {
    filtered = filtered.filter((m) => m.status === 'upcoming' && new Date(m.utcDate) >= new Date());
  }

  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (m) =>
        m.homeTeam.name.toLowerCase().includes(q) ||
        m.awayTeam.name.toLowerCase().includes(q) ||
        m.competition.name?.toLowerCase().includes(q)
    );
  }

  return filtered;
}

export function countLiveMatches(matches) {
  return matches.filter((m) => m.status === 'live').length;
}

export async function getSortedFilteredMatches(options) {
  const settings = await getSettings();
  return sortMatches(filterMatches(options.matches, options), settings);
}

export function getStatusLabel(match) {
  if (match.status === 'live') {
    if (match.rawStatus === 'PAUSED') return 'HT';
    return match.minute != null ? `${match.minute}'` : 'LIVE';
  }
  if (match.status === 'finished') return 'FT';
  if (match.status === 'postponed') return 'PPD';
  if (match.status === 'cancelled') return 'CAN';
  return null;
}

export function getScoreDisplay(match) {
  if (match.status === 'upcoming') return null;
  const { home, away } = match.score;
  if (home == null || away == null) return null;
  return `${home} – ${away}`;
}
