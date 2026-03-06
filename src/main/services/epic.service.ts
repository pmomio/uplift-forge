import { getConfig } from './config.service.js';
import { getAllTickets, FINAL_STATUSES } from './ticket.service.js';
import { getTimelines } from './timeline.service.js';
import type { EpicSummary, ProcessedTicket, TicketTimeline } from '../../shared/types.js';

/**
 * Epic Aggregation Service — groups tickets by parent epic and computes risk.
 */

export function getEpicSummaries(projectKey?: string): EpicSummary[] {
  const allTickets = getAllTickets(projectKey);
  const timelines = getTimelines(projectKey);
  const timelineMap = new Map(timelines.map(tl => [tl.key, tl]));

  // 1. Group tickets by parent_key
  const epicsMap = new Map<string, ProcessedTicket[]>();
  for (const t of allTickets) {
    if (t.parent_key) {
      const children = epicsMap.get(t.parent_key) ?? [];
      children.push(t);
      epicsMap.set(t.parent_key, children);
    }
  }

  // 2. Build summaries
  const summaries: EpicSummary[] = [];
  for (const [epicKey, children] of epicsMap.entries()) {
    const epicTicket = allTickets.find(t => t.key === epicKey);
    const summary = epicTicket?.summary ?? children[0].parent_summary ?? epicKey;

    const totalTickets = children.length;
    const resolved = children.filter(t => FINAL_STATUSES.includes(t.status));
    const resolvedTickets = resolved.length;

    const totalSP = children.reduce((s, t) => s + (t.story_points ?? 0), 0);
    const resolvedSP = resolved.reduce((s, t) => s + (t.story_points ?? 0), 0);

    const progressPct = totalTickets > 0 ? (resolvedTickets / totalTickets) : 0;

    // Avg cycle time for this epic's resolved tickets
    const resolvedTimelines = resolved.map(t => timelineMap.get(t.key)).filter((tl): tl is TicketTimeline => !!tl && tl.cycleTimeHours != null);
    const avgCycleTime = resolvedTimelines.length > 0
      ? Math.round((resolvedTimelines.reduce((s, tl) => s + tl.cycleTimeHours!, 0) / resolvedTimelines.length) * 10) / 10
      : null;

    // 3. Risk Scoring
    const { score, factors } = computeRiskScore(children, timelineMap, progressPct, avgCycleTime);

    summaries.push({
      key: epicKey,
      summary,
      totalTickets,
      resolvedTickets,
      totalSP,
      resolvedSP,
      progressPct,
      avgCycleTime,
      riskScore: score,
      riskLevel: score < 0.3 ? 'low' : score < 0.6 ? 'medium' : 'high',
      riskFactors: factors,
      childTickets: children,
    });
  }

  return summaries.sort((a, b) => b.riskScore - a.riskScore);
}

export function getEpicDetail(epicKey: string, projectKey?: string): EpicSummary | null {
  const summaries = getEpicSummaries(projectKey);
  return summaries.find(s => s.key === epicKey) ?? null;
}

/**
 * Weighted risk scoring formula (0.0 to 1.0).
 */
function computeRiskScore(
  allTickets: ProcessedTicket[], 
  timelineMap: Map<string, TicketTimeline>,
  progressPct: number, 
  avgCycleTime: number | null
): { score: number; factors: string[] } {
  const factors: string[] = [];
  let score = 0;

  // 1. Low progress factor (30%)
  if (progressPct < 0.2) {
    score += 0.3;
    factors.push('Low completion rate (< 20%)');
  } else if (progressPct < 0.5) {
    score += 0.15;
    factors.push('Partial completion (< 50%)');
  }

  // 2. Overdue factor — tickets with active time > 2x avg cycle time (30%)
  if (avgCycleTime && avgCycleTime > 0) {
    const overdue = allTickets.filter(t => {
      if (FINAL_STATUSES.includes(t.status)) return false;
      const tl = timelineMap.get(t.key);
      return tl && tl.activeTimeHours > avgCycleTime * 2;
    });
    if (overdue.length > 0) {
      const ratio = overdue.length / allTickets.length;
      score += Math.min(0.3, ratio * 0.6);
      factors.push(`${overdue.length} tickets trending past expected cycle time`);
    }
  }

  // 3. Blocked factor (20%)
  const blockedStatuses = getConfig().blocked_statuses.map(s => s.toLowerCase());
  const blocked = allTickets.filter(t => blockedStatuses.includes(t.status.toLowerCase()));
  if (blocked.length > 0) {
    const ratio = blocked.length / allTickets.length;
    score += Math.min(0.2, ratio * 0.5);
    factors.push(`${blocked.length} tickets currently blocked`);
  }

  // 4. Bug ratio factor (10%)
  const bugs = allTickets.filter(t => t.issue_type.toLowerCase().includes('bug'));
  if (bugs.length > 0) {
    const ratio = bugs.length / allTickets.length;
    if (ratio > 0.3) {
      score += 0.1;
      factors.push('High bug-to-feature ratio');
    }
  }

  // 5. Rework factor (10%)
  const withRework = allTickets.filter(t => timelineMap.get(t.key)?.hasRework);
  if (withRework.length > 0) {
    const ratio = withRework.length / allTickets.length;
    if (ratio > 0.2) {
      score += 0.1;
      factors.push('Frequent rework detected in workflow');
    }
  }

  return { score: Math.min(1.0, score), factors };
}
