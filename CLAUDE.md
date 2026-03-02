# 🔥 Uplift Forge

Engineering team performance platform. ⚡ Electron desktop app that connects to JIRA via API token auth, fetches ticket data with changelogs, and computes engineering metrics (hours, velocity, estimation accuracy, bug ratios).

## 🏗️ Tech Stack

- **Runtime**: ⚡ Electron 33 (main + renderer via context-isolated IPC)
- **Frontend**: ⚛️ React 19, 🎨 Tailwind CSS 4, 📈 Recharts, ✨ Lucide icons, 🍞 react-hot-toast
- **Build**: 🔨 Electron Forge + Vite (separate configs for main/preload/renderer)
- **Language**: 📘 TypeScript 5.9, strict mode, ESNext modules
- **Testing**: 🧪 Vitest + jsdom + Testing Library (coverage thresholds: 90/80/85/90) + 🎭 Playwright e2e
- **Date/Time**: 🕐 Luxon (timezone-aware office hours calculation)
- **Storage**: 💾 electron-store (config, ticket cache, auth credentials via OS keychain)

## 📁 Project Structure

```
src/
├── main/                          # 🖥️ Electron main process
│   ├── index.ts                   # 🚀 App entry, window creation
│   ├── preload.ts                 # 🌉 Context bridge (exposes window.api)
│   ├── auth/
│   │   ├── token-store.ts         # 🔐 OS keychain credential storage (safeStorage)
│   │   └── ai-key-store.ts        # 🔐 Encrypted AI API key storage (separate store)
│   ├── ipc/
│   │   └── handlers.ts            # 📡 All ipcMain.handle() registrations
│   └── services/
│       ├── config.service.ts      # ⚙️ AppConfig via electron-store, defaults (incl. persona, metric prefs, projects)
│       ├── jira.service.ts        # 🔗 JIRA REST API v3 (Basic auth, /search/jql)
│       ├── field-engine.service.ts # 🧮 Eng hours calc (state machine) + rule-based field mapping
│       ├── ticket.service.ts      # 🎫 Ticket caching, sync, processing, JIRA write-back
│       ├── metrics.service.ts     # 📊 Team + individual KPI computation (persona-default metrics)
│       ├── ai.service.ts          # 🤖 AI suggestion service (OpenAI + Claude, persona-aware prompts)
│       ├── epic.service.ts        # 🏔️ Epic aggregation, risk scoring, child ticket grouping
│       ├── project.service.ts     # 📁 Multi-project CRUD, cross-project metric aggregation
│       └── update.service.ts      # 🔄 OTA update check via GitHub Releases
├── renderer/                      # 🎨 React frontend
│   ├── App.tsx                    # 🏠 Root: auth gate, persona gate, onboarding, sidebar routing
│   ├── api.ts                     # 📡 IPC wrappers (mimics Axios {data} shape)
│   ├── pages/
│   │   ├── HomePage.tsx           # 👋 Persona-aware welcome/getting-started
│   │   ├── LoginPage.tsx          # 🔑 API token login form
│   │   ├── EngineeringAttribution.tsx  # 📊 Ticket table + sync
│   │   ├── TeamMetrics.tsx        # 👥 Team KPI cards, trends, breakdowns (Recharts)
│   │   ├── IndividualMetrics.tsx  # 🧑‍💻 Per-engineer KPIs with team comparison
│   │   └── EpicTracker.tsx        # 🏔️ Epic progress tracking + risk analysis
│   └── components/
│       ├── Sidebar.tsx            # 🧭 Navigation + project info (persona-filtered tabs)
│       ├── ConfigPanel.tsx        # ⚙️ Tabbed settings (persona, project, statuses, field IDs, rules)
│       ├── OnboardingWizard.tsx   # 🧙 Multi-step onboarding wizard (persona + project setup)
│       ├── TicketTable.tsx        # ✏️ Editable ticket grid with calc buttons
│       ├── TicketSummary.tsx      # 📈 Summary stats bar
│       ├── RuleBuilder.tsx        # 🔀 AND/OR rule editor for field mapping
│       ├── ModalDialog.tsx        # 💬 Reusable modal
│       ├── SuggestionPanel.tsx    # 🤖 AI suggestion slide-out panel (persona-aware titles)
│       └── UpdateBanner.tsx       # 🆕 OTA update notification
└── shared/                        # 🤝 Shared between main and renderer
    ├── types.ts                   # 📘 All TypeScript interfaces
    └── channels.ts                # 📡 IPC channel name constants
test/
└── main/
    ├── field-engine.test.ts       # 🧮 Eng hours + rule engine tests
    ├── metrics.test.ts            # 📊 Metrics computation tests
    ├── ai.service.test.ts         # 🤖 AI service tests (prompt, parsing, providers, errors)
    ├── jira.service.test.ts       # 🔗 JIRA API tests (auth, pagination, CRUD)
    ├── ticket.service.test.ts     # 🎫 Ticket processing, sync, members
    ├── epic.service.test.ts       # 🏔️ Epic aggregation + risk scoring tests
    ├── project.service.test.ts    # 📁 Multi-project CRUD tests
    └── update.test.ts             # 🔄 Update service tests
e2e/                               # 🎭 End-to-end tests (Playwright + Electron)
├── playwright.config.ts           # ⚙️ Playwright config (workers=1, 60s timeout)
├── global-setup.ts                # 🏗️ Ensures packaged app exists before tests
├── fixtures/
│   ├── electron.fixture.ts        # 🔌 Core fixture: temp userDataDir, JIRA mock, Electron launch
│   ├── jira-mock-server.ts        # 🔗 Local HTTP server mimicking JIRA REST API v3
│   └── mock-data.ts               # 📦 Canned JIRA issues, fields, statuses, members
├── helpers/
│   └── app-helpers.ts             # 🛠️ loginViaUI(), completeOnboarding(), navigateTo()
└── tests/
    ├── 01-login.spec.ts           # 🔑 Login form validation, auth flow
    ├── 02-onboarding.spec.ts      # 🧙 Wizard steps, persona selection, project setup
    ├── 03-navigation.spec.ts      # 🧭 Sidebar tabs, persona-based visibility
    ├── 04-settings.spec.ts        # ⚙️ ConfigPanel tabs, save, field fetch
    ├── 05-attribution.spec.ts     # 📊 Ticket table, sync, empty state
    ├── 06-team-metrics.spec.ts    # 👥 KPI cards, period selector, charts
    ├── 07-individual-metrics.spec.ts # 🧑‍💻 Per-engineer KPIs, team comparison
    ├── 08-epic-tracker.spec.ts    # 🏔️ Epic cards, risk badges, expand/collapse
    └── 09-logout-reset.spec.ts    # 🚪 Logout, auth clear, reset app
```

## 💻 Commands

```bash
npm start              # 🔥 Dev mode (Electron Forge + Vite HMR)
npm test               # 🧪 Run all tests (vitest run)
npm run test:watch     # 👀 Watch mode
npm run test:coverage  # 📊 Coverage report (v8)
npm run lint           # 🔍 ESLint
npm run test:e2e       # 🎭 Run e2e tests (Playwright + Electron)
npm run test:e2e:headed # 👀 E2e tests with visible window
npm run test:e2e:debug # 🐛 E2e debug mode (Playwright Inspector)
npm run test:all       # 🧪🎭 Run unit + e2e tests
npm run package        # 📦 Package the app
npm run make           # 🏗️ Build distributables (DMG, Squirrel, ZIP)
npm run publish        # 🚀 Publish to GitHub Releases
```

## 🏛️ Architecture

### 🔄 Data Flow

```
🔗 JIRA REST API v3
  ↓ (getIssues with expand=changelog)
🎫 ticket.service → processIssue()
  ├── 🧮 field-engine: calculateEngineeringHours() ← state machine, multi-cycle
  ├── 🗺️ field-engine: getMappedFields()           ← rule-based TPD BU + Work Stream
  └── 💾 caches ProcessedTicket in memory + electron-store
        ↓
  📊 metrics.service reads from ticket cache
  ├── computeMetrics()            → team KPIs
  └── computeIndividualSummary()  → per-engineer KPIs
        ↓
  🎨 renderer pages via IPC (window.api → ipcMain.handle)
```

### ⏱️ Engineering Hours Calculation

State machine in `field-engine.service.ts:calculateEngineeringHours()`:

- **States**: `idle` → `active` → `blocked` → `active` → `idle`
- 🔄 Tracks ALL active development periods across multiple start→end cycles
- 🔁 Tickets can bounce between statuses (rework, multiple developers) — total hours accumulate
- ⏸️ Excluded statuses (e.g. "Blocked") pause the clock
- 🌍 Office hours: timezone-aware, weekday-only, configurable start/end times
- ⚠️ **Known pitfall**: JIRA's `toString` changelog property collides with `Object.prototype.toString`. Must use bracket notation + typeof check (see `getStatusTo()` helper)
- ✅ **No matching statuses → 0 hours**: If a ticket never enters the configured start/end statuses (e.g. Todo → Rejected), returns `0` instead of `null`. Only non-array input returns `null`.

### ⚙️ Config Defaults

- `eng_start_status`: "In Progress"
- `eng_end_status`: "In Review"
- `eng_excluded_statuses`: ["Blocked"]
- `office_hours`: 09:00–18:00 Europe/Berlin, weekends excluded
- `sp_to_days`: 1 (story point = 1 day = 8 hours for estimation accuracy)

### 📊 Metrics KPIs

**👥 Team**: total tickets, story points, eng hours, estimation accuracy (ratio to 1.0), avg hours/SP, avg cycle time, bug count, bug ratio, bug hours %

**🧑‍💻 Individual**: same + complexity score (avg SP/ticket), focus ratio (product work %)

**🎨 Trend colors**: estimation_accuracy is special — closer to 1.0 is better regardless of up/down direction. Other metrics use `LOWER_IS_BETTER` set for bug/cycle/hours-per-SP metrics.

### 🤖 AI-Powered Suggestions

Adds per-KPI AI suggestions via OpenAI (`gpt-4o-mini`) or Claude (`claude-sonnet-4-20250514`). ✨

- **⚙️ Config flow**: User selects provider + enters API key in Settings → key is sent to main process via `AI_CONFIG_SET` IPC → encrypted and stored in a separate electron-store (`'ai-keys'`) → renderer only receives `{ provider, hasKey: boolean }` via `AI_CONFIG_GET` (key never returned to renderer)
- **💡 Suggestion flow**: Renderer builds `AiSuggestRequest` (metric name, values, trend, help text, context) → sends via `AI_SUGGEST` IPC → `ai.service.ts` in main process reads key from store, constructs system+user prompts, calls the provider API → parses JSON array response → returns `AiSuggestResponse` with suggestion strings
- **📝 Prompt design**: System prompt requests a senior engineering manager persona with bare JSON array output. `buildUserPrompt()` assembles metric context. `parseAiResponse()` handles clean JSON, markdown-fenced JSON, and regex extraction as fallbacks.
- **❌ Error handling**: 401 (bad key), 429 (rate limit), network failures, malformed JSON — all surfaced in the SuggestionPanel with a retry button

### 🎭 Persona System

The app supports 4 personas that tailor the UI, metrics, and AI suggestions:

- `'management'` — strategic, cross-project view
- `'engineering_manager'` — full access, team + individual insights
- `'individual'` — own metrics front & center, team comparison
- `'delivery_manager'` — epic tracking, risk identification

**Flow**: First launch → `OnboardingWizard` gates the app → user picks persona → saved to `AppConfig.persona` via electron-store → `Sidebar` filters tabs via `TAB_VISIBILITY` map → pages filter KPI cards via `PERSONA_DEFAULT_METRICS` → AI uses persona-specific system prompts.

**Tab visibility** is defined in `Sidebar.tsx:TAB_VISIBILITY` — a `Record<Persona, Set<string>>` mapping each persona to its visible tab IDs.

**Metric preferences** can override persona defaults. Stored as `MetricPreferences { visible: string[], hidden: string[] }` on `AppConfig.metric_preferences`.

### 🏔️ Epic Tracker

Groups tickets by `parent_key` (JIRA parent field) and computes delivery risk:

```
riskScore = (1 - progressPct) * 0.3    // low progress
           + overdueRatio * 0.3         // tickets past 2x avg cycle time
           + blockedRatio * 0.2         // blocked tickets
           + bugRatio * 0.1             // bug type tickets
           + reopenRatio * 0.1          // tickets reopened after resolution

riskLevel: low (0-0.3), medium (0.3-0.6), high (0.6-1.0)
```

The `epic.service.ts` generates human-readable `riskFactors[]` strings for each detected issue.

### 📁 Multi-Project Support

`project.service.ts` provides CRUD for project configs:
- Primary project = existing flat `AppConfig` fields (zero migration)
- Additional projects stored in `AppConfig.projects[]` array
- Each `ProjectConfig` has own `field_ids`, `mapping_rules`, `eng_start/end_status`
- Cross-project metrics currently delegate to primary project (future: per-project caches)

### 📡 IPC Pattern

All renderer↔main communication uses typed IPC channels defined in `shared/channels.ts`. The renderer's `api.ts` wraps IPC calls in `{ data }` to match Axios response shape. The preload script (`preload.ts`) exposes `window.api` via `contextBridge`.

## 🔐 Security: API Key Isolation

**🚨 Critical rule: API keys (JIRA and AI) must NEVER be readable from the renderer process.**

Both credential stores follow the same isolation pattern:

| Layer | 🔑 JIRA (`token-store.ts`) | 🤖 AI (`ai-key-store.ts`) |
|-------|------------------------|----------------------|
| 💾 Storage | electron-store `'auth-tokens'` | electron-store `'ai-keys'` |
| 🔐 Encryption | `safeStorage.encryptString()` (OS keychain) | Same |
| ✍️ Write | Renderer sends key via IPC → main encrypts + stores → clears from renderer state | Same |
| 👀 Read (renderer) | `AUTH_STATE` returns `{ status, email, baseUrl }` — no token | `AI_CONFIG_GET` returns `{ provider, hasKey }` — no key |
| 🖥️ Read (main only) | `getAuthHeader()` / `getCredentials()` | `getAiApiKey()` |
| 🔗 API calls | `jira.service.ts` in main process only | `ai.service.ts` in main process only |

**⚠️ When modifying credential handling:**
- 🚫 Never add an IPC handler that returns raw keys/tokens to the renderer
- 🚫 Never log keys to console (even in main process)
- 🧹 The renderer's ConfigPanel clears the key from React state immediately after the save IPC call succeeds (`setAiApiKey('')`)
- 🔒 `getAiApiKey()` is only importable from main process modules — never expose it in `preload.ts`

## 🧪 Testing

### 🔬 Unit Tests (Vitest)
- 📁 Tests live in `test/main/` (services) and `src/renderer/**/__tests__/` (components/pages)
- 🎭 Main service tests mock `electron-store` and `getConfig()` via `vi.mock()`
- 🌐 Renderer tests use jsdom + Testing Library, mock `window.api` globally
- 📊 Coverage thresholds: statements 90%, branches 80%, functions 85%, lines 90%
- ✅ 525 tests across 25 test suites

### 🎭 E2E Tests (Playwright + Electron)
- 🔌 Launches the **real packaged app** (`out/Uplift Forge-darwin-arm64/`) per test
- 💾 Each test gets an **isolated `--user-data-dir`** temp directory (auto-cleaned)
- 🔗 JIRA API calls hit a **local HTTP mock server** — zero app code changes needed
- 📡 Tests exercise the **full IPC chain**: renderer → preload → ipcMain → services → back
- 🧪 ~53 tests across 9 spec files covering: login, onboarding, navigation, settings, attribution, team metrics, individual metrics, epic tracker, logout/reset
- 🏗️ Global setup auto-packages the app if stale (`npx electron-forge package`)

### 📋 Test Files

```
test/main/
  🧮 field-engine.test.ts       # Eng hours + rule engine
  📊 metrics.test.ts            # Metrics computation
  🤖 ai.service.test.ts         # AI service (prompt, parsing, providers, errors)
  🔗 jira.service.test.ts       # JIRA API (pagination, CRUD, statuses, project)
  🎫 ticket.service.test.ts     # Ticket caching, sync, processing, members
  🔄 update.test.ts             # Update service
src/renderer/__tests__/
  🏠 App.test.tsx               # Root component (auth, routing, login/logout)
  📡 api.test.ts                # IPC wrapper functions
src/renderer/components/__tests__/
  ⚙️ ConfigPanel.test.tsx       # Settings (all tabs + AI section)
  🤖 SuggestionPanel.test.tsx   # AI suggestion slide-out panel
  🧙 OnboardingWizard.test.tsx  # Onboarding wizard (persona selection, project setup)
  💬 ModalDialog.test.tsx       # Reusable modal
  🔀 RuleBuilder.test.tsx       # AND/OR rule editor
  🧭 Sidebar.test.tsx           # Navigation
  📈 TicketSummary.test.tsx     # Summary stats
  ✏️ TicketTable.test.tsx       # Editable ticket grid
  🆕 UpdateBanner.test.tsx      # OTA update notification
src/renderer/pages/__tests__/
  📊 EngineeringAttribution.test.tsx
  🏔️ EpicTracker.test.tsx       # Epic tracking + risk analysis
  🧑‍💻 IndividualMetrics.test.tsx
  🔑 LoginPage.test.tsx         # Login form, consent, policy modals
  👥 TeamMetrics.test.tsx
```

## 📜 Workflow Rules

- 📝 **Always update docs after changes**: After any code changes, update `README.md`, `CLAUDE.md`, `USER_GUIDE.md`, and any relevant spec files to reflect the current state. This includes test counts, file structure, feature docs, and architecture notes.
- 🎉 **Use playful emojis in docs**: All documentation files (README.md, CLAUDE.md, USER_GUIDE.md) should use playful emojis throughout.

## 📐 Conventions

- 🐪 All service functions use camelCase; JIRA field names use snake_case in `ProcessedTicket`
- ❓ Null means "not available/computable"; use `== null` checks (not strict equality)
- 🏷️ `has_computed_values` flag on tickets indicates computed vs JIRA-native values
- 🔄 Config changes trigger either full sync (project key/filter change) or cache reprocessing (rule changes only)
