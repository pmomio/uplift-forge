import { getConfig } from './config.service.js';
import { getAllTickets } from './ticket.service.js';
import {
  getTimelines, computePercentiles, computeWeeklyThroughput,
  computeSpAccuracy, computeReviewDuration, computeLeadTimeBreakdown, computeWorkTypeDistribution,
} from './timeline.service.js';
import type {
  EmTeamMetricsResponse,
  EmIndividualMetricsResponse,
  CycleTimeDistribution,
  WorkStreamThroughput,
  ContributionEntry,
  AgingWipEntry,
  EngineerBugRatio,
  EmEngineerDetail,
  ProcessedTicket,
  TicketTimeline,
} from '../../shared/types.js';

const BUG_TYPES = new Set(['bug', 'defect']);

/**
 * EM Team Metrics — cycle time distribution, throughput, contribution,
 * aging WIP, bug ratios, rework rate.
 */
export function getEmTeamMetrics(period: string, projectKey?: string): EmTeamMetricsResponse {
  const timelines = getTimelines(projectKey);
  const tickets = getAllTickets(projectKey);
  const ticketMap = new Map(tickets.map(t => [t.key, t]));
  const cfg = getConfig();
  const trackedIds = new Set((cfg.tracked_engineers ?? []).map(e => e.accountId));
  const traces: Record<string, string> = {};

  // Filter by period
  const filteredTimelines = filterByPeriod(timelines, ticketMap, period);

  // Always scope to tracked engineers (empty = show none)
  const scopedTimelines = filteredTimelines.filter(tl => {
    const t = ticketMap.get(tl.key);
    return t?.assignee_id != null && trackedIds.has(t.assignee_id);
  });
  const scopedTickets = scopedTimelines
    .map(tl => ticketMap.get(tl.key))
    .filter((t): t is ProcessedTicket => t != null);

  // Cycle time distribution (scoped to tracked engineers)
  const cycleTime = computeCycleTimeDistribution(scopedTimelines);

  // Throughput by work stream (scoped to tracked engineers)
  const throughputByWorkStream = computeWorkStreamThroughput(scopedTickets);

  // Weekly throughput (scoped to tracked engineers)
  const scopedAllTimelines = timelines.filter(tl => {
    const t = ticketMap.get(tl.key);
    return t?.assignee_id != null && trackedIds.has(t.assignee_id);
  });
  const weeklyThroughput = computeWeeklyThroughput(scopedAllTimelines, 8);

  // Contribution spread (scoped to tracked engineers)
  const contributionSpread = computeContributionSpread(scopedTickets);

  // Aging WIP (scoped to tracked engineers)
  const thresholds = cfg.aging_thresholds ?? { warning_days: 3, critical_days: 7, escalation_days: 14 };
  const agingWip = computeAgingWip(scopedAllTimelines, ticketMap, thresholds);

  // Bug ratio by engineer (scoped to tracked engineers)
  const bugRatioByEngineer = computeBugRatioByEngineer(scopedTickets);

  // Rework rate (scoped to tracked engineers)
  const reworkCount = scopedTimelines.filter(tl => tl.hasRework).length;
  const reworkRate = scopedTimelines.length > 0 ? reworkCount / scopedTimelines.length : 0;

  // New metrics
  const spAccuracy = computeSpAccuracy(scopedTickets, scopedTimelines, cfg.sp_to_days ?? 1);
  const firstTimePassRate = 1 - reworkRate;
  const avgReviewDurationHours = computeReviewDuration(scopedTimelines);
  const workTypeDistribution = computeWorkTypeDistribution(scopedTickets);
  const unestimatedCount = scopedTickets.filter(t => t.story_points == null || t.story_points === 0).length;
  const unestimatedRatio = scopedTickets.length > 0 ? unestimatedCount / scopedTickets.length : 0;
  const leadTimeBreakdown = computeLeadTimeBreakdown(scopedTimelines);

  // Totals (scoped to tracked engineers)
  const totalTickets = scopedTickets.length;
  const totalStoryPoints = scopedTickets.reduce((sum, t) => sum + (t.story_points ?? 0), 0);

  // Build computation traces
  traces.totalTickets = `${timelines.length} total timelines, ${tickets.length} tickets\nPeriod "${period}": ${filteredTimelines.length} resolved tickets remain\nScoped to ${trackedIds.size} tracked engineers: ${scopedTimelines.length} timelines\n${totalTickets} tickets, ${totalStoryPoints} SP`;

  const ctValid = scopedTimelines.map(tl => tl.cycleTimeHours).filter((h): h is number => h != null);
  traces.cycleTimeP50 = `${scopedTimelines.length} scoped timelines\n${ctValid.length} had valid cycle time (first active → done)\n${ctValid.length > 0 ? `Range: ${Math.min(...ctValid).toFixed(1)}h – ${Math.max(...ctValid).toFixed(1)}h\np50 = ${cycleTime.p50.toFixed(1)}h, p85 = ${cycleTime.p85.toFixed(1)}h, p95 = ${cycleTime.p95.toFixed(1)}h` : 'No valid cycle times'}`;

  traces.reworkRate = `${scopedTimelines.length} resolved tickets\n${reworkCount} had backward transitions\nRework rate = ${reworkCount}/${scopedTimelines.length} = ${(reworkRate * 100).toFixed(1)}%\nFirst-time pass rate = ${(firstTimePassRate * 100).toFixed(1)}%`;

  const spTickets = scopedTickets.filter(t => (t.story_points ?? 0) > 0 && (t.eng_hours ?? 0) > 0);
  traces.spAccuracy = `${scopedTickets.length} tickets\n${spTickets.length} had both SP > 0 and eng_hours > 0\nsp_to_days config = ${cfg.sp_to_days ?? 1}\n${spAccuracy != null ? `Avg accuracy = ${spAccuracy.toFixed(0)}%` : 'Not computable (no qualifying tickets)'}`;

  traces.avgReviewDuration = `${scopedTimelines.length} timelines\n${avgReviewDurationHours != null ? `Avg review duration = ${avgReviewDurationHours.toFixed(1)}h` : 'No review periods found'}`;

  traces.unestimatedRatio = `${scopedTickets.length} tickets\n${unestimatedCount} had SP = null or 0\nUnestimated ratio = ${(unestimatedRatio * 100).toFixed(1)}%`;

  return {
    cycleTime,
    throughputByWorkStream,
    weeklyThroughput,
    contributionSpread,
    agingWip,
    bugRatioByEngineer,
    reworkRate,
    spAccuracy,
    firstTimePassRate,
    avgReviewDurationHours,
    workTypeDistribution,
    unestimatedRatio,
    leadTimeBreakdown,
    totalTickets,
    totalStoryPoints,
    period,
    traces,
  };
}

/**
 * EM Individual Metrics — per-engineer cycle time, rework, bug ratio,
 * complexity, focus ratio with team averages.
 */
export function getEmIndividualMetrics(period: string, projectKey?: string): EmIndividualMetricsResponse {
  const timelines = getTimelines(projectKey);
  const tickets = getAllTickets(projectKey);
  const ticketMap = new Map(tickets.map(t => [t.key, t]));
  const cfg = getConfig();
  const trackedIds = new Set((cfg.tracked_engineers ?? []).map(e => e.accountId));
  const traces: Record<string, string> = {};

  const filteredTimelines = filterByPeriod(timelines, ticketMap, period);

  // Group by assignee — always scoped to tracked engineers (empty = show none)
  const byAssignee = new Map<string, { timelines: TicketTimeline[]; tickets: ProcessedTicket[] }>();

  for (const tl of filteredTimelines) {
    const ticket = ticketMap.get(tl.key);
    if (!ticket || !ticket.assignee_id) continue;
    if (!trackedIds.has(ticket.assignee_id)) continue;

    if (!byAssignee.has(ticket.assignee_id)) {
      byAssignee.set(ticket.assignee_id, { timelines: [], tickets: [] });
    }
    const group = byAssignee.get(ticket.assignee_id)!;
    group.timelines.push(tl);
    group.tickets.push(ticket);
  }

  const engineers: EmEngineerDetail[] = [];

  for (const [accountId, group] of byAssignee) {
    const ticket = group.tickets[0];
    const displayName = ticket.assignee;
    const cycleTimes = group.timelines
      .map(tl => tl.cycleTimeHours)
      .filter((h): h is number => h != null);
    const cycleTimePerc = computePercentiles(cycleTimes, [50, 85]);

    const reworkCount = group.timelines.filter(tl => tl.hasRework).length;
    const reworkRate = group.timelines.length > 0 ? reworkCount / group.timelines.length : 0;

    const bugCount = group.tickets.filter(t => BUG_TYPES.has(t.issue_type.toLowerCase())).length;
    const bugRatio = group.tickets.length > 0 ? bugCount / group.tickets.length : 0;

    const totalSP = group.tickets.reduce((sum, t) => sum + (t.story_points ?? 0), 0);
    const complexityScore = group.tickets.length > 0 ? totalSP / group.tickets.length : null;

    const productTypes = new Set(['story', 'task', 'feature', 'enhancement', 'improvement']);
    const productTickets = group.tickets.filter(t => productTypes.has(t.issue_type.toLowerCase())).length;
    const focusRatio = group.tickets.length > 0 ? productTickets / group.tickets.length : null;

    const engSpAccuracy = computeSpAccuracy(group.tickets, group.timelines, cfg.sp_to_days ?? 1);
    const engFirstTimePassRate = 1 - reworkRate;

    engineers.push({
      accountId,
      displayName,
      cycleTimeP50: cycleTimePerc.p50 || null,
      cycleTimeP85: cycleTimePerc.p85 || null,
      reworkRate,
      bugRatio,
      tickets: group.tickets.length,
      storyPoints: totalSP,
      complexityScore,
      focusRatio,
      spAccuracy: engSpAccuracy,
      firstTimePassRate: engFirstTimePassRate,
    });
  }

  // Team averages
  const allCycleTimes = filteredTimelines
    .map(tl => tl.cycleTimeHours)
    .filter((h): h is number => h != null);
  const teamCycleTime = computePercentiles(allCycleTimes, [50]);

  const teamBugCount = filteredTimelines
    .map(tl => ticketMap.get(tl.key))
    .filter((t): t is ProcessedTicket => t != null)
    .filter(t => BUG_TYPES.has(t.issue_type.toLowerCase())).length;
  const teamReworkCount = filteredTimelines.filter(tl => tl.hasRework).length;

  const totalTickets = filteredTimelines.length;
  const totalSP = filteredTimelines
    .map(tl => ticketMap.get(tl.key))
    .filter((t): t is ProcessedTicket => t != null)
    .reduce((sum, t) => sum + (t.story_points ?? 0), 0);

  // Team-wide SP accuracy and first-time pass rate
  const teamReworkRate = totalTickets > 0 ? teamReworkCount / totalTickets : 0;
  const allFilteredTickets = filteredTimelines
    .map(tl => ticketMap.get(tl.key))
    .filter((t): t is ProcessedTicket => t != null);
  const teamSpAccuracy = computeSpAccuracy(allFilteredTickets, filteredTimelines, cfg.sp_to_days ?? 1);

  // Build computation traces
  traces.teamAvg = `${timelines.length} total timelines\nPeriod "${period}": ${filteredTimelines.length} resolved\n${byAssignee.size} engineers tracked\nTeam avg cycle p50 = ${teamCycleTime.p50 > 0 ? teamCycleTime.p50.toFixed(1) + 'h' : '—'}, rework = ${(teamReworkRate * 100).toFixed(1)}%, bug ratio = ${(totalTickets > 0 ? (teamBugCount / totalTickets) * 100 : 0).toFixed(1)}%`;

  return {
    engineers,
    teamAverages: {
      cycleTimeP50: teamCycleTime.p50 || null,
      reworkRate: teamReworkRate,
      bugRatio: totalTickets > 0 ? teamBugCount / totalTickets : 0,
      tickets: totalTickets,
      storyPoints: totalSP,
      spAccuracy: teamSpAccuracy,
      firstTimePassRate: 1 - teamReworkRate,
    },
    period,
    traces,
  };
}

// --- Helpers ---

function filterByPeriod(
  timelines: TicketTimeline[],
  ticketMap: Map<string, ProcessedTicket>,
  period: string,
): TicketTimeline[] {
  if (period === 'all') return timelines;

  const periodDays: Record<string, number> = {
    daily: 1,
    weekly: 7,
    'bi-weekly': 14,
    monthly: 30,
    quarterly: 90,
    'half-yearly': 180,
  };
  const days = periodDays[period] ?? 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return timelines.filter(tl => {
    const ticket = ticketMap.get(tl.key);
    if (!ticket?.resolved) return false;
    return new Date(ticket.resolved) >= cutoff;
  });
}

function computeCycleTimeDistribution(timelines: TicketTimeline[]): CycleTimeDistribution {
  const cycleTimes = timelines
    .map(tl => tl.cycleTimeHours)
    .filter((h): h is number => h != null);

  const perc = computePercentiles(cycleTimes, [50, 85, 95]);

  // 4-week trend
  const now = new Date();
  const trend: Array<{ week: string; p50: number; p85: number }> = [];
  for (let w = 3; w >= 0; w--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);

    const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    const weekCycleTimes = timelines
      .filter(tl => {
        if (tl.cycleTimeHours == null) return false;
        const donePeriod = tl.statusPeriods.find(p => p.category === 'done');
        if (!donePeriod) return false;
        const doneDate = new Date(donePeriod.enteredAt);
        return doneDate >= weekStart && doneDate < weekEnd;
      })
      .map(tl => tl.cycleTimeHours!)
      .filter((h): h is number => h != null);

    const weekPerc = computePercentiles(weekCycleTimes, [50, 85]);
    trend.push({ week: weekLabel, p50: weekPerc.p50, p85: weekPerc.p85 });
  }

  return { p50: perc.p50, p85: perc.p85, p95: perc.p95, trend };
}

function computeWorkStreamThroughput(tickets: ProcessedTicket[]): WorkStreamThroughput[] {
  const byStream = new Map<string, { count: number; sp: number }>();

  for (const t of tickets) {
    const ws = t.work_stream ?? 'Unclassified';
    const entry = byStream.get(ws) ?? { count: 0, sp: 0 };
    entry.count++;
    entry.sp += t.story_points ?? 0;
    byStream.set(ws, entry);
  }

  return Array.from(byStream.entries())
    .map(([workStream, data]) => ({
      workStream,
      count: data.count,
      storyPoints: data.sp,
    }))
    .sort((a, b) => b.count - a.count);
}

function computeContributionSpread(tickets: ProcessedTicket[]): ContributionEntry[] {
  const byAssignee = new Map<string, { displayName: string; sp: number; tickets: number }>();

  for (const t of tickets) {
    if (!t.assignee_id) continue;
    const entry = byAssignee.get(t.assignee_id) ?? { displayName: t.assignee, sp: 0, tickets: 0 };
    entry.sp += t.story_points ?? 0;
    entry.tickets++;
    byAssignee.set(t.assignee_id, entry);
  }

  const values = Array.from(byAssignee.values());
  const avgSP = values.length > 0 ? values.reduce((sum, e) => sum + e.sp, 0) / values.length : 1;

  return Array.from(byAssignee.entries())
    .map(([accountId, data]) => ({
      accountId,
      displayName: data.displayName,
      storyPoints: data.sp,
      tickets: data.tickets,
      normalizedScore: avgSP > 0 ? data.sp / avgSP : 0,
    }))
    .sort((a, b) => b.storyPoints - a.storyPoints);
}

function computeAgingWip(
  timelines: TicketTimeline[],
  ticketMap: Map<string, ProcessedTicket>,
  thresholds: { warning_days: number; critical_days: number; escalation_days: number },
): AgingWipEntry[] {
  const aging: AgingWipEntry[] = [];

  for (const tl of timelines) {
    // Only active (non-done) tickets
    const lastPeriod = tl.statusPeriods[tl.statusPeriods.length - 1];
    if (!lastPeriod || lastPeriod.category === 'done') continue;
    if (lastPeriod.category === 'wait') continue; // Skip backlog items

    const days = tl.daysInCurrentStatus;
    if (days < thresholds.warning_days) continue;

    const ticket = ticketMap.get(tl.key);
    if (!ticket) continue;

    const severity = days >= thresholds.escalation_days
      ? 'escalation'
      : days >= thresholds.critical_days
        ? 'critical'
        : 'warning';

    aging.push({
      key: tl.key,
      summary: ticket.summary,
      assignee: ticket.assignee,
      status: tl.currentStatus,
      daysInStatus: Math.round(days),
      storyPoints: ticket.story_points,
      severity,
    });
  }

  return aging.sort((a, b) => b.daysInStatus - a.daysInStatus);
}

function computeBugRatioByEngineer(tickets: ProcessedTicket[]): EngineerBugRatio[] {
  const byAssignee = new Map<string, { displayName: string; bugs: number; total: number }>();

  for (const t of tickets) {
    if (!t.assignee_id) continue;
    const entry = byAssignee.get(t.assignee_id) ?? { displayName: t.assignee, bugs: 0, total: 0 };
    entry.total++;
    if (BUG_TYPES.has(t.issue_type.toLowerCase())) entry.bugs++;
    byAssignee.set(t.assignee_id, entry);
  }

  return Array.from(byAssignee.entries())
    .map(([accountId, data]) => ({
      accountId,
      displayName: data.displayName,
      bugCount: data.bugs,
      totalCount: data.total,
      bugRatio: data.total > 0 ? data.bugs / data.total : 0,
    }))
    .sort((a, b) => b.bugRatio - a.bugRatio);
}
