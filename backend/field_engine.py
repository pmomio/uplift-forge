from datetime import datetime, time, timedelta
import pytz
from config import config

def calculate_engineering_hours(histories):
    """
    1. Identify first transition to start status.
    2. Identify first transition to end status after start status.
    3. Calculate delta excluding weekends and non-office hours.
    """
    if not isinstance(histories, list):
        return None

    start_status = config.eng_start_status.lower()
    end_status = config.eng_end_status.lower()

    in_progress_ts = None
    in_review_ts = None

    # Sort histories by creation time
    histories.sort(key=lambda x: x['created'])

    # Find first Start Status
    for history in histories:
        for item in history['items']:
            if item['field'] == 'status':
                status_to = item.get('toString', '').lower()
                if status_to == start_status and not in_progress_ts:
                    in_progress_ts = datetime.fromisoformat(history['created'].replace('Z', '+00:00'))
                    break
        if in_progress_ts:
            break

    if not in_progress_ts:
        return None

    # Find first End Status after Start Status
    for history in histories:
        ts = datetime.fromisoformat(history['created'].replace('Z', '+00:00'))
        if ts <= in_progress_ts:
            continue
        for item in history['items']:
            if item['field'] == 'status':
                status_to = item.get('toString', '').lower()
                if status_to == end_status:
                    in_review_ts = ts
                    break
        if in_review_ts:
            break

    if not in_review_ts:
        return None

    return compute_office_hours(in_progress_ts, in_review_ts)

def compute_office_hours(start_dt, end_dt):
    tz = pytz.timezone(config.office_hours['timezone'])
    start_dt = start_dt.astimezone(tz)
    end_dt = end_dt.astimezone(tz)

    office_start_time = time.fromisoformat(config.office_hours['start'])
    office_end_time = time.fromisoformat(config.office_hours['end'])

    total_seconds = 0
    current_dt = start_dt

    while current_dt < end_dt:
        # If weekend and exclude_weekends is true, skip day
        if config.office_hours['exclude_weekends'] and current_dt.weekday() >= 5:
            current_dt = (current_dt + timedelta(days=1)).replace(hour=office_start_time.hour, minute=office_start_time.minute, second=0, microsecond=0)
            continue

        day_start = current_dt.replace(hour=office_start_time.hour, minute=office_start_time.minute, second=0, microsecond=0)
        day_end = current_dt.replace(hour=office_end_time.hour, minute=office_end_time.minute, second=0, microsecond=0)

        # Ensure current_dt is within office hours for calculation
        effective_start = max(current_dt, day_start)
        effective_end = min(end_dt, day_end)

        if effective_start < effective_end:
            total_seconds += (effective_end - effective_start).total_seconds()

        # Move to next day
        current_dt = (current_dt + timedelta(days=1)).replace(hour=office_start_time.hour, minute=office_start_time.minute, second=0, microsecond=0)

    return round(total_seconds / 3600, 1)

def get_mapped_fields(issue):
    parent = issue.get('fields', {}).get('parent')
    if not parent:
        return None, None
    
    parent_key = parent.get('key')
    tpd_bu = config.get_tpd_bu(parent_key)
    work_stream = config.get_work_stream(parent_key)
    
    return tpd_bu, work_stream
