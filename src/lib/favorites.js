import { getSettings, saveSettings } from './storage.js';

export async function toggleFavoriteTeam(team) {
  const settings = await getSettings();
  const list = settings.favoriteTeams;
  const idx = list.findIndex((t) => t.id === team.id);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push({ id: team.id, name: team.name, crest: team.crest });
  }
  await saveSettings({ favoriteTeams: list });
  return list;
}

export async function toggleFavoriteCompetition(compId) {
  const settings = await getSettings();
  const list = settings.favoriteCompetitions;
  const idx = list.indexOf(compId);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push(compId);
  }
  await saveSettings({ favoriteCompetitions: list });
  return list;
}

export async function isTeamFavorite(teamId) {
  const settings = await getSettings();
  return settings.favoriteTeams.some((t) => t.id === teamId);
}

export async function isCompetitionFavorite(compId) {
  const settings = await getSettings();
  return settings.favoriteCompetitions.includes(compId);
}

export function buildCalendarUrl(match, type = 'google') {
  const start = new Date(match.utcDate);
  const end = new Date(start.getTime() + 2 * 3600000);
  const title = encodeURIComponent(`${match.homeTeam.name} vs ${match.awayTeam.name}`);
  const details = encodeURIComponent(match.competition.name || '');

  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  if (type === 'google') {
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}`;
  }

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${decodeURIComponent(title)}`,
    `DESCRIPTION:${decodeURIComponent(details)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}
