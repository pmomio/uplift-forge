# CLAUDE.md

## Project Overview

Uplift Forge — a FastAPI + React engineering team performance platform. Connects to JIRA to auto-compute engineering hours, map business metadata via a rule engine, and track team & individual KPIs with trend analysis. UI is personalized with JIRA project name, avatar, and lead.

## Repository Structure

```
backend/           Python FastAPI backend
  main.py          App entrypoint, CORS, router registration (no scheduler)
  config.py        Config class, loads config.yaml, persists changes
  config.yaml      All settings (project key, field IDs, mapping rules, filters, sp_to_days)
  jira_client.py   JIRA API wrapper (enhanced_jql, pagination, project metadata)
  field_engine.py  Engineering hours calc + rule-based field mapping
  scheduler.py     (deprecated — scheduler removed, sync is on-demand only)
  routes/
    tickets.py     Ticket CRUD, sync, caches, team & individual metrics endpoints
    config.py      Config GET/POST, JIRA field/status/project/member listing
  conftest.py              Shared test fixtures
  pytest.ini               Pytest config with coverage thresholds
  test_field_engine.py     Unit tests for office hours and eng hours calc
  test_integration.py      Integration tests (filters, JQL, rules)
  test_config.py           Config module tests
  test_jira_client.py      JIRA client tests
  test_main.py             App entrypoint tests
  test_routes_tickets.py   Ticket route tests
  test_routes_config.py    Config route tests
frontend/          React 19 + TypeScript + Vite 7
  src/
    App.tsx        Root component, layout, project info provider
    api.ts         Axios client, all API calls
    test-setup.ts  Vitest setup (jest-dom matchers)
    components/
      ConfigPanel.tsx    Feature-organized configuration page
      RuleBuilder.tsx    Visual AND/OR rule builder (indigo/emerald/violet themes)
      ModalDialog.tsx    Reusable prompt/confirm modal
      TicketTable.tsx    Attribution table with inline editing
      TicketSummary.tsx  Summary stats bar
      Sidebar.tsx        Navigation with project branding
      __tests__/         Component test files
    pages/
      HomePage.tsx                Welcome page with project personalization
      TeamMetrics.tsx             KPI dashboard with charts, trends, help tooltips
      IndividualMetrics.tsx       Per-engineer KPIs with team comparison
      EngineeringAttribution.tsx  Ticket-level field management
      __tests__/                  Page test files
  vite.config.ts   Build + test config with coverage thresholds
.github/
  workflows/
    test.yml       CI: runs backend + frontend tests on every PR
```

## Development Commands

```bash
make setup                  # Install all dependencies (backend venv + frontend npm)
make run-backend            # FastAPI on :8000
make run-frontend           # Vite dev server on :5173
make test                   # Run all tests (backend + frontend)
make test-backend           # Backend pytest with coverage
make test-frontend          # Frontend vitest
make test-frontend-coverage # Frontend vitest with coverage report
make docker-up              # Docker Compose build + start
make docker-down            # Stop Docker services
```

## Running Tests

Backend:
```bash
cd backend && .venv/bin/pytest --tb=short -q
```

Frontend:
```bash
cd frontend && npx vitest run
cd frontend && npx vitest run --coverage   # with coverage report
```

Or via Makefile: `make test`

## Test Coverage Policy

**All code changes must maintain >90% test coverage.** This is enforced by:

- **Backend:** pytest-cov with `--cov-fail-under=90` (currently ~99%)
- **Frontend:** @vitest/coverage-v8 with thresholds `{ statements: 90, branches: 80, functions: 85, lines: 90 }` (currently ~96%)
- **CI:** GitHub Actions runs both test suites on every PR to `main`. PRs that drop coverage below thresholds will fail CI.

When adding new features or modifying existing code:
1. Write tests for all new code paths (happy path + error handling).
2. Run `make test` locally before pushing.
3. Run `make test-frontend-coverage` to verify frontend thresholds are met.
4. Backend coverage is checked automatically by pytest on every run.

### Frontend testing conventions
- Mock `react-hot-toast` in every test file that renders components using toast: `vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))`
- Mock `recharts` in test files that render chart components (no canvas in jsdom)
- Use `container.querySelector('img[src="..."]')` instead of `getByRole('img')` — `<img alt="">` doesn't get `role="img"` in jsdom
- Use `getAllByText()` when text appears in multiple elements (e.g. sidebar + page header)
- Controlled selects with `value=""` don't respond well to `fireEvent.change` — test option availability instead of interaction

## TypeScript Check

```bash
cd frontend && npx tsc --noEmit
```

## Key Technical Decisions

- **No background scheduler:** Sync is triggered only by explicit user actions (Sync button or config save). APScheduler was removed.
- **JIRA Cloud API**: Must use `enhanced_jql` (not `jql`). Pagination uses `nextPageToken`/`isLast`.
- **Absolute dates in JQL**: This JIRA instance silently returns 0 results for relative dates. All date filters use absolute dates.
- **12-month data cap**: Time range is capped at 12 months to prevent excessive JIRA queries. Legacy `mode: "all"` is treated as 12 months.
- **Rule engine data model**: `Rule[][]` per group — inner arrays are AND-blocks, outer array OR's them. Old flat `Rule[]` format is auto-detected.
- **Raw issue cache**: `raw_issue_cache` stores full JIRA payloads so rules can be re-evaluated without re-fetching.
- **SP calibration**: `sp_to_days` config (default 1) defines man-days per story point. Used in estimation accuracy: `(SP x sp_to_days x 8) / eng_hours`.
- **Toast deduplication**: All `react-hot-toast` calls use `{ id: ... }` to prevent duplicate notifications on rapid clicks.
- **Fixed-position tooltips**: Help tooltips and trend tooltips use `getBoundingClientRect()` + `position: fixed` + `z-[9999]` to avoid clipping by overflow parents.
- **Feature-organized config**: ConfigPanel groups settings into JIRA Connection, Team Metrics, Engineering Attribution, Engineering Hours Calculation, and Individual Metrics sections.
- **Project personalization**: `GET /jira/project` fetches name/avatar/lead from JIRA. Passed as `ProjectInfo` prop through App → Sidebar, HomePage, TeamMetrics, IndividualMetrics, EngineeringAttribution.
- **No native browser dialogs**: All `prompt()`/`confirm()`/`alert()` replaced with `ModalDialog`. Notifications via `react-hot-toast`.
- **Config persistence**: All config saved to `config.yaml` via `yaml.safe_dump`. Secrets stay in `.env`.

## Code Conventions

- Backend: Python 3.11+, FastAPI routers, no ORMs (in-memory caches)
- Frontend: React 19, TypeScript strict, Tailwind CSS v4 (dark slate theme, feature-colored accents: indigo=shared, cyan=metrics, violet=attribution, emerald=eng hours, orange=individual)
- Charts: Recharts (LineChart, BarChart, PieChart)
- Icons: Lucide React only
- Tests: Backend uses pytest + unittest.mock; Frontend uses vitest + @testing-library/react + @testing-library/jest-dom
- Commit style: imperative mood, concise summary line

## Environment Variables (.env)

```
JIRA_API_TOKEN=   # Required
JIRA_EMAIL=       # Required
JIRA_BASE_URL=    # Required, e.g. https://your-org.atlassian.net
```

## Things to Watch Out For

- `atlassian-python-api` `jql()` is deprecated for Cloud — always use `enhanced_jql()`
- The `total` field in JIRA search responses returns 0 (unreliable) — rely on `isLast` for pagination
- Changing project key or ticket filter triggers a full re-sync; changing only mapping rules triggers `reprocess_cache()`
- Final statuses for dashboard display: Done, Rejected, Closed, Resolved, Cancelled
- `config.yaml` `ticket_filter.mode` accepts `last_x_months` or `missing_fields` (legacy `all` is treated as 12 months)
- RuleBuilder `color` prop accepts `indigo`, `emerald`, or `violet`
