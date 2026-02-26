import { DateTime } from 'luxon';
import { getConfig } from './config.service.js';
import type { Rule, MappingRules, OfficeHoursConfig } from '../../shared/types.js';

/**
 * Port of backend/field_engine.py — engineering hours calculation + rule-based field mapping.
 */

// ----- Engineering Hours -----

export interface HistoryItem {
  field: string;
  toString?: string | null;
  fromString?: string | null;
}

export interface HistoryEntry {
  created: string;
  items: HistoryItem[];
}

/**
 * Calculate engineering hours from changelog histories.
 *
 * 1. Find first transition to start status.
 * 2. Find first transition to end status after start.
 * 3. Exclude blocked periods.
 * 4. Compute office hours (timezone-aware, weekends excluded).
 */
export function calculateEngineeringHours(histories: HistoryEntry[]): number | null {
  if (!Array.isArray(histories)) return null;

  const cfg = getConfig();
  const startStatus = cfg.eng_start_status.toLowerCase();
  const endStatus = cfg.eng_end_status.toLowerCase();

  // Sort by creation time
  const sorted = [...histories].sort(
    (a, b) => DateTime.fromISO(a.created).toMillis() - DateTime.fromISO(b.created).toMillis(),
  );

  // Find first transition to start status
  let inProgressTs: DateTime | null = null;
  for (const history of sorted) {
    for (const item of history.items) {
      if (item.field === 'status') {
        const statusTo = (item.toString ?? '').toLowerCase();
        if (statusTo === startStatus && !inProgressTs) {
          inProgressTs = DateTime.fromISO(history.created);
          break;
        }
      }
    }
    if (inProgressTs) break;
  }
  if (!inProgressTs) return null;

  // Find first transition to end status after start
  let inReviewTs: DateTime | null = null;
  for (const history of sorted) {
    const ts = DateTime.fromISO(history.created);
    if (ts <= inProgressTs) continue;
    for (const item of history.items) {
      if (item.field === 'status') {
        const statusTo = (item.toString ?? '').toLowerCase();
        if (statusTo === endStatus) {
          inReviewTs = ts;
          break;
        }
      }
    }
    if (inReviewTs) break;
  }
  if (!inReviewTs) return null;

  // Find periods in excluded statuses within the window
  const excluded = cfg.eng_excluded_statuses.map((s) => s.toLowerCase());
  const blockedPeriods: Array<[DateTime, DateTime]> = [];
  let blockedStart: DateTime | null = null;

  for (const history of sorted) {
    const ts = DateTime.fromISO(history.created);
    if (ts <= inProgressTs || ts >= inReviewTs) continue;
    for (const item of history.items) {
      if (item.field === 'status') {
        const statusTo = (item.toString ?? '').toLowerCase();
        const statusFrom = (item.fromString ?? '').toLowerCase();
        if (excluded.includes(statusTo) && blockedStart === null) {
          blockedStart = ts;
        } else if (excluded.includes(statusFrom) && blockedStart !== null) {
          blockedPeriods.push([blockedStart, ts]);
          blockedStart = null;
        }
      }
    }
  }
  // If still in excluded status at end, cap at end timestamp
  if (blockedStart !== null) {
    blockedPeriods.push([blockedStart, inReviewTs]);
  }

  // Build active (non-blocked) intervals
  if (blockedPeriods.length === 0) {
    return computeOfficeHours(inProgressTs, inReviewTs, cfg.office_hours);
  }

  blockedPeriods.sort((a, b) => a[0].toMillis() - b[0].toMillis());
  const activePeriods: Array<[DateTime, DateTime]> = [];
  let currentStart = inProgressTs;
  for (const [blockStart, blockEnd] of blockedPeriods) {
    if (currentStart < blockStart) {
      activePeriods.push([currentStart, blockStart]);
    }
    currentStart = blockEnd;
  }
  if (currentStart < inReviewTs) {
    activePeriods.push([currentStart, inReviewTs]);
  }

  return activePeriods.reduce(
    (sum, [s, e]) => sum + computeOfficeHours(s, e, cfg.office_hours),
    0,
  );
}

/**
 * Compute office hours between two DateTime values.
 * Matches Python version: iterate day-by-day, skip weekends, clamp to office hours.
 */
export function computeOfficeHours(startDt: DateTime, endDt: DateTime, officeConfig?: OfficeHoursConfig): number {
  const cfg = officeConfig ?? getConfig().office_hours;
  const tz = cfg.timezone;

  let start = startDt.setZone(tz);
  const end = endDt.setZone(tz);

  const [offStartHour, offStartMin] = cfg.start.split(':').map(Number);
  const [offEndHour, offEndMin] = cfg.end.split(':').map(Number);

  let totalSeconds = 0;
  let current = start;

  while (current < end) {
    // Skip weekends (Mon=1 ... Sun=7 in luxon)
    if (cfg.exclude_weekends && current.weekday >= 6) {
      current = current.plus({ days: 1 }).set({ hour: offStartHour, minute: offStartMin, second: 0, millisecond: 0 });
      continue;
    }

    const dayStart = current.set({ hour: offStartHour, minute: offStartMin, second: 0, millisecond: 0 });
    const dayEnd = current.set({ hour: offEndHour, minute: offEndMin, second: 0, millisecond: 0 });

    const effectiveStart = current > dayStart ? current : dayStart;
    const effectiveEnd = end < dayEnd ? end : dayEnd;

    if (effectiveStart < effectiveEnd) {
      totalSeconds += effectiveEnd.diff(effectiveStart, 'seconds').seconds;
    }

    // Move to next day at office start
    current = current.plus({ days: 1 }).set({ hour: offStartHour, minute: offStartMin, second: 0, millisecond: 0 });
  }

  return Math.round((totalSeconds / 3600) * 10) / 10;
}

// ----- Field Mapping (Rule Engine) -----

interface RuleContext {
  parent_key: string;
  parent_summary: string;
  labels: string[];
  components: string[];
  summary: string;
  issue_type: string;
  priority: string;
  assignee: string;
}

/**
 * Evaluate mapping rules to determine TPD BU and Work Stream.
 */
export function getMappedFields(issue: Record<string, unknown>): [string | null, string | null] {
  const fields = (issue.fields ?? {}) as Record<string, unknown>;
  const parent = (fields.parent ?? {}) as Record<string, unknown>;
  const parentFields = (parent.fields ?? {}) as Record<string, unknown>;
  const assigneeObj = (fields.assignee ?? {}) as Record<string, unknown>;
  const issueTypeObj = (fields.issuetype ?? {}) as Record<string, unknown>;
  const priorityObj = (fields.priority ?? {}) as Record<string, unknown>;
  const componentsRaw = (fields.components ?? []) as Array<Record<string, string>>;

  const context: RuleContext = {
    parent_key: (parent.key as string) ?? '',
    parent_summary: (parentFields.summary as string) ?? '',
    labels: (fields.labels ?? []) as string[],
    components: componentsRaw.map((c) => c.name ?? ''),
    summary: (fields.summary as string) ?? '',
    issue_type: (issueTypeObj?.name as string) ?? '',
    priority: (priorityObj?.name as string) ?? '',
    assignee: (assigneeObj?.displayName as string) ?? '',
  };

  const rules = getConfig().mapping_rules;
  const tpdBu = matchFirstGroup(context, rules.tpd_bu ?? {});
  const workStream = matchFirstGroup(context, rules.work_stream ?? {});

  return [tpdBu, workStream];
}

/**
 * Return the name of the first group with a matching block, or null.
 *
 * Each group value is Rule[][] (AND-blocks OR'd).
 * Backward compatible: flat Rule[] treated as individual OR blocks.
 */
export function matchFirstGroup(
  context: RuleContext,
  groups: Record<string, Rule[][] | Rule[]>,
): string | null {
  for (const [groupName, blocks] of Object.entries(groups)) {
    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) continue;

    // Backward compat: if first element is a plain object (not array), it's old flat Rule[] format
    if (!Array.isArray(blocks[0])) {
      // Old format: each rule is an independent OR condition
      for (const rule of blocks as Rule[]) {
        if (evaluateRule(context, rule)) return groupName;
      }
    } else {
      // New format: list of AND-blocks
      for (const block of blocks as Rule[][]) {
        if (block && block.length > 0 && block.every((rule) => evaluateRule(context, rule))) {
          return groupName;
        }
      }
    }
  }
  return null;
}

/**
 * Evaluate a single rule against the context.
 */
export function evaluateRule(context: RuleContext, rule: Rule): boolean {
  const field = rule.field ?? '';
  const operator = rule.operator ?? '';
  const value = String(rule.value ?? '');

  const fieldValue = context[field as keyof RuleContext];
  if (fieldValue === undefined || fieldValue === null) return false;

  // Array fields (labels, components)
  if (Array.isArray(fieldValue)) {
    const items = fieldValue.map((v) => String(v).toLowerCase());
    const val = value.toLowerCase();
    switch (operator) {
      case 'equals':
        return items.includes(val);
      case 'contains':
        return items.some((item) => item.includes(val));
      case 'starts_with':
        return items.some((item) => item.startsWith(val));
      case 'in': {
        const targets = value.split(',').map((v) => v.trim().toLowerCase());
        return items.some((item) => targets.includes(item));
      }
      default:
        return false;
    }
  }

  // Scalar fields
  const fv = String(fieldValue).toLowerCase();
  const val = value.toLowerCase();
  switch (operator) {
    case 'equals':
      return fv === val;
    case 'contains':
      return fv.includes(val);
    case 'starts_with':
      return fv.startsWith(val);
    case 'in': {
      const targets = value.split(',').map((v) => v.trim().toLowerCase());
      return targets.includes(fv);
    }
    default:
      return false;
  }
}
