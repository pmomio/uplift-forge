# Uplift Forge — Product Specification

## Vision

A Jira-powered analytics platform that provides role-specific performance insights for engineering organizations. Each persona sees the metrics that matter most for their function, drawn from a shared data pipeline.

---

## Personas & Dashboards

### 1. EM / VP Engineering (`engineering_manager`)

**Purpose:** Actionable weekly insights to coach the team, unblock flow, and compare across 1–10 teams. Combines strategic cross-project view with deep per-engineer performance data.

**Scope:** 1–10 JIRA projects, cross-project aggregation, individual metrics for direct reports.

**Tabs:** Home, Eng. Attribution, Team Metrics, Individual Metrics, Epic Tracker, Settings

#### Team Metrics

| Metric | Source (Jira) | Calculation |
|--------|---------------|-------------|
| Cycle Time Distribution | Status transition timestamps | p50 / p85 / p95 of "In Progress" → "Done", with 4-week trend |
| Throughput by Work Stream | Board or label categorization | Tickets completed per sprint, split by Product / Ops / Support |
| Contribution Spread | Assignee field | Tickets completed per person, normalized by story points; heatmap |
| Aging WIP | Current status + time in status | Tickets in progress beyond configurable threshold (e.g., >5 days) |
| Sprint Commitment vs Delivery | Sprint scope at start vs end | Planned story points vs delivered story points per sprint |
| Bug Ratio per Engineer | Issue type + assignee | Bugs created / stories delivered, per team member |
| Rework Rate | Status transitions (backward moves) | Tickets moved from later → earlier status |
| Seniority-Calibrated Output | Custom field for level | Cycle time and throughput expectations adjusted by seniority |

#### Individual Metrics (for direct reports)

| Metric | Calculation |
|--------|-------------|
| Total Tickets / SP / Eng Hours | Sum per engineer |
| Cycle Time (p50, p85) | Per-engineer cycle time distribution |
| Bug Ratio | Per-engineer bugs / stories |
| Rework Rate | Per-engineer backward transitions |
| Complexity Score | Avg SP per ticket |
| Focus Ratio | Product work / total work |

#### Cross-Project Capabilities
- Aggregated metrics across all configured projects
- Per-project drill-down
- Headcount-normalized throughput (tickets per engineer per sprint)
- Tech debt ratio (% capacity on bugs + tech debt vs features)

#### UX Guidelines
- Weekly digest format (auto-generated summary)
- Filterable by sprint, work stream, or individual
- Comparison to team's own historical baseline (not cross-team)
- 1:1 prep view: individual metrics for each direct report

---

### 2. Individual Contributor (`individual`)

**Purpose:** Self-awareness without surveillance. Personal improvement signals the IC controls.

**Scope:** 1 project, self-only metrics.

**Tabs:** Home, Individual Metrics, Settings

#### Metrics

| Metric | Source (Jira) | Calculation |
|--------|---------------|-------------|
| My Cycle Time Trend | Status transitions on assigned tickets | Personal "In Progress" → "Done" time, trended over 8 weeks |
| My Throughput | Completed tickets by assignee | Tickets completed per week/sprint |
| My Aging WIP | Assigned tickets + current status | My tickets currently in progress beyond threshold |
| Time in Each Status | Status transition timestamps | Breakdown of where my tickets spend time (Dev / Review / QA / Blocked) |
| My Rework Rate | Backward status transitions | How often my tickets get reopened or moved backward |
| Scope Trajectory | Story points or complexity field | Trend of average complexity of assigned tickets over time |

#### UX Guidelines
- **Private by default** — EM does NOT see this view
- Progress-oriented framing: "Your cycle time improved 15% this month"
- No leaderboards, no individual rankings
- Opt-in comparison to team median (anonymous)
- Personal goals: IC can set targets (e.g., "Reduce my cycle time to <3 days")

#### Trust Principles
> This is the most sensitive view. If ICs don't trust the tool, adoption fails.
>
> - Data is visible only to the individual
> - No gamification that incentivizes gaming metrics
> - Frame as a mirror, not a scorecard
> - Make it clear: this data is NOT used in performance reviews unless the IC chooses to share it

---

### 3. Delivery Manager (`delivery_manager`)

**Purpose:** Real-time flow state, predictability data, and blockers to escalate.

**Scope:** 1–N JIRA projects (org-wide flow view), cross-project aggregation.

**Tabs:** Home, Team Metrics (Flow), Epic Tracker, Eng. Attribution, Settings

#### Metrics

| Metric | Source (Jira) | Calculation |
|--------|---------------|-------------|
| Cumulative Flow Diagram (CFD) | Status counts over time | Stacked area chart of tickets in each status per day |
| Lead Time Distribution | Created → Done timestamps | p50 / p85 / p95 with histogram visualization |
| WIP Count vs Limit | Current "In Progress" tickets | Real-time count against configurable WIP limit |
| Aging WIP (with escalation) | Time in current status | Tiered alerts: warning (>3d), critical (>5d), escalation (>7d) |
| Blocker Duration | Time in "Blocked" status | Average and max time tickets spend blocked; top blocking reasons |
| Flow Efficiency | Active vs wait time | (Time in active statuses) / (Total lead time) x 100 |
| Throughput Stability | Week-over-week variance | StdDev of weekly throughput; low variance = predictable |
| Forecasting (Monte Carlo) | Historical throughput data | "Remaining N tickets will take X–Y weeks at 80% confidence" |

#### Cross-Project Capabilities
- CFD and flow metrics aggregated across all configured projects
- Per-project drill-down on all flow metrics
- Org-wide throughput stability and forecasting

#### UX Guidelines
- Operational cockpit — real-time or daily refresh
- Alerts panel for anomalies (e.g., "3 tickets in Code Review for >4 days")
- Forecasting module with confidence intervals
- CFD as the primary visualization
- Blocker report for standup preparation

---

## Access & Trust Model

| Data Scope | EM / VP | IC | DM |
|---|:---:|:---:|:---:|
| Cross-project aggregates | Yes (own 1-10 teams) | No | Yes (org-wide) |
| Team-level metrics | Yes | No | Yes (flow only) |
| Individual metrics (reports) | Yes (direct reports) | No | No |
| Individual metrics (self) | No | Yes (self only) | No |
| Flow & predictability | Yes | No | Yes (full detail) |
| Forecasting | Yes | No | Yes (full detail) |
| Epic tracking & risk | Yes | No | Yes |

### Privacy Guarantees
- IC personal dashboards are **never** visible to managers
- EM sees individual data only for tracked direct reports
- DM sees flow metrics but **never** individual attribution
- No per-engineer data in any cross-persona endpoint

---

## Data Architecture

### Pipeline

```
Raw Jira Data (REST API v3, fields=*all, expand=changelog)
    |
    v
ETL Layer (ticket.service + timeline.service)
    |-- Status transition extraction -> TicketTimeline
    |-- Timestamp normalization
    |-- Assignee & team mapping
    |-- Issue type & label classification
    |-- Sprint scope snapshots
    |
    v
Shared Computation Layer (timeline.service)
    |-- TicketTimeline (per-ticket status periods)
    |-- Cycle time, lead time, flow efficiency
    |-- Rework detection (backward transitions)
    |-- Percentile calculations
    |-- Weekly throughput bucketing
    |
    v
+------------------+------------------+------------------+
| EM Metrics       | DM Metrics       | IC Metrics       |
| (em-metrics.ts)  | (dm-metrics.ts)  | (ic-metrics.ts)  |
| Team Pulse +     | Flow Control +   | My Flow          |
| Individual       | Forecasting      | (private)        |
+------------------+------------------+------------------+
```

### Key Jira Fields Required

| Field | Usage | Currently Extracted? |
|-------|-------|:---:|
| `status` + `changelog` | Cycle time, lead time, flow efficiency, aging WIP, rework | Changelog in raw cache; not fully extracted |
| `assignee` + `accountId` | Contribution spread, individual metrics, IC matching | Display name only; **accountId missing** |
| `issuetype` | Bug ratio, tech debt ratio | Yes |
| `story_points` (custom field) | Throughput normalization, scope trajectory | Yes |
| `sprint` | Commitment vs delivery, sprint-level filtering | **Not extracted** (in raw cache) |
| `labels` / `components` | Work stream classification, bug escape detection | Labels yes; **components not extracted** |
| `created` / `resolved` | Lead time calculation | Yes |
| `priority` | Blocker identification | Yes |
| Custom seniority field | Seniority-calibrated output | Not extracted (optional, in raw cache if exists) |

### Status Classification

```
Active statuses (configurable):    ["In Progress", "Code Review", "QA"]
Blocked statuses (configurable):   ["Blocked"]
Done statuses (configurable):      ["Done", "Resolved", "Closed", "Rejected", "Cancelled"]
Wait statuses (implicit):          Everything not in above three lists
```

---

## Metric Definitions & Formulas

### Cycle Time
```
Cycle Time = timestamp("Done") - timestamp("In Progress")
```
Calendar time, not office-hours-adjusted. Report as: p50, p85, p95.
Different from Engineering Hours (office-hours-adjusted active work time).

### Lead Time
```
Lead Time = timestamp("Done") - timestamp("Created")
```
Includes upstream wait time (backlog, grooming, etc.)

### Flow Efficiency
```
Flow Efficiency = (Time in Active Statuses) / (Total Lead Time) x 100
```
Target: >40% (most teams start at 15-25%)

### Throughput
```
Throughput = Count of tickets moved to "Done" per time period
```
Can be normalized by story points or team size.

### Bug Ratio
```
Bug Ratio = Bugs Created / Stories Delivered (per sprint or per engineer)
```

### Rework Rate
```
Rework Rate = Tickets with backward transitions / Total completed tickets x 100
```
Backward = any move from a later status to an earlier status in the configured workflow.

### Throughput Stability
```
Stability = 1 - (StdDev(weekly throughput) / Mean(weekly throughput))
```
Higher = more predictable. Target: >0.7

### Monte Carlo Forecast
```
For each simulation (N=10000):
  Sample N random weeks from historical throughput
  Calculate cumulative completion
  Record when remaining work reaches 0
Report: p50, p80, p95 completion dates
```

---

## Config Additions Required

### Shared (extend AppConfig)
```
active_statuses: string[]           // default: ["In Progress", "Code Review", "QA"]
blocked_statuses: string[]          // default: ["Blocked"]
done_statuses: string[]             // default: ["Done", "Resolved", "Closed"]
```

### EM-specific
```
seniority_field_id: string | null   // optional custom field for engineer level
```

### DM-specific
```
wip_limit: number | null
aging_thresholds: {
  warning_days: number              // default: 3
  critical_days: number             // default: 5
  escalation_days: number           // default: 7
}
```

### IC-specific
```
my_account_id: string | null        // auto-detected from auth or manual
personal_goals: Record<string, number>
opt_in_team_comparison: boolean     // default: false
```

---

## Unique Features (not in typical DORA tools)

These are Uplift Forge differentiators to keep:

| Feature | Notes |
|---------|-------|
| Engineering Attribution | Editable ticket table with JIRA write-back for hours/fields |
| Epic Tracker with Risk Scoring | Delivery risk analysis based on progress, blockers, bugs, reopens |
| AI-Powered Suggestions | OpenAI/Claude per-KPI coaching suggestions |
| Rule-Based Field Mapping | AND/OR rule engine for messy JIRA setups |
| Multi-Project Aggregation | Cross-project data for EM (1-10) and DM (1-N) |

---

## Build Phases

### Phase 1 — Foundation: Timeline Engine + Persona Merge
- [ ] Merge management + engineering_manager into single `engineering_manager` persona
- [ ] Add `assignee_id`, `sprint`, `components` to ProcessedTicket
- [ ] Build `timeline.service.ts` (TicketTimeline extraction from changelog)
- [ ] Add status classification config (active/blocked/done statuses)
- [ ] Percentile computation utility
- [ ] Update tab visibility for 3 personas

### Phase 2 — EM Metrics
- [ ] `em-metrics.service.ts` — cycle time distribution, contribution spread, rework rate
- [ ] EM team dashboard page (replaces current TeamMetrics for EM)
- [ ] EM individual metrics with cycle time + rework
- [ ] Aging WIP for EM
- [ ] Bug ratio per engineer

### Phase 3 — DM Metrics
- [ ] `dm-metrics.service.ts` — CFD, lead time, WIP, blockers, flow efficiency
- [ ] DM flow dashboard page (replaces current TeamMetrics for DM)
- [ ] Throughput stability
- [ ] Monte Carlo forecasting
- [ ] Aging WIP with tiered alerts
- [ ] DM config (WIP limit, aging thresholds)

### Phase 4 — IC Metrics
- [ ] `ic-metrics.service.ts` — personal cycle time, throughput, rework, time-in-status
- [ ] IC personal dashboard page (replaces current IndividualMetrics for IC)
- [ ] Privacy: IC data scoped to own account_id only
- [ ] Opt-in team comparison
- [ ] Personal goal setting
- [ ] IC config (my_account_id, goals, opt_in_team_comparison)

### Phase 5 — Sprint Support + Polish
- [ ] Extract sprint data from raw cache
- [ ] Sprint commitment vs delivery for EM
- [ ] Seniority-calibrated output (optional)
- [ ] Scheduled report generation
- [ ] Anomaly detection and alerting

---

## Key Design Principles

1. **Measure flow, not activity.** Cycle time, throughput, and flow efficiency reveal what matters.
2. **Use distributions, not averages.** Always show percentiles (p50/p85/p95).
3. **Trend over absolutes.** A team improving from 8→5 day cycle time matters more than a team sitting at 4.
4. **Limit active metrics to 3-5 per role.** Dashboard overload kills focus.
5. **Trust is the product.** If ICs fear surveillance, adoption dies. Privacy-by-default is non-negotiable.
6. **Insights, not just data.** Every screen should answer "so what?" — pair metrics with recommended actions.

---

*Document Version: 2.0*
*Last Updated: March 2026*
