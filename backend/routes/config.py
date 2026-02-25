import logging
from fastapi import APIRouter
from config import config as app_config
from routes.tickets import sync_tickets, get_visible_ticket_count
from jira_client import jira_client

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/config")
async def get_config():
    return {
        "project_key": app_config.project_key,
        "office_hours": app_config.office_hours,
        "mapping_rules": app_config.mapping_rules,
        "sync_config": app_config.sync_config,
        "field_ids": app_config.field_ids,
        "eng_start_status": app_config.eng_start_status,
        "eng_end_status": app_config.eng_end_status,
        "eng_excluded_statuses": app_config.eng_excluded_statuses,
        "ticket_filter": app_config.ticket_filter
    }

@router.get("/jira/statuses")
async def get_jira_statuses():
    try:
        all_statuses = jira_client.get_all_statuses()
        seen = set()
        statuses = []
        for status in all_statuses:
            name = status.get("name")
            if name and name not in seen:
                seen.add(name)
                statuses.append({"id": status.get("id"), "name": name})
        statuses.sort(key=lambda s: s["name"])
        return statuses
    except Exception as e:
        return {"error": str(e)}

@router.get("/jira/fields")
async def get_jira_fields():
    try:
        fields = jira_client.get_all_fields()
        return [{"id": f["id"], "name": f["name"], "type": f.get("schema", {}).get("type", "unknown")} for f in fields]
    except Exception as e:
        return {"error": str(e)}

@router.post("/sync")
async def trigger_sync():
    count = sync_tickets()
    return {"status": "success", "count": count}

@router.post("/config")
async def update_config_route(payload: dict):
    new_project_key = payload.get("project_key")
    field_ids = payload.get("field_ids")
    eng_start = payload.get("eng_start_status")
    eng_end = payload.get("eng_end_status")
    eng_excluded_statuses = payload.get("eng_excluded_statuses")
    ticket_filter = payload.get("ticket_filter")
    mapping_rules = payload.get("mapping_rules")

    project_key_changed = new_project_key and new_project_key != app_config.project_key
    filter_changed = ticket_filter is not None and ticket_filter != app_config.ticket_filter
    rules_changed = mapping_rules is not None and mapping_rules != app_config.mapping_rules

    app_config.update_config(
        project_key=new_project_key,
        field_ids=field_ids,
        eng_start=eng_start,
        eng_end=eng_end,
        eng_excluded_statuses=eng_excluded_statuses,
        ticket_filter=ticket_filter,
        mapping_rules=mapping_rules
    )

    needs_sync = project_key_changed or filter_changed
    if needs_sync:
        reason = "project key" if project_key_changed else "ticket filter"
        logger.info(f"Config changed ({reason}), triggering sync...")
        sync_tickets()

    # If rules changed, re-process cached tickets with new rules (no JIRA fetch needed)
    if rules_changed and not needs_sync:
        from routes.tickets import reprocess_cache
        reprocess_cache()

    visible = get_visible_ticket_count()
    return {"status": "success", "sync_triggered": needs_sync, "ticket_count": visible}
