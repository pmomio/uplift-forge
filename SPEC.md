# Uplift Forge — Technical Specification

**Version:** 3.0
**Team:** ACTIN
**Organisation:** Omio
**Date:** February 2026

---

## 1. Overview
Uplift Forge is a Python-based microservice and React UI that automates and manages JIRA ticket fields. It calculates engineering time from status transitions and maps business metadata using a configurable rule engine with AND/OR logic.

## 2. Architecture & Tech Stack

### Backend (Python 3.11+)
- **Framework:** FastAPI
- **JIRA Client:** `atlassian-python-api` with lazy-initialized cached instance
- **Pagination:** Cursor-based (`nextPageToken`/`isLast`) via `enhanced_jql` for JIRA Cloud
- **Persistence:** `config.yaml` for settings/mappings, in-memory caches for tickets and raw issues
- **Scheduling:** APScheduler for periodic syncs
- **Logging:** Python `logging` module

### Frontend (React 19 + TypeScript)
- **Build Tool:** Vite
- **Styling:** Tailwind CSS v4 — dark slate theme with indigo/emerald accents
- **Icons:** Lucide React
- **HTTP Client:** Axios
- **Notifications:** react-hot-toast
- **Dialogs:** Custom `ModalDialog` component (no native `alert`/`confirm`/`prompt`)

### Infrastructure
- **Containerisation:** Docker Compose (backend + frontend)
- **Dev tooling:** Makefile for common commands

## 3. Core Features

### 3.1 Dynamic JIRA Configuration
Users configure the system via the **Configure** modal (React portal):
- **Project Key:** The JIRA project to sync. Changing it triggers a full re-sync.
- **Fetch Fields:** Loads all available JIRA custom fields and workflow statuses on-demand.
- **Field ID Mappings:** Dropdown selection of JIRA custom fields for TPD BU, Engineering Hours, and Work Stream.
- **Calculation Statuses:** Configurable start status, end status, and excluded statuses for engineering hours calculation.
- **Ticket Filter:** Three modes:
  - **All Tickets** — fetches everything from the project.
  - **Last X Months** — fetches only tickets resolved within the last N months (uses absolute dates in JQL).
  - **Missing Required Fields** — shows only tickets missing TPD BU, Eng Hours, or Work Stream.
- **Mapping Rules:** Visual rule builder for TPD Business Unit and Work Stream (see Section 3.3).

All configuration is persisted to `config.yaml`.

### 3.2 Field Computation Engine

#### Engineering Hours
Calculated from the issue changelog:
1. Finds the first transition to the configured **start status**.
2. Finds the first subsequent transition to the configured **end status**.
3. Computes the delta in office hours (configurable timezone, start/end times, weekend exclusion).
4. Subtracts time spent in **excluded statuses** (e.g. Blocked) within the window.

#### TPD BU / Work Stream (Rule Engine)
Resolved by evaluating mapping rules against issue context. The rule engine supports:

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

**Backward compatibility:** Old flat `Rule[]` format (pre-v3) is auto-detected and treated as individual OR blocks.

#### Computed vs Stored
The system tracks whether field values come from JIRA or were auto-computed, enabling smart save-button state.

### 3.3 Rule Builder UI
A visual component for configuring mapping rules:
- Each group (e.g. "B2C", "Operational") contains AND-blocks separated by OR dividers.
- Within a block: field dropdown, operator dropdown, value input, "+ AND" button.
- Between blocks: visual OR separator, "+ OR Block" button.
- Group management via modal dialogs (add with validation, confirm removal).
- Color-themed: indigo for TPD BU, emerald for Work Stream.

### 3.4 Sync Engine
- **Bulk Sync:** Uses cursor-based pagination (`nextPageToken`/`isLast`) to fetch all project issues with embedded changelogs (no N+1 API calls). Absolute dates for time-filtered queries.
- **Single-ticket Sync:** Per-row refresh fetches and reprocesses one ticket.
- **Scheduled Sync:** APScheduler runs bulk sync at a configurable interval.
- **Raw Issue Cache:** Stores full JIRA issue payloads so mapping rules can be re-evaluated without re-fetching from JIRA (used when only rules change).

### 3.5 Dashboard
- **Filtering:** Shows only final-state tickets (Done, Rejected, Closed, Resolved, Cancelled).
- **Sorting:** By JIRA `updated` timestamp, newest first.
- **Pagination:** 10 items per page with previous/next navigation.
- **Inline Editing:** TPD BU (dropdown), Work Stream (dropdown), and Engineering Hours (number input) are editable per row.
- **Per-field Recalculate:** Calculator buttons for each field to recompute from JIRA data on demand.
- **Save to JIRA:** Pushes local edits back to JIRA custom fields. Button is active when a row has unsaved computed values or user edits.
- **Status Badges:** Color-coded by ticket status (emerald for Done/Closed, rose for Rejected/Cancelled, sky for others).
- **Summary Bar:** Shows total ticket count and breakdown of missing fields.
- **Toast Notifications:** All success/error feedback via non-blocking toast messages.

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
| `GET` | `/jira/fields` | List all JIRA custom fields |
| `GET` | `/jira/statuses` | List all JIRA workflow statuses |

### POST /config behavior
- Changing **project key** or **ticket filter** triggers a full JIRA re-sync.
- Changing only **mapping rules** triggers `reprocess_cache()` (re-evaluates rules against cached raw issues, no JIRA fetch).
- Response includes `ticket_count` (visible tickets after filtering).

## 5. Testing

41 backend tests across two files:
- **`test_field_engine.py`** (6 tests) — office hours calculation, blocked periods, weekend exclusion.
- **`test_integration.py`** (35 tests) — JQL construction (absolute dates, pagination), sync filter passthrough, GET /tickets filtering (all modes), missing fields edge cases, config endpoint behavior, rule engine AND/OR logic with backward compatibility.

Run: `make test` or `cd backend && .venv/bin/python -m pytest -v`

## 6. Security
- JIRA API token and email are managed via `.env` environment variables (never committed).
- CORS is configured for local development (all origins allowed).
- Configuration persistence in `config.yaml` allows the service to recover after restart.
- No native browser dialogs — all user interactions via React modals to prevent UI thread blocking.

## 7. Known JIRA Cloud Quirks
- `atlassian-python-api` `jql()` method raises `ValueError` for `start > 0` on Cloud instances — must use `enhanced_jql()`.
- The `total` field in JIRA search responses returns 0 — pagination relies on `isLast` flag.
- Relative dates in JQL (`-1M`, `-3M`) silently return 0 results on some instances — use absolute dates computed in Python.
