"""Tests for routes/tickets.py — process_issue, metrics, sync, endpoints."""

import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta, date
from fastapi.testclient import TestClient

from main import app
from config import config
from routes.tickets import (
    ticket_cache, raw_issue_cache, process_issue, reprocess_cache,
    sync_tickets, _compute_metrics, _compute_individual_summary,
    _parse_resolved, get_visible_ticket_count, FINAL_STATUSES,
)
from conftest import make_issue


client = TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# process_issue
# ---------------------------------------------------------------------------

class TestProcessIssue:

    def test_basic_processing(self):
        issue = make_issue("T-1", status="Done", assignee="Alice", eng_hours=5.0,
                           tpd_bu="B2C", work_stream="Product")
        process_issue(issue)
        assert "T-1" in ticket_cache
        t = ticket_cache["T-1"]
        assert t["key"] == "T-1"
        assert t["status"] == "Done"
        assert t["assignee"] == "Alice"
        assert t["eng_hours"] == 5.0
        assert t["tpd_bu"] == "B2C"
        assert t["work_stream"] == "Product"

    def test_stores_raw_issue(self):
        issue = make_issue("T-2")
        process_issue(issue, store_raw=True)
        assert "T-2" in raw_issue_cache

    def test_does_not_store_raw_when_disabled(self):
        issue = make_issue("T-3")
        process_issue(issue, store_raw=False)
        assert "T-3" not in raw_issue_cache

    def test_missing_assignee_defaults_to_unassigned(self):
        issue = make_issue("T-4")
        issue["fields"]["assignee"] = None
        process_issue(issue)
        assert ticket_cache["T-4"]["assignee"] == "Unassigned"

    def test_missing_status_defaults_to_unknown(self):
        issue = make_issue("T-5")
        issue["fields"]["status"] = None
        process_issue(issue)
        assert ticket_cache["T-5"]["status"] == "Unknown"

    def test_jira_values_take_precedence_over_computed(self):
        """JIRA custom field values should be used over computed values."""
        issue = make_issue("T-6", tpd_bu="JIRA-BU", eng_hours=10.0, work_stream="JIRA-WS")
        process_issue(issue)
        t = ticket_cache["T-6"]
        assert t["tpd_bu"] == "JIRA-BU"
        assert t["eng_hours"] == 10.0
        assert t["work_stream"] == "JIRA-WS"

    def test_computed_values_used_when_jira_empty(self):
        """When JIRA fields are empty, computed values from rules should be used."""
        issue = make_issue("T-7", parent_key="ACTIN-100", labels=["B2C"])
        config.mapping_rules = {
            "tpd_bu": {"B2C": [[{"field": "labels", "operator": "contains", "value": "B2C"}]]},
            "work_stream": {},
        }
        process_issue(issue)
        assert ticket_cache["T-7"]["tpd_bu"] == "B2C"

    def test_has_computed_values_flag_with_jira_values(self):
        """When JIRA custom fields are set, has_computed_values should be False."""
        issue = make_issue("T-8", tpd_bu="B2C", eng_hours=5.0, work_stream="Product")
        process_issue(issue)
        assert ticket_cache["T-8"]["has_computed_values"] is False

    def test_story_points_from_custom_field(self):
        issue = make_issue("T-9", story_points=5.0)
        process_issue(issue)
        assert ticket_cache["T-9"]["story_points"] == 5.0

    def test_story_points_invalid_value(self):
        issue = make_issue("T-10")
        sp_field = config.field_ids.get("story_points", "customfield_103")
        issue["fields"][sp_field] = "not-a-number"
        issue["fields"]["story_points"] = "not-a-number"
        process_issue(issue)
        assert ticket_cache["T-10"]["story_points"] is None

    def test_issue_type_and_priority(self):
        issue = make_issue("T-11", issue_type="Bug", priority="High")
        process_issue(issue)
        assert ticket_cache["T-11"]["issue_type"] == "Bug"
        assert ticket_cache["T-11"]["priority"] == "High"

    def test_missing_issuetype_defaults(self):
        issue = make_issue("T-12")
        issue["fields"]["issuetype"] = None
        process_issue(issue)
        assert ticket_cache["T-12"]["issue_type"] == "Unknown"

    def test_missing_priority_defaults(self):
        issue = make_issue("T-13")
        issue["fields"]["priority"] = None
        process_issue(issue)
        assert ticket_cache["T-13"]["priority"] == "Unknown"

    def test_dates_stored(self):
        now = datetime.now(timezone.utc).isoformat()
        issue = make_issue("T-14", resolved=now)
        issue["fields"]["created"] = now
        process_issue(issue)
        assert ticket_cache["T-14"]["created"] == now
        assert ticket_cache["T-14"]["resolved"] == now

    def test_base_url_stored(self):
        issue = make_issue("T-15")
        process_issue(issue)
        assert ticket_cache["T-15"]["base_url"] == config.jira_base_url

    def test_tpd_bu_dict_format(self):
        """JIRA may return tpd_bu as a dict instead of array."""
        issue = make_issue("T-16")
        tpd_field = config.field_ids.get("tpd_bu")
        issue["fields"][tpd_field] = {"value": "B2B"}
        process_issue(issue)
        assert ticket_cache["T-16"]["tpd_bu"] == "B2B"

    def test_work_stream_list_format(self):
        """JIRA may return work_stream as a list."""
        issue = make_issue("T-17")
        ws_field = config.field_ids.get("work_stream")
        issue["fields"][ws_field] = [{"value": "Ops"}]
        process_issue(issue)
        assert ticket_cache["T-17"]["work_stream"] == "Ops"

    def test_graceful_with_minimal_issue(self):
        """process_issue handles issues with missing nested fields gracefully."""
        issue = {"key": "T-MIN", "fields": {}, "changelog": {"histories": []}}
        process_issue(issue)
        assert ticket_cache["T-MIN"]["status"] == "Unknown"
        assert ticket_cache["T-MIN"]["assignee"] == "Unassigned"


class TestReprocessCache:

    def test_reprocesses_all_cached_issues(self):
        issues = [make_issue("T-1", status="Done"), make_issue("T-2", status="Done")]
        for issue in issues:
            process_issue(issue, store_raw=True)

        config.mapping_rules = {
            "tpd_bu": {"ReprocessedBU": [[{"field": "summary", "operator": "contains", "value": "Summary"}]]},
            "work_stream": {},
        }
        reprocess_cache()
        assert ticket_cache["T-1"]["tpd_bu"] == "ReprocessedBU"
        assert ticket_cache["T-2"]["tpd_bu"] == "ReprocessedBU"


class TestSyncTickets:

    def test_sync_clears_caches(self):
        ticket_cache["old"] = {"key": "old"}
        raw_issue_cache["old"] = {"key": "old"}

        with patch("routes.tickets.jira_client") as mock_jira:
            mock_jira.get_issues.return_value = []
            sync_tickets()

        assert len(ticket_cache) == 0
        assert len(raw_issue_cache) == 0

    def test_sync_returns_issue_count(self):
        with patch("routes.tickets.jira_client") as mock_jira:
            mock_jira.get_issues.return_value = [make_issue("T-1"), make_issue("T-2")]
            count = sync_tickets()

        assert count == 2

    def test_sync_caps_months_at_12(self):
        config.ticket_filter = {"mode": "last_x_months", "months": 24}
        with patch("routes.tickets.jira_client") as mock_jira:
            mock_jira.get_issues.return_value = []
            sync_tickets()
            mock_jira.get_issues.assert_called_once_with(config.project_key, months=12)

    def test_sync_mode_all_uses_12_months(self):
        config.ticket_filter = {"mode": "all", "months": 6}
        with patch("routes.tickets.jira_client") as mock_jira:
            mock_jira.get_issues.return_value = []
            sync_tickets()
            mock_jira.get_issues.assert_called_once_with(config.project_key, months=12)

    def test_sync_failure_returns_zero(self):
        with patch("routes.tickets.jira_client") as mock_jira:
            mock_jira.get_issues.side_effect = Exception("Connection error")
            count = sync_tickets()
        assert count == 0


# ---------------------------------------------------------------------------
# _parse_resolved
# ---------------------------------------------------------------------------

class TestParseResolved:

    def test_valid_iso_date(self):
        result = _parse_resolved({"resolved": "2026-01-15T10:00:00+00:00"})
        assert result == date(2026, 1, 15)

    def test_z_suffix(self):
        result = _parse_resolved({"resolved": "2026-01-15T10:00:00Z"})
        assert result == date(2026, 1, 15)

    def test_none_resolved(self):
        assert _parse_resolved({"resolved": None}) is None

    def test_missing_resolved(self):
        assert _parse_resolved({}) is None

    def test_invalid_format(self):
        assert _parse_resolved({"resolved": "not-a-date"}) is None


# ---------------------------------------------------------------------------
# _compute_metrics
# ---------------------------------------------------------------------------

class TestComputeMetrics:

    def test_empty_tickets(self):
        summary, by_bu, by_ws, by_type = _compute_metrics([])
        assert summary["total_tickets"] == 0
        assert summary["estimation_accuracy"] is None
        assert by_bu == {}

    def test_basic_metrics(self):
        tickets = [
            {"story_points": 3, "eng_hours": 8, "tpd_bu": "B2C", "work_stream": "Product",
             "issue_type": "Story"},
            {"story_points": 5, "eng_hours": 16, "tpd_bu": "B2B", "work_stream": "Ops",
             "issue_type": "Bug"},
        ]
        summary, by_bu, by_ws, by_type = _compute_metrics(tickets)
        assert summary["total_tickets"] == 2
        assert summary["total_story_points"] == 8.0
        assert summary["total_eng_hours"] == 24.0
        assert summary["bug_count"] == 1
        assert summary["bug_ratio"] == 0.5

    def test_estimation_accuracy(self):
        """estimation_accuracy = (paired_sp * sp_to_days * 8) / paired_hours."""
        config.sp_to_days = 1.0
        tickets = [
            {"story_points": 5, "eng_hours": 40, "tpd_bu": "B2C", "work_stream": "Product", "issue_type": "Story"},
        ]
        summary, _, _, _ = _compute_metrics(tickets)
        # (5 * 1 * 8) / 40 = 1.0
        assert summary["estimation_accuracy"] == 1.0

    def test_avg_cycle_time(self):
        tickets = [
            {"story_points": 3, "eng_hours": 10, "tpd_bu": "B2C", "work_stream": "P", "issue_type": "Story"},
            {"story_points": 2, "eng_hours": 6, "tpd_bu": "B2C", "work_stream": "P", "issue_type": "Story"},
        ]
        summary, _, _, _ = _compute_metrics(tickets)
        assert summary["avg_cycle_time_hours"] == 8.0  # (10+6)/2

    def test_avg_hours_per_sp(self):
        tickets = [
            {"story_points": 4, "eng_hours": 16, "tpd_bu": "B2C", "work_stream": "P", "issue_type": "Story"},
        ]
        summary, _, _, _ = _compute_metrics(tickets)
        assert summary["avg_eng_hours_per_sp"] == 4.0  # 16/4

    def test_breakdown_by_bu(self):
        tickets = [
            {"story_points": 3, "eng_hours": 8, "tpd_bu": "B2C", "work_stream": "P", "issue_type": "Story"},
            {"story_points": 2, "eng_hours": 4, "tpd_bu": "B2C", "work_stream": "P", "issue_type": "Story"},
            {"story_points": 5, "eng_hours": 10, "tpd_bu": "B2B", "work_stream": "P", "issue_type": "Story"},
        ]
        _, by_bu, _, _ = _compute_metrics(tickets)
        assert by_bu["B2C"]["tickets"] == 2
        assert by_bu["B2B"]["tickets"] == 1
        assert by_bu["B2C"]["eng_hours"] == 12.0

    def test_breakdown_by_work_stream(self):
        tickets = [
            {"story_points": 3, "eng_hours": 8, "tpd_bu": "B2C", "work_stream": "Product", "issue_type": "Story"},
            {"story_points": 2, "eng_hours": 4, "tpd_bu": "B2C", "work_stream": "Operational", "issue_type": "Story"},
        ]
        _, _, by_ws, _ = _compute_metrics(tickets)
        assert "Product" in by_ws
        assert "Operational" in by_ws

    def test_breakdown_by_issue_type(self):
        tickets = [
            {"story_points": 3, "eng_hours": 8, "tpd_bu": "B2C", "work_stream": "P", "issue_type": "Story"},
            {"story_points": 2, "eng_hours": 4, "tpd_bu": "B2C", "work_stream": "P", "issue_type": "Bug"},
        ]
        _, _, _, by_type = _compute_metrics(tickets)
        assert by_type["Story"]["tickets"] == 1
        assert by_type["Bug"]["tickets"] == 1

    def test_bug_eng_hours_pct(self):
        tickets = [
            {"story_points": 3, "eng_hours": 80, "tpd_bu": "B2C", "work_stream": "P", "issue_type": "Story"},
            {"story_points": 2, "eng_hours": 20, "tpd_bu": "B2C", "work_stream": "P", "issue_type": "Bug"},
        ]
        summary, _, _, _ = _compute_metrics(tickets)
        assert summary["bug_eng_hours_pct"] == 20.0  # 20/100 * 100

    def test_unassigned_bu(self):
        tickets = [
            {"story_points": 3, "eng_hours": 8, "tpd_bu": None, "work_stream": "P", "issue_type": "Story"},
        ]
        _, by_bu, _, _ = _compute_metrics(tickets)
        assert "Unassigned" in by_bu

    def test_defect_is_bug(self):
        tickets = [
            {"story_points": 3, "eng_hours": 8, "tpd_bu": "B2C", "work_stream": "P", "issue_type": "Defect"},
        ]
        summary, _, _, _ = _compute_metrics(tickets)
        assert summary["bug_count"] == 1

    def test_no_story_points(self):
        tickets = [
            {"story_points": None, "eng_hours": 8, "tpd_bu": "B2C", "work_stream": "P", "issue_type": "Story"},
        ]
        summary, _, _, _ = _compute_metrics(tickets)
        assert summary["avg_eng_hours_per_sp"] is None
        assert summary["estimation_accuracy"] is None

    def test_no_eng_hours(self):
        tickets = [
            {"story_points": 5, "eng_hours": None, "tpd_bu": "B2C", "work_stream": "P", "issue_type": "Story"},
        ]
        summary, _, _, _ = _compute_metrics(tickets)
        assert summary["avg_cycle_time_hours"] is None


# ---------------------------------------------------------------------------
# _compute_individual_summary
# ---------------------------------------------------------------------------

class TestComputeIndividualSummary:

    def test_empty_tickets(self):
        result = _compute_individual_summary([])
        assert result["total_tickets"] == 0
        assert result["avg_cycle_time_hours"] is None
        assert result["complexity_score"] is None
        assert result["focus_ratio"] is None

    def test_basic_individual_metrics(self):
        tickets = [
            {"story_points": 5, "eng_hours": 20, "issue_type": "Story", "work_stream": "Product"},
            {"story_points": 3, "eng_hours": 10, "issue_type": "Bug", "work_stream": "Operational"},
        ]
        result = _compute_individual_summary(tickets)
        assert result["total_tickets"] == 2
        assert result["total_story_points"] == 8.0
        assert result["total_eng_hours"] == 30.0
        assert result["avg_cycle_time_hours"] == 15.0  # (20+10)/2
        assert result["bug_ratio"] == 0.5

    def test_complexity_score(self):
        tickets = [
            {"story_points": 8, "eng_hours": 20, "issue_type": "Story", "work_stream": "Product"},
            {"story_points": 2, "eng_hours": 5, "issue_type": "Story", "work_stream": "Product"},
        ]
        result = _compute_individual_summary(tickets)
        assert result["complexity_score"] == 5.0  # (8+2)/2

    def test_focus_ratio(self):
        tickets = [
            {"story_points": 5, "eng_hours": 20, "issue_type": "Story", "work_stream": "Product"},
            {"story_points": 3, "eng_hours": 10, "issue_type": "Story", "work_stream": "Operational"},
            {"story_points": 2, "eng_hours": 5, "issue_type": "Story", "work_stream": "Product"},
        ]
        result = _compute_individual_summary(tickets)
        assert result["focus_ratio"] == 0.67  # 2/3

    def test_estimation_accuracy_individual(self):
        config.sp_to_days = 1.0
        tickets = [
            {"story_points": 5, "eng_hours": 40, "issue_type": "Story", "work_stream": "Product"},
        ]
        result = _compute_individual_summary(tickets)
        assert result["estimation_accuracy"] == 1.0

    def test_no_story_points_complexity_none(self):
        tickets = [
            {"story_points": None, "eng_hours": 10, "issue_type": "Story", "work_stream": "Product"},
        ]
        result = _compute_individual_summary(tickets)
        assert result["complexity_score"] is None


# ---------------------------------------------------------------------------
# get_visible_ticket_count
# ---------------------------------------------------------------------------

class TestGetVisibleTicketCount:

    def test_counts_final_status_only(self):
        for key, status in [("T-1", "Done"), ("T-2", "In Progress"), ("T-3", "Closed")]:
            ticket_cache[key] = {"key": key, "status": status, "tpd_bu": "B2C", "eng_hours": 5, "work_stream": "P"}
        config.ticket_filter = {"mode": "last_x_months", "months": 6}
        assert get_visible_ticket_count() == 2

    def test_missing_fields_mode(self):
        ticket_cache["T-1"] = {"key": "T-1", "status": "Done", "tpd_bu": "B2C", "eng_hours": 5, "work_stream": "P"}
        ticket_cache["T-2"] = {"key": "T-2", "status": "Done", "tpd_bu": None, "eng_hours": 5, "work_stream": "P"}
        config.ticket_filter = {"mode": "missing_fields"}
        assert get_visible_ticket_count() == 1  # only T-2


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

class TestGetTicketsEndpoint:

    def test_returns_final_statuses(self):
        for issue in [make_issue("T-1", "Done"), make_issue("T-2", "In Progress")]:
            process_issue(issue)
        resp = client.get("/tickets")
        assert resp.status_code == 200
        keys = {t["key"] for t in resp.json()}
        assert "T-1" in keys
        assert "T-2" not in keys


class TestUpdateTicketEndpoint:

    def test_update_ticket(self):
        process_issue(make_issue("T-1", status="Done", tpd_bu="B2C"))
        with patch("routes.tickets.jira_client") as mock_jira:
            resp = client.patch("/tickets/T-1", json={"tpd_bu": "B2B"})
        assert resp.status_code == 200
        assert ticket_cache["T-1"]["tpd_bu"] == "B2B"

    def test_update_eng_hours(self):
        process_issue(make_issue("T-2", status="Done"))
        with patch("routes.tickets.jira_client") as mock_jira:
            resp = client.patch("/tickets/T-2", json={"eng_hours": 12.5})
        assert resp.status_code == 200

    def test_update_nonexistent_key(self):
        with patch("routes.tickets.jira_client") as mock_jira:
            resp = client.patch("/tickets/NONEXIST", json={"tpd_bu": "B2C"})
        assert resp.status_code == 200  # returns None but no error

    def test_update_jira_failure(self):
        process_issue(make_issue("T-3", status="Done"))
        with patch("routes.tickets.jira_client") as mock_jira:
            mock_jira.update_issue_fields.side_effect = Exception("JIRA error")
            resp = client.patch("/tickets/T-3", json={"tpd_bu": "B2B"})
        assert resp.status_code == 500


class TestCalculateHoursEndpoint:

    def test_calculate_hours(self):
        with patch("routes.tickets.jira_client") as mock_jira:
            mock_jira.get_issue_changelog.return_value = {"histories": []}
            resp = client.get("/tickets/T-1/calculate")
        assert resp.status_code == 200
        assert "hours" in resp.json()

    def test_calculate_hours_error(self):
        with patch("routes.tickets.jira_client") as mock_jira:
            mock_jira.get_issue_changelog.side_effect = Exception("API error")
            resp = client.get("/tickets/T-1/calculate")
        assert resp.status_code == 500


class TestCalculateFieldsEndpoint:

    def test_calculate_fields(self):
        with patch("routes.tickets.jira_client") as mock_jira:
            mock_jira.jira.jql.return_value = {"issues": [make_issue("T-1")]}
            resp = client.get("/tickets/T-1/calculate-fields")
        assert resp.status_code == 200
        data = resp.json()
        assert "tpd_bu" in data
        assert "work_stream" in data

    def test_calculate_fields_not_found(self):
        with patch("routes.tickets.jira_client") as mock_jira:
            mock_jira.jira.jql.return_value = {"issues": []}
            resp = client.get("/tickets/T-1/calculate-fields")
        assert resp.status_code == 404

    def test_calculate_fields_error(self):
        with patch("routes.tickets.jira_client") as mock_jira:
            mock_jira.jira.jql.side_effect = Exception("API error")
            resp = client.get("/tickets/T-1/calculate-fields")
        assert resp.status_code == 500


class TestTeamMetricsEndpoint:

    def test_empty_cache(self):
        resp = client.get("/metrics/team")
        assert resp.status_code == 200
        data = resp.json()
        assert data["summary"] == {}
        assert data["period"] == "all"

    def test_all_period(self):
        now = datetime.now(timezone.utc).isoformat()
        for i in range(3):
            process_issue(make_issue(f"T-{i}", status="Done", eng_hours=10.0,
                                     story_points=3, resolved=now))
        resp = client.get("/metrics/team?period=all")
        data = resp.json()
        assert data["summary"]["total_tickets"] == 3
        assert data["period"] == "all"

    def test_weekly_period(self):
        now = datetime.now(timezone.utc).isoformat()
        process_issue(make_issue("T-1", status="Done", eng_hours=5.0, resolved=now))
        resp = client.get("/metrics/team?period=weekly")
        data = resp.json()
        assert data["period"] == "weekly"
        assert data["summary"]["total_tickets"] >= 0

    def test_monthly_trend(self):
        now = datetime.now(timezone.utc).isoformat()
        process_issue(make_issue("T-1", status="Done", eng_hours=5.0, resolved=now))
        resp = client.get("/metrics/team")
        data = resp.json()
        assert isinstance(data["monthly_trend"], list)


class TestIndividualMetricsEndpoint:

    def test_no_tracked_engineers(self):
        config.tracked_engineers = []
        resp = client.get("/metrics/individual")
        data = resp.json()
        assert data["engineers"] == []

    def test_with_tracked_engineers(self):
        config.tracked_engineers = [
            {"displayName": "Alice", "accountId": "a1"},
            {"displayName": "Bob", "accountId": "b1"},
        ]
        now = datetime.now(timezone.utc).isoformat()
        process_issue(make_issue("T-1", status="Done", assignee="Alice",
                                 eng_hours=10.0, story_points=3, resolved=now))
        process_issue(make_issue("T-2", status="Done", assignee="Bob",
                                 eng_hours=8.0, story_points=2, resolved=now))

        resp = client.get("/metrics/individual?period=all")
        data = resp.json()
        assert len(data["engineers"]) == 2
        names = {e["displayName"] for e in data["engineers"]}
        assert names == {"Alice", "Bob"}
        assert "team_averages" in data

    def test_period_filtering(self):
        config.tracked_engineers = [{"displayName": "Alice", "accountId": "a1"}]
        now = datetime.now(timezone.utc).isoformat()
        process_issue(make_issue("T-1", status="Done", assignee="Alice",
                                 eng_hours=10.0, resolved=now))

        resp = client.get("/metrics/individual?period=weekly")
        data = resp.json()
        assert data["period"] == "weekly"

    def test_team_averages_divided_by_n(self):
        config.tracked_engineers = [
            {"displayName": "Alice", "accountId": "a1"},
            {"displayName": "Bob", "accountId": "b1"},
        ]
        now = datetime.now(timezone.utc).isoformat()
        process_issue(make_issue("T-1", status="Done", assignee="Alice",
                                 eng_hours=20.0, story_points=5, resolved=now))
        process_issue(make_issue("T-2", status="Done", assignee="Bob",
                                 eng_hours=10.0, story_points=3, resolved=now))

        resp = client.get("/metrics/individual?period=all")
        data = resp.json()
        # With 2 engineers, totals should be divided by 2
        avg = data["team_averages"]
        assert avg["total_eng_hours"] == 15.0  # (20+10)/2


class TestSyncTicketEndpoint:

    def test_sync_single_ticket(self):
        with patch("routes.tickets.jira_client") as mock_jira:
            mock_jira.jira.jql.return_value = {"issues": [make_issue("T-1", status="Done")]}
            resp = client.post("/tickets/T-1/sync")
        assert resp.status_code == 200

    def test_sync_single_not_found(self):
        with patch("routes.tickets.jira_client") as mock_jira:
            mock_jira.jira.jql.return_value = {"issues": []}
            resp = client.post("/tickets/T-99/sync")
        assert resp.status_code == 500  # HTTPException wrapped

    def test_sync_single_error(self):
        with patch("routes.tickets.jira_client") as mock_jira:
            mock_jira.jira.jql.side_effect = Exception("API error")
            resp = client.post("/tickets/T-1/sync")
        assert resp.status_code == 500
