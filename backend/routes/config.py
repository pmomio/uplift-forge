import logging
from fastapi import APIRouter
from config import config as app_config
from routes.tickets import sync_tickets
from jira_client import jira_client

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/config")
async def get_config():
    return {
        "project_key": app_config.project_key,
        "office_hours": app_config.office_hours,
        "tpd_mapping": app_config.data.get("tpd_business_unit_mapping", {}),
        "work_stream_mapping": app_config.data.get("work_stream_mapping", {}),
        "sync_config": app_config.sync_config,
        "field_ids": app_config.field_ids,
        "eng_start_status": app_config.eng_start_status,
        "eng_end_status": app_config.eng_end_status
    }

@router.get("/jira/statuses")
async def get_jira_statuses():
    try:
        all_statuses = jira_client.get_all_statuses()
        # Deduplicate by name and sort alphabetically
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
        # Return simplified field objects (id, name, type)
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
    tpd_mapping = payload.get("tpd_mapping")
    work_stream_mapping = payload.get("work_stream_mapping")
    field_ids = payload.get("field_ids")
    eng_start = payload.get("eng_start_status")
    eng_end = payload.get("eng_end_status")
    
    # Check if project key changed
    project_key_changed = new_project_key and new_project_key != app_config.project_key

    app_config.update_config(
        project_key=new_project_key,
        tpd_mapping=tpd_mapping,
        work_stream_mapping=work_stream_mapping,
        field_ids=field_ids,
        eng_start=eng_start,
        eng_end=eng_end
    )

    if project_key_changed:
        logger.info(f"Project key changed to {new_project_key}, triggering sync...")
        count = sync_tickets()
        logger.info(f"Sync triggered from config change, fetched {count} tickets.")

    return {"status": "success", "sync_triggered": project_key_changed}
