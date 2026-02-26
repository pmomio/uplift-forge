# CLAUDE.md

## Project Overview

Uplift Forge — an Electron desktop app for engineering team performance. Connects to JIRA via Atlassian OAuth 2.0 SSO to auto-compute engineering hours, map business metadata via a rule engine, and track team & individual KPIs with trend analysis. No Python, no `.env`, no manual config — users install, sign in, and go.

## Architecture

- **Runtime**: Electron (main process = Node.js/TypeScript backend, renderer = React frontend)
- **Frontend-Backend**: Electron IPC (no HTTP server)
- **Auth**: Atlassian OAuth 2.0 (3LO) — tokens encrypted via `safeStorage` (OS Keychain)
- **Persistence**: `electron-store` JSON files in OS app data directory
- **Packaging**: electron-forge (.dmg for Mac, .exe for Windows)
- **Timezone math**: luxon library

## Repository Structure

```
uplift-forge/
  package.json                    # Electron-forge + all deps
  forge.config.ts                 # Electron Forge config (makers, plugins)
  tsconfig.json                   # Main process TS config
  tsconfig.renderer.json          # Renderer TS config
  vite.main.config.ts             # Vite config for main process
  vite.renderer.config.ts         # Vite config for renderer
  vite.preload.config.ts          # Vite config for preload
  vitest.config.ts                # Test configuration
  postcss.config.js               # PostCSS for Tailwind

  src/
    main/                         # Electron main process (Node.js backend)
      index.ts                    # BrowserWindow, app lifecycle, IPC registration
      preload.ts                  # contextBridge API exposure

      auth/
        oauth.ts                  # Atlassian OAuth 2.0 (3LO) flow
        token-store.ts            # Encrypted token storage (safeStorage + electron-store)

      services/
        config.service.ts         # electron-store config
        jira.service.ts           # JIRA REST API v3 with OAuth Bearer tokens
        field-engine.service.ts   # Office hours calc + rule engine
        ticket.service.ts         # Cache mgmt, sync, processIssue
        metrics.service.ts        # Team + individual KPIs

      ipc/
        handlers.ts               # All ipcMain.handle() registrations

    renderer/                     # React frontend
      index.html
      main.tsx
      App.tsx                     # Auth state gating + layout
      api.ts                      # IPC calls with {data} wrapper
      electron.d.ts               # Type declarations for window.api
      components/                 # Sidebar, ConfigPanel, RuleBuilder, ModalDialog, TicketTable, TicketSummary
      pages/                      # LoginPage, HomePage, TeamMetrics, IndividualMetrics, EngineeringAttribution

    shared/
      types.ts                    # Shared TypeScript interfaces
      channels.ts                 # IPC channel name constants

  test/
    main/                         # Main process tests
```

## Development Commands

```bash
make setup          # npm install
make dev            # npm start (electron-forge dev)
make test           # npm test (vitest)
make test-coverage  # npm run test:coverage
make package        # npm run package
make make-dist      # npm run make (produces .dmg/.exe)
```

## Running Tests

```bash
npm test                    # All tests
npm run test:coverage       # With coverage report
```

## Test Coverage Policy

**All code changes must maintain >90% test coverage.** Enforced by vitest with thresholds:
- Statements: 90%, Branches: 80%, Functions: 85%, Lines: 90%

### Testing conventions
- Mock `electron-store` as in-memory object in main process tests
- Mock `window.api` instead of axios in renderer tests
- Mock `react-hot-toast` in every test file that renders components using toast
- Mock `recharts` in test files that render chart components (no canvas in jsdom)
- The `{ data }` wrapper in api.ts means component tests need minimal changes from the old Axios pattern

## Key Technical Decisions

- **Electron IPC**: All frontend-backend communication via `ipcMain.handle()` / `ipcRenderer.invoke()`. No HTTP server.
- **Atlassian OAuth 2.0**: Tokens stored encrypted via `safeStorage`. Auto-refresh on expiry.
- **JIRA Cloud REST API v3**: Uses `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/...` with Bearer tokens. Pagination uses `nextPageToken`/`isLast`.
- **Absolute dates in JQL**: This JIRA instance silently returns 0 results for relative dates.
- **12-month data cap**: Time range capped at 12 months. Legacy `mode: "all"` treated as 12 months.
- **Rule engine data model**: `Rule[][]` per group — inner arrays are AND-blocks, outer array OR's them. Old flat `Rule[]` format auto-detected.
- **Ticket cache persistence**: In-memory Maps persisted to `electron-store` so data survives app restarts.
- **SP calibration**: `sp_to_days` config (default 1) defines man-days per story point.
- **Toast deduplication**: All `react-hot-toast` calls use `{ id: ... }`.
- **api.ts wraps IPC with `{ data }`**: Components keep using `res.data` unchanged.
- **External links**: Use `window.api.openExternal(url)` instead of `<a target="_blank">`.

## Code Conventions

- All code: TypeScript strict
- Frontend: React 19, Tailwind CSS v4 (dark slate theme, feature-colored accents: indigo=shared, cyan=metrics, violet=attribution, emerald=eng hours, orange=individual)
- Charts: Recharts (LineChart, BarChart, PieChart)
- Icons: Lucide React only
- Tests: Vitest + @testing-library/react + @testing-library/jest-dom
- Timezone: luxon (DateTime, setZone)
- Commit style: imperative mood, concise summary line

## Environment Variables

```
ATLASSIAN_CLIENT_ID=      # OAuth app Client ID (from Atlassian Developer Console)
ATLASSIAN_CLIENT_SECRET=  # OAuth app Client Secret
```

## Things to Watch Out For

- The `total` field in JIRA search responses returns 0 (unreliable) — rely on `isLast` for pagination
- Changing project key or ticket filter triggers a full re-sync; changing only mapping rules triggers `reprocessCache()`
- Final statuses for dashboard display: Done, Rejected, Closed, Resolved, Cancelled
- `ticket_filter.mode` accepts `last_x_months` or `missing_fields` (legacy `all` treated as 12 months)
- RuleBuilder `color` prop accepts `indigo`, `emerald`, or `violet`
- `safeStorage` is only available after `app.ready` — don't call token-store before that
- electron-store files are in OS app data dir (not the repo)
