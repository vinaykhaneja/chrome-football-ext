import { generateId } from './utils.js';
import { getReminders, saveReminders, getSettings } from './storage.js';

const ALARM_PREFIX = 'match-reminder-';

export function reminderAlarmName(id) {
  return `${ALARM_PREFIX}${id}`;
}

export async function addReminder(match, minutesBefore) {
  const kickoff = new Date(match.utcDate).getTime();
  const remindAt = kickoff - minutesBefore * 60000;

  if (remindAt <= Date.now()) {
    throw new Error('Kickoff is too soon for this reminder.');
  }

  const reminders = await getReminders();
  const duplicate = reminders.find(
    (r) => r.matchId === match.id && r.minutesBefore === minutesBefore
  );
  if (duplicate) return duplicate;

  const reminder = {
    id: generateId(),
    matchId: match.id,
    minutesBefore,
    remindAt,
    match: {
      id: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      competition: match.competition,
      utcDate: match.utcDate,
    },
    createdAt: Date.now(),
  };

  reminders.push(reminder);
  await saveReminders(reminders);
  await scheduleAlarm(reminder);
  return reminder;
}

export async function removeReminder(id) {
  const reminders = await getReminders();
  const filtered = reminders.filter((r) => r.id !== id);
  await saveReminders(filtered);
  await chrome.alarms.clear(reminderAlarmName(id));
}

export async function getRemindersForMatch(matchId) {
  const reminders = await getReminders();
  return reminders.filter((r) => r.matchId === matchId);
}

export async function getUpcomingReminders() {
  const reminders = await getReminders();
  return reminders
    .filter((r) => r.remindAt > Date.now())
    .sort((a, b) => a.remindAt - b.remindAt);
}

export async function scheduleAlarm(reminder) {
  await chrome.alarms.create(reminderAlarmName(reminder.id), {
    when: reminder.remindAt,
  });
}

export async function rescheduleAllReminders() {
  const reminders = await getReminders();
  const valid = reminders.filter((r) => r.remindAt > Date.now());
  if (valid.length !== reminders.length) {
    await saveReminders(valid);
  }
  for (const r of valid) {
    await scheduleAlarm(r);
  }
}

export async function applyDefaultReminders(matches) {
  const settings = await getSettings();
  if (!settings.defaultReminderMinutes) return;

  const existing = await getReminders();
  const existingKeys = new Set(existing.map((r) => `${r.matchId}-${r.minutesBefore}`));

  for (const match of matches) {
    if (match.status !== 'upcoming') continue;
    const key = `${match.id}-${settings.defaultReminderMinutes}`;
    if (existingKeys.has(key)) continue;
    try {
      await addReminder(match, settings.defaultReminderMinutes);
    } catch {
      // kickoff too soon
    }
  }
}

export function formatReminderLabel(minutesBefore) {
  if (minutesBefore >= 60 && minutesBefore % 60 === 0) {
    const h = minutesBefore / 60;
    return `${h} hour${h > 1 ? 's' : ''} before`;
  }
  return `${minutesBefore} min before`;
}

export async function handleAlarm(alarm) {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;

  const id = alarm.name.slice(ALARM_PREFIX.length);
  const reminders = await getReminders();
  const reminder = reminders.find((r) => r.id === id);
  if (!reminder) return;

  const { match } = reminder;
  const title = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
  const body = `Kickoff in ${formatReminderLabel(reminder.minutesBefore)} · ${match.competition.name}`;

  await chrome.notifications.create(`notification-${id}`, {
    type: 'basic',
    iconUrl: match.homeTeam.crest || chrome.runtime.getURL('icons/icon128.png'),
    title,
    body,
    priority: 2,
  });

  await removeReminder(id);
}
