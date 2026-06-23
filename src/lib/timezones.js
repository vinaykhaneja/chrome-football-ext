/** Common timezones for kickoff display. Values are IANA zone IDs. */
export const TIMEZONES = [
  { id: 'Asia/Kolkata', label: 'India (IST)' },
  { id: 'Europe/London', label: 'UK & Ireland' },
  { id: 'Europe/Paris', label: 'Western Europe' },
  { id: 'Europe/Berlin', label: 'Central Europe' },
  { id: 'Europe/Istanbul', label: 'Turkey' },
  { id: 'America/New_York', label: 'US Eastern' },
  { id: 'America/Chicago', label: 'US Central' },
  { id: 'America/Denver', label: 'US Mountain' },
  { id: 'America/Los_Angeles', label: 'US Pacific' },
  { id: 'America/Sao_Paulo', label: 'Brazil' },
  { id: 'America/Mexico_City', label: 'Mexico' },
  { id: 'Africa/Johannesburg', label: 'South Africa' },
  { id: 'Asia/Dubai', label: 'UAE & Gulf' },
  { id: 'Asia/Singapore', label: 'Singapore & Malaysia' },
  { id: 'Asia/Tokyo', label: 'Japan' },
  { id: 'Asia/Seoul', label: 'South Korea' },
  { id: 'Australia/Sydney', label: 'Australia (East)' },
  { id: 'Australia/Perth', label: 'Australia (West)' },
  { id: 'Pacific/Auckland', label: 'New Zealand' },
  { id: 'UTC', label: 'UTC' },
];

export function getTimezoneLabel(id) {
  const match = TIMEZONES.find((tz) => tz.id === id);
  if (match) return match.label;
  return id.replace(/_/g, ' ');
}
