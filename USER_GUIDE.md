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
8. [👥 Team Metrics](#-team-metrics)
9. [🧑‍💻 Individual Metrics](#-individual-metrics)
10. [🏔️ Epic Tracker](#️-epic-tracker)
11. [🔧 Settings](#-settings)
    - [General](#-general)
    - [Metrics](#-metrics-1)
    - [Engineering Attribution Rules](#-engineering-attribution-rules)
    - [Application Settings](#-application-settings)
12. [🤖 AI-Powered Suggestions](#-ai-powered-suggestions)
13. [🔄 Updating the App](#-updating-the-app)
14. [🛡️ Privacy & Security](#️-privacy--security)
15. [🩺 Troubleshooting](#-troubleshooting)

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
| 🏢 **Management / VIP** | C-level, directors | Cross-project summaries, strategic KPIs, team health overview |
| 👥 **Engineering Manager / VP** | Team leads managing 1-10 projects | Full metric access, individual engineer tracking, epic monitoring |
| 🧑‍💻 **Individual Contributor** | Developers, engineers | Own performance dashboard, team average comparisons, growth insights |
| 📋 **Delivery Manager** | Scrum masters, PMs | Epic-level tracking, risk identification, cycle time analysis |

3. **🔗 Project** (new users only) — enter your JIRA project key
4. **🎉 Ready!** — review and complete setup

### 🔄 Upgrading from a Previous Version

If you already had Uplift Forge installed before the persona update, you'll only be asked to pick your role. All your existing project settings, field mappings, and rules are preserved. 🛡️

### ♻️ Changing Your Persona

You can change your persona anytime in **Settings → General**. The sidebar tabs, visible metrics, and AI suggestion framing will update immediately. ⚡

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
- 💣 **Reset App** — wipes all stored data and credentials (use with caution!)
- ℹ️ **Version number** and developer credit

Click any tab to switch pages. The active tab is highlighted with an indigo accent. 💜

### 📑 Tab Visibility by Persona

| Tab | 🏢 VIP | 👥 Eng Mgr | 🧑‍💻 Individual | 📋 Delivery |
|-----|--------|-----------|--------------|------------|
| 🏠 Home | ✅ | ✅ | ✅ | ✅ |
| 👥 Team Metrics | ✅ | ✅ | ❌ | ✅ |
| 🧑‍💻 Individual Metrics | ❌ | ✅ | ✅ | ❌ |
| 🏔️ Epic Tracker | ❌ | ✅ | ❌ | ✅ |
| 📊 Attribution | ✅ | ✅ | ❌ | ✅ |
| ⚙️ Settings | ✅ | ✅ | ✅ | ✅ |

---

## 🏠 Home

The Home page is a persona-aware landing page. It shows:

- 👋 A welcome message tailored to your role (e.g. "Executive Dashboard" for VIPs, "Your Performance Dashboard" for ICs)
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
| 🏢 **TPD BU** | Business unit. Editable dropdown (B2C, B2B, Global Expansion, O4B, Rome2Rio, Omio.AI). |
| ⏱️ **Eng Hours** | Engineering hours. Editable number field. |
| 🔀 **Work Stream** | Work stream. Editable dropdown (Operational, Product, Tech Meta Backlog). |
| ⚡ **Actions** | Sync (refresh from JIRA), Save (push to JIRA). |

### 🎯 What You Can Do

- 🔃 **Sort** — Click any column header to sort ascending/descending. Click the X in the Actions header to reset sorting.
- ✏️ **Edit inline** — Change TPD BU, Eng Hours, or Work Stream directly in the table. Edited rows turn amber 🟡.
- 🧮 **Auto-calculate a single ticket** — Click the calculator icon next to Eng Hours to compute hours from the ticket's status changelog. Click it next to TPD BU or Work Stream to auto-classify using your mapping rules.
- 🔄 **Sync a single ticket** — Click the refresh icon in the Actions column to re-fetch that ticket from JIRA.
- 💾 **Save a single ticket** — Click the Save button to push your edits back to JIRA.
- 🧮 **Calculate All** — The amber button at the top calculates hours and fields for every ticket on the current page. Progress is shown as "Calculating X/Y..." ⏳
- 💾 **Save All** — The indigo button at the top saves all modified tickets. It's grayed out when nothing has been edited.
- 📄 **Paginate** — 10 tickets per page. Use Previous/Next at the bottom.

### 📈 Summary Stats Bar

Below the table, a stats bar shows:

- 🎫 **Tickets** — total count
- 🚦 **Status Breakdown** — colored dots with counts per status
- ⏱️ **Eng Hours** — average and total
- ✅ **Fields Complete** — percentage and fraction (e.g. 95% (19/20))
- ⚠️ **Missing** — clickable buttons for each field type with gaps (TPD BU, Hours, Work Stream)

Click a missing field button to filter the table to only show tickets missing that field. Click it again (or click "Clear filter") to show all. 🔍

### 🔄 Syncing

Click **Sync Now** at the top to fetch all tickets from JIRA for your configured time range. The last synced timestamp is displayed below the page title. 🕐

---

## 👥 Team Metrics

Nine KPI cards showing your team's output over a selected time period. 📊

### 🗓️ Period Selection

Choose a time window using the buttons at the top:

| Period | Description |
|--------|------------|
| 🌍 **All Time** | All tickets in the configured data range |
| 📅 **Monthly** | Current month vs. previous month |
| 📆 **Bi-weekly** | Current 2-week period vs. previous 2-week period |
| 🗓️ **Weekly** | Current week vs. previous week |

### 🃏 KPI Cards

| Metric | What It Tells You |
|--------|------------------|
| 🎫 **Total Tickets** | Volume of completed work |
| 📐 **Story Points** | Scope delivered |
| ⏱️ **Engineering Hours** | Actual time invested |
| 🎯 **Estimation Accuracy** | How close estimates are to reality (1.0 = perfect) |
| ⚡ **Avg Hours/SP** | Time efficiency per story point |
| 🔄 **Avg Cycle Time** | Average development time per ticket |
| 🐛 **Bug Count** | Number of bugs resolved |
| 📊 **Bug Ratio** | Percentage of work that's bugs |
| 🕐 **Bug Hours %** | Percentage of engineering time spent on bugs |

Each card displays:
- The metric value
- A **trend badge** showing the change from the previous period (⬆️ up, ⬇️ down, or ➡️ flat)
- A **❓ help icon** — hover to see what the metric means, why it matters, what "good" looks like, and what up/down trends indicate

### 🎨 Trend Colors

- 🟢 **Green** — the metric is moving in a good direction
- 🔴 **Red** — the metric is moving in a bad direction
- For most metrics, "up = good" (more tickets, more story points) ⬆️
- For bug-related and efficiency metrics, "down = good" (fewer bugs, less time per SP) ⬇️
- 🎯 **Estimation Accuracy** is special: closer to 1.0 is better, regardless of direction

### 📉 Charts

Below the KPI cards:

- 📈 **Monthly Trend** — line chart of ticket count, story points, and eng hours over time (only shown when data spans more than one month)
- 🏢 **Eng Hours by Business Unit** — horizontal bar chart
- 🥧 **Eng Hours by Work Stream** — pie chart
- 🏢 **Story Points by Business Unit** — horizontal bar chart
- 🥧 **Issue Type Breakdown** — pie chart

Hover over any chart element to see detailed values in a tooltip. 💬

### 🔄 Sync & Refresh

Click **Sync & Refresh** to pull the latest data from JIRA and recalculate all metrics. 🔃

---

## 🧑‍💻 Individual Metrics

Per-engineer performance with team comparisons. Only engineers you've added to the tracked list (in Settings) appear here. 👀

### 🏗️ Layout

- 📊 **Team Average row** — a grid showing the team-wide average for each KPI, with trend badges
- 🧑‍💻 **Engineer rows** — one row per tracked engineer, showing their KPIs in a grid

### 📋 KPI Grid

Each engineer's row shows the same 9 metrics as Team Metrics, plus two bonus metrics:

| Bonus Metric | What It Tells You |
|-------------|------------------|
| 🧩 **Complexity Score** | Average story points per ticket (higher = more complex work) |
| 🎯 **Focus Ratio** | Percentage of work on product tickets vs. operational/bugs |

### 🎨 Color Coding

Each KPI cell is color-coded against the team average:
- 🟢 **Green** — performing better than team average
- 🔴 **Red** — performing worse than team average
- ⚪ **Gray** — within normal range

### 🔍 Expanding an Engineer

Click an engineer's row to expand it. The detail section shows:

- 📊 **vs Team Average** — a grouped bar chart comparing 5 key metrics (tickets, story points, eng hours, avg hours/SP, avg cycle time) side-by-side with the team average
- 📏 **Ratios & Quality** — horizontal progress bars for estimation accuracy, bug ratio, bug hours %, and focus ratio, each compared to the team average

### 🏆 Team Comparison Chart

At the bottom (if 2+ engineers are tracked), a bar chart shows all tracked engineers side-by-side across key metrics. May the best engineer win! 😄

---

## 🏔️ Epic Tracker

Track epic-level delivery progress and identify risks 📊. Available for **Engineering Managers** and **Delivery Managers**.

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

### 🔄 Syncing

Click **Sync & Refresh** to re-fetch ticket data and recalculate epic progress and risk. 🔃

---

## 🔧 Settings

Four tabs for configuring the app. ⚙️

### 🌐 General

**🎭 Persona**
- 🎭 **Your Role** — change your persona at any time. This affects which tabs are visible, which metrics are prioritized, and how AI suggestions are framed.

**🔗 JIRA Connection**
- 🏷️ **Project Key** — your JIRA project prefix (e.g. `ACTIN`). Required.
- 📥 **Fetch Fields** — loads custom fields and statuses from your JIRA project. You must click this after setting or changing the project key.
- 📅 **Data Time Range** — how many months of data to fetch (1–12 months, default 6).

**🗺️ JIRA Field Mappings** (visible after fetching fields)
- 🏢 **TPD Business Unit** — select the custom field ID that stores your business unit classification
- ⏱️ **Engineering Hours** — select the custom field ID for engineering hours
- 🔀 **Work Stream** — select the custom field ID for work stream
- 📐 **Story Points** — select the custom field ID for story points

**🖥️ Display Settings**
- 🔍 **Show only tickets with missing fields by default** — when enabled, the Attribution table initially filters to tickets that need attention

### 📊 Metrics

**📐 Story Point Calibration**
- ⚖️ **SP to Man-Days** — how many working days one story point represents (default: 1). This is used for estimation accuracy calculations. The equivalent hours per SP is displayed automatically.

**👥 Team Management**
- 📥 **Fetch Members** — pulls the list of users who have been assigned tickets in your project
- ✅ Select engineers to track by clicking their name in the list. Selected engineers appear as tags above the list.
- ❌ Remove an engineer by clicking the X on their tag.
- 👤 Only active JIRA users appear in the list.

### 📏 Engineering Attribution Rules

This is where you define rules to auto-classify tickets into business units and work streams. 🧠

**How rules work:**
- 📦 Rules are organized into **groups** (each group maps to a value like "B2C" or "Product")
- 🧱 Within a group, you build **blocks** of conditions
- 🔗 Within a block, all conditions must match (**AND** logic)
- 🔀 Across blocks, any match is sufficient (**OR** logic)
- ⬇️ Groups are evaluated top-to-bottom — the first match wins

**Building a rule:**
1. ➕ Click **+ Add Group** and enter a name (e.g. "B2C")
2. 🏷️ Select a **field** to match on:
   - Parent Key, Parent Summary, Labels, Components, Summary, Issue Type, Priority, Assignee
3. 🔧 Select an **operator**: equals, contains, starts with, in list
4. ✍️ Enter the **value** to match
5. ➕ Click **+ AND** to add more conditions to the same block (all must match)
6. 🔀 Click **+ OR Block** to add an alternative set of conditions (any block can match)
7. 🔁 Repeat for Work Stream rules

**💡 Example:**
> Classify tickets as "B2C" when the parent key equals "PROJ-100" **AND** the label contains "consumer"
> **OR** when the component starts with "b2c"

**⏱️ Work Cycle Definition**
- ▶️ **Start Status** — the status that starts the engineering hours clock (e.g. "In Progress")
- ⏹️ **End Status** — the status that stops the clock (e.g. "Code Review")
- ⏸️ **Excluded Statuses** — statuses that pause the clock (e.g. "Blocked"). Add from the dropdown, remove by clicking the X on the tag.

### 🖥️ Application Settings

**🤖 AI-Powered Suggestions**
- 🔀 Choose your AI provider: **OpenAI** or **Claude**
- 🔑 Enter your API key and click **Save Key**
- 🧪 Click **Test Connection** to verify your key works
- 🗑️ Click **Remove** to delete the stored key
- ✅ A green checkmark appears when a key is configured

See [🤖 AI-Powered Suggestions](#-ai-powered-suggestions) for details.

**🔄 Software Updates**
- 📋 Shows the current app version
- 🔍 Click **Check for Updates** to manually check
- 🆕 If an update is available, you'll see the new version with **Download & Install** and **Release Notes** buttons
- ✅ A green checkmark shows "Up to date" when you're on the latest version

---

## 🤖 AI-Powered Suggestions

Every KPI card on Team Metrics and Individual Metrics has a **✨ Sparkles** button. Clicking it opens a slide-out panel that sends the metric context to your configured AI provider and returns 2–4 actionable improvement suggestions. 🧠💡

AI suggestions are **persona-aware** 🎭:
- 🏢 **Management VIP** → strategic, organizational-level recommendations
- 👥 **Engineering Manager** → tactical team improvement suggestions
- 🧑‍💻 **Individual Contributor** → personal growth and skill development tips
- 📋 **Delivery Manager** → risk mitigation and delivery-focused advice

The panel header also changes based on your persona (e.g., "Strategic Insights" for VIPs, "Growth Suggestions" for ICs). ✨

### 🔧 Setup

1. Go to **Settings → Application Settings** ⚙️
2. Select your AI provider (OpenAI or Claude) 🔀
3. Enter your API key and click **Save Key** 🔑
4. Click **Test Connection** to verify 🧪

### 🎯 Using Suggestions

**On Team Metrics:**
- Each KPI card has a ✨ Sparkles icon in the header. Click it to open the suggestion panel.

**On Individual Metrics:**
- Hover over any KPI cell in an engineer's row to reveal the ✨ Sparkles icon. Click it to get suggestions specific to that engineer's metric, including how they compare to the team average.

### 📋 The Suggestion Panel

When you click Sparkles:
1. 🎬 A panel slides in from the right
2. 🧠 An animated thinking indicator shows while the AI processes
3. 💡 2–4 numbered suggestion cards appear with actionable advice
4. 📊 The panel shows the metric context (current value, trend, previous value, team average)
5. 🏷️ A footer indicates which AI provider generated the suggestions

**Closing the panel:** Click the X button, click the backdrop, or press Escape. 👋

**If something goes wrong:** An error message appears with a **🔄 Retry** button.

**If no AI key is configured:** The Sparkles buttons are dimmed and disabled. 🚫

---

## 🔄 Updating the App

The app checks for updates automatically every 4 hours ⏰, and you can check manually from **Settings → Application Settings**.

When an update is available, a banner appears at the top of the screen showing the new version number 🆕. You can:
- 📥 Click **Download** to install the update
- 📝 Click **Release notes** to see what changed
- ❌ Click X to dismiss the banner

---

## 🛡️ Privacy & Security

- 🏠 **Local-first** — all data lives on your machine. No servers, no telemetry, no tracking.
- 🔐 **Encrypted credentials** — your JIRA API token and AI API key are stored using your OS's native secure storage (macOS Keychain, Windows DPAPI). They are never stored as plain text.
- 📜 **GDPR consent** — you must agree to the Privacy Policy and Terms of Service on first login.
- 💣 **Reset anytime** — the "Reset App" button in the sidebar wipes all stored data and credentials instantly.

The only external calls the app makes:
- 🔗 **JIRA REST API** — to your Atlassian instance (for ticket data)
- 🐙 **GitHub API** — to check for app updates
- 🤖 **OpenAI or Anthropic API** — only if you configure AI suggestions, and only when you click the Sparkles button

---

## 🩺 Troubleshooting

### 😱 "No tickets in cache"
Click **Sync Now** on the Engineering Attribution page. Make sure your project key is set correctly in Settings.

### 😶 Fields are empty after syncing
Go to **Settings → General**, click **Fetch Fields**, and map your custom field IDs. Then click **Save Settings** and sync again.

### 🤔 Engineering hours show 0 for some tickets
This is expected when a ticket never passed through your configured start/end statuses. For example, a ticket moved directly from "Todo" to "Rejected" was never actively worked on, so it gets 0 hours. Totally normal! ✅

### 😟 Engineering hours are blank (no value at all)
Click the calculator icon 🧮 next to the Eng Hours field on the ticket row. If the ticket has status transitions matching your configured start/end statuses, hours will be computed.

### 🎯 Estimation accuracy looks wrong
Check your **SP-to-days calibration** in Settings → Metrics. The default is 1 SP = 1 day (8 hours). Adjust if your team uses a different ratio.

### 🚫 AI suggestions button is grayed out
You need to configure an AI provider. Go to **Settings → Application Settings**, choose OpenAI or Claude, enter your API key, and save. 🔑

### ❌ AI suggestions show an error
- **401 error** — your API key is invalid. Check it and re-save. 🔑
- **429 error** — you've hit a rate limit. Wait a moment and retry. ⏳
- **Network error** — check your internet connection. 🌐

### 🔒 Login fails
- Verify your JIRA base URL is correct (e.g. `https://your-org.atlassian.net`, not `https://your-org.atlassian.net/jira`)
- Make sure your API token is valid and hasn't expired
- Check that your email matches the one on your Atlassian account

### 🕰️ App feels out of date
Go to **Settings → Application Settings** and click **Check for Updates**, or look for the update banner at the top of the screen. 🆕
