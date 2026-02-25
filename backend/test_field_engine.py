import pytest
from field_engine import compute_office_hours
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
