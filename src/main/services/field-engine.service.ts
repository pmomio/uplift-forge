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
 * Safely read the 'toString' own property from a changelog item.
 * JIRA uses 'toString' as a property name which collides with Object.prototype.toString.
 * When the property is missing from JSON, item.toString returns the inherited function
 * instead of undefined, so nullish coalescing (??) won't catch it.
 */
function getStatusTo(item: HistoryItem): string {
  const raw = item as Record<string, unknown>;
  return typeof raw['toString'] === 'string' ? raw['toString'] : '';
}

function getStatusFrom(item: HistoryItem): string {
  return item.fromString ?? '';
}

/**
 * Calculate engineering hours from changelog histories.
 *
 * Uses a state machine to track ALL active development periods across
 * multiple start→end cycles. A ticket may bounce between start and end
 * statuses several times (e.g. rework, multiple developers).
 *
 * States: idle → active → blocked → active → idle (one cycle)
 * Active time accumulates across every completed cycle.
 */
export function calculateEngineeringHours(histories: HistoryEntry[]): number | null {
  if (!Array.isArray(histories)) return null;

  const cfg = getConfig();
  const startStatus = cfg.eng_start_status.toLowerCase();
  const endStatus = cfg.eng_end_status.toLowerCase();
  const excluded = cfg.eng_excluded_statuses.map((s) => s.toLowerCase());

  // Sort by creation time
  const sorted = [...histories].sort(
    (a, b) => DateTime.fromISO(a.created).toMillis() - DateTime.fromISO(b.created).toMillis(),
  );

  // State machine: track active development periods across all cycles
  type State = 'idle' | 'active' | 'blocked';
  let state: State = 'idle';
  let periodStart: DateTime | null = null;
  const activePeriods: Array<[DateTime, DateTime]> = [];

  for (const history of sorted) {
    const ts = DateTime.fromISO(history.created);
    for (const item of history.items) {
      if (item.field !== 'status') continue;

      const statusTo = getStatusTo(item).toLowerCase();

      if (statusTo === startStatus) {
        // Entering start status → begin active period (if not already active)
        if (state !== 'active') {
          state = 'active';
          periodStart = ts;
        }
      } else if (statusTo === endStatus) {
        // Entering end status → close active period (if active)
        if (state === 'active' && periodStart) {
          activePeriods.push([periodStart, ts]);
          periodStart = null;
        }
        state = 'idle';
      } else if (excluded.includes(statusTo)) {
        // Entering excluded status → pause clock (if active)
        if (state === 'active' && periodStart) {
          activePeriods.push([periodStart, ts]);
          periodStart = null;
        }
        state = 'blocked';
      } else if (state === 'blocked') {
        // Leaving excluded status to a non-start/end status → resume clock
        state = 'active';
        periodStart = ts;
      }
    }
  }

  if (activePeriods.length === 0) return null;

  const total = activePeriods.reduce(
    (sum, [s, e]) => sum + computeOfficeHours(s, e, cfg.office_hours),
    0,
  );

  return Math.round(total * 10) / 10;
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
