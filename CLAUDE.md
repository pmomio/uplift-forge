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
│   │   ├── token-store.ts         # OS keychain credential storage (safeStorage)
│   │   └── ai-key-store.ts        # Encrypted AI API key storage (separate store)
│   ├── ipc/
│   │   └── handlers.ts            # All ipcMain.handle() registrations
│   └── services/
│       ├── config.service.ts      # AppConfig via electron-store, defaults
│       ├── jira.service.ts        # JIRA REST API v3 (Basic auth, /search/jql)
│       ├── field-engine.service.ts # Eng hours calc (state machine) + rule-based field mapping
│       ├── ticket.service.ts      # Ticket caching, sync, processing, JIRA write-back
│       ├── metrics.service.ts     # Team + individual KPI computation
│       ├── ai.service.ts          # AI suggestion service (OpenAI + Claude)
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
│       ├── SuggestionPanel.tsx    # AI suggestion slide-out panel
│       └── UpdateBanner.tsx       # OTA update notification
└── shared/                        # Shared between main and renderer
    ├── types.ts                   # All TypeScript interfaces
    └── channels.ts                # IPC channel name constants
test/
└── main/
    ├── field-engine.test.ts       # Eng hours + rule engine tests
    ├── metrics.test.ts            # Metrics computation tests
    ├── ai.service.test.ts         # AI service tests (prompt, parsing, providers, errors)
    ├── jira.service.test.ts       # JIRA API tests (auth, pagination, CRUD)
    ├── ticket.service.test.ts     # Ticket processing, sync, members
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

### AI-Powered Suggestions

Adds per-KPI AI suggestions via OpenAI (`gpt-4o-mini`) or Claude (`claude-sonnet-4-20250514`).

- **Config flow**: User selects provider + enters API key in Settings → key is sent to main process via `AI_CONFIG_SET` IPC → encrypted and stored in a separate electron-store (`'ai-keys'`) → renderer only receives `{ provider, hasKey: boolean }` via `AI_CONFIG_GET` (key never returned to renderer)
- **Suggestion flow**: Renderer builds `AiSuggestRequest` (metric name, values, trend, help text, context) → sends via `AI_SUGGEST` IPC → `ai.service.ts` in main process reads key from store, constructs system+user prompts, calls the provider API → parses JSON array response → returns `AiSuggestResponse` with suggestion strings
- **Prompt design**: System prompt requests a senior engineering manager persona with bare JSON array output. `buildUserPrompt()` assembles metric context. `parseAiResponse()` handles clean JSON, markdown-fenced JSON, and regex extraction as fallbacks.
- **Error handling**: 401 (bad key), 429 (rate limit), network failures, malformed JSON — all surfaced in the SuggestionPanel with a retry button

### IPC Pattern

All renderer↔main communication uses typed IPC channels defined in `shared/channels.ts`. The renderer's `api.ts` wraps IPC calls in `{ data }` to match Axios response shape. The preload script (`preload.ts`) exposes `window.api` via `contextBridge`.

## Security: API Key Isolation

**Critical rule: API keys (JIRA and AI) must NEVER be readable from the renderer process.**

Both credential stores follow the same isolation pattern:

| Layer | JIRA (`token-store.ts`) | AI (`ai-key-store.ts`) |
|-------|------------------------|----------------------|
| Storage | electron-store `'auth-tokens'` | electron-store `'ai-keys'` |
| Encryption | `safeStorage.encryptString()` (OS keychain) | Same |
| Write | Renderer sends key via IPC → main encrypts + stores → clears from renderer state | Same |
| Read (renderer) | `AUTH_STATE` returns `{ status, email, baseUrl }` — no token | `AI_CONFIG_GET` returns `{ provider, hasKey }` — no key |
| Read (main only) | `getAuthHeader()` / `getCredentials()` | `getAiApiKey()` |
| API calls | `jira.service.ts` in main process only | `ai.service.ts` in main process only |

**When modifying credential handling:**
- Never add an IPC handler that returns raw keys/tokens to the renderer
- Never log keys to console (even in main process)
- The renderer's ConfigPanel clears the key from React state immediately after the save IPC call succeeds (`setAiApiKey('')`)
- `getAiApiKey()` is only importable from main process modules — never expose it in `preload.ts`

## Testing

- Tests live in `test/main/` (services) and `src/renderer/**/__tests__/` (components/pages)
- Main service tests mock `electron-store` and `getConfig()` via `vi.mock()`
- Renderer tests use jsdom + Testing Library, mock `window.api` globally
- Coverage thresholds: statements 90%, branches 80%, functions 85%, lines 90%
- 466 tests across 21 test suites

### Test Files

```
test/main/
  field-engine.test.ts       # Eng hours + rule engine
  metrics.test.ts            # Metrics computation
  ai.service.test.ts         # AI service (prompt, parsing, providers, errors)
  jira.service.test.ts       # JIRA API (pagination, CRUD, statuses, project)
  ticket.service.test.ts     # Ticket caching, sync, processing, members
  update.test.ts             # Update service
src/renderer/__tests__/
  App.test.tsx               # Root component (auth, routing, login/logout)
  api.test.ts                # IPC wrapper functions
src/renderer/components/__tests__/
  ConfigPanel.test.tsx       # Settings (all tabs + AI section)
  SuggestionPanel.test.tsx   # AI suggestion slide-out panel
  ModalDialog.test.tsx       # Reusable modal
  RuleBuilder.test.tsx       # AND/OR rule editor
  Sidebar.test.tsx           # Navigation
  TicketSummary.test.tsx     # Summary stats
  TicketTable.test.tsx       # Editable ticket grid
  UpdateBanner.test.tsx      # OTA update notification
src/renderer/pages/__tests__/
  EngineeringAttribution.test.tsx
  IndividualMetrics.test.tsx
  LoginPage.test.tsx         # Login form, consent, policy modals
  TeamMetrics.test.tsx
```

## Workflow Rules

- **Always update docs after changes**: After any code changes, update `README.md`, `CLAUDE.md`, and any relevant spec files to reflect the current state. This includes test counts, file structure, feature docs, and architecture notes.

## Conventions

- All service functions use camelCase; JIRA field names use snake_case in `ProcessedTicket`
- Null means "not available/computable"; use `== null` checks (not strict equality)
- `has_computed_values` flag on tickets indicates computed vs JIRA-native values
- Config changes trigger either full sync (project key/filter change) or cache reprocessing (rule changes only)
