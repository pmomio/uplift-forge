# 🔥 Uplift Forge

Engineering team performance platform. ⚡ Electron desktop app that connects to JIRA via API token auth, fetches ticket data with changelogs, and computes persona-specific engineering metrics using a shared Timeline Engine.

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
│   │   └── handlers.ts            # 📡 All ipcMain.handle() registrations (incl. persona guards)
│   └── services/
│       ├── config.service.ts      # ⚙️ AppConfig via electron-store, defaults, persona migration
│       ├── jira.service.ts        # 🔗 JIRA REST API v3 (Basic auth, /search/jql)
│       ├── field-engine.service.ts # 🧮 Eng hours calc (state machine) + rule-based field mapping
│       ├── ticket.service.ts      # 🎫 Per-project ticket caches, sync, processing, JIRA write-back
│       ├── timeline.service.ts    # 🕐 Timeline Engine — status periods, cycle/lead time, rework, flow efficiency + shared metric helpers
│       ├── metrics.service.ts     # 📊 Legacy team + individual KPI computation
│       ├── em-metrics.service.ts  # 📊 EM persona metrics — cycle time dist, throughput, contribution, aging WIP, bug ratio
│       ├── dm-metrics.service.ts  # 🌊 DM persona metrics — CFD, lead time, WIP, flow efficiency, Monte Carlo
│       ├── ic-metrics.service.ts  # 🧑‍💻 IC persona metrics — personal cycle time, rework, goals, team comparison
│       ├── cto-metrics.service.ts # 🏛️ Management persona metrics — cross-project throughput, cycle time, bug escape, tech debt, flow efficiency
│       ├── ai.service.ts          # 🤖 AI suggestion service (OpenAI + Claude, persona-aware prompts)
│       ├── epic.service.ts        # 🏔️ Epic aggregation, risk scoring, child ticket grouping
│       ├── project.service.ts     # 📁 Multi-project CRUD, cross-project metric aggregation
│       └── update.service.ts      # 🔄 OTA update check via GitHub Releases
├── renderer/                      # 🎨 React frontend
│   ├── App.tsx                    # 🏠 Root: auth gate, persona gate, onboarding, persona-conditional routing
│   ├── api.ts                     # 📡 IPC wrappers (mimics Axios {data} shape)
│   ├── pages/
│   │   ├── HomePage.tsx           # 👋 Persona-aware welcome/getting-started
│   │   ├── LoginPage.tsx          # 🔑 API token login form
│   │   ├── EngineeringAttribution.tsx  # 📊 Ticket table + sync
│   │   ├── EmTeamDashboard.tsx    # 📊 EM Team — cycle time, throughput, contribution, aging WIP, bug ratio
│   │   ├── EmIndividualDashboard.tsx # 🧑‍💻 EM Individual — per-engineer cards with team avg comparison
│   │   ├── DmFlowDashboard.tsx    # 🌊 DM Flow — CFD, lead time histogram, WIP, Monte Carlo forecast
│   │   ├── IcPersonalDashboard.tsx # 🎯 IC Personal — cycle time trend, rework, goals, team comparison
│   │   ├── CtoOrgDashboard.tsx    # 🏛️ Management — cross-project KPIs, traffic-light indicators, throughput trends
│   │   └── EpicTracker.tsx        # 🏔️ Epic progress tracking + risk analysis
│   └── components/
│       ├── Sidebar.tsx            # 🧭 Navigation + project info (persona-filtered tabs)
│       ├── ConfigPanel.tsx        # ⚙️ Tabbed settings (read-only persona badge, project, statuses, fields, rules)
│       ├── OnboardingWizard.tsx   # 🧙 Multi-step onboarding wizard (persona + project setup, multi-project for EM)
│       ├── MetricCard.tsx         # 📊 Reusable KPI card with tooltip + explain modal + AI sparkles button
│       ├── TicketTable.tsx        # ✏️ Editable ticket grid with calc buttons
│       ├── TicketSummary.tsx      # 📈 Summary stats bar
│       ├── RuleBuilder.tsx        # 🔀 AND/OR rule editor for field mapping
│       ├── ModalDialog.tsx        # 💬 Reusable modal
│       ├── SuggestionPanel.tsx    # 🤖 AI suggestion slide-out panel (persona-aware titles)
│       └── UpdateBanner.tsx       # 🆕 OTA update notification
└── shared/                        # 🤝 Shared between main and renderer
    ├── types.ts                   # 📘 All TypeScript interfaces (incl. TicketTimeline, persona-specific responses)
    └── channels.ts                # 📡 IPC channel name constants (incl. persona-specific metric channels)
test/
└── main/
    ├── field-engine.test.ts       # 🧮 Eng hours + rule engine tests
    ├── metrics.test.ts            # 📊 Legacy metrics computation tests
    ├── timeline.service.test.ts   # 🕐 Timeline engine tests
    ├── em-metrics.service.test.ts # 📊 EM metrics tests
    ├── dm-metrics.service.test.ts # 🌊 DM metrics tests
    ├── ic-metrics.service.test.ts # 🧑‍💻 IC metrics tests
    ├── cto-metrics.service.test.ts # 🏛️ Management org metrics tests
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
🎫 ticket.service → processIssue(issue, storeRaw, projectKey?)
  ├── 🧮 field-engine: calculateEngineeringHours() ← office-hours state machine
  ├── 🗺️ field-engine: getMappedFields()           ← rule-based TPD BU + Work Stream
  ├── 📦 extracts: assignee_id, sprint_id, sprint_name, components
  └── 💾 caches ProcessedTicket + raw issue in per-project caches
        ↓
  🕐 timeline.service extracts TicketTimeline from raw changelog
  ├── StatusPeriod[] with category (active/wait/blocked/done)
  ├── cycleTimeHours, leadTimeHours, flowEfficiency
  ├── rework detection (backward transitions)
  └── daysInCurrentStatus (for aging WIP)
        ↓
  📊 Persona-specific metric services read from timelines + ticket cache
  ├── em-metrics.service → EM team + individual (scoped to tracked engineers)
  ├── dm-metrics.service → DM flow metrics + Monte Carlo forecast
  └── ic-metrics.service → IC personal metrics (filtered to my_account_id)
        ↓
  🎨 Persona-specific dashboard pages via IPC (window.api → ipcMain.handle)
  ├── EmTeamDashboard, EmIndividualDashboard   ← engineering_manager
  ├── DmFlowDashboard                          ← delivery_manager
  └── IcPersonalDashboard                      ← individual
```

### 🕐 Timeline Engine

Separate from engineering hours (office-hours-based), the Timeline Engine in `timeline.service.ts` extracts richer flow data from JIRA changelogs using **calendar time**:

- 📊 **Status Periods** — every period a ticket spent in each status, with duration and category
- ⏱️ **Cycle Time** — first active status to done (calendar hours)
- 📏 **Lead Time** — created to done (calendar hours)
- 🌊 **Flow Efficiency** — active time / lead time × 100
- 🔁 **Rework Detection** — backward transitions in status order
- ⏳ **Days in Current Status** — for aging WIP detection

Status classification is configurable: Active Statuses, Blocked Statuses, Done Statuses.

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
- `active_statuses`: ["In Progress", "Code Review", "QA"]
- `blocked_statuses`: ["Blocked"]
- `done_statuses`: ["Done", "Resolved", "Closed", "Rejected", "Cancelled"]

### 📊 Persona-Specific Metrics

**📊 EM Team Dashboard** (`em-metrics.service.ts → EmTeamDashboard.tsx`):
- Cycle time distribution (p50/p85/p95 with 4-week trend)
- Throughput by work stream
- Weekly throughput (8 weeks)
- Contribution spread (per-engineer SP, normalized)
- Aging WIP (warning/critical/escalation tiers)
- Bug ratio by engineer
- Rework rate
- 🎯 SP estimation accuracy (actual eng hours vs estimated SP × sp_to_days × 8h)
- ✅ First-time pass rate (complement of rework rate)
- ⏱️ Avg code review duration (time in review statuses)
- 📊 Work type distribution (horizontal bar by issue type)
- 📋 Unestimated ticket ratio (% of resolved tickets with no SP)
- 🔀 Lead time breakdown (active vs wait vs blocked %)
- 🔒 **Scoped to tracked engineers** — when `tracked_engineers` is configured, all metrics only include those engineers

**🧑‍💻 EM Individual Dashboard** (`em-metrics.service.ts → EmIndividualDashboard.tsx`):
- Per-engineer cards: cycle time p50/p85, rework rate, bug ratio, SP accuracy, first-time pass rate, complexity, focus ratio
- Team averages bar for comparison (includes SP accuracy + first-time pass rate)
- Color-coded vs team average (green = better, red = worse)
- 🔒 Filtered to tracked engineers only

**🌊 DM Flow Dashboard** (`dm-metrics.service.ts → DmFlowDashboard.tsx`):
- Cumulative Flow Diagram (30-day stacked area chart)
- Lead time distribution (p50/p85/p95 + histogram)
- WIP count vs configurable limit
- Aging WIP (3 tiers: warning/critical/escalation)
- Blocker duration (top blocked tickets)
- Flow efficiency (average + median)
- Throughput stability (1 - stddev/mean)
- Monte Carlo forecast (10,000 simulations, 50/85/95% confidence)
- 🔄 Arrival vs departure rate (12-week dual-line chart)
- 📦 Batch size trend (avg SP/ticket per week, 12 weeks)
- ⏱️ Time to first activity (created → first active status)
- 🔀 Lead time breakdown (active vs wait vs blocked %)

**🎯 IC Personal Dashboard** (`ic-metrics.service.ts → IcPersonalDashboard.tsx`):
- Cycle time trend (weekly p50 over 8 weeks)
- Weekly throughput
- Time in each status (percentage breakdown)
- Scope trajectory (avg SP/ticket by month)
- My aging WIP
- Rework rate + trend
- Team comparison (opt-in, anonymous medians)
- Goal progress (vs personal targets)
- 🎯 SP estimation accuracy (personal)
- ✅ First-time pass rate (personal)
- ⏱️ Code review wait time (avg hours in review statuses)
- 🎯 Focus score (% product work vs bugs/maintenance)
- 🔒 All data filtered to `my_account_id`

**🏛️ Management Org Dashboard** (`cto-metrics.service.ts → CtoOrgDashboard.tsx`):
- Cross-project throughput trends (multi-line chart)
- Cycle time p85 by project (horizontal bar)
- Bug escape rate (with traffic light indicator)
- Tech debt ratio (with traffic light indicator)
- Flow efficiency (with traffic light indicator)
- Headcount-normalized throughput (tickets per tracked engineer)
- Weekly aggregate throughput
- 📊 Delivery predictability (CoV of cycle time per project, color-coded)
- 📊 Work type distribution by project (stacked horizontal bars)

### 📊 MetricCard Component

All persona dashboards use shared `MetricCard` and `SectionTitle` components from `components/MetricCard.tsx`:

- **MetricCard**: KPI card with value + icon + help tooltip + 📖 explain button + AI sparkles button
- **SectionTitle**: Chart section header with help tooltip + 📖 explain button + optional AI sparkles button
- **ExplainModal**: Portal-rendered lightweight modal showing metric derivation (data source, computation, filters, config dependency)
- **Tooltip**: Shows "What it is" (description) + "High-Performing Target" (benchmark value)
- **📖 Explain Button**: `BookOpen` icon (13px) — opens `ExplainModal` with full derivation methodology. Supports **dynamic computation traces** via `dynamicDerivation` prop — when available, shows real computation pipeline with actual values (ticket counts, filter results, intermediate calculations) instead of static descriptions. Falls back to `MetricTooltip.derivation` when traces unavailable. Custom inline `IcExplainButton`/`CtoExplainButton` helpers handle non-standard card patterns (IC health cards, CTO traffic-light cards). EM Individual uses upgraded `CardHelp` component with `{ text, derivation, dynamicDerivation }` objects.
- **AI Sparkles**: Opens `SuggestionPanel` slide-out with metric context for AI-powered suggestions

### 🔬 Dynamic Computation Traces

Each persona-specific metric response includes an optional `traces?: Record<string, string>` field. Backend services build human-readable trace strings during computation with real numbers. The frontend prefers dynamic traces over static derivation fallback via the `dynamicDerivation` prop pattern:

- **Backend**: Each service declares `const traces: Record<string, string> = {};`, builds trace strings after each computation step, and adds `traces` to the response object
- **Frontend**: `dynamicDerivation={data?.traces?.keyName}` on MetricCard/SectionTitle/custom explain buttons. Falls back to `tooltip.derivation` when traces are `undefined`
- **Trace keys per service**: EM team (totalTickets, cycleTimeP50, reworkRate, spAccuracy, avgReviewDuration, unestimatedRatio), EM individual (teamAvg), DM flow (leadTimeP50, flowEfficiency, wip, throughputStability, monteCarlo), IC personal (cycleTimeP50, reworkRate, tickets, spAccuracy, firstTimePassRate, avgReviewWait, focusScore, teamComparison), CTO org (totalTickets, bugEscapeRate, techDebtRatio, flowEfficiency, headcount)
- **No new IPC channels needed** — traces travel inside existing response objects

### 🤖 AI-Powered Suggestions

Adds per-KPI AI suggestions via OpenAI (`gpt-4o-mini`) or Claude (`claude-sonnet-4-20250514`). ✨

- **⚙️ Config flow**: User selects provider + enters API key in Settings → key is sent to main process via `AI_CONFIG_SET` IPC → encrypted and stored in a separate electron-store (`'ai-keys'`) → renderer only receives `{ provider, hasKey: boolean }` via `AI_CONFIG_GET` (key never returned to renderer)
- **💡 Suggestion flow**: Renderer builds `AiSuggestRequest` (metric name, values, trend, help text, context) → sends via `AI_SUGGEST` IPC → `ai.service.ts` in main process reads key from store, constructs system+user prompts, calls the provider API → parses JSON array response → returns `AiSuggestResponse` with suggestion strings
- **📝 Prompt design**: System prompt requests a senior engineering manager persona with bare JSON array output. `buildUserPrompt()` assembles metric context. `parseAiResponse()` handles clean JSON, markdown-fenced JSON, and regex extraction as fallbacks.
- **❌ Error handling**: 401 (bad key), 429 (rate limit), network failures, malformed JSON — all surfaced in the SuggestionPanel with a retry button

### 🎭 Persona System

The app supports 4 personas with genuinely different metrics, backed by a shared Timeline Engine:

- `'engineering_manager'` — full access: team + individual metrics, multi-project support 🌐
- `'delivery_manager'` — flow dashboard: CFD, lead time, WIP, Monte Carlo forecast 🌊
- `'individual'` — private personal dashboard: cycle time, rework, goals, team comparison 🎯
- `'management'` — org health radar: cross-project throughput, cycle time comparison, bug escape rate, tech debt ratio, flow efficiency 🏛️

**🔒 Persona Immutability**: Persona is set once during onboarding and cannot be changed in Settings. To change persona, use "Reset App" in the sidebar.

**🔒 Persona Isolation**: Each persona's IPC metric endpoints check `getConfig().persona` before returning data. If persona doesn't match the endpoint, an error is returned. The renderer only renders its own persona's dashboard pages.

**Flow**: First launch → `OnboardingWizard` gates the app → user picks persona (with "permanent choice" warning) → saved to `AppConfig.persona` → `Sidebar` filters tabs via `TAB_VISIBILITY` → `App.tsx` routes to persona-specific dashboard pages → AI uses persona-specific system prompts.

**Tab visibility** is defined in `Sidebar.tsx:TAB_VISIBILITY`:
- EM sees all 6 tabs (home, attribution, metrics, individual, epics, config)
- DM sees 5 tabs (home, attribution, metrics, epics, config)
- IC sees 3 tabs (home, individual, config)
- Management sees 5 tabs (home, attribution, metrics, epics, config) — no individual

**App.tsx routing** (strict persona isolation):
```tsx
{activeTab === 'metrics' && persona === 'engineering_manager' && <EmTeamDashboard />}
{activeTab === 'metrics' && persona === 'delivery_manager' && <DmFlowDashboard />}
{activeTab === 'individual' && persona === 'engineering_manager' && <EmIndividualDashboard />}
{activeTab === 'individual' && persona === 'individual' && <IcPersonalDashboard />}
```

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

`project.service.ts` provides CRUD for project configs, `ticket.service.ts` provides per-project caching:

**📋 Config layer:**
- Primary project = existing flat `AppConfig` fields (zero migration)
- Additional projects stored in `AppConfig.projects[]` array
- Each `ProjectConfig` has own `field_ids`, `mapping_rules`, `eng_start/end_status`

**💾 Data layer (per-project ticket caches):**
- `projectTicketCaches: Map<string, Map<string, ProcessedTicket>>` — keyed by project key
- `projectRawCaches: Map<string, Map<string, Record<string, unknown>>>` — raw JIRA data per project
- `electron-store` persists under `{ projects: { [projectKey]: { ticketCache, rawIssueCache } } }`
- Auto-migration: old flat cache format detected and wrapped under primary project key on first load
- `syncTickets(projectKey?)` — syncs one project; `syncAllProjects()` — syncs all configured projects
- `getTickets(projectKey?)` — with key returns single project; without returns all projects aggregated
- `processIssue(issue, storeRaw?, projectKey?)` — sets `ticket.project_key` and stores in correct sub-cache
- `resolveProjectConfig(projectKey)` — resolves field_ids, mapping_rules, statuses from primary or projects[]
- Metrics, epics, and attribution all accept optional `projectKey` for scoped or aggregated results

**🌐 EM persona gets full cross-project experience:**
- All 6 tabs visible (home, attribution, metrics, individual, epics, config)
- OnboardingWizard shows multi-project key input
- Settings shows project management UI
- All data pages show aggregated data across projects
- Sync buttons call `syncAllProjects()` for EM with multiple projects

### 📡 IPC Pattern

All renderer↔main communication uses typed IPC channels defined in `shared/channels.ts`. The renderer's `api.ts` wraps IPC calls in `{ data }` to match Axios response shape. The preload script (`preload.ts`) exposes `window.api` via `contextBridge`.

**🔐 Credential Verification**: The `AUTH_LOGIN` channel performs real-time verification of JIRA credentials by calling the `/myself` endpoint before saving them to the secure store. This ensures invalid API tokens are caught during the login phase.

**Persona-specific metric channels** (with persona guards):
- `METRICS_EM_TEAM` → `getEmTeamMetrics(period, projectKey?)` — EM only
- `METRICS_EM_INDIVIDUAL` → `getEmIndividualMetrics(period, projectKey?)` — EM only
- `METRICS_DM_FLOW` → `getDmFlowMetrics(period, projectKey?)` — DM only
- `METRICS_DM_FORECAST` → `getDmFlowMetrics('all', projectKey?)` — DM only
- `METRICS_IC_PERSONAL` → `getIcPersonalMetrics(period)` — IC only
- `TIMELINE_LIST` → `getTimelines(projectKey?)`

**Legacy channels** still available: `METRICS_TEAM`, `METRICS_INDIVIDUAL`, `TICKETS_LIST`, `EPICS_LIST`, `SYNC_ALL_PROJECTS`.

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
- ✅ 675 tests across 33 test suites

### 🎭 E2E Tests (Playwright + Electron)
- 🔌 Launches the **real packaged app** (`out/Uplift Forge-darwin-arm64/`) per test
- 💾 Each test gets an **isolated `--user-data-dir`** temp directory (auto-cleaned)
- 🔗 JIRA API calls hit a **local HTTP mock server** — zero app code changes needed
- 📡 Tests exercise the **full IPC chain**: renderer → preload → ipcMain → services → back
- 🧪 ~54 tests across 9 spec files covering: login (incl. invalid credentials), onboarding, navigation, settings, attribution, team metrics, individual metrics, epic tracker, logout/reset
- 🏗️ Global setup auto-packages the app if stale (`npx electron-forge package`)

### 📋 Test Files

```
test/main/
  🧮 field-engine.test.ts       # Eng hours + rule engine
  📊 metrics.test.ts            # Legacy metrics computation
  🕐 timeline.service.test.ts   # Timeline engine (status periods, cycle/lead time, rework)
  📊 em-metrics.service.test.ts # EM team + individual metrics
  🌊 dm-metrics.service.test.ts # DM flow metrics + Monte Carlo
  🧑‍💻 ic-metrics.service.test.ts # IC personal metrics
  🤖 ai.service.test.ts         # AI service (prompt, parsing, providers, errors)
  🔗 jira.service.test.ts       # JIRA API (pagination, CRUD, statuses, project)
  🎫 ticket.service.test.ts     # Ticket caching, sync, processing, members
  🏔️ epic.service.test.ts       # Epic aggregation + risk scoring
  📁 project.service.test.ts    # Multi-project CRUD
  🔄 update.test.ts             # Update service
src/renderer/__tests__/
  🏠 App.test.tsx               # Root component (auth, routing, persona routing, login/logout)
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
  📊 EmTeamDashboard.test.tsx   # EM team dashboard KPIs + sync
  🧑‍💻 EmIndividualDashboard.test.tsx # EM individual engineer cards
  🌊 DmFlowDashboard.test.tsx   # DM flow dashboard + Monte Carlo
  🎯 IcPersonalDashboard.test.tsx # IC personal dashboard + goals
  🏛️ CtoOrgDashboard.test.tsx   # Management org dashboard KPIs + charts
  🔑 LoginPage.test.tsx         # Login form, consent, policy modals
```

## 📜 Workflow Rules

- 📝 **Always update docs after changes**: After any code changes, update `README.md`, `GEMINI.md`, `USER_GUIDE.md`, and any relevant spec files to reflect the current state. This includes test counts, file structure, feature docs, and architecture notes.
- 🎉 **Use playful emojis in docs**: All documentation files (README.md, GEMINI.md, USER_GUIDE.md) should use playful emojis throughout.

## 📐 Conventions

- 🐪 All service functions use camelCase; JIRA field names use snake_case in `ProcessedTicket`
- ❓ Null means "not available/computable"; use `== null` checks (not strict equality)
- 🏷️ `has_computed_values` flag on tickets indicates computed vs JIRA-native values
- 🔄 Config changes trigger either full sync (project key/filter change) or cache reprocessing (rule changes only)
- 🔒 Persona guards: all persona-specific IPC handlers check `getConfig().persona` before returning data
- 📊 Tracked engineers: EM team metrics scope all data to `tracked_engineers` when configured (empty = show all)
