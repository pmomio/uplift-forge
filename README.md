# 🔥 Uplift Forge

Engineering team performance platform. ⚡ Electron desktop app that connects to JIRA via API token auth, fetches ticket data with changelogs, and computes persona-specific engineering metrics using a shared Timeline Engine.

## 🏗️ Tech Stack

- **Runtime**: Electron (Node.js + React)
- **Frontend**: React 19, Tailwind CSS v4, Lucide React, Recharts
- **Backend**: Node.js, Electron IPC, `electron-store`, `safeStorage` (OS Keychain)
- **Time/Date**: `luxon`
- **Testing**: Vitest, React Testing Library, Playwright (E2E)

---

## 🚀 Getting Started

1.  **Setup**: `make setup` (installs dependencies)
2.  **Run**: `make dev` (starts the app in development mode)
3.  **Auth**: Enter your JIRA Base URL, Email, and API Token on first launch. Credentials are encrypted and stored in your OS keychain.
4.  **Config**: Select your project, ticket filter (e.g., last 6 months), and define mapping rules to categorize your work into Business Units (TPD BU) and Work Streams.

---

## ✨ Features

### 🔐 Persona-Aware Experience

Choose your perspective in Settings. Uplift Forge tailors its metrics, dashboards, and growth framing to your specific role:

- **Individual Contributor (IC)**: Private personal flow metrics, growth trajectory, and goal tracking.
- **Engineering Manager (EM)**: Team health, individual reports, contribution spread, and estimation accuracy.
- **Delivery Manager (DM)**: Org-wide flow metrics, CFD, WIP limits, and Monte Carlo forecasting.
- **Management**: Organizational health radar across all projects and aggregate bug escape rates.

### 📊 Engineering Attribution

The workhorse 💪. A sortable, filterable table of all your resolved tickets. For each one:

- **⏱️ Engineering Hours**: Click the calculator icon to auto-compute hours from status changelogs. The engine tracks every cycle a ticket goes through (In Progress -> Code Review -> back to In Progress -> Code Review again) and sums up all active development time. Office hours only, weekends excluded.
- **🏢 TPD BU & Work Stream**: Click to auto-classify using your mapping rules, or edit inline.
- **💾 Save to JIRA**: Push your changes back with one click.

Bulk buttons at the top let you calculate and save everything at once. ⚡

### 👥 Team Metrics (EM: Team Dashboard)

**For Engineering Managers** — nine KPI cards showing your team's output:

| Metric | What it tells you |
|--------|------------------|
| 🎫 Total Tickets | Volume of completed work |
| 📐 Story Points | Scope delivered |
| ⏱️ Engineering Hours | Actual time invested |
| 🎯 Estimation Accuracy | How close your estimates are to reality (1.0 = perfect) |
| ⚡ Avg Hours/SP | Time efficiency per story point |
| 🔄 Avg Cycle Time | Average development time per ticket |
| 🐛 Bug Count & Ratio | Quality signal |
| 🕐 Bug Hours % | How much time goes to fixing bugs |

Each card shows a trend badge comparing to the previous period. Filter by **Weekly**, **Bi-weekly**, **Monthly**, or **All Time**. 🗓️

Each KPI card has a **✨ Sparkles** button — click it to open the AI Suggestions panel, which sends the metric context to your configured AI provider and returns 2-4 actionable improvement suggestions. 🧠

Below the cards: monthly trend charts 📈, business unit breakdowns 🏢, work stream pie charts 🥧, and issue type distributions. Everything built with Recharts.

### 🌊 Team Metrics (DM: Flow Dashboard)

**For Delivery Managers** — the DM Flow Dashboard focuses on flow predictability:

- 📊 **Cumulative Flow Diagram** — 30-day stacked area chart of daily status counts
- ⏱️ **Lead Time Distribution** — p50/p85/p95 with histogram (day-range buckets)
- 📋 **WIP Count vs Limit** — active ticket count with configurable WIP limit
- ⚠️ **Aging WIP (3 tiers)** — warning/critical/escalation based on configurable thresholds
- 🚫 **Blocker Duration** — top blocked tickets sorted by blocked hours
- 🌊 **Flow Efficiency** — average and median (active time / lead time)
- 📈 **Throughput Stability** — coefficient of variation of weekly throughput (1 - stddev/mean)
- 🔮 **Monte Carlo Forecast** — 10,000 simulations predicting weeks to complete current WIP (50/85/95% confidence)

### 🧑‍💻 Individual Metrics (EM: Individual Dashboard)

**For Engineering Managers** — per-engineer metrics with team averages:

- 📊 **Engineer Output Comparison** — bar chart of tickets and SP per engineer
- ⚖️ **A "vs team average" comparison** for each metric
- 📊 **Side-by-side bar charts** across the team
- 🃏 **Expandable Engineer Cards** — cycle time p50/p85, rework rate, bug ratio, SP accuracy, complexity, focus ratio

### 🎯 Individual Metrics (IC: Personal Dashboard)

**For Individual Contributors** — private personal metrics with growth framing:

- 📈 **Cycle Time Trend** — weekly p50 over 8 weeks
- 🕐 **Time in Each Status** — how your time is distributed across workflow states
- 📐 **Scope Trajectory** — average SP per ticket by month (are you taking on more complex work?)
- 👥 **Team Comparison** (opt-in) — anonymous team medians for benchmarking
- 🎯 **Goal Progress** — personal targets vs current performance

### 🏛️ Team Metrics (Management: Org Dashboard)

**For Members of Management** — organizational health radar across all projects:

- 🎫 **Total Tickets** — volume KPI across all projects
- 🐛 **Bug Escape Rate** — aggregate quality across projects
- 🔧 **Tech Debt Ratio** — capacity on bugs + tech debt vs features
- 🌊 **Flow Efficiency** — aggregate active time / lead time
- 📊 **Cycle Time p85 by Project** — horizontal bar chart comparing projects

### 🏔️ Epic Tracker

Track epic-level delivery progress 📋. Available for Engineering Managers and Delivery Managers. Includes **in-progress epics** and uses the **Timeline Engine** for richer risk scoring. 🕐

- ⚠️ **7-factor risk scoring** — weighted formula using progress, overdue, blocked, bugs, rework, aging WIP, and reopen data.
- 📈 **Timeline-based metrics** — avg lead time, flow efficiency, rework count, aging WIP count per epic.
- 🤖 **AI Risk Analysis** — per-epic AI suggestions with full timeline context.

---

## 🔧 Settings

### ⚙️ App Configuration

- **JIRA Project & Filter**: Set your target project key and how much data to fetch (e.g., last 6 months).
- **Mapping Rules**: Define AND-OR logic to map tickets to your business metadata (e.g., `Issue Type = Story` AND `Label = Product` → `Work Stream = Feature Work`).
- **Team Tracking**: Enter names of engineers to track.
- **Workflow Classification**: Define which JIRA statuses map to `Active`, `Blocked`, and `Done` for the Timeline Engine.

### 🤖 AI Provider

Connect your preferred AI model to get actionable improvement suggestions. Supports **OpenAI** (GPT-4o) and **Anthropic** (Claude 3.5 Sonnet).

---

## 🔐 Security & Privacy

- **Local-First**: Your JIRA data stays on your machine.
- **Encrypted**: JIRA API tokens are stored via Electron's `safeStorage` (OS Keychain).
- **Privacy Mode**: IC metrics are private and never visible to other personas. Management/EM personas only see data for engineers defined in the "Tracked Engineers" list.

---

## 🛠️ Developer Guide

### 📂 Directory Structure

```
uplift-forge/
├── src/
│   ├── main/             # Electron main process (IPC handlers, services)
│   │   ├── services/     # Timeline Engine, Metrics, JIRA API
│   │   └── auth/         # SafeStorage token management
│   ├── renderer/         # React frontend (Vite)
│   │   ├── components/   # UI components, Charts, RuleBuilder
│   │   └── pages/        # Persona-specific dashboards
│   └── shared/           # Types and IPC channel constants
├── e2e/                  # Playwright end-to-end tests
└── test/                 # Vitest unit tests
```

### 💻 Commands

All commands are accessed via `make`. Run `make help` to see all available targets. 🎯

| Command | What it does |
|---------|-------------|
| `make help` | 📖 Show all available targets |
| `make setup` | 📦 Install all dependencies |
| `make dev` | 🔥 Launch in dev mode (Vite HMR + Electron) |
| `make test` | 🧪 Run all unit tests |
| `make test-watch` | 👀 Watch mode |
| `make test-coverage` | 📊 Coverage report |
| `make lint` | 🔍 ESLint |
| `make test-e2e` | 🎭 Run all e2e tests |
| `make test-all` | 🧪🎭 Run unit + e2e tests |
| `make package` | 📦 Package the app |
| `make make-dist` | 🏗️ Build distributables (DMG / Squirrel / ZIP) |

### 🧪 Testing

**Unit Tests**: 685 tests across 33 test suites (Vitest + Testing Library).

**E2E Tests**: ~62 end-to-end tests using Playwright + Electron 🎭. Tests launch the real packaged app with an isolated user-data directory and a local JIRA mock server.

---

## 📦 Building for Distribution

1. Update version in `package.json`
2. Run `make make-dist`
3. Find outputs in `out/make/`
