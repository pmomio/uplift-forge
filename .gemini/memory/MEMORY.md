# Uplift Forge - Memory

## Workflow Rules
- **Always update docs after changes**: After any code changes, update README.md, GEMINI.md, and any spec files. This was explicitly requested by the user.
- **Always update USER_GUIDE.md**: When adding a new feature, the end-user guide (`USER_GUIDE.md`) must be updated. Explicitly requested by the user.
- **Use playful emojis in docs**: All documentation files (README.md, GEMINI.md, USER_GUIDE.md) should use playful emojis throughout. Explicitly requested by the user.
- **Makefile is the primary developer interface**: All commands in docs must use `make` targets, NOT raw `npm` commands. The Makefile wraps all npm scripts and is the single entry point for developers and end-users. When adding new npm scripts, always add a corresponding Makefile target. Explicitly requested by the user.
- **Memory lives in repo**: The memory folder must reside at `.gemini/memory/` inside the repository, not the external Claude projects path.
- **Save to memory before starting work**: Whenever starting work on a new task/feature, first save what you're working on in memory. This ensures continuity across sessions. Explicitly requested by the user.
- **Track work status in memory**: Always keep the "Current Work" section up to date — add it when starting a task, update progress during work, and move it to "Completed" when done. This ensures continuity and avoids repeated context-gathering across sessions. Explicitly requested by the user.
- **Add e2e tests for new features**: Whenever a new feature is added, update or add Playwright e2e tests if applicable. E2e tests live in `e2e/tests/` and use fixtures from `e2e/fixtures/`. Explicitly requested by the user.

## Project State
- Branch `feat/e2e-tests`: Multi-project cross-project support fully implemented (all 6 phases complete)
- 690 tests across 33 suites (all passing)
- Product spec exists at `PRODUCT_SPEC.md` in project root
- Per-project ticket caches implemented in `ticket.service.ts` (project-keyed Map of Maps)
- Management persona gets all 6 tabs with cross-project aggregation

## Persona Redesign (March 2026)
- **Merge management + engineering_manager into single `engineering_manager` persona** labeled "EM / VP Engineering"
- **3 personas total**: `engineering_manager`, `individual`, `delivery_manager`
- **Each persona sees fundamentally different metrics** — not just hidden/shown cards on shared pages
- EM: 1-10 teams, cross-project aggregation, team pulse + individual reports
- DM: 1-N projects (org-wide flow view), cross-project aggregation on DM-specific metrics
- IC: 1 project, self-only metrics, private by default
- See `PRODUCT_SPEC.md` and `.gemini/memory/data-model.md` for full details

## Current Work: Update E2E Tests for New Features
- Need to update e2e tests to cover: JIRA field options in dropdowns, config-driven status colors, status helper, and any other recent features
- E2e tests in `e2e/tests/`, fixtures in `e2e/fixtures/`

## Completed: JIRA Field Options for Dropdowns
- `jira.service.ts:getFieldOptions(fieldId)` fetches allowed values via `/field/{fieldId}/context` + `/context/{id}/option` endpoints (paginated, deduped, disabled excluded)
- IPC channel `JIRA_FIELD_OPTIONS` wired through preload → api.ts
- `EngineeringAttribution.tsx` fetches options on mount using `field_ids.tpd_bu` and `field_ids.work_stream` from config
- `TicketTable.tsx` TPD BU changed from text input to `<select>` dropdown; both dropdowns prefer JIRA field options, fall back to mapping rules + ticket data
- `JiraFieldOption` type added to `shared/types.ts`

## Config-Driven Values Rule
- **Never hardcode JIRA statuses, issue types, field values, or labels** in service/component code. All such values must come from `AppConfig`. Only `config.service.ts` defaults may contain literal values.
- 5 new config fields: `bug_type_names`, `product_type_names`, `tech_debt_label_names`, `review_status_keywords`, `product_work_stream_names`
- All matching is **case-insensitive** (`.toLowerCase()` everywhere)
- Frontend status coloring uses `src/renderer/helpers/status-colors.ts` helper, driven by `done_statuses` + `blocked_statuses` from config
- TicketTable dropdown options prefer JIRA field allowed values (fetched via `getFieldOptions`), falling back to `mapping_rules` + existing ticket data

## Data Architecture Decisions
- Raw JIRA data already contains everything needed (`fields: '*all'`, `expand: 'changelog'`)
- No additional JIRA API calls needed for any spec metric
- Missing: changelog analysis engine (status timelines, rework detection, flow efficiency)
- Missing from ProcessedTicket: `assignee_id`, `sprint`, `components`
- Current `avg_cycle_time_hours` is actually avg eng_hours — NOT true cycle time
- Persona-specific metric services needed (emMetrics, dmMetrics, icMetrics) replacing shared computeMetrics
