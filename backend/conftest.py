"""Shared fixtures for backend tests."""

import pytest
import copy
import yaml
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from main import app
from config import config
from routes.tickets import ticket_cache, raw_issue_cache


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def clean_state():
    """Reset caches, config, and config.yaml before/after each test."""
    # Save config.yaml contents
    with open(config.config_path, "r") as f:
        original_yaml = f.read()

    # Save in-memory config state
    original_data = copy.deepcopy(config.data)
    original_filter = copy.deepcopy(config.ticket_filter)
    original_rules = copy.deepcopy(config.mapping_rules)
    original_tracked = copy.deepcopy(config.tracked_engineers)
    original_sp = config.sp_to_days
    original_project = config.project_key
    original_eng_start = config.eng_start_status
    original_eng_end = config.eng_end_status
    original_eng_excluded = copy.deepcopy(config.eng_excluded_statuses)
    original_field_ids = copy.deepcopy(config.field_ids)

    ticket_cache.clear()
    raw_issue_cache.clear()

    yield

    # Restore config.yaml
    with open(config.config_path, "w") as f:
        f.write(original_yaml)

    # Restore in-memory config
    config.data = original_data
    config.ticket_filter = original_filter
    config.mapping_rules = original_rules
    config.tracked_engineers = original_tracked
    config.sp_to_days = original_sp
    config.project_key = original_project
    config.eng_start_status = original_eng_start
    config.eng_end_status = original_eng_end
    config.eng_excluded_statuses = original_eng_excluded
    config.field_ids = original_field_ids

    ticket_cache.clear()
    raw_issue_cache.clear()


def make_issue(key, status="Done", updated=None, tpd_bu=None, eng_hours=None,
               work_stream=None, assignee="Test User", story_points=None,
               issue_type="Story", priority="Medium", resolved=None,
               parent_key=None, labels=None, components=None, summary=None):
    """Build a minimal JIRA issue dict that process_issue() can consume."""
    now = updated or datetime.now(timezone.utc).isoformat()
    tpd_field = config.field_ids.get("tpd_bu", "customfield_100")
    eng_field = config.field_ids.get("eng_hours", "customfield_101")
    ws_field = config.field_ids.get("work_stream", "customfield_102")
    sp_field = config.field_ids.get("story_points", "customfield_103")

    fields = {
        "summary": summary or f"Summary for {key}",
        "status": {"name": status},
        "assignee": {"displayName": assignee, "accountId": f"acc-{assignee.lower().replace(' ', '-')}",
                     "avatarUrls": {"48x48": f"https://avatar/{assignee}"}, "active": True},
        "updated": now,
        "created": now,
        "resolutiondate": resolved,
        "issuetype": {"name": issue_type},
        "priority": {"name": priority},
        "labels": labels or [],
        "components": [{"name": c} for c in (components or [])],
        tpd_field: [{"value": tpd_bu}] if tpd_bu else None,
        eng_field: eng_hours,
        ws_field: {"value": work_stream} if work_stream else None,
        sp_field: story_points,
        "story_points": story_points,
    }

    if parent_key:
        fields["parent"] = {"key": parent_key, "fields": {"summary": f"Parent {parent_key}"}}

    return {
        "key": key,
        "fields": fields,
        "changelog": {"histories": []},
    }
