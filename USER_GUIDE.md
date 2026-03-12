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
7. [👥 EM Team Dashboard](#-em-team-dashboard)
8. [🧑‍💻 EM Individual Dashboard](#-em-individual-dashboard)
9. [🌊 DM Flow Dashboard](#-dm-flow-dashboard)
10. [🎯 IC Personal Dashboard](#-ic-personal-dashboard)
11. [🏛️ Management Org Dashboard](#️-management-org-dashboard)
12. [🏔️ Epic Tracker](#️-epic-tracker)
13. [🔧 Settings](#-settings)
14. [🤖 AI-Powered Suggestions](#-ai-powered-suggestions)
15. [🔄 Updating the App](#-updating-the-app)
16. [🛡️ Privacy & Security](#️-privacy--security)
17. [🩺 Troubleshooting](#-troubleshooting)
18. [🌐 Multi-Project Support](#-multi-project-support)

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
| 👥 **Engineering Manager / VP** | Team leads, VPs managing 1-10 projects | Home, Metrics, Individual, Epics, Settings — cycle time, throughput, contribution, aging WIP, rework, bug ratio, per-engineer individual metrics, multi-project aggregation 🌐 |
| 📋 **Delivery Manager** | Scrum masters, PMs | Home, Metrics, Epics, Settings — Flow Dashboard (CFD, lead time, WIP, aging WIP, blockers, flow efficiency, Monte Carlo forecast) 🌊 |
| 🧑‍💻 **Individual Contributor** | Developers, engineers | Home, Individual, Settings — Personal dashboard (cycle time trend, throughput, time-in-status, rework, scope trajectory, team comparison (opt-in), goals) 🎯 |
| 🏛️ **Member of Management** | Directors, VPs, C-level | Home, Metrics, Epics, Settings — Organizational Health Radar (cross-project throughput, cycle time by project, bug escape rate, tech debt ratio, flow efficiency, headcount-normalized throughput). Multi-project. 💼 |

> 🔒 **This choice is permanent.** Your persona is locked after onboarding. To change it later, use "Reset App" in the sidebar — this performs a full wipe (credentials, config, caches, AI keys) and returns you to the login page, just like a fresh install. Each persona sees completely different metrics — there is no cross-persona visibility.

3. **🔗 Project** (new users only) — enter your JIRA project key(s). EM and Management personas can add multiple project keys for cross-project tracking 🌐
4. **🎉 Ready!** — review and complete setup. Your role is shown with a lock icon confirming it's permanent.

---

## ⚙️ First-Time Setup

After completing onboarding, head to **Settings** (the gear icon in the sidebar) if you need to configure additional options:

1. 🏷️ **Set your Project Key** — e.g. `ACTIN`, `PROJ`. This is the prefix on your JIRA ticket keys.
2. 📥 **Click Fetch Fields** — this pulls your project's custom fields and statuses from JIRA.
3. 🗺️ **Map your JIRA Story Points field** — select the custom field ID for Story Points.
4. 🚦 **Classify Statuses** — categorized your statuses into Active, Blocked, and Done to enable timeline metrics.
5. 💾 **Click Save Settings**.

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
| 👥 Team Metrics | ✅ (EM Dashboard) | ✅ (Flow Dashboard) | ❌ | ✅ (Org Dashboard) |
| 🧑‍💻 Individual Metrics | ✅ (EM Individual) | ❌ | ✅ (Personal Dashboard) | ❌ |
| 🏔️ Epic Tracker | ✅ | ✅ | ❌ | ✅ |
| ⚙️ Settings | ✅ | ✅ | ✅ | ✅ |

---

## 🏠 Home

The Home page is a persona-aware landing page. It shows:

- 👋 A welcome message tailored to your role (e.g. "Team Performance Hub" for EMs, "Delivery Command Center" for DMs)
- 📋 A 4-step setup guide
- 🃏 Feature cards explaining what the app does

---

## 👥 EM Team Dashboard

**For Engineering Managers.** Shows timeline-based team metrics:

### 🃏 KPI Cards (3x2 Grid)

- 🎫 **Total Tickets** — volume KPI
- ⏱️ **Cycle Time p50** — median cycle time (from first activity to done)
- 🔁 **Rework Rate** — percentage of tickets with backward status transitions
- 🎯 **SP Accuracy** — ratio of active time from history vs estimated (SP × sp_to_days × 8h)
- ⏱️ **Review Duration** — average time tickets spend in review statuses
- 📋 **Unestimated Ratio** — percentage of resolved tickets missing SP estimates

---

## 🎭 Try Demo Mode

Want to explore Uplift Forge without connecting your real JIRA?

1. On the login screen, click **Try Demo Mode** 🎲.
2. The app will generate 200+ realistic mock tickets across multiple projects.
3. You can switch personas (via Reset App) to see how different roles see the data.
4. Clicking **Sync & Refresh** while in demo mode will generate fresh randomized data.
5. All features (except real JIRA write-back) are available, including AI suggestions (requires your own API key).

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

- Horizontal bar chart breaking down completed tickets by issue type

### 🔀 Lead Time Breakdown

- Stacked bar showing average time split: active work vs waiting vs blocked.

---

## 🧑‍💻 EM Individual Dashboard

**For Engineering Managers.** Per-engineer metrics with team averages:

### 📊 Team Averages Bar

Shows baseline: cycle time p50, rework rate, bug ratio, total tickets, total SP, SP accuracy, first-time pass rate.

### 🃏 Engineer Cards

Click to expand. Each card shows:

| Metric | Description |
|--------|------------|
| ⏱️ **Cycle Time p50/p85** | Individual cycle time percentiles |
| 🔁 **Rework Rate** | Percentage of tickets with rework |
| 🐛 **Bug Ratio** | Bugs vs total tickets |
| 🧩 **Complexity** | Average SP per ticket |
| 🎯 **Focus Ratio** | Percentage of product work vs bugs/ops |
| 🎯 **SP Accuracy** | Estimates vs actual active time from history |

Values are color-coded against team average: 🟢 better, 🔴 worse.

---

## 🌊 DM Flow Dashboard

**For Delivery Managers.** Flow-focused metrics and delivery forecasting:

### 🃏 KPI Cards (5-card grid)

- ⏱️ **Lead Time p50** — median lead time (created → done)
- 🌊 **Flow Efficiency** — average active time / lead time
- 📋 **WIP** — active ticket count vs configured WIP limit
- 📈 **Throughput Stability** — stability of weekly throughput counts
- ⏱️ **Time to First Activity** — average time from ticket creation to first active status

---

## 🎯 IC Personal Dashboard

**For Individual Contributors.** Private personal metrics:

- 📈 **Cycle Time Trend** — weekly p50 over 8 weeks
- 🎯 **SP Estimation Accuracy** — your estimates vs actual active time from history
- ✅ **First-Time Pass Rate** — percentage of your tickets completed without rework
- ⏱️ **Code Review Wait Time** — average time your tickets spend in review
- 🎯 **Focus Score** — percentage of product work vs bugs/maintenance

---

## 🏛️ Management Org Dashboard

**For Members of Management.** An organizational health radar across all configured projects:

- 🎫 **Total Tickets** — volume across all projects
- 🐛 **Bug Escape Rate** — bugs ÷ total stories with traffic-light indicator
- 🔧 **Tech Debt Ratio** — capacity on bugs + tech debt vs features
- 🌊 **Flow Efficiency** — aggregate active time / lead time

---

## 🏔️ Epic Tracker

Track epic-level delivery progress and identify risks 📊.

### ✨ AI-Powered Risk Analysis
Uplift Forge uses AI to analyze your epics and provide mitigation strategies:
- **Summary Analysis**: Click the sparkles ✨ next to "Delivery Risk Overview" for a high-level org/project risk assessment.
- **Epic-Specific Analysis**: Click the sparkles ✨ on any epic card to get tailored suggestions for that specific epic's blockers, progress, and risk factors.

### 🧮 How Risk is Calculated

The risk score combines 4 factors automatically:
- 📉 **Progress** (30% weight) — how much work remains
- ⏰ **Overdue tickets** (30% weight) — tickets exceeding 2x the average cycle time
- 🚫 **Blocked tickets** (20% weight) — tickets currently in Blocked status
- 🐛 **Bug ratio** (10% weight) — proportion of bug-type tickets

Risk levels: **Low** (0-0.3) 🟢, **Medium** (0.3-0.6) 🟡, **High** (0.6-1.0) 🔴

---

## 🔧 Settings

### 🌐 General

**🔗 JIRA Connection**
- 🏷️ **Project Key** — your JIRA project prefix
- 📥 **Fetch Fields** — loads statuses and available fields
- 📅 **Data Time Range** — 1–12 months of history to fetch

**🗺️ JIRA Field Mappings**
- 📐 **Story Points** — select the custom field ID for story point estimates

### 📊 Metrics

**📐 Story Point Calibration**
- ⚖️ **SP to Man-Days** — how many working days one story point represents (default: 1). Used for accuracy metrics based on an 8-hour workday.

**🚦 Status Classification**
- **Active Statuses** — statuses where work is happening (e.g. In Progress, QA)
- **Blocked Statuses** — statuses where work is halted (e.g. Blocked)
- **Done Statuses** — resolution statuses (e.g. Done, Resolved)

---

## 🔧 Timeline Engine

The **Timeline Engine** extracts flow data from JIRA changelogs using **calendar time**:

- ⏱️ **Cycle Time** — first active status to done
- 📏 **Lead Time** — created to done
- 🌊 **Flow Efficiency** — active time / lead time × 100
- 🔁 **Rework Detection** — backward transitions in status order

---

## 🛡️ Privacy & Security

- 🏠 **Local-first** — all data lives on your machine.
- 🔐 **Encrypted credentials** — your JIRA API token and AI API key are stored using your OS's native secure storage.

---

## 🩺 Troubleshooting

### 😱 "No tickets in cache"
Click **Sync Now** on the Engineering Attribution page.

### 😶 Fields are empty after syncing
Go to **Settings → General**, click **Fetch Fields**, and map your custom field IDs.

### 🎯 Estimation accuracy looks wrong
Check your **SP-to-days calibration** in Settings → Metrics. Accuracy is now computed based on the time between status transitions in the JIRA changelog.

### 🔒 Can't change persona
Persona is permanent. Use **Reset App** in the sidebar to fully wipe the app.
