import { getAllTickets } from './ticket.service.js';
import { getTimelines } from './timeline.service.js';
import { getConfig } from './config.service.js';
import type { ProcessedTicket, EpicSummary, TicketTimeline } from '../../shared/types.js';

/**
 * Group tickets by parent_key and compute epic summaries with timeline-based risk scores.
 */
export function getEpicSummaries(projectKey?: string): EpicSummary[] {
  const allTickets = getAllTickets(projectKey);
  const cfg = getConfig();
  const doneSet = new Set(cfg.done_statuses.map(s => s.toLowerCase()));
  const bugSet = new Set((cfg.bug_type_names ?? ['bug', 'defect']).map(s => s.toLowerCase()));
  const blockedSet = new Set(cfg.blocked_statuses.map(s => s.toLowerCase()));
  const agingThresholdDays = cfg.aging_thresholds?.warning_days ?? 5;

  // Build timeline map for timeline-based risk scoring
  const timelines = getTimelines(projectKey);
  const timelineMap = new Map<string, TicketTimeline>();
  for (const tl of timelines) {
    timelineMap.set(tl.key, tl);
  }

  // Group by parent key
  const epicMap = new Map<string, { summary: string; tickets: ProcessedTicket[] }>();

  for (const ticket of allTickets) {
    if (!ticket.parent_key) continue;
    if (!epicMap.has(ticket.parent_key)) {
      epicMap.set(ticket.parent_key, {
        summary: ticket.parent_summary || ticket.parent_key,
        tickets: [],
      });
    }
    epicMap.get(ticket.parent_key)!.tickets.push(ticket);
  }

  const summaries: EpicSummary[] = [];

  for (const [key, { summary, tickets }] of epicMap) {
    if (tickets.length === 0) continue;

    const resolved = tickets.filter(t => doneSet.has(t.status.toLowerCase()));
    const inProgress = tickets.filter(t => !doneSet.has(t.status.toLowerCase()));
    const totalSP = tickets.reduce((s, t) => s + (t.story_points ?? 0), 0);
    const resolvedSP = resolved.reduce((s, t) => s + (t.story_points ?? 0), 0);
    const progressPct = tickets.length > 0 ? Math.round((resolved.length / tickets.length) * 100) / 100 : 0;

    // Avg cycle time from timeline (calendar hours), falling back to eng_hours
    const resolvedTimelines = resolved
      .map(t => timelineMap.get(t.key))
      .filter((tl): tl is TicketTimeline => tl != null && tl.cycleTimeHours != null);
    const avgCycleTime = resolvedTimelines.length > 0
      ? Math.round((resolvedTimelines.reduce((s, tl) => s + tl.cycleTimeHours!, 0) / resolvedTimelines.length) * 10) / 10
      : null;

    // Avg lead time from timeline
    const timelinesWithLeadTime = resolved
      .map(t => timelineMap.get(t.key))
      .filter((tl): tl is TicketTimeline => tl != null && tl.leadTimeHours != null);
    const avgLeadTime = timelinesWithLeadTime.length > 0
      ? Math.round((timelinesWithLeadTime.reduce((s, tl) => s + tl.leadTimeHours!, 0) / timelinesWithLeadTime.length) * 10) / 10
      : null;

    // Rework count from timelines
    const reworkCount = tickets.reduce((s, t) => {
      const tl = timelineMap.get(t.key);
      return s + (tl?.reworkCount ?? 0);
    }, 0);

    // Aging WIP count (non-final tickets past threshold)
    const agingWipCount = inProgress.filter(t => {
      const tl = timelineMap.get(t.key);
      return tl != null && tl.daysInCurrentStatus >= agingThresholdDays;
    }).length;

    // Avg flow efficiency from resolved timelines
    const timelinesWithEfficiency = resolved
      .map(t => timelineMap.get(t.key))
      .filter((tl): tl is TicketTimeline => tl != null && tl.flowEfficiency != null);
    const avgFlowEfficiency = timelinesWithEfficiency.length > 0
      ? Math.round((timelinesWithEfficiency.reduce((s, tl) => s + tl.flowEfficiency!, 0) / timelinesWithEfficiency.length) * 10) / 10
      : null;

    // Risk score computation using timeline data
    const { riskScore, riskFactors } = computeRisk(
      tickets, resolved, avgCycleTime, progressPct, timelineMap, agingThresholdDays,
      doneSet, bugSet, blockedSet,
    );
    const riskLevel = riskScore <= 0.3 ? 'low' : riskScore <= 0.6 ? 'medium' : 'high';

    summaries.push({
      key,
      summary,
      totalTickets: tickets.length,
      resolvedTickets: resolved.length,
      totalSP: Math.round(totalSP * 10) / 10,
      resolvedSP: Math.round(resolvedSP * 10) / 10,
      progressPct,
      avgCycleTime,
      riskScore: Math.round(riskScore * 100) / 100,
      riskLevel,
      riskFactors,
      childTickets: tickets,
      inProgressTickets: inProgress.length,
      avgLeadTime,
      reworkCount,
      agingWipCount,
      avgFlowEfficiency,
    });
  }

  // Sort by risk score descending (highest risk first)
  summaries.sort((a, b) => b.riskScore - a.riskScore);
  return summaries;
}

/**
 * Get detailed epic information for a specific epic key.
 */
export function getEpicDetail(epicKey: string, projectKey?: string): EpicSummary | null {
  const all = getEpicSummaries(projectKey);
  return all.find(e => e.key === epicKey) ?? null;
}

/**
 * Compute risk score and human-readable risk factors using 7 weighted factors.
 *
 * riskScore = weighted sum of:
 *   - (1 - progressPct) * 0.25       // low progress = higher risk
 *   - overdueRatio * 0.20            // tickets past 2x average cycle time (timeline-based)
 *   - blockedRatio * 0.15            // tickets with blocked time (timeline) or blocked status (fallback)
 *   - bugRatio * 0.10                // bugs in the epic
 *   - reworkRatio * 0.10             // tickets with backward transitions (timeline)
 *   - agingWipRatio * 0.10           // active tickets aging beyond threshold (timeline)
 *   - reopenRatio * 0.10             // tickets resolved but back to non-final status
 */
function computeRisk(
  allTickets: ProcessedTicket[],
  resolved: ProcessedTicket[],
  avgCycleTime: number | null,
  progressPct: number,
  timelineMap: Map<string, TicketTimeline>,
  agingThresholdDays: number,
  doneSet: Set<string>,
  bugSet: Set<string>,
  blockedSet: Set<string>,
): { riskScore: number; riskFactors: string[] } {
  const factors: string[] = [];
  const total = allTickets.length;
  if (total === 0) return { riskScore: 0, riskFactors: [] };

  const nonFinal = allTickets.filter(t => !doneSet.has(t.status.toLowerCase()));

  // 1. Progress factor (weight: 0.25)
  const progressFactor = (1 - progressPct) * 0.25;
  if (progressPct < 0.5) {
    const inProgress = total - resolved.length;
    factors.push(`Only ${Math.round(progressPct * 100)}% complete with ${inProgress} of ${total} tickets still open`);
  }

  // 2. Overdue factor (weight: 0.20) — tickets past 2x avg cycle time using timeline
  let overdueFactor = 0;
  if (avgCycleTime && avgCycleTime > 0) {
    const overdue = nonFinal.filter(t => {
      const tl = timelineMap.get(t.key);
      if (tl) {
        // Use activeTimeHours for WIP tickets (they don't have cycleTimeHours yet)
        return tl.activeTimeHours > avgCycleTime * 2;
      }
      // Fallback to eng_hours if no timeline
      return t.eng_hours != null && t.eng_hours > avgCycleTime * 2;
    });
    const overdueRatio = overdue.length / total;
    overdueFactor = overdueRatio * 0.20;
    if (overdue.length > 0) {
      factors.push(`${overdue.length} ticket${overdue.length > 1 ? 's have' : ' has'} exceeded 2x the average cycle time`);
    }
  }

  // 3. Blocked factor (weight: 0.15) — using timeline blockedTimeHours for non-final tickets
  const blocked = nonFinal.filter(t => {
    const tl = timelineMap.get(t.key);
    if (tl) {
      return tl.blockedTimeHours > 0;
    }
    // Fallback to status string
    return blockedSet.has(t.status.toLowerCase());
  });
  const blockedRatio = blocked.length / total;
  const blockedFactor = blockedRatio * 0.15;
  if (blocked.length > 0) {
    factors.push(`${blocked.length} ticket${blocked.length > 1 ? 's are' : ' is'} currently blocked`);
  }

  // 4. Bug factor (weight: 0.10)
  const bugs = allTickets.filter(t => bugSet.has((t.issue_type ?? '').toLowerCase()));
  const bugRatio = bugs.length / total;
  const bugFactor = bugRatio * 0.10;
  if (bugRatio > 0.2) {
    factors.push(`Bug ratio (${Math.round(bugRatio * 100)}%) is above healthy threshold`);
  }

  // 5. Rework factor (weight: 0.10) — backward transitions from timeline
  const ticketsWithRework = allTickets.filter(t => {
    const tl = timelineMap.get(t.key);
    return tl != null && tl.hasRework;
  });
  const reworkRatio = ticketsWithRework.length / total;
  const reworkFactor = reworkRatio * 0.10;
  if (ticketsWithRework.length > 0) {
    factors.push(`${ticketsWithRework.length} ticket${ticketsWithRework.length > 1 ? 's have' : ' has'} rework (backward transitions)`);
  }

  // 6. Aging WIP factor (weight: 0.10) — active tickets past threshold
  const agingWip = nonFinal.filter(t => {
    const tl = timelineMap.get(t.key);
    return tl != null && tl.daysInCurrentStatus >= agingThresholdDays;
  });
  const agingWipRatio = agingWip.length / total;
  const agingWipFactor = agingWipRatio * 0.10;
  if (agingWip.length > 0) {
    factors.push(`${agingWip.length} ticket${agingWip.length > 1 ? 's are' : ' is'} aging in current status (${agingThresholdDays}+ days)`);
  }

  // 7. Reopen factor (weight: 0.10) — tickets resolved but back to non-final
  const reopened = allTickets.filter(t => t.resolved && !doneSet.has(t.status.toLowerCase()));
  const reopenRatio = reopened.length / total;
  const reopenFactor = reopenRatio * 0.10;
  if (reopened.length > 0) {
    factors.push(`${reopened.length} ticket${reopened.length > 1 ? 's have' : ' has'} been reopened after resolution`);
  }

  const riskScore = Math.min(1, progressFactor + overdueFactor + blockedFactor + bugFactor + reworkFactor + agingWipFactor + reopenFactor);
  return { riskScore, riskFactors: factors };
}
