# Football Match Tracker

A Manifest V3 Chrome extension for tracking upcoming football (soccer) matches, live scores, and kickoff reminders.

## Features

- **Match dashboard** — Today, live, and tomorrow tabs with team crests, competition, kickoff time (local timezone), status, and scores
- **Competition selection** — Enable/disable 30+ competitions with search, select all/none, and auto-discovery of new competitions
- **Reminders** — 30 min, 1 hour, 2 hour, or custom reminders via Chrome Alarms + Notifications
- **Favorites** — Pin favorite clubs and competitions to the top of the list
- **Live updates** — Background refresh every 2 minutes; badge shows live match count
- **Themes** — Dark, light, or system appearance

## Install (Developer Mode)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder (`chrome-app`)

## API Key Setup

The extension uses [football-data.org](https://www.football-data.org/) for match data.

1. Register for a free account at https://www.football-data.org/client/register
2. Copy your API token
3. Open extension **Settings** (gear icon in popup)
4. Paste the token and save

**Free tier includes:** Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Eredivisie, Primeira Liga, Championship, Champions League, European Championship, Brasileirão, and World Cup.

**Demo mode** works without an API key using sample matches so you can explore the UI immediately.

## Usage

### Popup

- **Today / Live / Tomorrow** — Filter matches by day or live status
- **Reminders** — View and cancel scheduled reminders
- **Search** — Filter by team or competition name
- **🔔 buttons** — Tap to set/cancel kickoff reminders (tap again to cancel)
- **★** — Add home team to favorites

### Settings

- Configure API key, theme, timezone, and default reminders
- Select competitions to follow
- Search and add favorite teams

## Permissions

| Permission   | Purpose                                      |
|-------------|----------------------------------------------|
| `storage`   | Save preferences, cache, and reminders       |
| `alarms`    | Schedule kickoff reminders                   |
| `notifications` | Alert before matches                     |
| `api.football-data.org` | Fetch fixtures and scores          |

## Project Structure

```
chrome-app/
├── manifest.json
├── icons/
├── src/
│   ├── background/service-worker.js
│   ├── lib/          # Shared modules (API, storage, reminders)
│   ├── popup/        # Extension popup UI
│   └── options/      # Settings page
```

## Development

No build step required — pure ES modules loaded by Chrome.

After editing, reload the extension on `chrome://extensions`.

## Limitations

- Competitions without a football-data.org code are listed but not yet fetchable
- Free API tier has delayed scores and a 10 requests/minute rate limit
- Live score updates require a paid football-data.org plan for real-time data
