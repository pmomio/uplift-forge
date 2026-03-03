# 🔥 Uplift Forge — User Guide

> ✨ Your engineering team's performance, forged into something useful.

Uplift Forge is a desktop app that connects to JIRA and turns ticket data into clear metrics, beautiful charts, and actionable insights. Everything runs locally on your machine — no servers, no Docker, no backend setup. 💻🔒

---

## 📖 Table of Contents

1. [🚀 Installation](#-installation)
2. [🔗 Connecting to JIRA](#-connecting-to-jira)
3. [🎭 Onboarding & Persona Selection](#-onboarding--persona-selection)
4. [⚙️ First-Time Setup](#️-first-time-setup)
5. [🧭 Navigation](#-navigation)
6. [🏠 Home](#-home)
7. [📊 Engineering Attribution](#-engineering-attribution)
8. [👥 EM Team Dashboard](#-em-team-dashboard)
9. [🧑‍💻 EM Individual Dashboard](#-em-individual-dashboard)
10. [🌊 DM Flow Dashboard](#-dm-flow-dashboard)
11. [🎯 IC Personal Dashboard](#-ic-personal-dashboard)
12. [🏛️ Management Org Dashboard](#️-management-org-dashboard)
13. [🏔️ Epic Tracker](#️-epic-tracker)
14. [🔧 Settings](#-settings)
15. [🤖 AI-Powered Suggestions](#-ai-powered-suggestions)
16. [🔄 Updating the App](#-updating-the-app)
17. [🛡️ Privacy & Security](#️-privacy--security)
18. [🩺 Troubleshooting](#-troubleshooting)
19. [🌐 Multi-Project Support](#-multi-project-support)

---

## 🚀 Installation

```bash
git clone git@github.com:pmomio/uplift-forge.git
cd uplift-forge
npm install
npm start
```

The app launches in development mode with hot-reload. 🔥 For packaged builds, run `npm run make` to produce a DMG (macOS) or installer (Windows).

---

## 🔗 Connecting to JIRA

On first launch you'll see the login screen. You need three things:

| Field | Where to get it |
|-------|----------------|
| **🌐 JIRA Base URL** | Your Atlassian URL, e.g. `https://your-org.atlassian.net` |
| **📧 Email** | The email address on your Atlassian account |
| **🔑 API Token** | Generate one at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) |

1. Enter your JIRA base URL (trailing slashes are removed automatically) 🪄
2. Enter your Atlassian email
3. Enter your API token (the field is masked for security 🔒)
4. Read the **Privacy Policy** and **Terms of Service** by clicking the links — they open in a scrollable modal 📜
5. Check the **I consent** checkbox to enable the login button ✅
6. Click **Connect & Continue** (or press Enter) 🚀

If authentication fails, an error message appears below the form ❌. Double-check your URL, email, and token.

Your credentials are encrypted at rest using your operating system's secure storage (macOS Keychain / Windows DPAPI). They never leave your machine. 🏠

---

## 🎭 Onboarding & Persona Selection

After your first login, an **Onboarding Wizard** 🧙‍♂️ guides you through setting up your workspace.

### 📋 Steps

1. **👋 Welcome** — introduction to Uplift Forge
2. **🎭 Your Role** — pick the persona that matches how you use the tool:

| Persona | Best For | What You Get |
|---------|----------|-------------|
| 👥 **Engineering Manager / VP** | Team leads, VPs managing 1-10 projects | All 6 tabs — cycle time, throughput, contribution, aging WIP, rework, bug ratio, per-engineer individual metrics, multi-project aggregation 🌐 |
| 📋 **Delivery Manager** | Scrum masters, PMs | Flow Dashboard — CFD, lead time, WIP, aging WIP, blockers, flow efficiency, Monte Carlo forecast 🌊 |
| 🧑‍💻 **Individual Contributor** | Developers, engineers | Personal dashboard — cycle time trend, throughput, time-in-status, rework, scope trajectory, team comparison (opt-in), goals 🎯 |
| 🏛️ **Member of Management** | Directors, VPs, C-level | Organizational Health Radar — cross-project throughput, cycle time by project, bug escape rate, tech debt ratio, flow efficiency, headcount-normalized throughput. Multi-project. 💼 |

> 🔒 **This choice is permanent.** Your persona is locked after onboarding. To change it later, use "Reset App" in the sidebar — this performs a full wipe (credentials, config, caches, AI keys) and returns you to the login page, just like a fresh install. Each persona sees completely different metrics — there is no cross-persona visibility.

3. **🔗 Project** (new users only) — enter your JIRA project key(s). EM and Management personas can add multiple project keys for cross-project tracking 🌐
4. **🎉 Ready!** — review and complete setup. Your role is shown with a lock icon confirming it's permanent.

---

## ⚙️ First-Time Setup

After completing onboarding, head to **Settings** (the gear icon in the sidebar) if you need to configure additional options:

1. 🏷️ **Set your Project Key** — e.g. `ACTIN`, `PROJ`. This is the prefix on your JIRA ticket keys.
2. 📥 **Click Fetch Fields** — this pulls your project's custom fields and statuses from JIRA.
3. 🗺️ **Map your JIRA fields** — select the custom field IDs for TPD Business Unit, Engineering Hours, Work Stream, and Story Points.
4. ⏱️ **Set start and end statuses** — these define when the engineering hours clock starts and stops (e.g. "In Progress" → "Code Review").
5. 💾 **Click Save Settings**.
6. 🔄 Go to **Engineering Attribution** and click **Sync Now** to pull your tickets.

That's it. You're ready to go! 🎉

---

## 🧭 Navigation

The sidebar on the left is your main navigation. It shows:

- 🖼️ **Project avatar and name** (once configured)
- 🏷️ **Project key** (e.g. "ACTIN")
- 📑 **Tabs** — filtered based on your persona (see below)
- 📧 **Your email** (at the bottom)
- 🚪 **Logout** — signs you out and returns to the login screen
- 💣 **Reset App** — wipes all stored data, credentials, and AI keys; returns to login page (use with caution!)
- ℹ️ **Version number** and developer credit

Click any tab to switch pages. The active tab is highlighted with an indigo accent. 💜

### 📑 Tab Visibility by Persona

| Tab | 👥 Eng Mgr | 📋 Delivery | 🧑‍💻 Individual | 🏛️ Management |
|-----|-----------|------------|--------------|--------------|
| 🏠 Home | ✅ | ✅ | ✅ | ✅ |
| 📊 Attribution | ✅ | ✅ | ❌ | ✅ |
| 👥 Team Metrics | ✅ (EM Dashboard) | ✅ (Flow Dashboard) | ❌ | ✅ (Org Dashboard) |
| 🧑‍💻 Individual Metrics | ✅ (EM Individual) | ❌ | ✅ (Personal Dashboard) | ❌ |
| 🏔️ Epic Tracker | ✅ | ✅ | ❌ | ✅ |
| ⚙️ Settings | ✅ | ✅ | ✅ | ✅ |

> 💡 Each persona sees its own dashboard for Team/Individual Metrics — the same tab ID routes to completely different pages depending on your role.

---

## 🏠 Home

The Home page is a persona-aware landing page. It shows:

- 👋 A welcome message tailored to your role (e.g. "Engineering Command Center" for EMs, "Your Performance Dashboard" for ICs)
- 📋 A 4-step setup guide
- 🃏 Feature cards explaining what the app does

This page is read-only — it's there to orient you when you first open the app. 🧭

---

## 📊 Engineering Attribution

This is the workhorse of the app 💪. It shows a sortable, paginated table of all your resolved JIRA tickets.

### 🗂️ The Ticket Table

Each row shows:

| Column | Description |
|--------|------------|
| 🔑 **Key** | JIRA ticket key (e.g. ACTIN-123). Click the link icon to open in JIRA. |
| 📝 **Summary** | Ticket title (truncated; hover to see full text). |
| 🚦 **Status** | Colored badge — green for Done/Closed, red for Rejected/Cancelled. |
| 👤 **Assignee** | Who the ticket is assigned to. |
| 🏢 **TPD BU** | Business unit. Editable dropdown. |
| ⏱️ **Eng Hours** | Engineering hours. Editable number field. |
| 🔀 **Work Stream** | Work stream. Editable dropdown. |
| ⚡ **Actions** | Sync (refresh from JIRA), Save (push to JIRA). |

### 🎯 What You Can Do

- 🔃 **Sort** — Click any column header to sort ascending/descending
- ✏️ **Edit inline** — Change TPD BU, Eng Hours, or Work Stream directly in the table
- 🧮 **Auto-calculate** — Click calculator icons to compute hours from changelogs or auto-classify using rules
- 🔄 **Sync** — Re-fetch tickets from JIRA
- 💾 **Save** — Push edits back to JIRA
- 🧮 **Calculate All / Save All** — Bulk operations at the top

---

## 👥 EM Team Dashboard

**For Engineering Managers.** Shows timeline-based team metrics:

### 🃏 KPI Cards (3x2 Grid)

- 🎫 **Total Tickets** — volume KPI
- ⏱️ **Cycle Time p50** — median cycle time
- 🔁 **Rework Rate** — percentage of tickets with backward status transitions
- ✅ **First-Time Pass Rate** — percentage of tickets completed without any rework
- 🎯 **SP Estimation Accuracy** — actual eng hours vs estimated (SP × sp_to_days × 8h). Shows unestimated % in subtitle
- ⏱️ **Avg Review Duration** — average time tickets spend in review statuses

### 📈 Cycle Time Distribution

- p50/p85/p95 cycle time with a 4-week trend line chart
- Cycle time = first active status → done (calendar hours)

### 📊 Throughput by Work Stream

- Bar chart showing ticket counts and story points grouped by work stream (Product, Maintenance, etc.)

### 📈 Weekly Throughput

- 8-week bar chart of tickets completed per week

### 👥 Contribution Spread

- Per-engineer output (tickets + SP) normalized against team average

### ⏳ Aging WIP

- Table of tickets stuck in active statuses beyond configured thresholds
- Three severity levels: ⚠️ warning, 🔶 critical, 🔴 escalation

### 🐛 Bug Ratio by Engineer

- Per-engineer bug count vs total count

### 📊 Work Type Distribution

- Horizontal bar chart breaking down completed tickets by issue type (Story, Task, Bug, Sub-task, etc.)

### 🔀 Lead Time Breakdown

- Stacked bar showing average time split: active work vs waiting vs blocked. Target: Active >50%, Wait <30%, Blocked <10%

### 🔄 Period Selection

All Time, Half Year, Quarterly, Monthly, Bi-weekly, Weekly, Daily. Click **Sync & Refresh** to pull latest data. 🔃

---

## 🧑‍💻 EM Individual Dashboard

**For Engineering Managers.** Per-engineer metrics with team averages:

### 📊 Team Averages Bar

Shows baseline: cycle time p50, rework rate, bug ratio, total tickets, total SP, SP accuracy, first-time pass rate.

### 📊 Engineer Output Comparison

Bar chart comparing tickets and SP across all tracked engineers.

### 🃏 Engineer Cards

Click to expand. Each card shows:

| Metric | Description |
|--------|------------|
| ⏱️ **Cycle Time p50/p85** | Individual cycle time percentiles |
| 🔁 **Rework Rate** | Percentage of tickets with rework |
| 🐛 **Bug Ratio** | Bugs vs total tickets |
| 🧩 **Complexity** | Average SP per ticket |
| 🎯 **Focus Ratio** | Percentage of product work (stories, tasks) vs bugs/ops |
| 🎫 **Tickets & SP** | Raw counts |

Values are color-coded against team average: 🟢 better, 🔴 worse (respecting "lower is better" for cycle time, rework, bugs).

---

## 🌊 DM Flow Dashboard

**For Delivery Managers.** Flow-focused metrics and delivery forecasting:

### 🃏 KPI Cards (5-card grid)

- ⏱️ **Lead Time p50** — median lead time (created → done)
- 🌊 **Flow Efficiency** — average active time / lead time
- 📋 **WIP** — active ticket count vs configured WIP limit
- 📈 **Throughput Stability** — 1 - (stddev/mean) of weekly throughput counts
- ⏱️ **Time to First Activity** — average time from ticket creation to first active status. Elite: <4h. Good: <1 day

### 📊 Lead Time Distribution

Histogram with day-range buckets (0-1d, 1-3d, 3-7d, 1-2w, 2-4w, 4w+) plus p50/p85/p95 values.

### 📈 Weekly Throughput

12-week bar chart of tickets completed per week.

### 📊 Cumulative Flow Diagram

30-day stacked area chart showing daily counts of tickets in each status. Reveals bottlenecks by showing widening bands. 📏

### 🔮 Monte Carlo Forecast

10,000 simulations sampling from historical weekly throughput to predict how many weeks to complete current WIP:
- 50% confidence (optimistic)
- 85% confidence (likely)
- 95% confidence (conservative)

### 📋 WIP Breakdown

Current WIP broken down by status (e.g. "In Progress: 5, Code Review: 3").

### ⏳ Aging WIP (3 tiers)

Tickets stuck beyond configurable thresholds:
- ⚠️ **Warning** (default: 3+ days)
- 🔶 **Critical** (default: 7+ days)
- 🔴 **Escalation** (default: 14+ days)

### 📈 Arrival vs Departure Rate

Dual-line chart (12 weeks) showing tickets created vs resolved per week. When arrivals consistently exceed departures, the backlog grows unsustainably. 📊

### 📦 Batch Size Trend

Line chart (12 weeks) showing average story points per completed ticket each week. Smaller batches flow faster — spikes indicate large tickets clogging flow. 📉

### 🔀 Lead Time Breakdown

Stacked bar showing average time split: active work vs waiting vs blocked. Target: Active >50%, Wait <30%, Blocked <10%.

### 🚫 Top Blocked Tickets

Tickets with the most blocked hours, sorted by duration.

### 🔄 Period Selection

All Time, Half Year, Quarterly, Monthly, Bi-weekly, Weekly, Daily. Includes **Sync & Refresh** button. 🔃

---

## 🎯 IC Personal Dashboard

**For Individual Contributors.** Private personal metrics with a growth-oriented framing:

### 🃏 KPI Cards (Row 1)

- ⏱️ **Cycle Time p50** — your median cycle time
- 🔁 **Rework Rate** — your rework percentage
- 🎫 **Tickets** — your total tickets completed
- 📐 **Story Points** — your total SP delivered

### 📊 Quality & Planning Cards (Row 2)

Four additional cards with health indicators (🟢 good, 🟡 ok, 🔴 bad):

- 🎯 **SP Estimation Accuracy** — your SP estimates vs actual engineering hours. 80-120% = good, 60-150% = ok
- ✅ **First-Time Pass Rate** — percentage of your tickets completed without backward transitions. ≥90% = good, ≥75% = ok
- ⏱️ **Review Wait Time** — average time your tickets spend in Code Review. ≤4h = good, ≤24h = ok
- 🎯 **Focus Score** — percentage of product work (stories, tasks) vs bugs/maintenance. ≥70% = good, ≥50% = ok

### 📈 Cycle Time Trend

Weekly p50 cycle time over 8 weeks. Shows whether you're getting faster at completing work. 🏎️

### 📊 Weekly Throughput

Bar chart of your tickets completed per week over 8 weeks.

### 🕐 Time in Each Status

Horizontal bar chart showing what percentage of time your tickets spend in each status (In Progress, Code Review, Open, etc.). Helps identify where time is spent. 🔍

### 📐 Scope Trajectory

Average story points per ticket by month. Tracks whether you're taking on more complex work over time. 📈

### ⏳ My In-Progress Tickets

Your current WIP with days-in-status. Color-coded: 🟢 normal, 🟡 >3 days, 🔴 >7 days.

### 👥 Team Comparison (opt-in)

When enabled in Settings, shows anonymous team medians for:
- Cycle time p50
- Rework rate
- Throughput (tickets)

Your values are shown alongside team medians — no individual names, just anonymous benchmarks. 🔒

### 🎯 Goal Progress

When personal goals are configured in Settings, shows progress bars for each target (e.g. "Tickets: 12/15, Story Points: 35/40").

### ⚙️ IC Settings

To use this dashboard fully:
- Set your **Account ID** in Settings (used to filter tickets to just yours)
- Optionally enable **Team Comparison** for anonymous benchmarks
- Optionally set **Personal Goals** for progress tracking

---

## 🏛️ Management Org Dashboard

**For Members of Management.** An organizational health radar across all configured projects:

### 🃏 KPI Cards (with Traffic-Light Indicators)

- 🎫 **Total Tickets** — volume across all projects
- 🐛 **Bug Escape Rate** — bugs ÷ total stories. Traffic light: 🟢 <10%, 🟡 10-20%, 🔴 >20%
- 🔧 **Tech Debt Ratio** — capacity on bugs + tech debt vs features. Traffic light: 🟢 <20%, 🟡 20-35%, 🔴 >35%
- 🌊 **Flow Efficiency** — average active time / lead time. Traffic light: 🟢 >40%, 🟡 25-40%, 🔴 <25%

Traffic-light dots pulse on amber/red states to draw attention to metrics that need action. 💡

### 👤 Headcount-Normalized Throughput

Tickets completed ÷ number of tracked engineers. Shows productivity per capita across the org.

### 📊 Cycle Time p85 by Project

Horizontal bar chart comparing p85 cycle time across all configured projects. Helps identify which projects are slower.

### 📈 Throughput Trend by Project

Multi-line chart (one line per project) over 8 weeks. Different colors per project for easy comparison.

### 📊 Weekly Throughput (Aggregate)

Bar chart of total tickets completed per week across all projects.

### 📏 Delivery Predictability by Project

Horizontal bar chart showing the coefficient of variation (CoV) of cycle time per project. Color-coded: 🟢 <30% (predictable), 🟡 30-50% (moderate), 🔴 >50% (unpredictable). Lower is better — elite teams target <30%.

### 📊 Work Type by Project

Stacked horizontal bars showing feature vs bug vs task breakdown per project. Healthy teams have >60% feature work. Bug-heavy projects may need quality investment. 🏗️

### 🔄 Period Selection

All Time, Half Year, Quarterly, Monthly, Bi-weekly, Weekly, Daily. Click **Sync & Refresh** to sync all projects. 🔃

### 🤖 AI Support

All metric cards have ✨ Sparkles buttons for AI-powered strategic insights. Management AI focuses on org-wide patterns, cross-project comparisons, and strategic decisions — never references individual engineers. 🧠

---

## 🏔️ Epic Tracker

Track epic-level delivery progress and identify risks 📊. Available for **Engineering Managers**, **Delivery Managers**, and **Members of Management**.

### 📋 What You See

- 📊 **Summary stats** — total epics, breakdown by risk level (high 🔴, medium 🟡, low 🟢)
- 🃏 **Epic cards** — color-coded by risk level, showing progress bars, ticket counts, and SP totals
- ⚠️ **Risk badges** — auto-computed risk score (0.00-1.00) with level indicator

### 🔍 Expanding an Epic

Click any epic card to expand it. The detail section shows:

- ⚠️ **Risk Factors** — human-readable descriptions of why the risk score is elevated
- 📊 **Stats** — average cycle time, risk score, total/resolved SP
- 📋 **Child Tickets** — a table of all tickets under this epic with status, SP, and hours
- 🤖 **AI Risk Analysis** — click the Sparkles button to get AI-powered risk mitigation suggestions

### 🧮 How Risk is Calculated

The risk score combines 5 factors automatically:
- 📉 **Progress** (30% weight) — how much work remains
- ⏰ **Overdue tickets** (30% weight) — tickets exceeding 2x the average cycle time
- 🚫 **Blocked tickets** (20% weight) — tickets currently in Blocked status
- 🐛 **Bug ratio** (10% weight) — proportion of bug-type tickets
- 🔄 **Reopened tickets** (10% weight) — tickets that were resolved but reopened

Risk levels: **Low** (0-0.3) 🟢, **Medium** (0.3-0.6) 🟡, **High** (0.6-1.0) 🔴

---

## 🔧 Settings

Four tabs for configuring the app. ⚙️

### 🌐 General

**🔒 Your Role**
- Read-only badge showing your locked persona with a 🔒 icon. "Reset the app to change."

**🔗 JIRA Connection**
- 🏷️ **Project Key** — your JIRA project prefix (e.g. `ACTIN`). Required.
- 📥 **Fetch Fields** — loads custom fields and statuses from your JIRA project.
- 📅 **Data Time Range** — how many months of data to fetch (1–12 months, default 6).

**🗺️ JIRA Field Mappings** (visible after fetching fields)
- 🏢 **TPD Business Unit** — select the custom field ID
- ⏱️ **Engineering Hours** — select the custom field ID
- 🔀 **Work Stream** — select the custom field ID
- 📐 **Story Points** — select the custom field ID

**🌐 Additional Projects** (EM persona only)
- Manage additional JIRA projects for cross-project aggregation

### 📊 Metrics

**📐 Story Point Calibration**
- ⚖️ **SP to Man-Days** — how many working days one story point represents (default: 1).

**👥 Team Management**
- 📥 **Fetch Members** — pulls the list of users who have been assigned tickets
- ✅ Select engineers to track by clicking their name

### 📏 Engineering Attribution Rules

Visual rule builder for auto-classifying tickets into business units and work streams. 🧠

**How rules work:**
- 📦 Rules are organized into **groups** (each group maps to a value like "B2C" or "Product")
- 🧱 Within a group, **blocks** of conditions use **AND** logic
- 🔀 Across blocks, **OR** logic applies
- ⬇️ Groups are evaluated top-to-bottom — first match wins

**⏱️ Work Cycle Definition**
- ▶️ **Start Status** — the status that starts the engineering hours clock
- ⏹️ **End Status** — the status that stops the clock
- ⏸️ **Excluded Statuses** — statuses that pause the clock (e.g. "Blocked")

### 🖥️ Application Settings

**🤖 AI-Powered Suggestions**
- 🔀 Choose your AI provider: **OpenAI** or **Claude**
- 🔑 Enter your API key and click **Save Key**
- 🧪 Click **Test Connection** to verify
- 🗑️ Click **Remove** to delete the stored key

**🔄 Software Updates**
- 📋 Shows the current app version
- 🔍 Click **Check for Updates** to manually check

---

## 📖 Metric Explain Button

Every metric across all 5 persona dashboards has a **📖 BookOpen** button next to the help tooltip icon. Clicking it opens a modal that explains exactly how the metric is computed:

- **📊 Data source** — what JIRA data is used (changelogs, ticket fields, etc.)
- **🧮 Computation** — the formula or algorithm applied
- **🔍 Filters** — what tickets are included or excluded
- **⚙️ Config dependency** — which Settings affect the result

### 🔬 Dynamic Computation Traces

When data is available, the Explain modal shows **dynamic computation traces** with real values from your actual data instead of generic descriptions. For example:

> 237 total timelines, 180 tickets
> Period "monthly": 42 resolved tickets remain
> Scoped to 14 tracked engineers: 38 timelines
> 35 had valid cycle time (first active → done)
> Range: 2.1h – 312.5h
> p50 = 18.4h, p85 = 48.2h, p95 = 96.1h

This lets you see the exact pipeline — ticket counts, filter results, intermediate calculations, and final values — so you can verify how each metric was computed. 🔍 When traces are unavailable (e.g. no data loaded yet), the static derivation description is shown as a fallback. ✨

This is available on:
- 🃏 **KPI cards** (MetricCard) — the BookOpen icon sits between the help tooltip and AI sparkles button
- 📊 **Section headers** (SectionTitle) — charts and data sections
- 🏥 **Health cards** — IC personal dashboard health indicators
- 🚦 **Traffic-light cards** — CTO org dashboard quality indicators
- 📋 **Team average cards** — EM individual dashboard team averages

Click the **📖** icon → read the derivation → click **"Got it"** to close. You can also close with Escape or by clicking outside the modal. 🎯

---

## 🤖 AI-Powered Suggestions

KPI cards on all dashboards have a **✨ Sparkles** button. Clicking it opens a slide-out panel with 2–4 actionable improvement suggestions from your configured AI provider. 🧠💡

AI suggestions are **persona-aware** 🎭:
- 👥 **Engineering Manager** → tactical team improvement suggestions with strategic insights
- 🧑‍💻 **Individual Contributor** → personal growth and skill development tips
- 📋 **Delivery Manager** → risk mitigation and delivery-focused advice
- 🏛️ **Member of Management** → strategic organizational insights, cross-project patterns, no individual engineer references

### 🔧 Setup

1. Go to **Settings → Application Settings** ⚙️
2. Select your AI provider (OpenAI or Claude) 🔀
3. Enter your API key and click **Save Key** 🔑
4. Click **Test Connection** to verify 🧪

---

## 🔄 Updating the App

The app checks for updates automatically every 4 hours ⏰, and you can check manually from **Settings → Application Settings**.

When an update is available, a banner appears at the top of the screen 🆕. You can:
- 📥 Click **Download** to install the update
- 📝 Click **Release notes** to see what changed
- ❌ Click X to dismiss the banner

---

## 🛡️ Privacy & Security

- 🏠 **Local-first** — all data lives on your machine. No servers, no telemetry, no tracking.
- 🔐 **Encrypted credentials** — your JIRA API token and AI API key are stored using your OS's native secure storage (macOS Keychain, Windows DPAPI). They are never stored as plain text.
- 📜 **GDPR consent** — you must agree to the Privacy Policy and Terms of Service on first login.
- 💣 **Reset anytime** — the "Reset App" button in the sidebar wipes all stored data, credentials, and AI keys instantly. Returns you to the login page (fresh install state). 🔄

The only external calls the app makes:
- 🔗 **JIRA REST API** — to your Atlassian instance (for ticket data)
- 🐙 **GitHub API** — to check for app updates
- 🤖 **OpenAI or Anthropic API** — only if you configure AI suggestions

---

## 🩺 Troubleshooting

### 😱 "No tickets in cache"
Click **Sync Now** on the Engineering Attribution page. Make sure your project key is set correctly in Settings.

### 😶 Fields are empty after syncing
Go to **Settings → General**, click **Fetch Fields**, and map your custom field IDs. Then click **Save Settings** and sync again.

### 🤔 Engineering hours show 0 for some tickets
This is expected when a ticket never passed through your configured start/end statuses. Totally normal! ✅

### 😟 Engineering hours are blank (no value at all)
Click the calculator icon 🧮 next to the Eng Hours field on the ticket row.

### 🎯 Estimation accuracy looks wrong
Check your **SP-to-days calibration** in Settings → Metrics.

### 🚫 AI suggestions button is grayed out
Configure an AI provider in **Settings → Application Settings**. 🔑

### 🔒 Can't change persona
Persona is permanent. Use **Reset App** in the sidebar to fully wipe the app and start fresh from the login page.

### 🧑‍💻 IC dashboard shows all tickets instead of just mine
Set your **Account ID** in Settings. This tells the app which JIRA account is yours.

---

## 🌐 Multi-Project Support

The **Engineering Manager** and **Member of Management** personas can track multiple JIRA projects simultaneously.

### 🧙 Setting Up During Onboarding

When you select **Engineering Manager** or **Member of Management** during onboarding, the project setup step shows a multi-project input:

1. ✍️ Enter your primary JIRA project key (e.g. `ALPHA`)
2. ➕ Click **Add Another Project** to add more keys (e.g. `BETA`, `GAMMA`)
3. ❌ Click the X button to remove a project key

### ⚙️ Managing Projects in Settings

After onboarding, you can add or remove projects in **Settings → General** under "Additional Projects".

### 📊 How Cross-Project Data Works

When multiple projects are configured:

- **👥 EM Team Dashboard** — shows "All Projects" header with aggregated metrics
- **🏛️ Management Org Dashboard** — shows per-project comparisons and aggregate org-wide metrics
- **📊 Attribution** — shows tickets from all projects
- **🏔️ Epic Tracker** — shows epics from all projects
- **🧑‍💻 EM Individual Dashboard** — aggregated per-engineer stats
- **🔄 Sync** — syncs all projects simultaneously

Each project maintains its own ticket cache independently. 💾
