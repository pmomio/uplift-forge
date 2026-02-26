import logging
from collections import defaultdict
from datetime import datetime, date, timedelta
from fastapi import APIRouter, HTTPException
from jira_client import jira_client
from field_engine import calculate_engineering_hours, get_mapped_fields
from config import config

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory caches
ticket_cache = {}
raw_issue_cache = {}  # Stores raw JIRA issues for rule re-evaluation

FINAL_STATUSES = ["Done", "Rejected", "Closed", "Resolved", "Cancelled"]

def get_visible_ticket_count():
    """Return the count of tickets that would be shown by GET /tickets."""
    filtered = [t for t in ticket_cache.values() if t.get("status") in FINAL_STATUSES]
    tf = config.ticket_filter
    if tf.get("mode") == "missing_fields":
        filtered = [t for t in filtered if not t.get("tpd_bu") or t.get("eng_hours") is None or not t.get("work_stream")]
    return len(filtered)

@router.get("/tickets")
async def get_tickets():
    filtered = [t for t in ticket_cache.values() if t.get("status") in FINAL_STATUSES]

    # Apply missing_fields filter if configured
    tf = config.ticket_filter
    if tf.get("mode") == "missing_fields":
        filtered = [t for t in filtered if not t.get("tpd_bu") or t.get("eng_hours") is None or not t.get("work_stream")]

    # Sort by updated timestamp, newest first
    return sorted(filtered, key=lambda x: x.get('updated', ''), reverse=True)

@router.patch("/tickets/{key}")
async def update_ticket(key: str, fields: dict):
    try:
        # Map frontend field names to JIRA custom field IDs
        jira_payload = {}
        if "tpd_bu" in fields:
            field_id = config.field_ids.get("tpd_bu")
            if field_id:
                # Based on raw data, this is a multi-select (array)
                jira_payload[field_id] = [{"value": fields["tpd_bu"]}] if fields["tpd_bu"] else []
        
        if "eng_hours" in fields:
            field_id = config.field_ids.get("eng_hours")
            if field_id:
                jira_payload[field_id] = float(fields["eng_hours"]) if fields["eng_hours"] is not None else None

        if "work_stream" in fields:
            field_id = config.field_ids.get("work_stream")
            if field_id:
                jira_payload[field_id] = {"value": fields["work_stream"]} if fields["work_stream"] else None

        logger.info(f"JIRA payload for {key}: {jira_payload}")
        if jira_payload:
            jira_client.update_issue_fields(key, jira_payload)

        if key in ticket_cache:
            ticket_cache[key].update(fields)
            ticket_cache[key]['has_computed_values'] = False
        return ticket_cache.get(key)
    except Exception as e:
        logger.exception(f"Update failed for {key}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tickets/{key}/sync")
async def sync_ticket_endpoint(key: str):
    try:
        # In a real Jira client we would fetch one issue
        # For simplicity in this mock-like setup, we'll use the existing search mechanism
        # or just assume we can fetch it.
        issues = jira_client.jira.jql(f'key = "{key}"', expand='changelog')['issues']
        if not issues:
            raise HTTPException(status_code=404, detail="Ticket not found in JIRA")
        
        issue = issues[0]
        process_issue(issue)
        return ticket_cache.get(key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tickets/{key}/calculate")
async def calculate_ticket_hours(key: str):
    try:
        changelog = jira_client.get_issue_changelog(key)
        histories = changelog.get('histories', [])
        hours = calculate_engineering_hours(histories)
        return {"hours": hours}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tickets/{key}/calculate-fields")
async def calculate_ticket_fields(key: str):
    try:
        issue = jira_client.jira.jql(f'key = "{key}"', expand='changelog')['issues']
        if not issue:
            raise HTTPException(status_code=404, detail="Ticket not found")
        issue = issue[0]
        tpd_bu, work_stream = get_mapped_fields(issue)
        return {"tpd_bu": tpd_bu, "work_stream": work_stream}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def process_issue(issue, store_raw=True):
    try:
        key = issue['key']
        if store_raw:
            raw_issue_cache[key] = issue
        fields = issue.get('fields', {})
        summary = fields.get('summary', 'No Summary')
        status_obj = fields.get('status', {})
        status = status_obj.get('name', 'Unknown') if status_obj else 'Unknown'
        assignee_obj = fields.get('assignee')
        assignee = assignee_obj.get('displayName', 'Unassigned') if assignee_obj else 'Unassigned'
        
        # Mapping from JIRA Custom Fields
        tpd_bu_field = config.field_ids.get("tpd_bu")
        eng_hours_field = config.field_ids.get("eng_hours")
        work_stream_field = config.field_ids.get("work_stream")

        # Get values from JIRA (if they exist)
        jira_tpd_bu = fields.get(tpd_bu_field) if tpd_bu_field else None
        if isinstance(jira_tpd_bu, list) and len(jira_tpd_bu) > 0:
            jira_tpd_bu = jira_tpd_bu[0].get('value')
        elif isinstance(jira_tpd_bu, dict):
            jira_tpd_bu = jira_tpd_bu.get('value')
        
        jira_eng_hours = fields.get(eng_hours_field) if eng_hours_field else None
        
        jira_work_stream = fields.get(work_stream_field) if work_stream_field else None
        if isinstance(jira_work_stream, list) and len(jira_work_stream) > 0:
            jira_work_stream = jira_work_stream[0].get('value')
        elif isinstance(jira_work_stream, dict):
            jira_work_stream = jira_work_stream.get('value')

        # Use embedded changelog (already fetched via expand='changelog')
        changelog = issue.get('changelog', {})
        histories = changelog.get('histories', [])
        comp_eng_hours = calculate_engineering_hours(histories)
        comp_tpd_bu, comp_work_stream = get_mapped_fields(issue)

        uses_computed_eng_hours = jira_eng_hours is None and comp_eng_hours is not None
        uses_computed_tpd_bu = not jira_tpd_bu and bool(comp_tpd_bu)
        uses_computed_work_stream = not jira_work_stream and bool(comp_work_stream)

        # Story points (configurable custom field or standard field)
        sp_field = config.field_ids.get("story_points")
        story_points = None
        if sp_field:
            story_points = fields.get(sp_field)
        # Fallback to standard JIRA story_points field
        if story_points is None:
            story_points = fields.get('story_points')
        if story_points is not None:
            try:
                story_points = float(story_points)
            except (ValueError, TypeError):
                story_points = None

        # Issue type and priority
        issue_type_obj = fields.get('issuetype')
        issue_type = issue_type_obj.get('name', 'Unknown') if issue_type_obj else 'Unknown'
        priority_obj = fields.get('priority')
        priority = priority_obj.get('name', 'Unknown') if priority_obj else 'Unknown'

        # Dates
        created = fields.get('created')
        resolved = fields.get('resolutiondate')

        ticket_cache[key] = {
            "key": key,
            "summary": summary,
            "status": status,
            "assignee": assignee,
            "eng_hours": jira_eng_hours if jira_eng_hours is not None else comp_eng_hours,
            "tpd_bu": jira_tpd_bu if jira_tpd_bu else comp_tpd_bu,
            "work_stream": jira_work_stream if jira_work_stream else comp_work_stream,
            "has_computed_values": uses_computed_eng_hours or uses_computed_tpd_bu or uses_computed_work_stream,
            "story_points": story_points,
            "issue_type": issue_type,
            "priority": priority,
            "created": created,
            "resolved": resolved,
            "base_url": config.jira_base_url,
            "updated": fields.get('updated')
        }
    except Exception as e:
        logger.exception(f"Error processing issue {issue.get('key')}")

def reprocess_cache():
    """Re-run process_issue on all cached raw issues (e.g. after rule changes)."""
    logger.info(f"Reprocessing {len(raw_issue_cache)} cached issues with updated rules...")
    for issue in raw_issue_cache.values():
        process_issue(issue, store_raw=False)
    logger.info("Reprocessing complete.")


def sync_tickets():
    logger.info(f"Starting sync for project: {config.project_key}")
    try:
        tf = config.ticket_filter
        months = tf.get("months", 6)
        # Cap at 12 months max; treat legacy "all" mode as 12 months
        if tf.get("mode") == "all" or months is None:
            months = 12
        months = min(int(months), 12)
        issues = jira_client.get_issues(config.project_key, months=months)
        logger.info(f"Fetched {len(issues)} issues from JIRA.")

        # Clear caches on full sync
        ticket_cache.clear()
        raw_issue_cache.clear()

        for issue in issues:
            process_issue(issue)

        logger.info(f"Sync complete. {len(ticket_cache)} tickets cached.")
        return len(issues)
    except Exception as e:
        logger.exception("Sync failed")
        return 0


BUG_TYPES = {"bug", "defect"}

PERIOD_DAYS = {
    "weekly": 7,
    "bi-weekly": 14,
    "monthly": 30,
}


def _parse_resolved(t):
    """Return a date object from the resolved field, or None."""
    r = t.get("resolved")
    if not r:
        return None
    try:
        return datetime.fromisoformat(r.replace("Z", "+00:00")).date()
    except Exception:
        return None


def _compute_metrics(tickets):
    """Compute KPIs from a list of tickets. Returns summary dict + breakdowns."""
    if not tickets:
        empty = {"total_tickets": 0, "total_story_points": 0, "total_eng_hours": 0,
                 "estimation_accuracy": None, "avg_eng_hours_per_sp": None,
                 "avg_cycle_time_hours": None, "bug_count": 0, "bug_ratio": 0, "bug_eng_hours_pct": 0}
        return empty, {}, {}, {}

    total_tickets = len(tickets)
    total_sp = sum(t.get("story_points") or 0 for t in tickets)
    total_eng_hours = sum(t.get("eng_hours") or 0 for t in tickets)

    paired = [t for t in tickets if t.get("story_points") and t.get("eng_hours")]
    paired_sp = sum(t["story_points"] for t in paired)
    paired_hours = sum(t["eng_hours"] for t in paired)
    hours_per_sp = config.sp_to_days * 8  # sp_to_days man-days * 8 hours/day
    estimation_accuracy = round((paired_sp * hours_per_sp) / paired_hours, 2) if paired_hours > 0 else None

    avg_hours_per_sp = round(total_eng_hours / total_sp, 1) if total_sp > 0 else None

    tickets_with_hours = [t for t in tickets if t.get("eng_hours")]
    avg_cycle_time = round(sum(t["eng_hours"] for t in tickets_with_hours) / len(tickets_with_hours), 1) if tickets_with_hours else None

    bugs = [t for t in tickets if (t.get("issue_type") or "").lower() in BUG_TYPES]
    bug_count = len(bugs)
    bug_eng_hours = sum(t.get("eng_hours") or 0 for t in bugs)

    summary = {
        "total_tickets": total_tickets,
        "total_story_points": round(total_sp, 1),
        "total_eng_hours": round(total_eng_hours, 1),
        "estimation_accuracy": estimation_accuracy,
        "avg_eng_hours_per_sp": avg_hours_per_sp,
        "avg_cycle_time_hours": avg_cycle_time,
        "bug_count": bug_count,
        "bug_ratio": round(bug_count / total_tickets, 2) if total_tickets > 0 else 0,
        "bug_eng_hours_pct": round(bug_eng_hours / total_eng_hours * 100, 1) if total_eng_hours > 0 else 0,
    }

    by_bu = defaultdict(lambda: {"tickets": 0, "story_points": 0, "eng_hours": 0})
    for t in tickets:
        bu = t.get("tpd_bu") or "Unassigned"
        by_bu[bu]["tickets"] += 1
        by_bu[bu]["story_points"] += t.get("story_points") or 0
        by_bu[bu]["eng_hours"] += t.get("eng_hours") or 0
    by_bu = {k: {"tickets": v["tickets"], "story_points": round(v["story_points"], 1), "eng_hours": round(v["eng_hours"], 1)} for k, v in by_bu.items()}

    by_ws = defaultdict(lambda: {"tickets": 0, "story_points": 0, "eng_hours": 0})
    for t in tickets:
        ws = t.get("work_stream") or "Unassigned"
        by_ws[ws]["tickets"] += 1
        by_ws[ws]["story_points"] += t.get("story_points") or 0
        by_ws[ws]["eng_hours"] += t.get("eng_hours") or 0
    by_ws = {k: {"tickets": v["tickets"], "story_points": round(v["story_points"], 1), "eng_hours": round(v["eng_hours"], 1)} for k, v in by_ws.items()}

    by_type = defaultdict(lambda: {"tickets": 0, "story_points": 0, "eng_hours": 0})
    for t in tickets:
        it = t.get("issue_type") or "Unknown"
        by_type[it]["tickets"] += 1
        by_type[it]["story_points"] += t.get("story_points") or 0
        by_type[it]["eng_hours"] += t.get("eng_hours") or 0
    by_type = {k: {"tickets": v["tickets"], "story_points": round(v["story_points"], 1), "eng_hours": round(v["eng_hours"], 1)} for k, v in by_type.items()}

    return summary, dict(by_bu), dict(by_ws), dict(by_type)


@router.get("/metrics/team")
async def get_team_metrics(period: str = "all"):
    """Compute team-level KPIs from the ticket cache.

    period: "all", "weekly", "bi-weekly", "monthly"
    Returns current period metrics + previous period metrics for trend comparison.
    """
    all_tickets = [t for t in ticket_cache.values() if t.get("status") in FINAL_STATUSES]

    if not all_tickets:
        return {"summary": {}, "prev_summary": {}, "by_business_unit": {}, "by_work_stream": {},
                "monthly_trend": [], "issue_type_breakdown": {}, "period": period}

    today = date.today()
    days = PERIOD_DAYS.get(period)

    if days:
        cutoff_current = today - timedelta(days=days)
        cutoff_prev = cutoff_current - timedelta(days=days)
        current_tickets = [t for t in all_tickets if (_parse_resolved(t) or date.min) >= cutoff_current]
        prev_tickets = [t for t in all_tickets if cutoff_prev <= (_parse_resolved(t) or date.min) < cutoff_current]
    else:
        # "all" — no time filter, no previous period
        current_tickets = all_tickets
        prev_tickets = []

    summary, by_bu, by_ws, by_type = _compute_metrics(current_tickets)
    prev_summary, prev_by_bu, prev_by_ws, prev_by_type = _compute_metrics(prev_tickets)

    # Monthly trend (always computed from all tickets for the line chart)
    monthly = defaultdict(lambda: {"tickets": 0, "story_points": 0, "eng_hours": 0, "bug_count": 0})
    for t in all_tickets:
        resolved = t.get("resolved")
        if not resolved:
            continue
        month_key = resolved[:7]
        monthly[month_key]["tickets"] += 1
        monthly[month_key]["story_points"] += t.get("story_points") or 0
        monthly[month_key]["eng_hours"] += t.get("eng_hours") or 0
        if (t.get("issue_type") or "").lower() in BUG_TYPES:
            monthly[month_key]["bug_count"] += 1

    monthly_trend = [
        {"month": k, "tickets": v["tickets"], "story_points": round(v["story_points"], 1),
         "eng_hours": round(v["eng_hours"], 1), "bug_count": v["bug_count"]}
        for k, v in sorted(monthly.items())
    ]

    return {
        "summary": summary,
        "prev_summary": prev_summary,
        "by_business_unit": by_bu,
        "prev_by_business_unit": prev_by_bu,
        "by_work_stream": by_ws,
        "prev_by_work_stream": prev_by_ws,
        "monthly_trend": monthly_trend,
        "issue_type_breakdown": by_type,
        "prev_issue_type_breakdown": prev_by_type,
        "period": period,
    }


def _compute_individual_summary(tickets):
    """Compute individual KPIs from a list of tickets for one engineer."""
    if not tickets:
        return {
            "total_tickets": 0, "total_story_points": 0, "total_eng_hours": 0,
            "avg_cycle_time_hours": None, "avg_eng_hours_per_sp": None,
            "estimation_accuracy": None, "bug_ratio": 0,
            "complexity_score": None, "focus_ratio": None,
        }

    total_tickets = len(tickets)
    total_sp = sum(t.get("story_points") or 0 for t in tickets)
    total_eng_hours = sum(t.get("eng_hours") or 0 for t in tickets)

    tickets_with_hours = [t for t in tickets if t.get("eng_hours")]
    avg_cycle_time = round(sum(t["eng_hours"] for t in tickets_with_hours) / len(tickets_with_hours), 1) if tickets_with_hours else None

    avg_hours_per_sp = round(total_eng_hours / total_sp, 1) if total_sp > 0 else None

    paired = [t for t in tickets if t.get("story_points") and t.get("eng_hours")]
    paired_sp = sum(t["story_points"] for t in paired)
    paired_hours = sum(t["eng_hours"] for t in paired)
    hours_per_sp = config.sp_to_days * 8
    estimation_accuracy = round((paired_sp * hours_per_sp) / paired_hours, 2) if paired_hours > 0 else None

    bugs = [t for t in tickets if (t.get("issue_type") or "").lower() in BUG_TYPES]
    bug_ratio = round(len(bugs) / total_tickets, 2) if total_tickets > 0 else 0

    tickets_with_sp = [t for t in tickets if t.get("story_points")]
    complexity_score = round(total_sp / len(tickets_with_sp), 1) if tickets_with_sp else None

    product_tickets = [t for t in tickets if (t.get("work_stream") or "").lower() == "product"]
    focus_ratio = round(len(product_tickets) / total_tickets, 2) if total_tickets > 0 else None

    return {
        "total_tickets": total_tickets,
        "total_story_points": round(total_sp, 1),
        "total_eng_hours": round(total_eng_hours, 1),
        "avg_cycle_time_hours": avg_cycle_time,
        "avg_eng_hours_per_sp": avg_hours_per_sp,
        "estimation_accuracy": estimation_accuracy,
        "bug_ratio": bug_ratio,
        "complexity_score": complexity_score,
        "focus_ratio": focus_ratio,
    }


@router.get("/metrics/individual")
async def get_individual_metrics(period: str = "all"):
    """Compute per-engineer KPIs for tracked engineers."""
    tracked = config.tracked_engineers
    if not tracked:
        return {"engineers": [], "team_averages": {}, "prev_team_averages": {}, "period": period}

    tracked_names = {e["displayName"] for e in tracked}

    all_tickets = [t for t in ticket_cache.values() if t.get("status") in FINAL_STATUSES]

    today = date.today()
    days = PERIOD_DAYS.get(period)

    if days:
        cutoff_current = today - timedelta(days=days)
        cutoff_prev = cutoff_current - timedelta(days=days)
        current_tickets = [t for t in all_tickets if (_parse_resolved(t) or date.min) >= cutoff_current]
        prev_tickets = [t for t in all_tickets if cutoff_prev <= (_parse_resolved(t) or date.min) < cutoff_current]
    else:
        current_tickets = all_tickets
        prev_tickets = []

    # Group by assignee
    by_assignee_current = defaultdict(list)
    for t in current_tickets:
        by_assignee_current[t.get("assignee", "Unassigned")].append(t)

    by_assignee_prev = defaultdict(list)
    for t in prev_tickets:
        by_assignee_prev[t.get("assignee", "Unassigned")].append(t)

    # Compute team averages (across all tracked engineers)
    tracked_current = [t for t in current_tickets if t.get("assignee") in tracked_names]
    tracked_prev = [t for t in prev_tickets if t.get("assignee") in tracked_names]
    team_avg = _compute_individual_summary(tracked_current)
    prev_team_avg = _compute_individual_summary(tracked_prev)

    # Per-engineer averages: divide totals by number of tracked engineers
    n = len(tracked)
    if n > 1:
        for key in ("total_tickets", "total_story_points", "total_eng_hours"):
            team_avg[key] = round(team_avg[key] / n, 1)
            prev_team_avg[key] = round(prev_team_avg[key] / n, 1)

    engineers = []
    for eng in tracked:
        name = eng["displayName"]
        current = _compute_individual_summary(by_assignee_current.get(name, []))
        prev = _compute_individual_summary(by_assignee_prev.get(name, []))
        engineers.append({
            "accountId": eng.get("accountId"),
            "displayName": name,
            "avatar": eng.get("avatar"),
            "metrics": current,
            "prev_metrics": prev,
        })

    return {
        "engineers": engineers,
        "team_averages": team_avg,
        "prev_team_averages": prev_team_avg,
        "period": period,
    }
