export function formatKickoff(isoString, timezone = undefined) {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone === 'auto' ? undefined : timezone,
  }).format(date);
}

export function formatTime(isoString, timezone = undefined) {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone === 'auto' ? undefined : timezone,
  }).format(date);
}

export function formatDateLabel(isoString, timezone = undefined) {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: timezone === 'auto' ? undefined : timezone,
  }).format(date);
}

export function getCountdown(isoString) {
  const diff = new Date(isoString) - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function toDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isSameDay(isoString, reference = new Date(), timezone = undefined) {
  const opts = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone === 'auto' ? undefined : timezone };
  const a = new Intl.DateTimeFormat('en-CA', opts).format(new Date(isoString));
  const b = new Intl.DateTimeFormat('en-CA', opts).format(reference);
  return a === b;
}

export function isTomorrow(isoString, timezone = undefined) {
  const tomorrow = addDays(new Date(), 1);
  return isSameDay(isoString, tomorrow, timezone);
}

export function isWithinDays(isoString, days, timezone = undefined) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = addDays(start, days);
  end.setHours(23, 59, 59, 999);
  const kickoff = new Date(isoString).getTime();
  return kickoff >= start.getTime() && kickoff <= end.getTime();
}

export function formatRelativeUpdate(timestamp) {
  if (!timestamp) return '';
  const mins = Math.floor((Date.now() - timestamp) / 60000);
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated on ${formatKickoff(new Date(timestamp).toISOString())}`;
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
