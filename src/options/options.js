import {
  COMPETITIONS,
  FREE_TIER_CODES,
  DEFAULT_ENABLED,
} from '../lib/competitions.js';
import { getSettings, saveSettings } from '../lib/storage.js';
import { searchTeams } from '../lib/api.js';
import { escapeHtml } from '../lib/utils.js';
import { TIMEZONES, getTimezoneLabel } from '../lib/timezones.js';

let settings = null;
let enabledSet = new Set();
let compSearch = '';

const els = {
  apiKey: document.getElementById('api-key'),
  demoMode: document.getElementById('demo-mode'),
  saveApi: document.getElementById('save-api'),
  apiStatus: document.getElementById('api-status'),
  theme: document.getElementById('theme'),
  timezone: document.getElementById('timezone'),
  defaultReminder: document.getElementById('default-reminder'),
  compSearch: document.getElementById('comp-search'),
  competitionList: document.getElementById('competition-list'),
  selectAll: document.getElementById('select-all'),
  selectNone: document.getElementById('select-none'),
  selectFree: document.getElementById('select-free'),
  selectFifa: document.getElementById('select-fifa'),
  teamSearch: document.getElementById('team-search'),
  teamSearchBtn: document.getElementById('team-search-btn'),
  teamResults: document.getElementById('team-results'),
  favoriteTeams: document.getElementById('favorite-teams'),
  favoriteComps: document.getElementById('favorite-comps'),
  saveAll: document.getElementById('save-all'),
};

async function init() {
  settings = await getSettings();
  enabledSet = new Set(settings.enabledCompetitions);
  populateTimezoneOptions();
  bindValues();
  applyTheme(settings.theme);
  renderCompetitions();
  renderFavoriteTeams();
  renderFavoriteComps();
  bindEvents();
}

function populateTimezoneOptions() {
  for (const { id, label } of TIMEZONES) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = label;
    els.timezone.appendChild(opt);
  }

  const saved = settings.timezone || 'auto';
  if (saved !== 'auto' && !TIMEZONES.some((tz) => tz.id === saved)) {
    const opt = document.createElement('option');
    opt.value = saved;
    opt.textContent = getTimezoneLabel(saved);
    els.timezone.appendChild(opt);
  }

  els.timezone.value = saved;
}

function bindValues() {
  els.apiKey.value = settings.apiKey || '';
  els.demoMode.checked = settings.demoMode;
  els.theme.value = settings.theme || 'system';
  els.defaultReminder.value = settings.defaultReminderMinutes?.toString() || '';
}

function applyTheme(theme) {
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
}

function bindEvents() {
  els.saveApi.addEventListener('click', async () => {
    await saveSettings({
      apiKey: els.apiKey.value.trim(),
      demoMode: els.demoMode.checked,
    });
    showStatus('API settings saved. Refreshing matches…');
    chrome.runtime.sendMessage({ type: 'REFRESH_MATCHES' });
  });

  els.theme.addEventListener('change', () => applyTheme(els.theme.value));

  els.selectAll.addEventListener('click', () => {
    enabledSet = new Set(COMPETITIONS.map((c) => c.id));
    renderCompetitions();
  });

  els.selectNone.addEventListener('click', () => {
    enabledSet.clear();
    renderCompetitions();
  });

  els.selectFree.addEventListener('click', () => {
    enabledSet = new Set(DEFAULT_ENABLED.filter((id) => {
      const c = COMPETITIONS.find((x) => x.id === id);
      return c?.apiCode && FREE_TIER_CODES.has(c.apiCode);
    }));
    renderCompetitions();
  });

  els.selectFifa.addEventListener('click', () => {
    enabledSet = new Set(
      COMPETITIONS.filter((c) => c.category === 'FIFA' && c.apiCode).map((c) => c.id)
    );
    renderCompetitions();
  });

  els.compSearch.addEventListener('input', (e) => {
    compSearch = e.target.value.toLowerCase();
    renderCompetitions();
  });

  els.teamSearchBtn.addEventListener('click', searchTeamHandler);
  els.teamSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchTeamHandler();
  });

  els.saveAll.addEventListener('click', saveAllSettings);
}

function renderCompetitions() {
  const filtered = COMPETITIONS.filter(
    (c) =>
      !compSearch ||
      c.name.toLowerCase().includes(compSearch) ||
      c.category.toLowerCase().includes(compSearch)
  );

  const grouped = {};
  for (const comp of filtered) {
    if (!grouped[comp.category]) grouped[comp.category] = [];
    grouped[comp.category].push(comp);
  }

  els.competitionList.innerHTML = Object.entries(grouped)
    .map(
      ([category, comps]) => `
      <div class="comp-group">
        <div class="comp-meta" style="padding:8px 4px;font-weight:700;color:var(--text)">${escapeHtml(category)}</div>
        ${comps.map(renderCompRow).join('')}
      </div>
    `
    )
    .join('');

  els.competitionList.querySelectorAll('.comp-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const cb = row.querySelector('input');
      cb.checked = !cb.checked;
      toggleComp(cb.dataset.id, cb.checked);
    });
    row.querySelector('input').addEventListener('change', (e) => {
      toggleComp(e.target.dataset.id, e.target.checked);
    });
  });
}

function renderCompRow(comp) {
  const checked = enabledSet.has(comp.id);
  const isFree = comp.apiCode && FREE_TIER_CODES.has(comp.apiCode);
  const badge = comp.apiCode
    ? isFree
      ? '<span class="comp-badge">Free tier</span>'
      : '<span class="comp-badge paid">Paid tier</span>'
    : '<span class="comp-badge paid">Coming soon</span>';

  return `
    <label class="comp-row${comp.apiCode ? '' : ' unavailable'}" data-id="${comp.id}">
      <input type="checkbox" data-id="${comp.id}" ${checked ? 'checked' : ''} />
      <div class="comp-info">
        <div class="comp-name">${escapeHtml(comp.name)}</div>
        <div class="comp-meta">${comp.apiCode ? `API: ${comp.apiCode}` : 'Not yet available via API'}</div>
      </div>
      ${badge}
    </label>
  `;
}

function toggleComp(id, enabled) {
  if (enabled) enabledSet.add(id);
  else enabledSet.delete(id);
}

function renderFavoriteTeams() {
  if (!settings.favoriteTeams.length) {
    els.favoriteTeams.innerHTML = '<span class="help">No favorite teams yet.</span>';
    return;
  }
  els.favoriteTeams.innerHTML = settings.favoriteTeams
    .map(
      (t) => `
    <span class="chip">
      ${t.crest ? `<img src="${escapeHtml(t.crest)}" width="16" height="16" alt="" />` : ''}
      ${escapeHtml(t.name)}
      <button data-team-id="${t.id}" class="remove-team" title="Remove">×</button>
    </span>
  `
    )
    .join('');

  els.favoriteTeams.querySelectorAll('.remove-team').forEach((btn) => {
    btn.addEventListener('click', async () => {
      settings.favoriteTeams = settings.favoriteTeams.filter(
        (t) => t.id !== Number(btn.dataset.teamId)
      );
      await saveSettings({ favoriteTeams: settings.favoriteTeams });
      renderFavoriteTeams();
    });
  });
}

function renderFavoriteComps() {
  const favComps = settings.favoriteCompetitions
    .map((id) => COMPETITIONS.find((c) => c.id === id))
    .filter(Boolean);

  if (!favComps.length) {
    els.favoriteComps.innerHTML =
      '<span class="help">Star competitions from the popup or enable them here.</span>';
    return;
  }

  els.favoriteComps.innerHTML = favComps
    .map(
      (c) => `
    <span class="chip">
      ${escapeHtml(c.name)}
      <button data-comp-id="${c.id}" class="remove-comp" title="Remove">×</button>
    </span>
  `
    )
    .join('');

  els.favoriteComps.querySelectorAll('.remove-comp').forEach((btn) => {
    btn.addEventListener('click', async () => {
      settings.favoriteCompetitions = settings.favoriteCompetitions.filter(
        (id) => id !== btn.dataset.compId
      );
      await saveSettings({ favoriteCompetitions: settings.favoriteCompetitions });
      renderFavoriteComps();
    });
  });

  const quickAdd = COMPETITIONS.filter(
    (c) => enabledSet.has(c.id) && !settings.favoriteCompetitions.includes(c.id)
  )
    .slice(0, 8)
    .map(
      (c) =>
        `<button class="btn" data-add-fav="${c.id}" style="margin:4px 4px 0 0">+ ${escapeHtml(c.name)}</button>`
    )
    .join('');

  if (quickAdd) {
    els.favoriteComps.insertAdjacentHTML(
      'beforeend',
      `<div style="width:100%;margin-top:10px">${quickAdd}</div>`
    );
    els.favoriteComps.querySelectorAll('[data-add-fav]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        settings.favoriteCompetitions.push(btn.dataset.addFav);
        await saveSettings({ favoriteCompetitions: settings.favoriteCompetitions });
        renderFavoriteComps();
      });
    });
  }
}

async function searchTeamHandler() {
  const q = els.teamSearch.value.trim();
  if (!q) return;

  const apiKey = els.apiKey.value.trim() || settings.apiKey;
  if (!apiKey) {
    showStatus('Enter an API key to search teams.', true);
    return;
  }

  const teams = await searchTeams(q, apiKey);
  if (!teams.length) {
    els.teamResults.classList.remove('hidden');
    els.teamResults.innerHTML = '<div class="team-result">No teams found.</div>';
    return;
  }

  els.teamResults.classList.remove('hidden');
  els.teamResults.innerHTML = teams
    .map(
      (t) => `
    <div class="team-result" data-id="${t.id}" data-name="${escapeHtml(t.name)}" data-crest="${escapeHtml(t.crest || '')}">
      ${t.crest ? `<img src="${escapeHtml(t.crest)}" alt="" />` : ''}
      <span>${escapeHtml(t.name)}</span>
    </div>
  `
    )
    .join('');

  els.teamResults.querySelectorAll('.team-result').forEach((row) => {
    if (!row.dataset.id) return;
    row.addEventListener('click', async () => {
      const team = {
        id: Number(row.dataset.id),
        name: row.dataset.name,
        crest: row.dataset.crest || null,
      };
      if (!settings.favoriteTeams.some((t) => t.id === team.id)) {
        settings.favoriteTeams.push(team);
        await saveSettings({ favoriteTeams: settings.favoriteTeams });
        renderFavoriteTeams();
      }
      els.teamResults.classList.add('hidden');
      els.teamSearch.value = '';
    });
  });
}

async function saveAllSettings() {
  const defaultVal = els.defaultReminder.value;
  await saveSettings({
    apiKey: els.apiKey.value.trim(),
    demoMode: els.demoMode.checked,
    theme: els.theme.value,
    timezone: els.timezone.value,
    defaultReminderMinutes: defaultVal ? Number(defaultVal) : null,
    enabledCompetitions: [...enabledSet],
  });

  showStatus('All settings saved!');
  chrome.runtime.sendMessage({ type: 'REFRESH_MATCHES' });
}

function showStatus(msg, isError = false) {
  els.apiStatus.textContent = msg;
  els.apiStatus.classList.toggle('error', isError);
  els.apiStatus.classList.remove('hidden');
  setTimeout(() => els.apiStatus.classList.add('hidden'), 4000);
}

init();
