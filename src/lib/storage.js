import { DEFAULT_ENABLED, mergeNewCompetitions, migrateCompetitionIds } from './competitions.js';

const DEFAULTS = {
  apiKey: '',
  demoMode: false,
  enabledCompetitions: DEFAULT_ENABLED,
  favoriteTeams: [],
  favoriteNationalTeams: [],
  favoriteCompetitions: [],
  defaultReminderMinutes: null,
  theme: 'system',
  timezone: 'auto',
  reminders: [],
  matchesCache: null,
  matchesCacheTime: 0,
  lastRefreshError: null,
};

export async function getSettings() {
  const data = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const settings = { ...DEFAULTS, ...data };
  settings.enabledCompetitions = migrateCompetitionIds(
    mergeNewCompetitions(settings.enabledCompetitions)
  );
  return settings;
}

export async function saveSettings(partial) {
  if (partial.apiKey?.trim()) {
    partial.demoMode = false;
  }
  await chrome.storage.local.set(partial);
}

export async function getReminders() {
  const { reminders = [] } = await chrome.storage.local.get('reminders');
  return reminders;
}

export async function saveReminders(reminders) {
  await chrome.storage.local.set({ reminders });
}

export async function getMatchesCache() {
  const { matchesCache, matchesCacheTime } = await chrome.storage.local.get([
    'matchesCache',
    'matchesCacheTime',
  ]);
  return { matches: matchesCache, time: matchesCacheTime || 0 };
}

export async function setMatchesCache(matches) {
  await chrome.storage.local.set({
    matchesCache: matches,
    matchesCacheTime: Date.now(),
    lastRefreshError: null,
  });
}

export async function clearMatchesCache() {
  await chrome.storage.local.set({
    matchesCache: null,
    matchesCacheTime: 0,
  });
}
