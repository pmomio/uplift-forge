# Uplift Forge - Memory

## Workflow Rules
- **Always update docs after changes**: After any code changes, update README.md, CLAUDE.md, and any spec files. This was explicitly requested by the user.
- **Always update USER_GUIDE.md**: When adding a new feature, the end-user guide (`USER_GUIDE.md`) must be updated. Explicitly requested by the user.
- **Use playful emojis in docs**: All documentation files (README.md, CLAUDE.md, USER_GUIDE.md) should use playful emojis throughout. Explicitly requested by the user.
- **Memory lives in repo**: The memory folder must reside at `.claude/memory/` inside the repository, not the external Claude projects path.

## Project State
- Branch `feat/e2e-tests`: Multi-project cross-project support fully implemented (all 6 phases complete)
- 565 tests across 25 suites (all passing)
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
- See `PRODUCT_SPEC.md` and `.claude/memory/data-model.md` for full details

## Data Architecture Decisions
- Raw JIRA data already contains everything needed (`fields: '*all'`, `expand: 'changelog'`)
- No additional JIRA API calls needed for any spec metric
- Missing: changelog analysis engine (status timelines, rework detection, flow efficiency)
- Missing from ProcessedTicket: `assignee_id`, `sprint`, `components`
- Current `avg_cycle_time_hours` is actually avg eng_hours — NOT true cycle time
- Persona-specific metric services needed (emMetrics, dmMetrics, icMetrics) replacing shared computeMetrics
