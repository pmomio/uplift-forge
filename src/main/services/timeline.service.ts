import { getConfig } from './config.service.js';
import { getRawIssues } from './ticket.service.js';
import type { StatusPeriod, TicketTimeline, StatusClassification, ProcessedTicket } from '../../shared/types.js';

/**
 * Timeline Engine — extracts status periods, cycle/lead time, rework,
 * and flow efficiency from raw JIRA changelogs.
 *
 * Uses calendar time (not office hours). The existing
 * calculateEngineeringHours() in field-engine continues to use office hours.
 */

// Per-project timeline caches
const timelineCaches = new Map<string, Map<string, TicketTimeline>>();

/**
 * Classify a status string into a category using the configured status lists.
 */
export function classifyStatus(
  status: string,
  classification?: StatusClassification,
): 'active' | 'blocked' | 'done' | 'wait' {
  const cfg = classification ?? getConfig();
  const lower = status.toLowerCase();

  if (cfg.active_statuses.some(s => s.toLowerCase() === lower)) return 'active';
  if (cfg.blocked_statuses.some(s => s.toLowerCase() === lower)) return 'blocked';
  if (cfg.done_statuses.some(s => s.toLowerCase() === lower)) return 'done';

  // Default: statuses not in any list are "wait" (e.g. Open, To Do, Backlog)
  return 'wait';
}

/**
 * Compute hours between two ISO timestamps (calendar time).
 */
function hoursBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.max(0, (end - start) / (1000 * 60 * 60));
}

/**
 * Extract a TicketTimeline from a raw JIRA issue with changelog.
 */
export function extractTimeline(
  rawIssue: Record<string, unknown>,
  classification?: StatusClassification,
): TicketTimeline {
  const key = rawIssue.key as string;
  const fields = (rawIssue.fields ?? {}) as Record<string, unknown>;
  const changelog = (rawIssue.changelog ?? {}) as { histories?: unknown[] };
  const histories = (changelog.histories ?? []) as Array<{
    created: string;
    items: Array<{ field: string; toString?: string; fromString?: string }>;
  }>;

  const created = fields.created as string | null;
  const resolved = fields.resolutiondate as string | null;

  // Current status
  const statusObj = fields.status as Record<string, unknown> | null;
  const currentStatus = statusObj ? (statusObj.name as string) ?? 'Unknown' : 'Unknown';

  // Build status transitions from changelog
  const transitions: Array<{ from: string; to: string; timestamp: string }> = [];
  for (const history of histories) {
    for (const item of history.items) {
      if (item.field === 'status') {
        const raw = item as Record<string, unknown>;
        transitions.push({
          from: String(raw['fromString'] ?? ''),
          to: String(raw['toString'] ?? ''),
          timestamp: history.created,
        });
      }
    }
  }

  // Sort transitions chronologically
  transitions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Build status periods
  const statusPeriods: StatusPeriod[] = [];
  const now = new Date().toISOString();

  if (transitions.length === 0) {
    // No transitions — ticket has been in its initial status since creation
    const enteredAt = created ?? now;
    const category = classifyStatus(currentStatus, classification);
    const isDone = category === 'done';
    statusPeriods.push({
      status: currentStatus,
      enteredAt,
      exitedAt: isDone && resolved ? resolved : null,
      durationHours: hoursBetween(enteredAt, isDone && resolved ? resolved : now),
      category,
    });
  } else {
    // Initial period: from creation to first transition
    const firstTransition = transitions[0];
    if (created && firstTransition.from) {
      const initialEnd = firstTransition.timestamp;
      statusPeriods.push({
        status: firstTransition.from,
        enteredAt: created,
        exitedAt: initialEnd,
        durationHours: hoursBetween(created, initialEnd),
        category: classifyStatus(firstTransition.from, classification),
      });
    }

    // Periods from each transition
    for (let i = 0; i < transitions.length; i++) {
      const t = transitions[i];
      const nextTimestamp = i < transitions.length - 1
        ? transitions[i + 1].timestamp
        : null;

      const isLast = nextTimestamp === null;
      const category = classifyStatus(t.to, classification);
      const isDone = category === 'done';

      const exitedAt = isLast
        ? (isDone && resolved ? resolved : null)
        : nextTimestamp;

      statusPeriods.push({
        status: t.to,
        enteredAt: t.timestamp,
        exitedAt,
        durationHours: hoursBetween(t.timestamp, exitedAt ?? now),
        category,
      });
    }
  }

  // Compute aggregate times
  let activeTimeHours = 0;
  let waitTimeHours = 0;
  let blockedTimeHours = 0;

  for (const period of statusPeriods) {
    switch (period.category) {
      case 'active':
        activeTimeHours += period.durationHours;
        break;
      case 'wait':
        waitTimeHours += period.durationHours;
        break;
      case 'blocked':
        blockedTimeHours += period.durationHours;
        break;
      // 'done' periods not counted
    }
  }

  // Cycle time: first active status entry -> done
  let cycleTimeHours: number | null = null;
  const firstActive = statusPeriods.find(p => p.category === 'active');
  const lastDone = [...statusPeriods].reverse().find(p => p.category === 'done');
  if (firstActive && lastDone && lastDone.enteredAt) {
    cycleTimeHours = hoursBetween(firstActive.enteredAt, lastDone.enteredAt);
  }

  // Lead time: created -> done
  let leadTimeHours: number | null = null;
  if (created && lastDone && lastDone.enteredAt) {
    leadTimeHours = hoursBetween(created, lastDone.enteredAt);
  }

  // Flow efficiency: activeTime / leadTime * 100
  let flowEfficiency: number | null = null;
  if (leadTimeHours != null && leadTimeHours > 0) {
    flowEfficiency = (activeTimeHours / leadTimeHours) * 100;
  }

  // Rework detection: build status order from first occurrence in changelog.
  // Any backward transition = rework.
  const statusOrder: string[] = [];
  for (const t of transitions) {
    if (!statusOrder.includes(t.to)) {
      statusOrder.push(t.to);
    }
  }
  let reworkCount = 0;
  for (const t of transitions) {
    const fromIdx = statusOrder.indexOf(t.from);
    const toIdx = statusOrder.indexOf(t.to);
    if (fromIdx >= 0 && toIdx >= 0 && toIdx < fromIdx) {
      reworkCount++;
    }
  }

  // Days in current status
  const lastPeriod = statusPeriods[statusPeriods.length - 1];
  const daysInCurrentStatus = lastPeriod
    ? lastPeriod.durationHours / 24
    : 0;

  return {
    key,
    statusPeriods,
    cycleTimeHours,
    leadTimeHours,
    activeTimeHours,
    waitTimeHours,
    blockedTimeHours,
    flowEfficiency,
    hasRework: reworkCount > 0,
    reworkCount,
    currentStatus,
    daysInCurrentStatus,
  };
}

/**
 * Compute percentiles from an array of numbers.
 */
export function computePercentiles(
  values: number[],
  percentiles: number[] = [50, 85, 95],
): Record<string, number> {
  if (values.length === 0) {
    const result: Record<string, number> = {};
    for (const p of percentiles) result[`p${p}`] = 0;
    return result;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const result: Record<string, number> = {};
  for (const p of percentiles) {
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) {
      result[`p${p}`] = sorted[lower];
    } else {
      result[`p${p}`] = sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
    }
  }
  return result;
}

/**
 * Compute weekly throughput from timelines.
 */
export function computeWeeklyThroughput(
  timelines: TicketTimeline[],
  weeks = 8,
): Array<{ week: string; count: number; storyPoints: number }> {
  const now = new Date();
  const result: Array<{ week: string; count: number; storyPoints: number }> = [];

  for (let w = weeks - 1; w >= 0; w--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);

    const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    let count = 0;

    for (const tl of timelines) {
      // Count tickets that entered "done" during this week
      const donePeriod = tl.statusPeriods.find(p => p.category === 'done');
      if (donePeriod) {
        const doneDate = new Date(donePeriod.enteredAt);
        if (doneDate >= weekStart && doneDate < weekEnd) {
          count++;
        }
      }
    }

    result.push({ week: weekLabel, count, storyPoints: 0 });
  }

  return result;
}

/**
 * Get timelines for a project, computing from raw cache if needed.
 */
export function getTimelines(projectKey?: string): TicketTimeline[] {
  const cfg = getConfig();
  const classification: StatusClassification = {
    active_statuses: cfg.active_statuses,
    blocked_statuses: cfg.blocked_statuses,
    done_statuses: cfg.done_statuses,
  };

  if (projectKey) {
    return getTimelinesForProject(projectKey, classification);
  }

  // Aggregate across all projects
  const rawByProject = getRawIssues();
  const allTimelines: TicketTimeline[] = [];
  for (const [pk, rawMap] of Object.entries(rawByProject)) {
    allTimelines.push(...getTimelinesForProject(pk, classification, rawMap));
  }
  return allTimelines;
}

function getTimelinesForProject(
  projectKey: string,
  classification: StatusClassification,
  rawMap?: Map<string, Record<string, unknown>>,
): TicketTimeline[] {
  // Check cache
  const cached = timelineCaches.get(projectKey);
  if (cached && cached.size > 0) {
    return Array.from(cached.values());
  }

  // Compute from raw issues
  const issues = rawMap ?? getRawIssues(projectKey);
  const issueMap = issues instanceof Map ? issues : new Map(Object.entries(issues));
  const timelines = new Map<string, TicketTimeline>();

  for (const [key, rawIssue] of issueMap) {
    timelines.set(key, extractTimeline(rawIssue, classification));
  }

  timelineCaches.set(projectKey, timelines);
  return Array.from(timelines.values());
}

// --- Shared metric helpers (used by multiple persona services) ---

/**
 * Compute SP estimation accuracy: avg ratio of actual eng_hours to estimated hours (SP × spToDays × 8).
 * Returns value where 100 = perfect. null if no tickets have both SP and eng_hours.
 */
export function computeSpAccuracy(
  tickets: ProcessedTicket[],
  timelines: TicketTimeline[],
  spToDays: number,
): number | null {
  const timelineMap = new Map(timelines.map(tl => [tl.key, tl]));
  const ratios: number[] = [];

  for (const t of tickets) {
    if (t.story_points == null || t.story_points <= 0) continue;
    if (t.eng_hours == null || t.eng_hours <= 0) continue;
    const estimated = t.story_points * spToDays * 8;
    if (estimated <= 0) continue;
    ratios.push((t.eng_hours / estimated) * 100);
  }

  if (ratios.length === 0) return null;
  return ratios.reduce((a, b) => a + b, 0) / ratios.length;
}

/**
 * Compute average time spent in review statuses (case-insensitive match for "review").
 * Returns average hours, or null if no review periods found.
 */
export function computeReviewDuration(
  timelines: TicketTimeline[],
): number | null {
  const durations: number[] = [];

  for (const tl of timelines) {
    let reviewHours = 0;
    let hasReview = false;
    for (const sp of tl.statusPeriods) {
      if (sp.status.toLowerCase().includes('review')) {
        reviewHours += sp.durationHours;
        hasReview = true;
      }
    }
    if (hasReview) {
      durations.push(reviewHours);
    }
  }

  if (durations.length === 0) return null;
  return durations.reduce((a, b) => a + b, 0) / durations.length;
}

/**
 * Compute average time from ticket creation to first active-category status period.
 * Returns hours, or null if no data.
 */
export function computeTimeToFirstActivity(
  timelines: TicketTimeline[],
  ticketMap: Map<string, ProcessedTicket>,
): number | null {
  const delays: number[] = [];

  for (const tl of timelines) {
    const ticket = ticketMap.get(tl.key);
    if (!ticket?.created) continue;

    const firstActive = tl.statusPeriods.find(p => p.category === 'active');
    if (!firstActive) continue;

    const createdMs = new Date(ticket.created).getTime();
    const activeMs = new Date(firstActive.enteredAt).getTime();
    const hours = Math.max(0, (activeMs - createdMs) / (1000 * 60 * 60));
    delays.push(hours);
  }

  if (delays.length === 0) return null;
  return delays.reduce((a, b) => a + b, 0) / delays.length;
}

/**
 * Compute average lead time breakdown: percentage of time spent active vs waiting vs blocked.
 * Returns null if no timelines with lead time data.
 */
export function computeLeadTimeBreakdown(
  timelines: TicketTimeline[],
): { activePercent: number; waitPercent: number; blockedPercent: number } | null {
  let totalActive = 0;
  let totalWait = 0;
  let totalBlocked = 0;
  let count = 0;

  for (const tl of timelines) {
    if (tl.leadTimeHours == null || tl.leadTimeHours <= 0) continue;
    const total = tl.activeTimeHours + tl.waitTimeHours + tl.blockedTimeHours;
    if (total <= 0) continue;

    totalActive += tl.activeTimeHours / total;
    totalWait += tl.waitTimeHours / total;
    totalBlocked += tl.blockedTimeHours / total;
    count++;
  }

  if (count === 0) return null;
  return {
    activePercent: (totalActive / count) * 100,
    waitPercent: (totalWait / count) * 100,
    blockedPercent: (totalBlocked / count) * 100,
  };
}

/**
 * Compute work type distribution from tickets.
 * Returns sorted by count descending.
 */
export function computeWorkTypeDistribution(
  tickets: ProcessedTicket[],
): Array<{ type: string; count: number; percentage: number }> {
  const byType = new Map<string, number>();

  for (const t of tickets) {
    const type = t.issue_type || 'Unknown';
    byType.set(type, (byType.get(type) ?? 0) + 1);
  }

  const total = tickets.length;
  return Array.from(byType.entries())
    .map(([type, count]) => ({
      type,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Invalidate timeline cache after sync/reprocess.
 */
export function invalidateTimelineCache(projectKey?: string): void {
  if (projectKey) {
    timelineCaches.delete(projectKey);
  } else {
    timelineCaches.clear();
  }
}
