"""
Integration tests for the ticket filter feature.

Tests all three filter modes (all, last_x_months, missing_fields)
end-to-end through the FastAPI app with mocked JIRA calls.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from datetime import datetime, timezone, timedelta
import copy
import yaml

from main import app
from config import config
from routes.tickets import ticket_cache


client = TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _clean_state():
    """Reset ticket cache and config filter before each test."""
    original_filter = copy.deepcopy(config.ticket_filter)
    ticket_cache.clear()
    yield
    config.ticket_filter = original_filter
    ticket_cache.clear()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_issue(key, status="Done", updated=None, tpd_bu=None, eng_hours=None, work_stream=None):
    """Build a minimal JIRA issue dict that process_issue() can consume."""
    now = updated or datetime.now(timezone.utc).isoformat()
    tpd_field = config.field_ids.get("tpd_bu", "customfield_100")
    eng_field = config.field_ids.get("eng_hours", "customfield_101")
    ws_field = config.field_ids.get("work_stream", "customfield_102")
    fields = {
        "summary": f"Summary for {key}",
        "status": {"name": status},
        "assignee": {"displayName": "Test User"},
        "updated": now,
        tpd_field: [{"value": tpd_bu}] if tpd_bu else None,
        eng_field: eng_hours,
        ws_field: {"value": work_stream} if work_stream else None,
    }
    return {
        "key": key,
        "fields": fields,
        "changelog": {"histories": []},
    }


def _sync_with_issues(issues):
    """Mock jira_client.get_issues to return `issues`, then POST /sync."""
    with patch("routes.tickets.jira_client") as mock_jira:
        mock_jira.get_issues.return_value = issues
        resp = client.post("/sync")
        assert resp.status_code == 200
        return resp.json(), mock_jira


# ---------------------------------------------------------------------------
# Sample data
# ---------------------------------------------------------------------------

RECENT = datetime.now(timezone.utc).isoformat()
OLD = (datetime.now(timezone.utc) - timedelta(days=180)).isoformat()


# ---------------------------------------------------------------------------
# Tests: JQL construction
# ---------------------------------------------------------------------------

class TestJqlConstruction:
    """Verify that JiraClient.get_issues builds the correct JQL string."""

    def test_jql_without_months_filter(self):
        from jira_client import JiraClient
        jc = JiraClient()
        mock = MagicMock()
        mock.enhanced_jql.return_value = {"issues": [], "isLast": True}
        jc._client = mock

        jc.get_issues("PROJ")

        jql = mock.enhanced_jql.call_args[0][0]
        assert jql == 'project = "PROJ" ORDER BY updated DESC'

    def test_jql_with_months_filter_uses_absolute_date(self):
        from jira_client import JiraClient
        import re
        jc = JiraClient()
        mock = MagicMock()
        mock.enhanced_jql.return_value = {"issues": [], "isLast": True}
        jc._client = mock

        jc.get_issues("PROJ", months=3)

        jql = mock.enhanced_jql.call_args[0][0]
        # Should contain an absolute date like resolved >= "2025-11-25"
        assert re.search(r'resolved >= "\d{4}-\d{2}-\d{2}"', jql), f"Expected absolute date in JQL: {jql}"
        assert 'ORDER BY updated DESC' in jql

    def test_jql_months_uses_quoted_absolute_date(self):
        """Absolute dates must be quoted in JQL (unlike relative dates)."""
        from jira_client import JiraClient
        import re
        for m in [1, 3, 6, 12]:
            jc = JiraClient()
            mock = MagicMock()
            mock.enhanced_jql.return_value = {"issues": [], "isLast": True}
            jc._client = mock

            jc.get_issues("TEST", months=m)

            jql = mock.enhanced_jql.call_args[0][0]
            assert re.search(r'resolved >= "\d{4}-\d{2}-\d{2}"', jql), f"months={m}: expected absolute date in JQL: {jql}"

    def test_jql_months_date_is_correct(self):
        """The computed cutoff date should be approximately X months ago."""
        from jira_client import JiraClient
        jc = JiraClient()
        mock = MagicMock()
        mock.enhanced_jql.return_value = {"issues": [], "isLast": True}
        jc._client = mock

        jc.get_issues("PROJ", months=1)

        jql = mock.enhanced_jql.call_args[0][0]
        import re
        match = re.search(r'resolved >= "(\d{4}-\d{2}-\d{2})"', jql)
        assert match, f"No date found in JQL: {jql}"
        cutoff = datetime.strptime(match.group(1), "%Y-%m-%d")
        now = datetime.now()
        diff_days = (now - cutoff).days
        # Should be roughly 28-31 days ago for months=1
        assert 25 <= diff_days <= 35, f"Expected ~30 days ago, got {diff_days} days"

    def test_jql_months_none_no_date_clause(self):
        from jira_client import JiraClient
        jc = JiraClient()
        mock = MagicMock()
        mock.enhanced_jql.return_value = {"issues": [], "isLast": True}
        jc._client = mock

        jc.get_issues("PROJ", months=None)

        jql = mock.enhanced_jql.call_args[0][0]
        assert "resolved >=" not in jql

    def test_jql_months_zero_no_date_clause(self):
        """months=0 is falsy, should behave like None."""
        from jira_client import JiraClient
        jc = JiraClient()
        mock = MagicMock()
        mock.enhanced_jql.return_value = {"issues": [], "isLast": True}
        jc._client = mock

        jc.get_issues("PROJ", months=0)

        jql = mock.enhanced_jql.call_args[0][0]
        assert "resolved >=" not in jql


# ---------------------------------------------------------------------------
# Tests: sync_tickets passes correct months to get_issues
# ---------------------------------------------------------------------------

class TestSyncTicketsFilter:
    """Verify sync_tickets() reads ticket_filter from config and passes
    the correct months value to jira_client.get_issues()."""

    def test_sync_mode_all_passes_no_months(self):
        config.ticket_filter = {"mode": "all", "months": 3}

        with patch("routes.tickets.jira_client") as mock_jira:
            mock_jira.get_issues.return_value = []
            client.post("/sync")
            mock_jira.get_issues.assert_called_once_with(config.project_key, months=None)

    def test_sync_mode_last_x_months_passes_months_3(self):
        config.ticket_filter = {"mode": "last_x_months", "months": 3}

        with patch("routes.tickets.jira_client") as mock_jira:
            mock_jira.get_issues.return_value = []
            client.post("/sync")
            mock_jira.get_issues.assert_called_once_with(config.project_key, months=3)

    def test_sync_mode_last_x_months_passes_months_6(self):
        config.ticket_filter = {"mode": "last_x_months", "months": 6}

        with patch("routes.tickets.jira_client") as mock_jira:
            mock_jira.get_issues.return_value = []
            client.post("/sync")
            mock_jira.get_issues.assert_called_once_with(config.project_key, months=6)

    def test_sync_mode_last_x_months_passes_months_12(self):
        config.ticket_filter = {"mode": "last_x_months", "months": 12}

        with patch("routes.tickets.jira_client") as mock_jira:
            mock_jira.get_issues.return_value = []
            client.post("/sync")
            mock_jira.get_issues.assert_called_once_with(config.project_key, months=12)

    def test_sync_mode_missing_fields_passes_no_months(self):
        config.ticket_filter = {"mode": "missing_fields", "months": 3}

        with patch("routes.tickets.jira_client") as mock_jira:
            mock_jira.get_issues.return_value = []
            client.post("/sync")
            mock_jira.get_issues.assert_called_once_with(config.project_key, months=None)


# ---------------------------------------------------------------------------
# Tests: GET /tickets filtering
# ---------------------------------------------------------------------------

class TestGetTicketsFilter:
    """Verify GET /tickets returns the right set of tickets for each mode."""

    def _seed_all(self):
        """Populate cache with a mix of tickets."""
        issues = [
            _make_issue("T-1", "Done", RECENT, tpd_bu="B2C", eng_hours=4.0, work_stream="Product"),
            _make_issue("T-2", "Done", RECENT, tpd_bu="B2B", eng_hours=2.0, work_stream=None),
            _make_issue("T-3", "Closed", OLD, tpd_bu=None, eng_hours=None, work_stream=None),
            _make_issue("T-4", "Done", RECENT, tpd_bu="B2C", eng_hours=None, work_stream="Operational"),
            _make_issue("T-5", "Rejected", RECENT, tpd_bu="B2B", eng_hours=3.0, work_stream="Product"),
            _make_issue("T-6", "In Progress", RECENT, tpd_bu="B2C", eng_hours=1.0, work_stream="Product"),
        ]
        _sync_with_issues(issues)

    def test_mode_all_returns_all_final_status_tickets(self):
        config.ticket_filter = {"mode": "all", "months": 3}
        self._seed_all()

        resp = client.get("/tickets")
        keys = {t["key"] for t in resp.json()}

        assert resp.status_code == 200
        assert keys == {"T-1", "T-2", "T-3", "T-4", "T-5"}
        assert "T-6" not in keys  # In Progress is not final

    def test_mode_all_excludes_non_final_statuses(self):
        config.ticket_filter = {"mode": "all", "months": 3}
        issues = [
            _make_issue("T-1", "In Progress"),
            _make_issue("T-2", "Open"),
            _make_issue("T-3", "Blocked"),
            _make_issue("T-4", "Done"),
        ]
        _sync_with_issues(issues)

        resp = client.get("/tickets")
        keys = {t["key"] for t in resp.json()}
        assert keys == {"T-4"}

    def test_mode_missing_fields_returns_only_incomplete_tickets(self):
        config.ticket_filter = {"mode": "missing_fields", "months": 3}
        self._seed_all()

        resp = client.get("/tickets")
        keys = {t["key"] for t in resp.json()}

        # T-1: all fields set → excluded
        assert "T-1" not in keys
        # T-5: all fields set → excluded
        assert "T-5" not in keys
        # T-2: missing work_stream → included
        assert "T-2" in keys
        # T-3: missing tpd_bu, eng_hours, work_stream → included
        assert "T-3" in keys
        # T-4: missing eng_hours → included
        assert "T-4" in keys
        # T-6: non-final → always excluded
        assert "T-6" not in keys

    def test_mode_missing_fields_with_all_complete(self):
        config.ticket_filter = {"mode": "missing_fields", "months": 3}
        issues = [
            _make_issue("T-1", "Done", tpd_bu="B2C", eng_hours=1.0, work_stream="Product"),
            _make_issue("T-2", "Closed", tpd_bu="B2B", eng_hours=2.0, work_stream="Operational"),
        ]
        _sync_with_issues(issues)

        resp = client.get("/tickets")
        assert resp.status_code == 200
        assert len(resp.json()) == 0

    def test_mode_last_x_months_filters_at_jql_level(self):
        """last_x_months limits what is fetched. The cache should only contain
        what the mocked JIRA returned (recent issues)."""
        config.ticket_filter = {"mode": "last_x_months", "months": 3}

        recent_only = [
            _make_issue("T-1", "Done", RECENT, tpd_bu="B2C", eng_hours=4.0, work_stream="Product"),
            _make_issue("T-2", "Done", RECENT, tpd_bu="B2B", eng_hours=2.0, work_stream=None),
        ]
        _sync_with_issues(recent_only)

        resp = client.get("/tickets")
        keys = {t["key"] for t in resp.json()}
        assert keys == {"T-1", "T-2"}

    def test_empty_cache_returns_empty_list(self):
        config.ticket_filter = {"mode": "all", "months": 3}
        _sync_with_issues([])

        resp = client.get("/tickets")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_tickets_sorted_by_updated_desc(self):
        config.ticket_filter = {"mode": "all", "months": 3}
        old = "2025-01-01T00:00:00+00:00"
        mid = "2025-06-15T00:00:00+00:00"
        new = "2026-01-01T00:00:00+00:00"
        issues = [
            _make_issue("T-OLD", "Done", old),
            _make_issue("T-NEW", "Done", new),
            _make_issue("T-MID", "Done", mid),
        ]
        _sync_with_issues(issues)

        resp = client.get("/tickets")
        keys = [t["key"] for t in resp.json()]
        assert keys == ["T-NEW", "T-MID", "T-OLD"]


# ---------------------------------------------------------------------------
# Tests: missing_fields edge cases
# ---------------------------------------------------------------------------

class TestMissingFieldsEdgeCases:

    def test_missing_only_eng_hours(self):
        config.ticket_filter = {"mode": "missing_fields", "months": 3}
        _sync_with_issues([_make_issue("T-1", "Done", tpd_bu="B2C", eng_hours=None, work_stream="Product")])

        resp = client.get("/tickets")
        assert len(resp.json()) == 1
        assert resp.json()[0]["key"] == "T-1"

    def test_missing_only_tpd_bu(self):
        config.ticket_filter = {"mode": "missing_fields", "months": 3}
        _sync_with_issues([_make_issue("T-1", "Done", tpd_bu=None, eng_hours=5.0, work_stream="Product")])

        resp = client.get("/tickets")
        assert len(resp.json()) == 1

    def test_missing_only_work_stream(self):
        config.ticket_filter = {"mode": "missing_fields", "months": 3}
        _sync_with_issues([_make_issue("T-1", "Done", tpd_bu="B2C", eng_hours=5.0, work_stream=None)])

        resp = client.get("/tickets")
        assert len(resp.json()) == 1

    def test_all_three_missing(self):
        config.ticket_filter = {"mode": "missing_fields", "months": 3}
        _sync_with_issues([_make_issue("T-1", "Done", tpd_bu=None, eng_hours=None, work_stream=None)])

        resp = client.get("/tickets")
        assert len(resp.json()) == 1

    def test_no_missing_returns_empty(self):
        config.ticket_filter = {"mode": "missing_fields", "months": 3}
        _sync_with_issues([_make_issue("T-1", "Done", tpd_bu="X", eng_hours=1.0, work_stream="Y")])

        resp = client.get("/tickets")
        assert len(resp.json()) == 0


# ---------------------------------------------------------------------------
# Tests: config endpoint includes ticket_filter
# ---------------------------------------------------------------------------

class TestConfigEndpoint:

    def test_get_config_returns_ticket_filter(self):
        config.ticket_filter = {"mode": "last_x_months", "months": 6}

        resp = client.get("/config")
        assert resp.status_code == 200
        assert resp.json()["ticket_filter"] == {"mode": "last_x_months", "months": 6}

    def test_get_config_returns_current_filter_after_mutation(self):
        config.ticket_filter = {"mode": "missing_fields", "months": 1}

        resp = client.get("/config")
        assert resp.json()["ticket_filter"]["mode"] == "missing_fields"

    def test_post_config_with_filter_triggers_sync(self):
        config.ticket_filter = {"mode": "all", "months": 3}

        with patch("routes.config.sync_tickets", return_value=0) as mock_sync:
            resp = client.post("/config", json={
                "ticket_filter": {"mode": "last_x_months", "months": 6}
            })

        assert resp.status_code == 200
        assert resp.json()["sync_triggered"] is True
        mock_sync.assert_called_once()
        assert config.ticket_filter == {"mode": "last_x_months", "months": 6}

    def test_post_config_same_filter_no_sync(self):
        config.ticket_filter = {"mode": "all", "months": 3}

        with patch("routes.config.sync_tickets", return_value=0) as mock_sync:
            resp = client.post("/config", json={
                "ticket_filter": {"mode": "all", "months": 3}
            })

        assert resp.json()["sync_triggered"] is False
        mock_sync.assert_not_called()

    def test_post_config_only_months_change_triggers_sync(self):
        config.ticket_filter = {"mode": "last_x_months", "months": 3}

        with patch("routes.config.sync_tickets", return_value=0) as mock_sync:
            resp = client.post("/config", json={
                "ticket_filter": {"mode": "last_x_months", "months": 6}
            })

        assert resp.json()["sync_triggered"] is True
        mock_sync.assert_called_once()


# ---------------------------------------------------------------------------
# Tests: field engine rule evaluation (AND/OR logic)
# ---------------------------------------------------------------------------

class TestFieldEngineRules:
    """Verify _match_first_group handles both old flat and new AND-block formats."""

    def _ctx(self, **overrides):
        base = {
            'parent_key': 'ACTIN-100',
            'parent_summary': 'Support Requests',
            'labels': ['B2C', 'ACTINOPS'],
            'components': ['backend'],
            'summary': 'Fix login bug',
            'issue_type': 'Bug',
            'priority': 'High',
            'assignee': 'Alice',
        }
        base.update(overrides)
        return base

    def test_new_format_and_block_all_match(self):
        from field_engine import _match_first_group
        groups = {
            "B2C": [
                [
                    {"field": "parent_key", "operator": "equals", "value": "ACTIN-100"},
                    {"field": "labels", "operator": "contains", "value": "B2C"},
                ]
            ]
        }
        assert _match_first_group(self._ctx(), groups) == "B2C"

    def test_new_format_and_block_partial_match_fails(self):
        from field_engine import _match_first_group
        groups = {
            "B2C": [
                [
                    {"field": "parent_key", "operator": "equals", "value": "ACTIN-100"},
                    {"field": "labels", "operator": "contains", "value": "NONEXISTENT"},
                ]
            ]
        }
        assert _match_first_group(self._ctx(), groups) is None

    def test_new_format_or_across_blocks(self):
        from field_engine import _match_first_group
        groups = {
            "B2C": [
                # Block 1: won't match (wrong parent key)
                [
                    {"field": "parent_key", "operator": "equals", "value": "WRONG-999"},
                ],
                # Block 2: will match
                [
                    {"field": "labels", "operator": "contains", "value": "B2C"},
                ],
            ]
        }
        assert _match_first_group(self._ctx(), groups) == "B2C"

    def test_new_format_first_group_wins(self):
        from field_engine import _match_first_group
        groups = {
            "B2C": [
                [{"field": "labels", "operator": "contains", "value": "B2C"}]
            ],
            "Ops": [
                [{"field": "labels", "operator": "contains", "value": "ACTINOPS"}]
            ],
        }
        # Both would match, but B2C comes first
        assert _match_first_group(self._ctx(), groups) == "B2C"

    def test_new_format_empty_blocks_no_match(self):
        from field_engine import _match_first_group
        groups = {"B2C": []}
        assert _match_first_group(self._ctx(), groups) is None

    def test_old_flat_format_backward_compat(self):
        """Old Rule[] format (list of dicts) should still work as OR."""
        from field_engine import _match_first_group
        groups = {
            "B2C": [
                {"field": "parent_key", "operator": "equals", "value": "WRONG"},
                {"field": "labels", "operator": "contains", "value": "B2C"},
            ]
        }
        # Second rule matches (OR logic)
        assert _match_first_group(self._ctx(), groups) == "B2C"

    def test_complex_and_or_combination(self):
        from field_engine import _match_first_group
        groups = {
            "B2C": [
                # Block 1: parent_key AND priority (won't match — wrong priority)
                [
                    {"field": "parent_key", "operator": "equals", "value": "ACTIN-100"},
                    {"field": "priority", "operator": "equals", "value": "Low"},
                ],
                # Block 2: labels AND issue_type (will match)
                [
                    {"field": "labels", "operator": "contains", "value": "B2C"},
                    {"field": "issue_type", "operator": "equals", "value": "Bug"},
                ],
            ]
        }
        assert _match_first_group(self._ctx(), groups) == "B2C"
