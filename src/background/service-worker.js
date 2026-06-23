import { fetchMatches } from '../lib/api.js';
import { countLiveMatches } from '../lib/matches.js';
import {
  handleAlarm,
  rescheduleAllReminders,
  applyDefaultReminders,
} from '../lib/reminders.js';
import { getSettings, getMatchesCache, clearMatchesCache, saveSettings } from '../lib/storage.js';
import { DEFAULT_ENABLED } from '../lib/competitions.js';

const REFRESH_ALARM = 'refresh-matches';

async function updateBadge() {
  try {
    const { matches } = await getMatchesCache();
    const live = countLiveMatches(matches || []);
    if (live > 0) {
      await chrome.action.setBadgeText({ text: String(live) });
      await chrome.action.setBadgeBackgroundColor({ color: '#e53935' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch {
    await chrome.action.setBadgeText({ text: '' });
  }
}

async function refreshMatches(force = false) {
  const result = await fetchMatches({ force });
  await applyDefaultReminders(result.matches);
  await updateBadge();
  return result;
}

async function setupAlarms() {
  await chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: 10 });
  await rescheduleAllReminders();
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const settings = await getSettings();
  if (!settings.apiKey) {
    await saveSettings({ demoMode: true });
  }

  if (details.reason === 'update') {
    await clearMatchesCache();
    const enabled = [...new Set([...settings.enabledCompetitions, ...DEFAULT_ENABLED])];
    await saveSettings({ enabledCompetitions: enabled });
  }

  await setupAlarms();
  await refreshMatches(true);
});

chrome.runtime.onStartup.addListener(async () => {
  await setupAlarms();
  await refreshMatches(false);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    await refreshMatches(false);
    return;
  }
  await handleAlarm(alarm);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'REFRESH_MATCHES') {
    refreshMatches(true).then(sendResponse).catch((e) => sendResponse({ error: e.message }));
    return true;
  }
  if (message.type === 'GET_MATCHES') {
    fetchMatches({ force: message.force }).then(sendResponse).catch((e) => sendResponse({ error: e.message }));
    return true;
  }
  if (message.type === 'UPDATE_BADGE') {
    updateBadge().then(() => sendResponse({ ok: true }));
    return true;
  }
});
