# Uplift Forge

A standalone Electron desktop app for engineering team performance. Connect via Atlassian SSO — no manual API tokens, no Python, no Docker. Just install, sign in, and go.

## Features

### Team Metrics
- **9 KPI cards** with trend badges: total tickets, story points, eng hours, estimation accuracy, avg hours/SP, avg cycle time, bug count, bug ratio, bug hours %.
- **Period filtering**: All Time, Weekly, Bi-weekly, Monthly with previous-period comparison.
- **Charts**: Monthly trend, Eng Hours by BU, Eng Hours by Work Stream, SP by BU, Issue Type breakdown.
- **Interactive tooltips**: KPI explanations, targets, trend meanings.

### Individual Metrics
- **Per-engineer KPIs**: Tickets, story points, eng hours, cycle time, hours/SP, estimation accuracy, bug ratio, complexity, focus ratio.
- **Team comparison**: Bar charts comparing engineers side-by-side.
- **Tracked engineers**: Select which JIRA members to track.

### Engineering Attribution
- **Engineering Hours**: Auto-calculated from JIRA status transitions (office hours, weekends, excluded statuses).
- **Rule-Based Mapping**: TPD BU and Work Stream auto-assigned via visual AND/OR rule builder.
- **Inline Editing**: Edit fields directly and save back to JIRA.
- **Bulk actions**: Calculate All and Save All for batch operations.

### Configuration
- **JIRA Connection** — Project key, data time range.
- **Team Metrics** — Story points field, SP calibration.
- **Engineering Attribution** — Field mappings, mapping rules.
- **Engineering Hours** — Start/end/excluded statuses.
- **Individual Metrics** — Tracked engineers.

## Quick Start

### 1. Install
```bash
git clone git@github.com:pmomio/uplift-forge.git
cd uplift-forge
npm install
```

### 2. Run
```bash
npm start
```

On first launch, you'll be prompted to enter your Atlassian OAuth app credentials (Client ID and Client Secret). Register an OAuth app at [developer.atlassian.com](https://developer.atlassian.com/console/myapps/) with callback URL `http://localhost:39871/callback`.

After entering credentials, click "Connect to Atlassian" to authenticate via SSO. Your credentials and session are stored securely — no environment variables needed.

## Development Commands

| Command | Description |
|---------|-------------|
| `make setup` | Install dependencies (`npm install`) |
| `make dev` | Start Electron dev server |
| `make test` | Run all tests |
| `make test-coverage` | Run tests with coverage report |
| `make package` | Package the app (unpacked) |
| `make make-dist` | Build distributable (.dmg/.exe) |

## Testing

The project maintains **>90% test coverage** with 274 tests.

Coverage thresholds enforced automatically via vitest:
- Statements: 90%, Branches: 80%, Functions: 85%, Lines: 90%

## Tech Stack

- **Runtime**: Electron + Node.js
- **Backend**: TypeScript services in Electron main process
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Recharts, Lucide React
- **Auth**: Atlassian OAuth 2.0 (3LO) with encrypted token storage
- **Persistence**: electron-store (JSON in OS app data)
- **Packaging**: electron-forge
- **Testing**: Vitest + Testing Library
