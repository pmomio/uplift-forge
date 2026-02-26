# Uplift Forge — Technical Specification

**Version:** 5.0
**Team:** ACTIN
**Organisation:** Omio
**Date:** February 2026

---

## 1. Overview
Uplift Forge is a Python + React platform for engineering team performance. It connects to JIRA to auto-compute engineering hours, map business metadata via a rule engine, track team-level and individual-level KPIs with trend analysis, and provide a personalized dashboard using JIRA project metadata.

## 2. Architecture & Tech Stack

### Backend (Python 3.11+)
- **Framework:** FastAPI
- **JIRA Client:** `atlassian-python-api` with lazy-initialized cached instance
- **Pagination:** Cursor-based (`nextPageToken`/`isLast`) via `enhanced_jql` for JIRA Cloud
- **Persistence:** `config.yaml` for settings/mappings, in-memory caches for tickets and raw issues
- **Sync:** On-demand only — triggered by explicit user actions (Sync button or config save). No background scheduler.
- **Logging:** Python `logging` module
- **Testing:** pytest + pytest-cov (188 tests, ~99% coverage)

### Frontend (React 19 + TypeScript)
- **Build Tool:** Vite 7
- **Styling:** Tailwind CSS v4 — dark slate theme with indigo/cyan/violet/emerald/orange accents per feature
- **Charts:** Recharts (LineChart, BarChart, PieChart)
- **Icons:** Lucide React
- **HTTP Client:** Axios
- **Notifications:** react-hot-toast (with ID-based deduplication)
- **Dialogs:** Custom `ModalDialog` component (no native `alert`/`confirm`/`prompt`)
- **Testing:** vitest + @testing-library/react + @vitest/coverage-v8 (257 tests, ~96% coverage)

### Infrastructure
- **Containerisation:** Docker Compose (backend + frontend)
- **Dev tooling:** Makefile for common commands

## 3. Core Features

### 3.1 Project Personalization
The app fetches JIRA project metadata (`GET /jira/project`) on startup:
- **Project name** shown in sidebar, page headers ("Activations & Incentives — Team Metrics")
- **Project avatar** replaces the default icon in sidebar and home page
- **Project lead** displayed at the bottom of the sidebar
- Graceful fallback to generic "Uplift Forge" branding if JIRA call fails

### 3.2 Feature-Organized Configuration
The Configuration page groups settings by feature with visual section headers:

**JIRA Connection** (shared) — Project key, Fetch Fields button, data time range (1-12 months max).

**Team Metrics** — Story Points field mapping, SP calibration (`sp_to_days`: how many man-days = 1 SP, default 1).

**Engineering Attribution** — TPD BU / Eng Hours / Work Stream field mappings, "show only missing fields" toggle, TPD BU and Work Stream mapping rules.

**Engineering Hours Calculation** (shared) — Start/end statuses, excluded statuses for eng hours computation.

**Individual Metrics** — Tracked engineers selection from JIRA project members. Fetch Members button to load available team members, toggle selection on/off.

All configuration persisted to `config.yaml`.

### 3.3 Team Metrics Dashboard

#### KPI Cards (9 metrics)
| Metric | Formula | Lower is Better? |
|--------|---------|:-:|
| Total Tickets | count of resolved tickets in period | |
| Total Story Points | sum of SP | |
| Total Eng Hours | sum of eng_hours | |
| Estimation Accuracy | (total SP x sp_to_days x 8) / total eng hours | |
| Avg Hours / SP | total eng hours / total SP | Yes |
| Avg Cycle Time | mean eng hours per ticket | Yes |
| Bug Count | count where issue_type in {Bug, Defect} | Yes |
| Bug Ratio | bug count / total tickets | Yes |
| Bug Hours % | bug eng hours / total eng hours x 100 | Yes |

#### Period Filtering
- **All Time** — no time filter
- **Weekly** — last 7 days
- **Bi-weekly** — last 14 days
- **Monthly** — last 30 days

Each period also computes the previous period of the same length for trend comparison.

#### Trend Badges
- **KPI cards**: Arrow + percentage change, colored green/red based on `LOWER_IS_BETTER` set
- **Chart headers**: Arrow + percentage + "vs prev period"
- **Hover tooltips**: Show previous value, current value, and direction

#### Charts
- Monthly Trend (line chart): tickets, story points, eng hours over time
- Eng Hours by Business Unit (horizontal bar)
- Eng Hours by Work Stream (pie)
- Story Points by Business Unit (horizontal bar)
- Issue Type Breakdown (pie)

#### Help Tooltips
Every KPI card and chart section has a `?` icon. Hover shows:
- What is this metric
- Why it matters
- High-performing targets
- What up-trend and down-trend mean for this specific metric

### 3.4 Individual Metrics Dashboard

#### Per-Engineer KPI Cards
Each tracked engineer gets a collapsible card showing:
| Metric | Description | Lower is Better? |
|--------|-------------|:-:|
| Tickets | Total resolved tickets | |
| Story Points | Sum of SP | |
| Eng Hours | Sum of engineering hours | |
| Cycle Time | Average eng hours per ticket | Yes |
| Hours / SP | Average eng hours per story point | Yes |
| Estimation Accuracy | (SP x sp_to_days x 8) / eng hours | |
| Bug Ratio | Bug tickets / total tickets | Yes |
| Complexity | Average story points per ticket | |
| Focus Ratio | Tickets with eng hours / total tickets | |

#### Expand/Collapse Detail
Clicking an engineer card reveals:
- **vs Team Average** comparison for each KPI
- **Ratios & Quality** section with bug ratio, complexity, and focus ratio
- Trend badges (when using time-bounded periods)
- Help tooltips on each metric

#### Team Comparison Chart
Bar chart comparing all tracked engineers on story points, eng hours, and tickets.

#### Team Average Row
Summary row showing averaged metrics across all tracked engineers.

### 3.5 Field Computation Engine

#### Engineering Hours
Calculated from the issue changelog:
1. Finds the first transition to the configured **start status**.
2. Finds the first subsequent transition to the configured **end status**.
3. Computes the delta in office hours (configurable timezone, start/end times, weekend exclusion).
4. Subtracts time spent in **excluded statuses** (e.g. Blocked) within the window.

#### TPD BU / Work Stream (Rule Engine)
Resolved by evaluating mapping rules against issue context:

**Fields:** `parent_key`, `parent_summary`, `labels`, `components`, `summary`, `issue_type`, `priority`, `assignee`

**Operators:** `equals` (exact match), `contains` (substring), `starts_with` (prefix), `in` (comma-separated list)

**Logic:**
- Rules within an AND-block must **all** match (AND).
- Multiple AND-blocks within a group are evaluated with **any** match sufficient (OR).
- Groups are checked top-to-bottom; the **first matching group** wins.

**Data model** (`Rule[][]` per group):
```json
{
  "tpd_bu": {
    "B2C": [
      [
        {"field": "parent_key", "operator": "equals", "value": "ACTIN-195"},
        {"field": "labels", "operator": "contains", "value": "B2C"}
      ],
      [
        {"field": "summary", "operator": "contains", "value": "consumer"}
      ]
    ]
  }
}
```
This means: match B2C if `(parent_key = ACTIN-195 AND labels contains B2C) OR (summary contains consumer)`.

### 3.6 Sync Engine
- **Bulk Sync:** Cursor-based pagination with embedded changelogs (no N+1 API calls). Time range capped at 12 months.
- **Single-ticket Sync:** Per-row refresh fetches and reprocesses one ticket.
- **On-demand only:** No background scheduler. Sync triggers via "Sync Now" / "Sync & Refresh" buttons or config save (when project key or filter changes).
- **Raw Issue Cache:** Stores full JIRA issue payloads so mapping rules can be re-evaluated without re-fetching from JIRA.

### 3.7 Engineering Attribution Dashboard
- **Filtering:** Shows only final-state tickets (Done, Rejected, Closed, Resolved, Cancelled).
- **Sorting:** By JIRA `updated` timestamp, newest first.
- **Pagination:** 10 items per page with previous/next navigation.
- **Inline Editing:** TPD BU (dropdown), Work Stream (dropdown), and Engineering Hours (number input) are editable per row.
- **Per-field Recalculate:** Calculator buttons for each field to recompute from JIRA data on demand.
- **Bulk actions:** Calculate All (hours + fields) and Save All buttons for batch operations across visible dirty/computed tickets.
- **Save to JIRA:** Pushes local edits back to JIRA custom fields (toast deduplication via IDs).
- **Status Badges:** Color-coded by ticket status.
- **Summary Bar:** Shows total ticket count and breakdown of missing fields with clickable filter buttons.

## 4. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/tickets` | List cached tickets (final statuses only, filtered by mode) |
| `PATCH` | `/tickets/{key}` | Update ticket fields in JIRA |
| `POST` | `/tickets/{key}/sync` | Re-sync a single ticket from JIRA |
| `GET` | `/tickets/{key}/calculate` | Recalculate engineering hours |
| `GET` | `/tickets/{key}/calculate-fields` | Recalculate TPD BU and Work Stream |
| `POST` | `/sync` | Trigger full project sync |
| `GET` | `/config` | Get current configuration |
| `POST` | `/config` | Update configuration (returns `sync_triggered`, `ticket_count`) |
| `GET` | `/jira/project` | Get project name, lead, and avatar from JIRA |
| `GET` | `/jira/fields` | List all JIRA custom fields |
| `GET` | `/jira/statuses` | List all JIRA workflow statuses |
| `GET` | `/jira/members` | List JIRA project members (active users) |
| `GET` | `/metrics/team?period=` | Team KPIs with trend data (`all`, `weekly`, `bi-weekly`, `monthly`) |
| `GET` | `/metrics/individual?period=` | Per-engineer KPIs with team averages (`all`, `weekly`, `bi-weekly`, `monthly`) |

### POST /config behavior
- Changing **project key** or **ticket filter** triggers a full JIRA re-sync.
- Changing only **mapping rules** triggers `reprocess_cache()` (re-evaluates rules against cached raw issues, no JIRA fetch).
- Response includes `ticket_count` (visible tickets after filtering).

### GET /metrics/team response
Returns `summary`, `by_business_unit`, `by_work_stream`, `issue_type_breakdown`, `monthly_trend`, plus `prev_*` variants for trend calculation when `period != all`.

### GET /metrics/individual response
Returns `engineers` (array of per-engineer metrics with `prev_metrics`), `team_averages`, `prev_team_averages`, and `period`.

## 5. Configuration Schema (`config.yaml`)

```yaml
jira:
  base_url: https://your-org.atlassian.net
  email: your-email@example.com
  project_key: ACTIN
  field_ids:
    tpd_bu: customfield_17924
    eng_hours: customfield_18466
    work_stream: customfield_18837
    story_points: customfield_10004

engineering_hours_start_status: In Progress
engineering_hours_end_status: Code Review
engineering_hours_excluded_statuses: [Blocked]

ticket_filter:
  mode: last_x_months    # last_x_months | missing_fields
  months: 6              # 1-12

sp_to_days: 1            # man-days per story point

mapping_rules:
  tpd_bu: { ... }
  work_stream: { ... }

tracked_engineers:
  - accountId: "abc123"
    displayName: "Alice Dev"
    avatar: "https://..."

office_hours:
  start: "09:00"
  end: "18:00"
  timezone: Europe/Berlin
  exclude_weekends: true

sync:
  auto_write_to_jira: false
  interval_minutes: 60
```

## 6. Testing

The project maintains **>90% test coverage** across both backend and frontend.

### Backend (188 tests, ~99% coverage)
- **`conftest.py`** — Shared fixtures, config.yaml save/restore
- **`test_field_engine.py`** — Office hours calculation, blocked periods, weekend exclusion, operator logic, field mapping
- **`test_integration.py`** — JQL construction, sync filter passthrough, GET /tickets filtering, missing fields edge cases, config endpoint behavior, rule engine AND/OR logic with backward compatibility
- **`test_config.py`** — Config module loading, persistence, defaults
- **`test_jira_client.py`** — JIRA API wrapper, pagination, error handling
- **`test_main.py`** — App entrypoint, CORS, router registration
- **`test_routes_tickets.py`** — Ticket CRUD, sync, metrics endpoints, error cases
- **`test_routes_config.py`** — Config GET/POST, JIRA field/status/member listing

Run: `make test-backend` or `cd backend && .venv/bin/pytest --tb=short -q`

### Frontend (257 tests, ~96% coverage)
- **`App.test.tsx`** — Tab navigation, project fetch, config save callback
- **`api.test.ts`** — All API function shapes
- **`ConfigPanel.test.tsx`** (51 tests) — All config sections, field fetch, save, members, status selects, rule builders
- **`TicketTable.test.tsx`** (53 tests) — Rendering, filtering, sorting, editing, save, sync, calculate, bulk actions, pagination
- **`RuleBuilder.test.tsx`** (26 tests) — Groups, AND/OR blocks, adding/removing rules, color themes
- **`TeamMetrics.test.tsx`** (29 tests) — KPI cards, charts, trends, tooltips, sync, empty states
- **`IndividualMetrics.test.tsx`** (21 tests) — Engineer cards, expand/collapse, trend badges, team comparison
- **`EngineeringAttribution.test.tsx`** (13 tests) — Fetch, sync, error handling, empty states
- Plus tests for ModalDialog, Sidebar, TicketSummary, HomePage

Run: `make test-frontend` or `cd frontend && npx vitest run`

### Coverage Thresholds
| Suite | Statements | Branches | Functions | Lines |
|-------|-----------|----------|-----------|-------|
| Backend | 90% (fail-under) | — | — | — |
| Frontend | 90% | 80% | 85% | 90% |

## 7. Security
- JIRA API token and email managed via `.env` environment variables (never committed).
- CORS configured for local development.
- Configuration persistence in `config.yaml` allows recovery after restart.
- No native browser dialogs — all interactions via React modals.
- Data time range capped at 12 months to prevent excessive JIRA queries.

## 8. Known JIRA Cloud Quirks
- `atlassian-python-api` `jql()` method raises `ValueError` for `start > 0` on Cloud — must use `enhanced_jql()`.
- The `total` field in JIRA search responses returns 0 — pagination relies on `isLast` flag.
- Relative dates in JQL silently return 0 results on some instances — use absolute dates computed in Python.
