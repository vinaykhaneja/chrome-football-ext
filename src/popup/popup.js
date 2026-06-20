import {
  sortMatches,
  filterMatches,
  countLiveMatches,
  getStatusLabel,
  getScoreDisplay,
} from '../lib/matches.js';
import {
  addReminder,
  removeReminder,
  getRemindersForMatch,
  getUpcomingReminders,
  formatReminderLabel,
} from '../lib/reminders.js';
import { toggleFavoriteTeam, buildCalendarUrl } from '../lib/favorites.js';
import { getSettings } from '../lib/storage.js';
import {
  formatKickoff,
  formatTime,
  getCountdown,
  escapeHtml,
  formatRelativeUpdate,
} from '../lib/utils.js';

let state = {
  matches: [],
  settings: null,
  activeTab: 'today',
  search: '',
  matchReminders: new Map(),
};

const els = {
  loading: document.getElementById('loading'),
  matchList: document.getElementById('match-list'),
  reminderList: document.getElementById('reminder-list'),
  empty: document.getElementById('empty-state'),
  demoBanner: document.getElementById('demo-banner'),
  updatedBanner: document.getElementById('updated-banner'),
  errorBanner: document.getElementById('error-banner'),
  liveCount: document.getElementById('live-count'),
  searchInput: document.getElementById('search-input'),
};

async function init() {
  state.settings = await getSettings();
  applyTheme(state.settings.theme);
  bindEvents();
  await loadData();
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelector('.tab.active')?.classList.remove('active');
      tab.classList.add('active');
      state.activeTab = tab.dataset.tab;
      render();
    });
  });

  els.searchInput.addEventListener('input', (e) => {
    state.search = e.target.value;
    render();
  });

  document.getElementById('refresh-btn').addEventListener('click', async () => {
    els.loading.classList.remove('hidden');
    els.matchList.classList.add('hidden');
    await loadData(true);
  });

  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

async function loadData(force = false) {
  try {
    const result = await chrome.runtime.sendMessage({ type: 'GET_MATCHES', force });
    if (result.error && !result.matches?.length) throw new Error(result.error);

    state.matches = result.matches || [];
    state.settings = await getSettings();

    els.demoBanner.classList.toggle('hidden', !result.demo && state.settings.apiKey);
    if (result.demo) {
      els.updatedBanner.classList.add('hidden');
    } else if (result.cacheTime) {
      els.updatedBanner.textContent = formatRelativeUpdate(result.cacheTime);
      if (result.fromCache) {
        els.updatedBanner.textContent += ' · tap ↻ to refresh';
      }
      els.updatedBanner.classList.remove('hidden');
    }
    if (result.error) {
      els.errorBanner.textContent = `Using cached data: ${result.error}`;
      els.errorBanner.classList.remove('hidden');
    } else {
      els.errorBanner.classList.add('hidden');
    }

    const live = countLiveMatches(state.matches);
    if (live > 0) {
      els.liveCount.textContent = live;
      els.liveCount.classList.remove('hidden');
    } else {
      els.liveCount.classList.add('hidden');
    }

    await loadMatchReminders();
    render();
  } catch (err) {
    els.errorBanner.textContent = err.message;
    els.errorBanner.classList.remove('hidden');
    els.loading.classList.add('hidden');
  }
}

async function loadMatchReminders() {
  state.matchReminders.clear();
  for (const match of state.matches) {
    const rems = await getRemindersForMatch(match.id);
    state.matchReminders.set(match.id, rems);
  }
}

function render() {
  els.loading.classList.add('hidden');

  if (state.activeTab === 'reminders') {
    renderReminders();
    return;
  }

  const filtered = filterMatches(sortMatches(state.matches, state.settings), {
    tab: state.activeTab,
    search: state.search,
    timezone: state.settings.timezone,
  });

  els.reminderList.classList.add('hidden');

  if (!filtered.length) {
    els.matchList.classList.add('hidden');
    els.empty.classList.remove('hidden');
    return;
  }

  els.empty.classList.add('hidden');
  els.matchList.classList.remove('hidden');
  els.matchList.innerHTML = filtered.map(renderMatchCard).join('');
  bindMatchEvents();
}

async function renderReminders() {
  els.matchList.classList.add('hidden');
  const reminders = await getUpcomingReminders();

  if (!reminders.length) {
    els.reminderList.classList.add('hidden');
    els.empty.classList.remove('hidden');
    els.empty.querySelector('p').textContent = 'No upcoming reminders.';
    return;
  }

  els.empty.classList.add('hidden');
  els.reminderList.classList.remove('hidden');
  els.reminderList.innerHTML = reminders.map((r) => {
    const m = r.match;
    return `
      <div class="reminder-card" data-id="${r.id}">
        <div class="reminder-info">
          <h3>${escapeHtml(m.homeTeam.name)} vs ${escapeHtml(m.awayTeam.name)}</h3>
          <p>${escapeHtml(m.competition.name)} · ${formatReminderLabel(r.minutesBefore)} · ${formatKickoff(m.utcDate, state.settings.timezone)}</p>
        </div>
        <button class="btn btn-danger cancel-reminder" data-id="${r.id}">Cancel</button>
      </div>
    `;
  }).join('');

  els.reminderList.querySelectorAll('.cancel-reminder').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await removeReminder(btn.dataset.id);
      showToast('Reminder cancelled');
      await loadMatchReminders();
      renderReminders();
    });
  });
}

function isFavorite(match) {
  const favTeams = new Set([
    ...state.settings.favoriteTeams.map((t) => t.id),
    ...state.settings.favoriteNationalTeams.map((t) => t.id),
  ]);
  const favComps = new Set(state.settings.favoriteCompetitions);
  return (
    favTeams.has(match.homeTeam.id) ||
    favTeams.has(match.awayTeam.id) ||
    favComps.has(match.competition.id)
  );
}

function renderMatchCard(match) {
  const statusLabel = getStatusLabel(match);
  const score = getScoreDisplay(match);
  const countdown = match.status === 'upcoming' ? getCountdown(match.utcDate) : null;
  const rems = state.matchReminders.get(match.id) || [];
  const remMinutes = new Set(rems.map((r) => r.minutesBefore));
  const fav = isFavorite(match);

  const crest = (url, alt) =>
    url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" onerror="this.style.display='none'" />` : '';

  return `
    <article class="match-card${fav ? ' favorite' : ''}" data-match-id="${match.id}">
      <div class="match-meta">
        <span class="competition">
          ${crest(match.competition.emblem, match.competition.name)}
          ${escapeHtml(match.competition.name || '')}
        </span>
        ${statusLabel ? `<span class="status-pill ${match.status}">${escapeHtml(statusLabel)}</span>` : ''}
      </div>
      <div class="teams">
        <div class="team home">
          ${crest(match.homeTeam.crest, match.homeTeam.name)}
          <span class="team-name">${escapeHtml(match.homeTeam.shortName || match.homeTeam.name)}</span>
        </div>
        <div class="score-block">
          ${score ? `<div class="score">${score}</div>` : `<div class="countdown">${countdown || formatTime(match.utcDate, state.settings.timezone)}</div>`}
          ${countdown && score ? `<div class="countdown">${countdown}</div>` : ''}
        </div>
        <div class="team away">
          ${crest(match.awayTeam.crest, match.awayTeam.name)}
          <span class="team-name">${escapeHtml(match.awayTeam.shortName || match.awayTeam.name)}</span>
        </div>
      </div>
      <div class="kickoff">${formatKickoff(match.utcDate, state.settings.timezone)}</div>
      <div class="match-actions">
        ${[30, 60, 120].map((min) => `
          <button class="btn reminder-btn${remMinutes.has(min) ? ' active' : ''}" data-min="${min}" data-match-id="${match.id}">
            🔔 ${min >= 60 ? min / 60 + 'h' : min + 'm'}
          </button>
        `).join('')}
        <div class="custom-reminder-row">
          <input type="number" min="5" max="1440" placeholder="min" class="custom-min" data-match-id="${match.id}" />
          <button class="btn custom-reminder-btn" data-match-id="${match.id}">Custom</button>
        </div>
        <button class="btn btn-fav${state.settings.favoriteTeams.some((t) => t.id === match.homeTeam.id) ? ' active' : ''}" data-team-id="${match.homeTeam.id}" data-team-name="${escapeHtml(match.homeTeam.name)}" data-team-crest="${escapeHtml(match.homeTeam.crest || '')}" title="Favorite home team">★</button>
        <button class="btn calendar-btn" data-match-id="${match.id}" title="Add to calendar">📅</button>
      </div>
    </article>
  `;
}

function bindMatchEvents() {
  els.matchList.querySelectorAll('.reminder-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const match = state.matches.find((m) => m.id === Number(btn.dataset.matchId));
      const min = Number(btn.dataset.min);
      if (!match) return;

      if (btn.classList.contains('active')) {
        const rems = state.matchReminders.get(match.id) || [];
        const rem = rems.find((r) => r.minutesBefore === min);
        if (rem) {
          await removeReminder(rem.id);
          showToast('Reminder cancelled');
        }
      } else {
        try {
          await addReminder(match, min);
          showToast(`Reminder set for ${formatReminderLabel(min)}`);
        } catch (e) {
          showToast(e.message, true);
        }
      }
      await loadMatchReminders();
      render();
    });
  });

  els.matchList.querySelectorAll('.custom-reminder-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const matchId = Number(btn.dataset.matchId);
      const input = els.matchList.querySelector(`.custom-min[data-match-id="${matchId}"]`);
      const min = Number(input.value);
      const match = state.matches.find((m) => m.id === matchId);
      if (!match || !min || min < 5) {
        showToast('Enter at least 5 minutes', true);
        return;
      }
      try {
        await addReminder(match, min);
        showToast(`Reminder set for ${formatReminderLabel(min)}`);
        input.value = '';
        await loadMatchReminders();
        render();
      } catch (e) {
        showToast(e.message, true);
      }
    });
  });

  els.matchList.querySelectorAll('.btn-fav').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await toggleFavoriteTeam({
        id: Number(btn.dataset.teamId),
        name: btn.dataset.teamName,
        crest: btn.dataset.teamCrest || null,
      });
      state.settings = await getSettings();
      render();
    });
  });

  els.matchList.querySelectorAll('.calendar-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const match = state.matches.find((m) => m.id === Number(btn.dataset.matchId));
      if (!match) return;
      chrome.tabs.create({ url: buildCalendarUrl(match, 'google') });
    });
  });
}

function showToast(message, isError = false) {
  const existing = document.querySelector('.toast');
  existing?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  if (isError) toast.style.borderColor = 'var(--live)';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

init();
