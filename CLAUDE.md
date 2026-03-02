# Uplift Forge

Engineering team performance platform. Electron desktop app that connects to JIRA via API token auth, fetches ticket data with changelogs, and computes engineering metrics (hours, velocity, estimation accuracy, bug ratios).

## Tech Stack

- **Runtime**: Electron 33 (main + renderer via context-isolated IPC)
- **Frontend**: React 19, Tailwind CSS 4, Recharts, Lucide icons, react-hot-toast
- **Build**: Electron Forge + Vite (separate configs for main/preload/renderer)
- **Language**: TypeScript 5.9, strict mode, ESNext modules
- **Testing**: Vitest + jsdom + Testing Library (coverage thresholds: 90/80/85/90)
- **Date/Time**: Luxon (timezone-aware office hours calculation)
- **Storage**: electron-store (config, ticket cache, auth credentials via OS keychain)

## Project Structure

```
src/
├── main/                          # Electron main process
│   ├── index.ts                   # App entry, window creation
│   ├── preload.ts                 # Context bridge (exposes window.api)
│   ├── auth/
│   │   └── token-store.ts         # OS keychain credential storage (safeStorage)
│   ├── ipc/
│   │   └── handlers.ts            # All ipcMain.handle() registrations
│   └── services/
│       ├── config.service.ts      # AppConfig via electron-store, defaults
│       ├── jira.service.ts        # JIRA REST API v3 (Basic auth, /search/jql)
│       ├── field-engine.service.ts # Eng hours calc (state machine) + rule-based field mapping
│       ├── ticket.service.ts      # Ticket caching, sync, processing, JIRA write-back
│       ├── metrics.service.ts     # Team + individual KPI computation
│       └── update.service.ts      # OTA update check via GitHub Releases
├── renderer/                      # React frontend
│   ├── App.tsx                    # Root: auth gate, sidebar routing, refresh key
│   ├── api.ts                     # IPC wrappers (mimics Axios {data} shape)
│   ├── pages/
│   │   ├── HomePage.tsx           # Static welcome/getting-started
│   │   ├── LoginPage.tsx          # API token login form
│   │   ├── EngineeringAttribution.tsx  # Ticket table + sync
│   │   ├── TeamMetrics.tsx        # Team KPI cards, trends, breakdowns (Recharts)
│   │   └── IndividualMetrics.tsx  # Per-engineer KPIs with team comparison
│   └── components/
│       ├── Sidebar.tsx            # Navigation + project info
│       ├── ConfigPanel.tsx        # Tabbed settings (project, statuses, field IDs, rules, engineers)
│       ├── TicketTable.tsx        # Editable ticket grid with calc buttons
│       ├── TicketSummary.tsx      # Summary stats bar
│       ├── RuleBuilder.tsx        # AND/OR rule editor for field mapping
│       ├── ModalDialog.tsx        # Reusable modal
│       └── UpdateBanner.tsx       # OTA update notification
└── shared/                        # Shared between main and renderer
    ├── types.ts                   # All TypeScript interfaces
    └── channels.ts                # IPC channel name constants
test/
└── main/
    ├── field-engine.test.ts       # Eng hours + rule engine tests
    ├── metrics.test.ts            # Metrics computation tests
    └── update.test.ts             # Update service tests
```

## Commands

```bash
npm start              # Dev mode (Electron Forge + Vite HMR)
npm test               # Run all tests (vitest run)
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report (v8)
npm run lint           # ESLint
npm run package        # Package the app
npm run make           # Build distributables (DMG, Squirrel, ZIP)
npm run publish        # Publish to GitHub Releases
```

## Architecture

### Data Flow

```
JIRA REST API v3
  ↓ (getIssues with expand=changelog)
ticket.service → processIssue()
  ├── field-engine: calculateEngineeringHours() ← state machine, multi-cycle
  ├── field-engine: getMappedFields()           ← rule-based TPD BU + Work Stream
  └── caches ProcessedTicket in memory + electron-store
        ↓
  metrics.service reads from ticket cache
  ├── computeMetrics()            → team KPIs
  └── computeIndividualSummary()  → per-engineer KPIs
        ↓
  renderer pages via IPC (window.api → ipcMain.handle)
```

### Engineering Hours Calculation

State machine in `field-engine.service.ts:calculateEngineeringHours()`:

- **States**: `idle` → `active` → `blocked` → `active` → `idle`
- Tracks ALL active development periods across multiple start→end cycles
- Tickets can bounce between statuses (rework, multiple developers) — total hours accumulate
- Excluded statuses (e.g. "Blocked") pause the clock
- Office hours: timezone-aware, weekday-only, configurable start/end times
- **Known pitfall**: JIRA's `toString` changelog property collides with `Object.prototype.toString`. Must use bracket notation + typeof check (see `getStatusTo()` helper)

### Config Defaults

- `eng_start_status`: "In Progress"
- `eng_end_status`: "In Review"
- `eng_excluded_statuses`: ["Blocked"]
- `office_hours`: 09:00–18:00 Europe/Berlin, weekends excluded
- `sp_to_days`: 1 (story point = 1 day = 8 hours for estimation accuracy)

### Metrics KPIs

**Team**: total tickets, story points, eng hours, estimation accuracy (ratio to 1.0), avg hours/SP, avg cycle time, bug count, bug ratio, bug hours %

**Individual**: same + complexity score (avg SP/ticket), focus ratio (product work %)

**Trend colors**: estimation_accuracy is special — closer to 1.0 is better regardless of up/down direction. Other metrics use `LOWER_IS_BETTER` set for bug/cycle/hours-per-SP metrics.

### IPC Pattern

All renderer↔main communication uses typed IPC channels defined in `shared/channels.ts`. The renderer's `api.ts` wraps IPC calls in `{ data }` to match Axios response shape. The preload script (`preload.ts`) exposes `window.api` via `contextBridge`.

## Testing

- Tests live in `test/main/` (services) and `src/renderer/**/__tests__/` (components/pages)
- Main service tests mock `electron-store` and `getConfig()` via `vi.mock()`
- Renderer tests use jsdom + Testing Library, mock `window.api` globally
- Coverage thresholds: statements 90%, branches 80%, functions 85%, lines 90%

## Conventions

- All service functions use camelCase; JIRA field names use snake_case in `ProcessedTicket`
- Null means "not available/computable"; use `== null` checks (not strict equality)
- `has_computed_values` flag on tickets indicates computed vs JIRA-native values
- Config changes trigger either full sync (project key/filter change) or cache reprocessing (rule changes only)
