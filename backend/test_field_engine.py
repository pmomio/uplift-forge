import pytest
from unittest.mock import patch
from field_engine import (
    compute_office_hours, calculate_engineering_hours,
    get_mapped_fields, _match_first_group, _evaluate_rule,
)
from datetime import datetime
import pytz
from config import config

def test_compute_office_hours_same_day():
    # Thursday, Feb 26, 2026
    start = datetime(2026, 2, 26, 10, 0, tzinfo=pytz.UTC)
    end = datetime(2026, 2, 26, 12, 0, tzinfo=pytz.UTC)
    # Office hours are 09:00 - 18:00 (Berlin)
    # Berlin is UTC+1 in Feb
    # start = 11:00 Berlin, end = 13:00 Berlin
    assert compute_office_hours(start, end) == 2.0


def _make_status_history(created, from_status, to_status):
    """Helper to create a JIRA changelog history entry for a status transition."""
    return {
        'created': created,
        'items': [{'field': 'status', 'fromString': from_status, 'toString': to_status}]
    }


def test_compute_office_hours_over_weekend():
    # Friday, Feb 20, 2026, 17:00 Berlin (16:00 UTC)
    # Monday, Feb 23, 2026, 10:00 Berlin (09:00 UTC)
    # Friday: 17:00 to 18:00 = 1 hour
    # Sat/Sun: 0 hours
    # Monday: 09:00 to 10:00 = 1 hour
    # Total = 2 hours
    tz = pytz.timezone("Europe/Berlin")
    start = tz.localize(datetime(2026, 2, 20, 17, 0)).astimezone(pytz.UTC)
    end = tz.localize(datetime(2026, 2, 23, 10, 0)).astimezone(pytz.UTC)

    assert compute_office_hours(start, end) == 2.0


def test_calculate_engineering_hours_excludes_blocked_time():
    """
    Timeline (all Berlin time, Thursday Feb 26 2026):
      10:00 - transition to In Progress
      12:00 - transition to Blocked
      14:00 - transition to In Progress (unblocked)
      16:00 - transition to Code Review

    Active periods: 10:00-12:00 (2h) + 14:00-16:00 (2h) = 4 hours
    Blocked period: 12:00-14:00 (excluded)
    """
    tz = pytz.timezone("Europe/Berlin")
    histories = [
        _make_status_history(
            tz.localize(datetime(2026, 2, 26, 10, 0)).isoformat(),
            'Open', 'In Progress'),
        _make_status_history(
            tz.localize(datetime(2026, 2, 26, 12, 0)).isoformat(),
            'In Progress', 'Blocked'),
        _make_status_history(
            tz.localize(datetime(2026, 2, 26, 14, 0)).isoformat(),
            'Blocked', 'In Progress'),
        _make_status_history(
            tz.localize(datetime(2026, 2, 26, 16, 0)).isoformat(),
            'In Progress', 'Code Review'),
    ]
    result = calculate_engineering_hours(histories)
    assert result == 4.0


def test_calculate_engineering_hours_no_blocked_time():
    """Without any blocked period, full time should be counted."""
    tz = pytz.timezone("Europe/Berlin")
    histories = [
        _make_status_history(
            tz.localize(datetime(2026, 2, 26, 10, 0)).isoformat(),
            'Open', 'In Progress'),
        _make_status_history(
            tz.localize(datetime(2026, 2, 26, 14, 0)).isoformat(),
            'In Progress', 'Code Review'),
    ]
    result = calculate_engineering_hours(histories)
    assert result == 4.0


def test_calculate_engineering_hours_blocked_until_end():
    """
    If ticket transitions directly from Blocked to Code Review,
    the blocked period closes at that transition.

    Timeline:
      10:00 - In Progress
      12:00 - Blocked
      14:00 - Code Review (from Blocked)

    Active: 10:00-12:00 = 2 hours
    """
    tz = pytz.timezone("Europe/Berlin")
    histories = [
        _make_status_history(
            tz.localize(datetime(2026, 2, 26, 10, 0)).isoformat(),
            'Open', 'In Progress'),
        _make_status_history(
            tz.localize(datetime(2026, 2, 26, 12, 0)).isoformat(),
            'In Progress', 'Blocked'),
        _make_status_history(
            tz.localize(datetime(2026, 2, 26, 14, 0)).isoformat(),
            'Blocked', 'Code Review'),
    ]
    result = calculate_engineering_hours(histories)
    assert result == 2.0


def test_calculate_engineering_hours_multiple_blocked_periods():
    """
    Timeline (Thursday Feb 26 2026, Berlin):
      09:00 - In Progress
      10:00 - Blocked       (1h active)
      11:00 - In Progress   (1h blocked)
      13:00 - Blocked       (2h active)
      15:00 - In Progress   (2h blocked)
      17:00 - Code Review   (2h active)

    Active: 09-10 (1h) + 11-13 (2h) + 15-17 (2h) = 5 hours
    """
    tz = pytz.timezone("Europe/Berlin")
    histories = [
        _make_status_history(
            tz.localize(datetime(2026, 2, 26, 9, 0)).isoformat(),
            'Open', 'In Progress'),
        _make_status_history(
            tz.localize(datetime(2026, 2, 26, 10, 0)).isoformat(),
            'In Progress', 'Blocked'),
        _make_status_history(
            tz.localize(datetime(2026, 2, 26, 11, 0)).isoformat(),
            'Blocked', 'In Progress'),
        _make_status_history(
            tz.localize(datetime(2026, 2, 26, 13, 0)).isoformat(),
            'In Progress', 'Blocked'),
        _make_status_history(
            tz.localize(datetime(2026, 2, 26, 15, 0)).isoformat(),
            'Blocked', 'In Progress'),
        _make_status_history(
            tz.localize(datetime(2026, 2, 26, 17, 0)).isoformat(),
            'In Progress', 'Code Review'),
    ]
    result = calculate_engineering_hours(histories)
    assert result == 5.0


# ---------------------------------------------------------------------------
# Edge cases for calculate_engineering_hours
# ---------------------------------------------------------------------------

def test_calculate_engineering_hours_not_list():
    """Non-list input should return None."""
    assert calculate_engineering_hours(None) is None
    assert calculate_engineering_hours("not a list") is None

def test_calculate_engineering_hours_no_start_status():
    """No transition to start status should return None."""
    histories = [
        _make_status_history("2026-02-26T10:00:00+01:00", "Open", "Code Review"),
    ]
    assert calculate_engineering_hours(histories) is None

def test_calculate_engineering_hours_no_end_status():
    """Start status found but no end status should return None."""
    tz = pytz.timezone("Europe/Berlin")
    histories = [
        _make_status_history(
            tz.localize(datetime(2026, 2, 26, 10, 0)).isoformat(),
            'Open', 'In Progress'),
    ]
    assert calculate_engineering_hours(histories) is None

def test_calculate_engineering_hours_case_insensitive():
    """Status matching should be case insensitive."""
    tz = pytz.timezone("Europe/Berlin")
    histories = [
        _make_status_history(
            tz.localize(datetime(2026, 2, 26, 10, 0)).isoformat(),
            'Open', 'in progress'),
        _make_status_history(
            tz.localize(datetime(2026, 2, 26, 14, 0)).isoformat(),
            'in progress', 'code review'),
    ]
    result = calculate_engineering_hours(histories)
    assert result == 4.0

def test_compute_office_hours_before_office_start():
    """Time before office hours should not be counted."""
    tz = pytz.timezone("Europe/Berlin")
    start = tz.localize(datetime(2026, 2, 26, 7, 0))
    end = tz.localize(datetime(2026, 2, 26, 10, 0))
    # Only 09:00-10:00 counts = 1 hour
    assert compute_office_hours(start, end) == 1.0

def test_compute_office_hours_after_office_end():
    """Time after office hours should not be counted."""
    tz = pytz.timezone("Europe/Berlin")
    start = tz.localize(datetime(2026, 2, 26, 17, 0))
    end = tz.localize(datetime(2026, 2, 26, 20, 0))
    # Only 17:00-18:00 counts = 1 hour
    assert compute_office_hours(start, end) == 1.0

def test_compute_office_hours_entirely_outside():
    """Entirely outside office hours should return 0."""
    tz = pytz.timezone("Europe/Berlin")
    start = tz.localize(datetime(2026, 2, 26, 19, 0))
    end = tz.localize(datetime(2026, 2, 26, 22, 0))
    assert compute_office_hours(start, end) == 0

def test_compute_office_hours_multi_day():
    """Multi-day span counts office hours per day."""
    tz = pytz.timezone("Europe/Berlin")
    # Wednesday 09:00 to Friday 18:00 = 3 full days = 3 * 9 = 27 hours
    start = tz.localize(datetime(2026, 2, 25, 9, 0))
    end = tz.localize(datetime(2026, 2, 27, 18, 0))
    assert compute_office_hours(start, end) == 27.0


# ---------------------------------------------------------------------------
# _evaluate_rule tests for all operators
# ---------------------------------------------------------------------------

class TestEvaluateRule:

    def test_scalar_equals(self):
        ctx = {"summary": "Fix login bug"}
        assert _evaluate_rule(ctx, {"field": "summary", "operator": "equals", "value": "fix login bug"}) is True
        assert _evaluate_rule(ctx, {"field": "summary", "operator": "equals", "value": "wrong"}) is False

    def test_scalar_contains(self):
        ctx = {"summary": "Fix login bug"}
        assert _evaluate_rule(ctx, {"field": "summary", "operator": "contains", "value": "login"}) is True
        assert _evaluate_rule(ctx, {"field": "summary", "operator": "contains", "value": "signup"}) is False

    def test_scalar_starts_with(self):
        ctx = {"summary": "Fix login bug"}
        assert _evaluate_rule(ctx, {"field": "summary", "operator": "starts_with", "value": "fix"}) is True
        assert _evaluate_rule(ctx, {"field": "summary", "operator": "starts_with", "value": "login"}) is False

    def test_scalar_in(self):
        ctx = {"priority": "High"}
        assert _evaluate_rule(ctx, {"field": "priority", "operator": "in", "value": "High, Medium"}) is True
        assert _evaluate_rule(ctx, {"field": "priority", "operator": "in", "value": "Low, Medium"}) is False

    def test_array_equals(self):
        ctx = {"labels": ["B2C", "Frontend"]}
        assert _evaluate_rule(ctx, {"field": "labels", "operator": "equals", "value": "B2C"}) is True
        assert _evaluate_rule(ctx, {"field": "labels", "operator": "equals", "value": "Backend"}) is False

    def test_array_contains(self):
        ctx = {"labels": ["B2C-Frontend", "Ops"]}
        assert _evaluate_rule(ctx, {"field": "labels", "operator": "contains", "value": "b2c"}) is True
        assert _evaluate_rule(ctx, {"field": "labels", "operator": "contains", "value": "xyz"}) is False

    def test_array_starts_with(self):
        ctx = {"components": ["backend-api", "frontend-web"]}
        assert _evaluate_rule(ctx, {"field": "components", "operator": "starts_with", "value": "backend"}) is True
        assert _evaluate_rule(ctx, {"field": "components", "operator": "starts_with", "value": "mobile"}) is False

    def test_array_in(self):
        ctx = {"labels": ["B2C", "Frontend"]}
        assert _evaluate_rule(ctx, {"field": "labels", "operator": "in", "value": "B2C, B2B"}) is True
        assert _evaluate_rule(ctx, {"field": "labels", "operator": "in", "value": "B2B, Backend"}) is False

    def test_unknown_field_returns_false(self):
        ctx = {"summary": "test"}
        assert _evaluate_rule(ctx, {"field": "nonexistent", "operator": "equals", "value": "test"}) is False

    def test_unknown_operator_returns_false(self):
        ctx = {"summary": "test"}
        assert _evaluate_rule(ctx, {"field": "summary", "operator": "regex", "value": "test"}) is False

    def test_unknown_operator_array_returns_false(self):
        ctx = {"labels": ["test"]}
        assert _evaluate_rule(ctx, {"field": "labels", "operator": "regex", "value": "test"}) is False


# ---------------------------------------------------------------------------
# get_mapped_fields
# ---------------------------------------------------------------------------

class TestGetMappedFields:

    def test_maps_from_parent_key(self):
        config.mapping_rules = {
            "tpd_bu": {"B2C": [[{"field": "parent_key", "operator": "equals", "value": "PROJ-1"}]]},
            "work_stream": {"Product": [[{"field": "parent_key", "operator": "equals", "value": "PROJ-1"}]]},
        }
        issue = {
            "fields": {
                "parent": {"key": "PROJ-1", "fields": {"summary": "Parent"}},
                "labels": [], "components": [], "summary": "Test",
                "issuetype": {"name": "Story"}, "priority": {"name": "Medium"},
                "assignee": {"displayName": "Alice"},
            }
        }
        tpd, ws = get_mapped_fields(issue)
        assert tpd == "B2C"
        assert ws == "Product"

    def test_no_match_returns_none(self):
        config.mapping_rules = {
            "tpd_bu": {"B2C": [[{"field": "parent_key", "operator": "equals", "value": "NOMATCH"}]]},
            "work_stream": {},
        }
        issue = {
            "fields": {
                "parent": {"key": "PROJ-1", "fields": {"summary": "Parent"}},
                "labels": [], "components": [], "summary": "Test",
                "issuetype": {"name": "Story"}, "priority": {"name": "Medium"},
                "assignee": {"displayName": "Alice"},
            }
        }
        tpd, ws = get_mapped_fields(issue)
        assert tpd is None
        assert ws is None

    def test_no_parent(self):
        config.mapping_rules = {"tpd_bu": {}, "work_stream": {}}
        issue = {"fields": {"labels": [], "components": [], "summary": "Test",
                            "issuetype": {"name": "Story"}, "priority": {"name": "Medium"},
                            "assignee": {"displayName": "Alice"}}}
        tpd, ws = get_mapped_fields(issue)
        assert tpd is None
        assert ws is None

    def test_context_includes_all_fields(self):
        """Verify the context dictionary is populated from all supported fields."""
        config.mapping_rules = {
            "tpd_bu": {"Match": [[{"field": "assignee", "operator": "equals", "value": "Alice"}]]},
            "work_stream": {"WS": [[{"field": "issue_type", "operator": "equals", "value": "Bug"}]]},
        }
        issue = {
            "fields": {
                "parent": {"key": "P-1", "fields": {"summary": "Parent Summary"}},
                "labels": ["label1"],
                "components": [{"name": "comp1"}],
                "summary": "Test summary",
                "issuetype": {"name": "Bug"},
                "priority": {"name": "High"},
                "assignee": {"displayName": "Alice"},
            }
        }
        tpd, ws = get_mapped_fields(issue)
        assert tpd == "Match"
        assert ws == "WS"
