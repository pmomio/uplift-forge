"""Tests for routes/config.py — config endpoints, JIRA metadata endpoints."""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from main import app
from config import config
from routes.tickets import ticket_cache, raw_issue_cache, process_issue
from conftest import make_issue


client = TestClient(app, raise_server_exceptions=False)


class TestGetConfig:

    def test_returns_all_config_fields(self):
        resp = client.get("/config")
        assert resp.status_code == 200
        data = resp.json()
        assert "project_key" in data
        assert "office_hours" in data
        assert "mapping_rules" in data
        assert "field_ids" in data
        assert "eng_start_status" in data
        assert "eng_end_status" in data
        assert "eng_excluded_statuses" in data
        assert "ticket_filter" in data
        assert "sp_to_days" in data
        assert "tracked_engineers" in data

    def test_reflects_current_config(self):
        config.sp_to_days = 3.0
        resp = client.get("/config")
        assert resp.json()["sp_to_days"] == 3.0


class TestPostConfig:

    def test_update_sp_to_days(self):
        with patch("routes.config.sync_tickets", return_value=0):
            resp = client.post("/config", json={"sp_to_days": 2.5})
        assert resp.status_code == 200
        assert config.sp_to_days == 2.5

    def test_project_key_change_triggers_sync(self):
        original = config.project_key
        with patch("routes.config.sync_tickets", return_value=5) as mock_sync:
            resp = client.post("/config", json={"project_key": "NEWPROJ"})
        assert resp.status_code == 200
        assert resp.json()["sync_triggered"] is True
        mock_sync.assert_called_once()
        # Restore
        config.project_key = original
        config.data["jira"]["project_key"] = original

    def test_filter_change_triggers_sync(self):
        # Ensure current filter differs from what we're setting
        config.ticket_filter = {"mode": "last_x_months", "months": 6}
        with patch("routes.config.sync_tickets", return_value=0) as mock_sync:
            resp = client.post("/config", json={
                "ticket_filter": {"mode": "missing_fields", "months": 1}
            })
        assert resp.json()["sync_triggered"] is True
        mock_sync.assert_called_once()

    def test_rules_change_reprocesses_cache(self):
        # Seed some data
        process_issue(make_issue("T-1", status="Done"), store_raw=True)

        new_rules = {"tpd_bu": {"NewBU": [[{"field": "summary", "operator": "contains", "value": "Summary"}]]}, "work_stream": {}}
        with patch("routes.config.sync_tickets", return_value=0):
            resp = client.post("/config", json={"mapping_rules": new_rules})
        assert resp.status_code == 200
        assert resp.json()["sync_triggered"] is False
        assert ticket_cache["T-1"]["tpd_bu"] == "NewBU"

    def test_returns_ticket_count(self):
        process_issue(make_issue("T-1", status="Done", tpd_bu="B2C", eng_hours=5, work_stream="P"))
        with patch("routes.config.sync_tickets", return_value=0):
            resp = client.post("/config", json={"sp_to_days": 1.5})
        assert "ticket_count" in resp.json()

    def test_tracked_engineers_update(self):
        engineers = [{"displayName": "Charlie", "accountId": "c1"}]
        with patch("routes.config.sync_tickets", return_value=0):
            resp = client.post("/config", json={"tracked_engineers": engineers})
        assert resp.status_code == 200
        assert config.tracked_engineers == engineers


class TestTriggerSync:

    def test_sync_endpoint(self):
        with patch("routes.config.sync_tickets", return_value=10) as mock_sync:
            resp = client.post("/sync")
        assert resp.status_code == 200
        assert resp.json() == {"status": "success", "count": 10}


class TestGetJiraProject:

    def test_returns_project_info(self):
        with patch("routes.config.jira_client") as mock_jira:
            mock_jira.get_project.return_value = {
                "key": "PROJ",
                "name": "My Project",
                "lead": {"displayName": "Alice"},
                "avatarUrls": {"48x48": "https://avatar.png"},
            }
            resp = client.get("/jira/project")
        assert resp.status_code == 200
        data = resp.json()
        assert data["key"] == "PROJ"
        assert data["name"] == "My Project"
        assert data["lead"] == "Alice"
        assert data["avatar"] == "https://avatar.png"

    def test_handles_error(self):
        with patch("routes.config.jira_client") as mock_jira:
            mock_jira.get_project.side_effect = Exception("Connection error")
            resp = client.get("/jira/project")
        assert resp.status_code == 200
        assert "error" in resp.json()


class TestGetJiraMembers:

    def test_extracts_unique_assignees(self):
        raw_issue_cache["T-1"] = make_issue("T-1", assignee="Alice")
        raw_issue_cache["T-2"] = make_issue("T-2", assignee="Bob")
        raw_issue_cache["T-3"] = make_issue("T-3", assignee="Alice")  # duplicate

        resp = client.get("/jira/members")
        assert resp.status_code == 200
        members = resp.json()
        names = {m["displayName"] for m in members}
        assert names == {"Alice", "Bob"}

    def test_skips_null_assignees(self):
        issue = make_issue("T-1")
        issue["fields"]["assignee"] = None
        raw_issue_cache["T-1"] = issue

        resp = client.get("/jira/members")
        assert resp.json() == []

    def test_sorted_by_name(self):
        raw_issue_cache["T-1"] = make_issue("T-1", assignee="Charlie")
        raw_issue_cache["T-2"] = make_issue("T-2", assignee="Alice")
        raw_issue_cache["T-3"] = make_issue("T-3", assignee="Bob")

        resp = client.get("/jira/members")
        names = [m["displayName"] for m in resp.json()]
        assert names == ["Alice", "Bob", "Charlie"]


class TestGetJiraStatuses:

    def test_returns_unique_statuses(self):
        with patch("routes.config.jira_client") as mock_jira:
            mock_jira.get_all_statuses.return_value = [
                {"id": "1", "name": "Open"},
                {"id": "2", "name": "Done"},
                {"id": "3", "name": "Open"},  # duplicate
            ]
            resp = client.get("/jira/statuses")
        assert resp.status_code == 200
        names = [s["name"] for s in resp.json()]
        assert sorted(names) == ["Done", "Open"]

    def test_handles_error(self):
        with patch("routes.config.jira_client") as mock_jira:
            mock_jira.get_all_statuses.side_effect = Exception("API error")
            resp = client.get("/jira/statuses")
        assert resp.status_code == 200
        assert "error" in resp.json()


class TestGetJiraFields:

    def test_returns_field_list(self):
        with patch("routes.config.jira_client") as mock_jira:
            mock_jira.get_all_fields.return_value = [
                {"id": "summary", "name": "Summary", "schema": {"type": "string"}},
                {"id": "customfield_123", "name": "Custom", "schema": {"type": "option"}},
            ]
            resp = client.get("/jira/fields")
        assert resp.status_code == 200
        fields = resp.json()
        assert len(fields) == 2
        assert fields[0]["id"] == "summary"
        assert fields[0]["type"] == "string"

    def test_handles_missing_schema(self):
        with patch("routes.config.jira_client") as mock_jira:
            mock_jira.get_all_fields.return_value = [
                {"id": "f1", "name": "Field1"},
            ]
            resp = client.get("/jira/fields")
        assert resp.json()[0]["type"] == "unknown"

    def test_handles_error(self):
        with patch("routes.config.jira_client") as mock_jira:
            mock_jira.get_all_fields.side_effect = Exception("API error")
            resp = client.get("/jira/fields")
        assert resp.status_code == 200
        assert "error" in resp.json()
