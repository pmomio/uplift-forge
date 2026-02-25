# JIRA Field Updater Service — Technical Specification

**Version:** 2.0
**Team:** ACTIN
**Organisation:** Omio
**Date:** February 2026

---

## 1. Overview
A Python-based microservice and React UI that automates and manages JIRA ticket fields. It calculates engineering time from status transitions and maps business metadata based on parent issue relationships.

## 2. Architecture & Tech Stack

### Backend (Python 3.11+)
- **Framework:** FastAPI
- **JIRA Client:** `atlassian-python-api` with lazy-initialized cached instance
- **Pagination:** Cursor-based (`nextPageToken`/`isLast`) via `enhanced_jql` for JIRA Cloud
- **Persistence:** `config.yaml` for settings/mappings, in-memory cache for tickets
- **Scheduling:** APScheduler for periodic syncs
- **Logging:** Python `logging` module

### Frontend (React 19 + TypeScript)
- **Build Tool:** Vite
- **Styling:** Tailwind CSS v4 — dark slate theme with indigo/emerald accents
- **Icons:** Lucide React
- **HTTP Client:** Axios
- **Notifications:** react-hot-toast

### Infrastructure
- **Containerisation:** Docker Compose (backend + frontend)
- **Dev tooling:** Makefile for common commands

## 3. Core Features

### 3.1 Dynamic JIRA Configuration
Users configure the system via the **Configure Mappings** modal:
- **Project Key:** The JIRA project to sync. Changing it triggers a full re-sync.
- **Fetch Fields:** A button beside the project key that loads all available JIRA custom fields and workflow statuses on-demand.
- **Field ID Mappings:** Dropdown selection of JIRA custom fields for TPD BU, Engineering Hours, and Work Stream.
- **Calculation Statuses:** Configurable start and end statuses for engineering hours calculation.
- **TPD Business Unit Mapping:** Maps parent issue keys (epics) to business units.
- **Work Stream Mapping:** Maps parent issue keys to work streams.

All configuration is persisted to `config.yaml`.

### 3.2 Field Computation Engine
- **Engineering Hours:** Calculated from the issue changelog — finds the first transition to the configured start status and the first subsequent transition to the end status, then computes the delta in office hours (09:00–18:00 Europe/Berlin, excluding weekends).
- **TPD BU / Work Stream:** Resolved by looking up the issue's parent key against the configured mappings.
- **Computed vs Stored:** The system tracks whether field values come from JIRA or were auto-computed, enabling smart save-button state.

### 3.3 Sync Engine
- **Bulk Sync:** Uses cursor-based pagination to fetch all project issues in a single pass with embedded changelogs (no N+1 API calls).
- **Single-ticket Sync:** Per-row refresh fetches and reprocesses one ticket.
- **Scheduled Sync:** APScheduler runs bulk sync at a configurable interval.

### 3.4 Dashboard
- **Filtering:** Shows only final-state tickets (Done, Rejected, Closed, Resolved, Cancelled).
- **Sorting:** By JIRA `updated` timestamp, newest first.
- **Pagination:** 10 items per page with previous/next navigation.
- **Inline Editing:** TPD BU (dropdown), Work Stream (dropdown), and Engineering Hours (number input) are editable per row.
- **Per-field Recalculate:** Calculator buttons for each field to recompute from JIRA data on demand.
- **Save to JIRA:** Pushes local edits back to JIRA custom fields. Button is active when a row has unsaved computed values or user edits.
- **Status Badges:** Color-coded by ticket status (emerald for Done/Closed, rose for Rejected/Cancelled, sky for others).
- **Toast Notifications:** All success/error feedback via non-blocking toast messages.

## 4. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/tickets` | List cached tickets (final statuses only) |
| `PATCH` | `/tickets/{key}` | Update ticket fields in JIRA |
| `POST` | `/tickets/{key}/sync` | Re-sync a single ticket from JIRA |
| `GET` | `/tickets/{key}/calculate` | Recalculate engineering hours |
| `GET` | `/tickets/{key}/calculate-fields` | Recalculate TPD BU and Work Stream |
| `POST` | `/sync` | Trigger full project sync |
| `GET` | `/config` | Get current configuration |
| `POST` | `/config` | Update configuration |
| `GET` | `/jira/fields` | List all JIRA custom fields |
| `GET` | `/jira/statuses` | List all JIRA workflow statuses |

## 5. Security
- JIRA API token and email are managed via `.env` environment variables (never committed).
- CORS is configured for local development (all origins allowed).
- Configuration persistence in `config.yaml` allows the service to recover after restart.
