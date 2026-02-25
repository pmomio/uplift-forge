import logging
from fastapi import APIRouter, HTTPException
from jira_client import jira_client
from field_engine import calculate_engineering_hours, get_mapped_fields
from config import config

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory cache for v1
ticket_cache = {}

@router.get("/tickets")
async def get_tickets():
    final_statuses = ["Done", "Rejected", "Closed", "Resolved", "Cancelled"]
    filtered = [t for t in ticket_cache.values() if t.get("status") in final_statuses]
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

def process_issue(issue):
    try:
        key = issue['key']
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

        ticket_cache[key] = {
            "key": key,
            "summary": summary,
            "status": status,
            "assignee": assignee,
            "eng_hours": jira_eng_hours if jira_eng_hours is not None else comp_eng_hours,
            "tpd_bu": jira_tpd_bu if jira_tpd_bu else comp_tpd_bu,
            "work_stream": jira_work_stream if jira_work_stream else comp_work_stream,
            "has_computed_values": uses_computed_eng_hours or uses_computed_tpd_bu or uses_computed_work_stream,
            "base_url": config.jira_base_url,
            "updated": fields.get('updated')
        }
    except Exception as e:
        logger.exception(f"Error processing issue {issue.get('key')}")

def sync_tickets():
    logger.info(f"Starting sync for project: {config.project_key}")
    try:
        issues = jira_client.get_issues(config.project_key)
        logger.info(f"Fetched {len(issues)} issues from JIRA.")
        
        # Clear cache on full sync
        ticket_cache.clear()
        
        for issue in issues:
            process_issue(issue)
        
        logger.info(f"Sync complete. {len(ticket_cache)} tickets cached.")
        return len(issues)
    except Exception as e:
        logger.exception("Sync failed")
        return 0
