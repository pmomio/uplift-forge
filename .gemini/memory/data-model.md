# Data Model — Persona-Specific Metrics

## Personas (3 total)

| Persona | Label | Projects | Tabs |
|---------|-------|----------|------|
| `engineering_manager` | EM / VP Engineering | 1–10 teams | home, attribution, metrics, individual, epics, config |
| `individual` | Individual Contributor | 1 project | home, individual, config |
| `delivery_manager` | Delivery Manager | 1–N projects (org-wide) | home, metrics, epics, attribution, config |

## Shared Foundation Layer

### TicketTimeline (extracted from raw changelog)

The core building block. Every persona-specific metric derives from this.

```
TicketTimeline {
  key: string
  statusPeriods: StatusPeriod[]     // every status the ticket was in, with durations
  cycleTimeHours: number | null     // first active status → final resolution (calendar time)
  leadTimeHours: number | null      // created → resolved
  activeTimeHours: number           // sum of active status durations
  waitTimeHours: number             // sum of wait status durations
  blockedTimeHours: number          // sum of blocked status durations
  flowEfficiency: number | null     // activeTime / (activeTime + waitTime)
  hasRework: boolean                // any backward status transitions?
  reworkCount: number               // number of backward transitions
  currentStatus: string
  daysInCurrentStatus: number | null
}

StatusPeriod {
  status: string
  enteredAt: string                 // ISO timestamp
  exitedAt: string | null           // null if still in this status
  durationHours: number | null      // office-hours-adjusted
  category: 'active' | 'wait' | 'blocked'
}
```

### ProcessedTicket Additions

Fields to add to ProcessedTicket:
- `assignee_id: string` — for reliable IC matching (currently only display name)
- `sprint_id: string | null` — sprint ID from JIRA
- `sprint_name: string | null` — sprint name
- `components: string[]` — for work categorization

### Shared Computation Utilities

1. `buildTicketTimeline(rawIssue, statusConfig)` → TicketTimeline
2. `computePercentiles(values[], [50, 85, 95])` → { p50, p85, p95 }
3. `computeWeeklyThroughput(tickets[])` → Array<{ week, count, storyPoints }>
4. `buildCFDData(timelines[], dateRange)` → Array<{ date, statusCounts }>
5. `runMonteCarloForecast(weeklyThroughput[], remaining, simulations=10000)` → { p50, p80, p95 weeks }

### Status Classification Config (new)

Current config has binary start/end/excluded. Flow metrics need richer classification:

```
active_statuses: string[]      // e.g. ["In Progress", "Code Review", "QA"]
blocked_statuses: string[]     // e.g. ["Blocked"] (replaces eng_excluded_statuses)
done_statuses: string[]        // e.g. ["Done", "Resolved", "Closed"] (replaces FINAL_STATUSES)
```

Everything not in the above three lists = "wait" status.

---

## EM / VP Engineering Metrics

### Team Metrics Response

```
EMTeamMetrics {
  cycleTime: {
    p50: number | null
    p85: number | null
    p95: number | null
    trend: Array<{ week: string; p50: number; p85: number }>   // 4-week trend
  }

  throughput: {
    byWorkStream: Record<string, { tickets: number; storyPoints: number; engHours: number }>
    weeklyTrend: Array<{ week: string; tickets: number; storyPoints: number }>
  }

  contributionSpread: Array<{
    engineer: string
    engineerId: string
    tickets: number
    storyPoints: number
    engHours: number
    normalizedOutput: number   // SP normalized by team avg
  }>

  agingWip: Array<{
    key: string
    summary: string
    assignee: string
    currentStatus: string
    daysInStatus: number
    totalAge: number           // days since first active status
  }>

  sprintMetrics: {             // null if no sprint data
    sprintName: string
    committedSP: number
    deliveredSP: number
    commitmentRatio: number
  } | null

  bugRatioByEngineer: Array<{
    engineer: string
    engineerId: string
    bugsCreated: number
    storiesDelivered: number
    ratio: number
  }>

  reworkRate: {
    total: number              // percentage
    ticketsWithRework: number
    totalCompleted: number
    byEngineer: Array<{ engineer: string; rate: number }>
  }

  seniorityCalibrated: Array<{   // null if no seniority field configured
    level: string
    avgCycleTime: number
    avgThroughput: number
  }> | null

  period: string
}
```

### Individual Metrics Response (EM sees for their reports)

```
EMIndividualMetrics {
  engineers: Array<{
    accountId: string
    displayName: string
    avatar: string | null
    metrics: {
      totalTickets: number
      totalSP: number
      totalEngHours: number
      cycleTime: { p50: number | null; p85: number | null }
      bugRatio: number
      reworkRate: number
      complexityScore: number | null   // avg SP per ticket
      focusRatio: number | null        // product work %
    }
    prevMetrics: { /* same shape */ }
  }>
  teamAverages: { /* same shape as metrics */ }
  period: string
}
```

---

## Delivery Manager Metrics

```
DMFlowMetrics {
  cfd: Array<{
    date: string               // YYYY-MM-DD
    statusCounts: Record<string, number>
  }>

  leadTime: {
    p50: number | null
    p85: number | null
    p95: number | null
    histogram: Array<{ bucket: string; count: number }>   // "0-1d", "1-3d", etc.
  }

  wip: {
    current: number
    limit: number | null       // configurable
    byStatus: Record<string, number>
    overLimit: boolean
  }

  agingWip: Array<{
    key: string
    summary: string
    assignee: string
    currentStatus: string
    daysInStatus: number
    tier: 'normal' | 'warning' | 'critical' | 'escalation'   // configurable thresholds
  }>

  blockerStats: {
    avgBlockedHours: number
    maxBlockedHours: number
    currentlyBlocked: number
    blockedTickets: Array<{
      key: string
      summary: string
      blockedHours: number
    }>
  }

  flowEfficiency: {
    overall: number            // percentage
    trend: Array<{ week: string; efficiency: number }>
  }

  throughputStability: {
    mean: number
    stdDev: number
    stability: number          // 1 - (stdDev / mean), higher = more predictable
    weeklyData: Array<{ week: string; count: number }>
  }

  forecast: {
    remainingTickets: number
    p50Weeks: number
    p80Weeks: number
    p95Weeks: number
  } | null

  period: string
}
```

---

## IC Metrics

```
ICMyFlowMetrics {
  cycleTimeTrend: Array<{
    week: string
    cycleTimeHours: number | null
    ticketCount: number
  }>                           // 8 weeks

  currentCycleTime: {
    p50: number | null
    teamMedian: number | null  // only if opt-in comparison enabled
  }

  throughput: {
    current: number            // tickets this period
    trend: Array<{ week: string; tickets: number; storyPoints: number }>
  }

  agingWip: Array<{
    key: string
    summary: string
    currentStatus: string
    daysInStatus: number
  }>

  timeInStatus: {
    avgByStatus: Record<string, number>   // hours averaged across completed tickets
    recentTickets: Array<{
      key: string
      summary: string
      statusBreakdown: Record<string, number>   // hours per status
    }>
  }

  reworkRate: {
    rate: number               // percentage
    ticketsWithRework: number
    totalCompleted: number
    trend: Array<{ week: string; rate: number }>
  }

  scopeTrajectory: Array<{
    month: string
    avgComplexity: number      // avg SP per ticket
    ticketCount: number
  }>

  period: string
}
```

---

## Config Additions

### Shared (extend AppConfig)

```
active_statuses: string[]         // default: ["In Progress", "Code Review", "QA"]
blocked_statuses: string[]        // replaces eng_excluded_statuses for flow metrics
done_statuses: string[]           // replaces hardcoded FINAL_STATUSES
```

### EM-specific

```
seniority_field_id: string | null   // optional custom field for engineer level
```

### DM-specific

```
wip_limit: number | null                     // configurable WIP limit
aging_thresholds: {
  warning_days: number                       // default: 3
  critical_days: number                      // default: 5
  escalation_days: number                    // default: 7
}
```

### IC-specific

```
my_account_id: string | null                 // auto-detected from auth or configurable
personal_goals: Record<string, number>       // e.g. { "cycle_time": 24 } (hours target)
opt_in_team_comparison: boolean              // default: false
```

---

## Service Architecture

```
src/main/services/
├── timeline.service.ts          # NEW: buildTicketTimeline, shared computation utilities
├── em-metrics.service.ts        # NEW: EM team + individual metrics
├── dm-metrics.service.ts        # NEW: DM flow metrics (CFD, WIP, forecast)
├── ic-metrics.service.ts        # NEW: IC personal flow metrics
├── metrics.service.ts           # DEPRECATED: current shared metrics (keep for migration)
├── ticket.service.ts            # UPDATE: add assignee_id, sprint, components to ProcessedTicket
├── field-engine.service.ts      # KEEP: eng hours calc + rule engine (still useful for attribution)
└── ...
```

## Privacy Model

- IC metrics endpoint only returns data for the requesting user's account_id
- EM individual metrics only returns data for tracked_engineers in their config
- DM never receives per-engineer breakdown
- No individual-level data in any cross-persona endpoint
