<p align="center">
  <img src="assets/logo.png" width="80" />
</p>

<h1 align="center">🔥 Uplift Forge</h1>

<p align="center">
  <em>✨ Your engineering team's performance, forged into something useful.</em>
</p>

<p align="center">
  A desktop app that plugs into JIRA and turns messy ticket data into clear metrics, beautiful charts, and actionable insights. No servers. No Docker. No "let me set up the backend real quick." Just install, connect, and see what your team's been up to. 🚀
</p>

---

## 🎯 What It Does (the short version)

You connect to JIRA. Uplift Forge pulls your tickets, crunches the numbers, and gives you:

- 🎭 **4 Persona-Specific Dashboards** — completely different metrics for Engineering Managers, Delivery Managers, Individual Contributors, and Members of Management
- 🌐 **Cross-Project Aggregation** — EM and Management personas track multiple JIRA projects simultaneously with aggregated metrics, epics, and attribution
- ⏱️ **Timeline Engine** — extracts status periods, cycle/lead time, rework detection, and flow efficiency from JIRA changelogs (calendar-time based)
- 📊 **EM Dashboard** — cycle time distribution, throughput, contribution spread, aging WIP, bug ratio, rework rate, SP accuracy, first-time pass rate, review duration, work type distribution, lead time breakdown
- 🌊 **DM Flow Dashboard** — CFD, lead time histogram, WIP vs limit, tiered aging WIP, blockers, flow efficiency, Monte Carlo forecast, arrival vs departure, batch size trend, time to first activity, lead time breakdown
- 🧑‍💻 **IC Personal Dashboard** — private cycle time trend, throughput, time-in-status, rework, scope trajectory, team comparison (opt-in), personal goals, SP accuracy, first-time pass rate, review wait time, focus score
- 🏛️ **Management Org Dashboard** — cross-project organizational health radar with throughput by project, cycle time comparison, bug escape rate, tech debt ratio, flow efficiency, headcount-normalized throughput, traffic-light KPIs, delivery predictability, work type by project
- 🏔️ **Epic Tracker** — epic-level progress tracking with auto-computed risk scores and delivery risk analysis
- 🧠 **Smart Attribution** — rule-based classification of tickets into business units and work streams
- ✏️ **JIRA Write-back** — edit fields inline and push them straight back to JIRA
- 🤖 **AI Suggestions** — connect OpenAI or Claude to get persona-aware actionable improvement suggestions
- 📖 **Explain Button** — every metric has a BookOpen icon that opens a modal explaining the data source, computation formula, filters, and config dependencies. Shows **dynamic computation traces** with real values (ticket counts, filter results, intermediate calculations) when available

All data stays on your machine. 🏠 Your credentials live in your OS keychain. 🔐 Nothing leaves your laptop (except JIRA API calls and optional AI provider calls).

---

## 🚀 Getting Started

### 1. Clone & install

```bash
git clone git@github.com:pmomio/uplift-forge.git
cd uplift-forge
npm install
```

### 2. Fire it up 🔥

```bash
npm start
```

### 3. 🔗 Connect to JIRA

On first launch you'll see a login screen. You need three things:

| Field | Where to get it |
|-------|----------------|
| 🌐 **JIRA Base URL** | Your Atlassian URL, e.g. `https://your-org.atlassian.net` |
| 📧 **Email** | The email on your Atlassian account |
| 🔑 **API Token** | Generate one at [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens) |

**🔐 Real-time Verification**: Uplift Forge verifies your credentials against the JIRA API before saving them. If your API token is invalid or expired, you'll receive an immediate error message. 🛡️

That's it. No OAuth dance, no callback URLs, no environment variables. Your credentials are encrypted at rest using your OS keychain (macOS Keychain / Windows DPAPI). 🛡️

### 4. ⚙️ Configure your project

Head to **Settings** and:

1. 🏷️ Set your **JIRA Project Key** (e.g. `ACTIN`)
2. 📥 Click **Fetch Fields** to load your custom fields and statuses
3. 🗺️ Map your JIRA custom fields (TPD BU, Work Stream, Story Points)
4. 📏 Optionally set up mapping rules for auto-classification

Hit save, and you're off to the races! 🏁

---

## 🎭 Persona System

On first launch, an **Onboarding Wizard** 🧙‍♂️ guides you through selecting your role. **This choice is permanent** — reset the app to change it later. 🔒

| Persona | What You See |
|---------|-------------|
| 👥 **Engineering Manager / VP** | All 6 tabs — cycle time, throughput, contribution, aging WIP, rework, bug ratio, SP accuracy, first-time pass rate, review duration, work type distribution, lead time breakdown, per-engineer individual metrics. Multi-project support. 🌐 |
| 📋 **Delivery Manager** | Flow Dashboard — CFD, lead time distribution, WIP vs limits, tiered aging WIP, blockers, flow efficiency, throughput stability, Monte Carlo forecast, arrival vs departure, batch size trend, time to first activity, lead time breakdown 🌊 |
| 🧑‍💻 **Individual Contributor** | Private personal dashboard — cycle time trend, throughput, time-in-status, rework, scope trajectory, team comparison, personal goals, SP accuracy, first-time pass rate, review wait time, focus score 🎯 |
| 🏛️ **Member of Management** | Organizational Health Radar — cross-project throughput, cycle time by project, bug escape rate, tech debt ratio, flow efficiency, headcount-normalized throughput. Multi-project. 💼 |

Each persona sees **genuinely different metrics** backed by a shared Timeline Engine that computes status periods, cycle/lead time, rework, and flow efficiency from JIRA changelogs. 🔧

**🔒 Persona Isolation**: Each persona can ONLY see its own metrics — IPC handlers enforce persona guards preventing cross-persona data access. To change persona, use "Reset App" in the sidebar (goes back to login — full fresh install state).

**🌐 Multi-Project Support**: EM and Management personas can configure multiple JIRA project keys during onboarding and in Settings. Data is aggregated across all projects.

---

## 📑 The Tabs

### 🏠 Home

A persona-aware welcome screen with a getting-started guide. Shows different greetings based on your role. 👋

### 📊 Engineering Attribution

The workhorse 💪. A sortable, filterable table of all your resolved tickets.

- 🏢 **TPD BU & Work Stream**: Auto-classify using mapping rules, or edit inline
- 💾 **Save to JIRA**: Push changes back with one click

### 👥 Team Metrics (EM: Team Dashboard)

**For Engineering Managers** — the EM Team Dashboard shows:

- 📈 **Cycle Time Distribution** — p50/p85/p95 with 4-week trend
- 🔄 **Throughput by Work Stream** — ticket counts and SP by category
- 📊 **Weekly Throughput** — trend chart over 8 weeks
- 👥 **Contribution Spread** — per-engineer output normalized against team average
- ⏳ **Aging WIP** — tickets stuck in active statuses beyond warning/critical/escalation thresholds
- 🐛 **Bug Ratio by Engineer** — quality signal per team member
- 🔁 **Rework Rate** — percentage of tickets with backward status transitions
- 🎯 **SP Estimation Accuracy** — active time from history vs estimated (SP × sp_to_days × 8h)
- ✅ **First-Time Pass Rate** — percentage of tickets completed without rework
- ⏱️ **Avg Code Review Duration** — time tickets spend in review statuses
- 📊 **Work Type Distribution** — horizontal bar chart by issue type
- 📋 **Unestimated Ticket Ratio** — % of resolved tickets with no story point estimate
- 🔀 **Lead Time Breakdown** — active work vs waiting vs blocked percentages

### 🌊 Team Metrics (DM: Flow Dashboard)

**For Delivery Managers** — the DM Flow Dashboard shows:

- 📊 **Cumulative Flow Diagram** — 30-day stacked area chart of daily status counts
- ⏱️ **Lead Time Distribution** — p50/p85/p95 with histogram (day-range buckets)
- 📋 **WIP Count vs Limit** — active ticket count with configurable WIP limit
- ⚠️ **Aging WIP (3 tiers)** — warning/critical/escalation based on configurable thresholds
- 🚫 **Blocker Duration** — top blocked tickets sorted by blocked hours
- 🌊 **Flow Efficiency** — average and median (active time / lead time)
- 📈 **Throughput Stability** — coefficient of variation of weekly throughput (1 - stddev/mean)
- 🔮 **Monte Carlo Forecast** — 10,000 simulations predicting weeks to complete current WIP (50/85/95% confidence)
- 🔄 **Arrival vs Departure Rate** — 12-week dual-line chart of tickets created vs resolved
- 📦 **Batch Size Trend** — avg SP per completed ticket each week (12 weeks)
- ⏱️ **Time to First Activity** — average time from creation to first active status
- 🔀 **Lead Time Breakdown** — active work vs waiting vs blocked percentages

### 🧑‍💻 Individual Metrics (EM: Individual Dashboard)

**For Engineering Managers** — per-engineer metrics with team averages:

- 📊 **Engineer Output Comparison** — bar chart of tickets and SP per engineer
- 🃏 **Expandable Engineer Cards** — cycle time p50/p85, rework rate, bug ratio, SP accuracy, first-time pass rate, complexity, focus ratio
- ⚖️ **Team Averages Bar** — baseline comparison for all metrics (includes SP accuracy + first-time pass)
- 🎨 **Color-coded** — green/red vs team average (lower-is-better for cycle time, rework, bugs)

### 🎯 Individual Metrics (IC: Personal Dashboard)

**For Individual Contributors** — private personal metrics with growth framing:

- 📈 **Cycle Time Trend** — weekly p50 over 8 weeks
- 📊 **Weekly Throughput** — tickets done per week
- 🕐 **Time in Each Status** — how your time is distributed across workflow states
- 🔁 **Rework Rate** — your rework trend over time
- 📐 **Scope Trajectory** — average SP per ticket by month (are you taking on more complex work?)
- ⏳ **My Aging WIP** — your in-progress tickets with days-in-status
- 👥 **Team Comparison** (opt-in) — anonymous team medians for benchmarking
- 🎯 **Goal Progress** — personal targets vs current performance
- 🎯 **SP Estimation Accuracy** — your estimates vs actual active time from history
- ✅ **First-Time Pass Rate** — percentage of your tickets completed without rework
- ⏱️ **Code Review Wait Time** — average time your tickets spend in review
- 🎯 **Focus Score** — percentage of product work vs bugs/maintenance

### 🏛️ Team Metrics (Management: Org Dashboard)

**For Members of Management** — organizational health radar across all projects:

- 🎫 **Total Tickets** — volume KPI across all projects
- 🐛 **Bug Escape Rate** — bugs ÷ total stories with traffic-light indicator (green <10%, amber <20%, red ≥20%)
- 🔧 **Tech Debt Ratio** — capacity on bugs + tech debt vs features with traffic-light indicator
- 🌊 **Flow Efficiency** — aggregate active time / lead time with traffic-light indicator
- 👤 **Headcount-Normalized Throughput** — tickets ÷ number of tracked engineers
- 📊 **Cycle Time p85 by Project** — horizontal bar chart comparing projects
- 📈 **Throughput Trend by Project** — multi-line chart (one line per project over 8 weeks)
- 📊 **Weekly Throughput** — aggregate bar chart
- 📊 **Delivery Predictability** — coefficient of variation per project (color-coded: green <30%, amber 30-50%, red >50%)
- 📊 **Work Type by Project** — stacked horizontal bars showing issue type breakdown per project

### 🏔️ Epic Tracker

Track epic-level delivery progress 📋. Available for Engineering Managers and Delivery Managers.

- 📊 **Summary stats** — total epics, high/medium/low risk counts
- 🃏 **Epic cards** — expandable with progress bars, risk badges, ticket counts
- ⚠️ **Auto-computed risk scores** — weighted formula based on progress, overdue, blocked, bugs
- 🤖 **AI Risk Analysis** — per-epic AI suggestions for risk mitigation

### 🔧 Settings

- 🔒 **Your Role** — read-only badge (set during onboarding, immutable)
- 🔗 **JIRA Connection** — project key, data range, field mappings
- 📊 **Metrics** — SP calibration, tracked engineers, status classification
- 📏 **Attribution** — visual rule builder for TPD BU and Work Stream
- 🖥️ **Application** — AI provider setup, version info, update check

---

## 🔧 Timeline Engine

The **Timeline Engine** extracts flow data from JIRA changelogs using **calendar time**:

- 📊 **Status Periods** — every period a ticket spent in each status, with duration and category (active/wait/blocked/done)
- ⏱️ **Cycle Time** — first active status to done (calendar hours)
- 📏 **Lead Time** — created to done (calendar hours)
- 🌊 **Flow Efficiency** — active time / lead time × 100
- 🔁 **Rework Detection** — backward transitions in status order (e.g. Code Review → In Progress)
- ⏳ **Days in Current Status** — for aging WIP detection

Status classification is configurable in Settings: Active Statuses, Blocked Statuses, Done Statuses. 🔧

---

## 🛡️ Privacy & Security

- 🏠 **Local-first**: All data lives on your machine. No servers, no telemetry, no tracking.
- 🔐 **Encrypted credentials**: API tokens are stored using your OS's native secure storage (macOS Keychain, Windows DPAPI).
- 📜 **GDPR consent**: Users agree to a Privacy Policy and Terms of Service on first login.
- 💣 **Reset anytime**: The "Reset App" button in the sidebar wipes all stored data, credentials, and AI keys — returning you to the login page (fresh install state).

The only external calls are to the JIRA REST API (your instance) and GitHub (for update checks). 🔗

---

## 🛠️ Development

### 💻 Commands

| Command | What it does |
|---------|-------------|
| `npm start` | 🔥 Launch in dev mode (Vite HMR + Electron) |
| `npm test` | 🧪 Run all tests |
| `npm run test:watch` | 👀 Watch mode |
| `npm run test:coverage` | 📊 Coverage report |
| `npm run lint` | 🔍 ESLint |
| `npm run test:e2e` | 🎭 Run all e2e tests |
| `npm run test:e2e:headed` | 👀 Run e2e tests with visible window |
| `npm run test:all` | 🧪🎭 Run unit + e2e tests |
| `npm run package` | 📦 Package the app |
| `npm run make` | 🏗️ Build distributables (DMG / Squirrel / ZIP) |
| `npm run publish` | 🚀 Publish to GitHub Releases |

### 🏗️ Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | ⚡ Electron 33 |
| Frontend | ⚛️ React 19, 🎨 Tailwind CSS 4, 📈 Recharts, ✨ Lucide icons |
| Language | 📘 TypeScript 5.9 (strict mode) |
| Build | 🔨 Electron Forge + Vite |
| Testing | 🧪 Vitest + Testing Library + jsdom |
| Date/Time | 🕐 Luxon (timezone-aware) |
| Storage | 💾 electron-store (JSON on disk) |
| Auth | 🔑 API token, encrypted via safeStorage |

### 📁 Project Layout

```
src/
  main/           🖥️ Electron main process
    auth/           🔐 Credential storage (OS keychain)
    ipc/            📡 IPC handler registrations
    services/       🧠 Business logic (config, JIRA, tickets, metrics, timeline, em/dm/ic/cto metrics, field engine, projects, updates)
  renderer/       🎨 React frontend
    pages/          📄 Home, Login, EmTeamDashboard, EmIndividualDashboard, DmFlowDashboard, IcPersonalDashboard, CtoOrgDashboard, Attribution, Epic Tracker
    components/     🧩 Sidebar, ConfigPanel, TicketTable, RuleBuilder, OnboardingWizard, etc.
  shared/         🤝 Types and IPC channel constants
test/
  main/           🧪 Service unit tests
```

### 🧪 Testing

**Unit Tests**: 675 tests across 33 test suites (Vitest + Testing Library). Coverage thresholds enforced:

| Metric | Threshold |
|--------|-----------|
| ✅ Statements | 90% |
| 🔀 Branches | 80% |
| ⚡ Functions | 85% |
| 📏 Lines | 90% |

**E2E Tests**: ~54 end-to-end tests using Playwright + Electron 🎭.
 Tests launch the real packaged app with an isolated user-data directory and a local JIRA mock server.

---

## 📦 Building for Distribution

```bash
# 🍎 macOS DMG
npm run make

# 🌍 All platforms (DMG, Squirrel installer, ZIP)
npm run make
```

Releases are published to GitHub via `npm run publish`. The app checks for updates automatically every 4 hours ⏰ (or manually from Settings).

---

## 📜 License

GNU GPL v3

---

<p align="center">
  Built with ❤️ by <a href="https://www.parijatmukherjee.com">Parijat Mukherjee</a>
</p>
