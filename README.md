<p align="center">
  <img src="assets/logo.png" width="80" />
</p>

<h1 align="center">Uplift Forge</h1>

<p align="center">
  <em>Your engineering team's performance, forged into something useful.</em>
</p>

<p align="center">
  A desktop app that plugs into JIRA and turns messy ticket data into clear metrics, beautiful charts, and actionable insights. No servers. No Docker. No "let me set up the backend real quick." Just install, connect, and see what your team's been up to.
</p>

---

## What It Does (the short version)

You connect to JIRA. Uplift Forge pulls your tickets, crunches the numbers, and gives you:

- **Engineering Hours** — auto-calculated from status transitions, respecting office hours, weekends, and blocked periods
- **Team Metrics** — 9 KPI cards with trends, charts, breakdowns by business unit and work stream
- **Individual Metrics** — per-engineer performance with team comparisons
- **Smart Attribution** — rule-based classification of tickets into business units and work streams
- **JIRA Write-back** — edit fields inline and push them straight back to JIRA

All data stays on your machine. Your credentials live in your OS keychain. Nothing leaves your laptop.

---

## Getting Started

### 1. Clone & install

```bash
git clone git@github.com:pmomio/uplift-forge.git
cd uplift-forge
npm install
```

### 2. Fire it up

```bash
npm start
```

### 3. Connect to JIRA

On first launch you'll see a login screen. You need three things:

| Field | Where to get it |
|-------|----------------|
| **JIRA Base URL** | Your Atlassian URL, e.g. `https://your-org.atlassian.net` |
| **Email** | The email on your Atlassian account |
| **API Token** | Generate one at [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens) |

That's it. No OAuth dance, no callback URLs, no environment variables. Your credentials are encrypted at rest using your OS keychain (macOS Keychain / Windows DPAPI).

### 4. Configure your project

Head to **Settings** and:

1. Set your **JIRA Project Key** (e.g. `ACTIN`)
2. Click **Fetch Fields** to load your custom fields and statuses
3. Map your JIRA custom fields (TPD BU, Engineering Hours, Work Stream, Story Points)
4. Set the **start** and **end** statuses for engineering hours calculation (e.g. "In Progress" -> "Code Review")
5. Optionally set up mapping rules for auto-classification

Hit save, and you're off to the races.

---

## The Five Tabs

### Home

A friendly welcome screen with a getting-started guide. Nothing fancy — just helpful.

### Engineering Attribution

The workhorse. A sortable, filterable table of all your resolved tickets. For each one:

- **Engineering Hours**: Click the calculator icon to auto-compute hours from status changelogs. The engine tracks every cycle a ticket goes through (In Progress -> Code Review -> back to In Progress -> Code Review again) and sums up all active development time. Office hours only, weekends excluded.
- **TPD BU & Work Stream**: Click to auto-classify using your mapping rules, or edit inline.
- **Save to JIRA**: Push your changes back with one click.

Bulk buttons at the top let you calculate and save everything at once.

### Team Metrics

Nine KPI cards showing your team's output:

| Metric | What it tells you |
|--------|------------------|
| Total Tickets | Volume of completed work |
| Story Points | Scope delivered |
| Engineering Hours | Actual time invested |
| Estimation Accuracy | How close your estimates are to reality (1.0 = perfect) |
| Avg Hours/SP | Time efficiency per story point |
| Avg Cycle Time | Average development time per ticket |
| Bug Count & Ratio | Quality signal |
| Bug Hours % | How much time goes to fixing bugs |

Each card shows a trend badge comparing to the previous period. Filter by **Weekly**, **Bi-weekly**, **Monthly**, or **All Time**.

Below the cards: monthly trend charts, business unit breakdowns, work stream pie charts, and issue type distributions. Everything built with Recharts.

### Individual Metrics

Same depth, but per-engineer. Pick your tracked team members in Settings, and you'll see:

- Personal KPI cards with trend arrows
- A "vs team average" comparison for each metric
- Side-by-side bar charts across the team

Two bonus metrics here: **Complexity Score** (average SP per ticket) and **Focus Ratio** (percentage of product work).

### Settings

Four tabs:

- **General** — Project key, data range (1-12 months), field ID mappings, ticket filters
- **Metrics** — Story point calibration (SP-to-days ratio) and tracked engineers
- **Attribution** — Visual rule builder for TPD BU and Work Stream (supports AND/OR logic on parent key, labels, components, summary, etc.)
- **Application** — Version info, manual update check

---

## How Engineering Hours Work

This is the core of the app, so here's how it works under the hood:

```
Ticket lifecycle:  ToDo -> In Progress -> Blocked -> In Progress -> Code Review -> In Progress -> Code Review -> Done
                           |______________|         |_______________|            |_______________|
                             Period 1                   Period 2                     Period 3

Engineering Hours = office_hours(Period 1) + office_hours(Period 2) + office_hours(Period 3)
```

A state machine walks through every status transition in the changelog:

- **idle** -> Ticket enters the start status -> **active** (clock starts)
- **active** -> Ticket enters an excluded status -> **blocked** (clock pauses)
- **blocked** -> Ticket leaves excluded status -> **active** (clock resumes)
- **active** -> Ticket enters the end status -> **idle** (clock stops, period recorded)

This repeats for every cycle. All periods are summed. Office hours are computed timezone-aware (default: 09:00-18:00 Europe/Berlin, weekdays only).

---

## Privacy & Security

- **Local-first**: All data lives on your machine. No servers, no telemetry, no tracking.
- **Encrypted credentials**: API tokens are stored using your OS's native secure storage (macOS Keychain, Windows DPAPI).
- **GDPR consent**: Users agree to a Privacy Policy and Terms of Service on first login.
- **Reset anytime**: The "Reset App" button in the sidebar wipes all stored data and credentials.

The only external calls are to the JIRA REST API (your instance) and GitHub (for update checks).

---

## Development

### Commands

| Command | What it does |
|---------|-------------|
| `npm start` | Launch in dev mode (Vite HMR + Electron) |
| `npm test` | Run all tests |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run lint` | ESLint |
| `npm run package` | Package the app |
| `npm run make` | Build distributables (DMG / Squirrel / ZIP) |
| `npm run publish` | Publish to GitHub Releases |

### Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Electron 33 |
| Frontend | React 19, Tailwind CSS 4, Recharts, Lucide icons |
| Language | TypeScript 5.9 (strict mode) |
| Build | Electron Forge + Vite |
| Testing | Vitest + Testing Library + jsdom |
| Date/Time | Luxon (timezone-aware) |
| Storage | electron-store (JSON on disk) |
| Auth | API token, encrypted via safeStorage |

### Project Layout

```
src/
  main/           Electron main process
    auth/           Credential storage (OS keychain)
    ipc/            IPC handler registrations
    services/       Business logic (config, JIRA, tickets, metrics, field engine, updates)
  renderer/       React frontend
    pages/          Home, Login, Attribution, Team Metrics, Individual Metrics
    components/     Sidebar, ConfigPanel, TicketTable, RuleBuilder, etc.
  shared/         Types and IPC channel constants
test/
  main/           Service unit tests
```

### Testing

279 tests across 14 test suites. Coverage thresholds enforced:

| Metric | Threshold |
|--------|-----------|
| Statements | 90% |
| Branches | 80% |
| Functions | 85% |
| Lines | 90% |

---

## Building for Distribution

```bash
# macOS DMG
npm run make

# All platforms (DMG, Squirrel installer, ZIP)
npm run make
```

Releases are published to GitHub via `npm run publish`. The app checks for updates automatically every 4 hours (or manually from Settings).

---

## License

MIT

---

<p align="center">
  Built by <a href="https://www.parijatmukherjee.com">Parijat Mukherjee</a>
</p>
