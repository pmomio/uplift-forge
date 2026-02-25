import pytest
from unittest.mock import patch
from field_engine import compute_office_hours, calculate_engineering_hours
from datetime import datetime
import pytz

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
