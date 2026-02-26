# Uplift Forge

An engineering team performance platform that connects to JIRA to provide automated field management, team & individual KPIs, and data-driven insights. The UI personalizes itself with your JIRA project name, avatar, and team lead.

## Features

### Team Metrics
- **9 KPI cards** with trend badges (vs previous period): total tickets, story points, eng hours, estimation accuracy, avg hours/SP, avg cycle time, bug count, bug ratio, bug hours %.
- **Period filtering**: All Time, Weekly, Bi-weekly, Monthly — with automatic previous-period comparison.
- **Charts**: Monthly trend line, Eng Hours by BU (bar), Eng Hours by Work Stream (pie), SP by BU (bar), Issue Type breakdown (pie).
- **Interactive tooltips**: Hover any `?` icon for KPI explanation, targets, and trend meanings. Hover trend badges to see current vs previous values.
- **Configurable SP calibration**: Define how many man-days = 1 story point for your team.

### Individual Metrics
- **Per-engineer KPIs**: Tickets, story points, eng hours, cycle time, hours/SP, estimation accuracy, bug ratio, complexity, focus ratio.
- **Team comparison**: Bar charts comparing all engineers side-by-side on key metrics.
- **Expand/collapse detail**: Click an engineer to see their full KPI breakdown with vs-team-average comparison and quality ratios.
- **Trend badges**: Period-over-period trends for each metric when using time-bounded periods.
- **Tracked engineers**: Configure which JIRA members to track in the Individual Metrics section of Configuration.

### Engineering Attribution
- **Engineering Hours**: Auto-calculated from JIRA status transitions, respecting office hours, weekends, and excluded statuses.
- **Rule-Based Mapping**: TPD Business Unit and Work Stream auto-assigned via visual rule builder with AND/OR logic across parent key, labels, components, summary, issue type, priority, and assignee.
- **Inline Editing**: Edit fields directly in the table and save back to JIRA.
- **Per-field Recalculate**: Recompute any field on demand with a single click.
- **Bulk actions**: Calculate All and Save All buttons for batch operations across visible tickets.
- **Missing Fields Filter**: Toggle to show only tickets needing attention.

### Configuration
Settings are organized by feature:
- **JIRA Connection** — Project key, data time range (max 12 months).
- **Team Metrics** — Story points field mapping, SP-to-days calibration.
- **Engineering Attribution** — TPD BU / Eng Hours / Work Stream field mappings, mapping rules, display filter.
- **Engineering Hours Calculation** — Start/end statuses, excluded statuses (shared by both features).
- **Individual Metrics** — Tracked engineers selection from JIRA project members.

All configuration is persisted to `config.yaml`.

## Quick Start

### 1. Clone and configure
```bash
git clone git@github.com:pmomio/uplift-forge.git
cd uplift-forge
cp .env.example .env
```

Edit `.env` with your credentials:
- `JIRA_API_TOKEN` — your JIRA API token
- `JIRA_EMAIL` — your JIRA account email
- `JIRA_BASE_URL` — e.g. `https://your-org.atlassian.net`

### 2. Run with Docker (recommended)
```bash
make docker-up
```
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000

### 3. First-time setup
1. Open the UI — go to **Configuration**.
2. Enter your JIRA **Project Key** and click **Fetch Fields**.
3. Under **Team Metrics**: select the Story Points field and set SP calibration.
4. Under **Engineering Attribution**: map TPD BU, Eng Hours, Work Stream fields. Add mapping rules.
5. Under **Engineering Hours Calculation**: set start/end statuses and exclusions.
6. Under **Individual Metrics**: fetch members and select engineers to track.
7. **Save** and click **Sync & Refresh** on any tab.

## Running locally (development)

### Prerequisites
- Python 3.11+
- Node.js 20+

### Setup
```bash
make setup
```

### Start services (two terminals)
```bash
make run-backend   # FastAPI on :8000
make run-frontend  # Vite dev server on :5173
```

## Available Commands

| Command | Description |
|---------|-------------|
| `make setup` | Install backend (venv + pip) and frontend (npm) dependencies |
| `make run-backend` | Start FastAPI server locally |
| `make run-frontend` | Start Vite dev server locally |
| `make test` | Run all tests (backend + frontend) |
| `make test-backend` | Run backend tests with coverage |
| `make test-frontend` | Run frontend tests |
| `make test-frontend-coverage` | Run frontend tests with coverage report |
| `make docker-up` | Build and start both services with Docker Compose |
| `make docker-down` | Stop Docker services |

## Testing

The project maintains **>90% test coverage** enforced by CI on every pull request.

| Suite | Tests | Coverage | Tool |
|-------|------:|----------|------|
| Backend | 188 | ~99% | pytest + pytest-cov |
| Frontend | 257 | ~96% | vitest + @vitest/coverage-v8 |
| **Total** | **445** | | |

Coverage thresholds are enforced automatically:
- **Backend:** `--cov-fail-under=90` in `pytest.ini`
- **Frontend:** `{ statements: 90, branches: 80, functions: 85, lines: 90 }` in `vite.config.ts`
- **CI:** GitHub Actions runs both suites on every PR to `main`

## Tech Stack

- **Backend:** FastAPI, `atlassian-python-api`, PyYAML, pytest
- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Recharts, Lucide React, react-hot-toast, vitest
- **CI:** GitHub Actions
- **Infrastructure:** Docker Compose, Makefile
