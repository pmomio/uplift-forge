# CLAUDE.md

## Project Overview

Uplift Forge — a FastAPI + React app that automates JIRA ticket field management (engineering hours, TPD Business Unit, Work Stream).

## Repository Structure

```
backend/           Python FastAPI backend
  main.py          App entrypoint, CORS, router registration
  config.py        Config class, loads config.yaml, persists changes
  config.yaml      All settings (project key, field IDs, mapping rules, filters)
  jira_client.py   JIRA API wrapper (enhanced_jql, pagination)
  field_engine.py  Engineering hours calc + rule-based field mapping
  scheduler.py     APScheduler for periodic syncs
  routes/
    tickets.py     Ticket CRUD, sync, caches (ticket_cache, raw_issue_cache)
    config.py      Config GET/POST, JIRA field/status listing
  test_field_engine.py    Unit tests for office hours and eng hours calc
  test_integration.py     Integration tests (41 tests: filters, JQL, rules)
frontend/          React 19 + TypeScript + Vite
  src/
    App.tsx        Root component, layout, sync button
    api.ts         Axios client, all API calls
    components/
      ConfigPanel.tsx    Config modal (portal-based)
      RuleBuilder.tsx    Visual AND/OR rule builder
      ModalDialog.tsx    Reusable prompt/confirm modal (replaces native dialogs)
      TicketTable.tsx    Dashboard table with inline editing
      TicketSummary.tsx  Summary stats bar
```

## Development Commands

```bash
make setup          # Install all dependencies (backend venv + frontend npm)
make run-backend    # FastAPI on :8000
make run-frontend   # Vite dev server on :5173
make test           # Run all backend tests (pytest)
make docker-up      # Docker Compose build + start
make docker-down    # Stop Docker services
```

## Running Tests

```bash
cd backend && .venv/bin/python -m pytest test_integration.py test_field_engine.py -v
```

Or via Makefile: `make test`

## TypeScript Check

```bash
cd frontend && npx tsc --noEmit
```

## Key Technical Decisions

- **JIRA Cloud API**: Must use `enhanced_jql` (not `jql`) — the `jql` method raises `ValueError` for `start > 0` on Cloud instances. Pagination uses `nextPageToken`/`isLast`.
- **Absolute dates in JQL**: This JIRA instance silently returns 0 results for relative dates (`-1M`). All date filters use absolute dates computed in Python (`resolved >= "YYYY-MM-DD"`).
- **Rule engine data model**: `Rule[][]` per group — inner arrays are AND-blocks, outer array OR's them. Backward compat: flat `Rule[]` (old format) is auto-detected and treated as individual OR blocks.
- **Raw issue cache**: `raw_issue_cache` stores full JIRA issue payloads so mapping rules can be re-evaluated without re-fetching from JIRA.
- **No native browser dialogs**: All `prompt()`/`confirm()`/`alert()` replaced with `ModalDialog` component. Notifications via `react-hot-toast`.
- **Config persistence**: All config saved to `config.yaml` via `yaml.safe_dump`. Secrets (API token, email) stay in `.env`.

## Code Conventions

- Backend: Python 3.11+, FastAPI routers, no ORMs (in-memory caches)
- Frontend: React 19, TypeScript strict, Tailwind CSS v4 (dark slate theme, indigo/emerald accents)
- Icons: Lucide React only
- Tests: pytest, mocking via `unittest.mock.patch` on `jira_client` / `sync_tickets`
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
- Changing project key or ticket filter triggers a full re-sync; changing only mapping rules triggers `reprocess_cache()` (no JIRA fetch)
- Final statuses for dashboard display: Done, Rejected, Closed, Resolved, Cancelled
