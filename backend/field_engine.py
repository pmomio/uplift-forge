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

    # Find periods spent in excluded statuses (e.g. Blocked) within the window
    excluded = [s.lower() for s in config.eng_excluded_statuses]
    blocked_periods = []
    blocked_start = None

    for history in histories:
        ts = datetime.fromisoformat(history['created'].replace('Z', '+00:00'))
        if ts <= in_progress_ts or ts >= in_review_ts:
            continue
        for item in history['items']:
            if item['field'] == 'status':
                status_to = (item.get('toString') or '').lower()
                status_from = (item.get('fromString') or '').lower()
                if status_to in excluded and blocked_start is None:
                    blocked_start = ts
                elif status_from in excluded and blocked_start is not None:
                    blocked_periods.append((blocked_start, ts))
                    blocked_start = None

    # If still in excluded status at end, cap at end timestamp
    if blocked_start is not None:
        blocked_periods.append((blocked_start, in_review_ts))

    # Build active (non-blocked) intervals
    if not blocked_periods:
        return compute_office_hours(in_progress_ts, in_review_ts)

    active_periods = []
    current_start = in_progress_ts
    for block_start, block_end in sorted(blocked_periods):
        if current_start < block_start:
            active_periods.append((current_start, block_start))
        current_start = block_end
    if current_start < in_review_ts:
        active_periods.append((current_start, in_review_ts))

    return sum(compute_office_hours(s, e) for s, e in active_periods)

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
    """Evaluate mapping rules to determine TPD BU and Work Stream."""
    fields = issue.get('fields', {})
    parent = fields.get('parent') or {}

    context = {
        'parent_key': parent.get('key', ''),
        'parent_summary': (parent.get('fields') or {}).get('summary', ''),
        'labels': fields.get('labels', []),
        'components': [c.get('name', '') for c in fields.get('components', [])],
        'summary': fields.get('summary', ''),
        'issue_type': (fields.get('issuetype') or {}).get('name', ''),
        'priority': (fields.get('priority') or {}).get('name', ''),
        'assignee': (fields.get('assignee') or {}).get('displayName', ''),
    }

    rules = config.mapping_rules
    tpd_bu = _match_first_group(context, rules.get('tpd_bu', {}))
    work_stream = _match_first_group(context, rules.get('work_stream', {}))

    return tpd_bu, work_stream


def _match_first_group(context, groups):
    """Return the name of the first group with a matching block, or None.

    Each group value is a list of AND-blocks (Rule[][]).
    An AND-block matches when ALL its rules match.
    A group matches when ANY of its AND-blocks matches (OR across blocks).

    For backward compatibility, a flat list of rule dicts (Rule[]) is treated
    as individual OR blocks (each rule is its own single-rule AND-block).
    """
    for group_name, blocks in groups.items():
        if not blocks:
            continue
        # Backward compat: if first element is a dict, it's the old flat Rule[] format
        if isinstance(blocks[0], dict):
            # Old format: each rule is an independent OR condition
            for rule in blocks:
                if _evaluate_rule(context, rule):
                    return group_name
        else:
            # New format: list of AND-blocks
            for block in blocks:
                if block and all(_evaluate_rule(context, rule) for rule in block):
                    return group_name
    return None


def _evaluate_rule(context, rule):
    """Evaluate a single rule against the context."""
    field = rule.get('field', '')
    operator = rule.get('operator', '')
    value = str(rule.get('value', ''))

    field_value = context.get(field)
    if field_value is None:
        return False

    # Array fields (labels, components)
    if isinstance(field_value, list):
        items = [str(v).lower() for v in field_value]
        val = value.lower()
        if operator == 'equals':
            return val in items
        elif operator == 'contains':
            return any(val in item for item in items)
        elif operator == 'starts_with':
            return any(item.startswith(val) for item in items)
        elif operator == 'in':
            targets = [v.strip().lower() for v in value.split(',')]
            return bool(set(items) & set(targets))
        return False

    # Scalar fields
    fv = str(field_value).lower()
    val = value.lower()
    if operator == 'equals':
        return fv == val
    elif operator == 'contains':
        return val in fv
    elif operator == 'starts_with':
        return fv.startswith(val)
    elif operator == 'in':
        targets = [v.strip().lower() for v in value.split(',')]
        return fv in targets
    return False
