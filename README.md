# Uplift Forge

A web application that automates JIRA ticket field management. It calculates engineering hours from status transitions, maps TPD Business Units and Work Streams using a flexible rule engine, and provides inline editing with push-back to JIRA.

## Features

- **Engineering Hours:** Auto-calculated from configurable status transitions (e.g. In Progress -> Code Review), respecting office hours, weekends, and excluded statuses (e.g. Blocked).
- **Rule-Based Field Mapping:** TPD Business Unit and Work Stream are auto-assigned using a visual rule builder with AND/OR logic across multiple fields (parent key, labels, components, summary, issue type, priority, assignee).
- **Ticket Filters:** Three modes — All Tickets, Last X Months (resolved date), Missing Required Fields.
- **Per-field Recalculate:** Recompute any field on demand with a single click.
- **Inline Editing:** Edit fields directly in the dashboard table and save back to JIRA.
- **Dynamic Configuration:** Configure project key, custom field IDs, statuses, mapping rules, and filters from the UI — with on-demand field fetching from JIRA.
- **Bulk & Single Sync:** Full project sync or per-ticket refresh from JIRA.
- **Scheduled Sync:** APScheduler runs bulk sync at a configurable interval.

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
1. Open the UI and click **Configure**.
2. Enter your JIRA **Project Key** (e.g. `ACTIN`).
3. Click **Fetch Fields** to load available custom fields and statuses.
4. Map the three field IDs: TPD Business Unit, Engineering Hours, Work Stream.
5. Set the **Start Status** and **End Status** for engineering hours calculation.
6. Configure **Ticket Filter** (All, Last X Months, or Missing Fields).
7. Add **TPD Business Unit** and **Work Stream** mapping rules using the visual rule builder.
8. **Save** and click **Sync Now**.

## Running locally (development)

### Prerequisites
- Python 3.11+
- Node.js 18+

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
| `make docker-up` | Build and start both services with Docker Compose |
| `make docker-down` | Stop Docker services |
| `make test` | Run all backend tests |

## Tech Stack

- **Backend:** FastAPI, `atlassian-python-api`, APScheduler, PyYAML
- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide React, react-hot-toast
- **Infrastructure:** Docker Compose, Makefile
