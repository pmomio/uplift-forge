import { getConfig } from './config.service.js';
import { getAllTickets } from './ticket.service.js';
import {
  getTimelines, computePercentiles,
  computeSpAccuracy, computeReviewDuration,
} from './timeline.service.js';
import type {
  IcPersonalMetricsResponse,
  IcWeeklyTrend,
  IcTimeInStatus,
  IcAgingItem,
  IcTeamComparison,
  ProcessedTicket,
  TicketTimeline,
} from '../../shared/types.js';

/**
 * IC Personal Metrics — private to the individual contributor.
 * All data is filtered to config.my_account_id.
 */
export function getIcPersonalMetrics(period: string, projectKey?: string): IcPersonalMetricsResponse {
  const cfg = getConfig();
  const myAccountId = cfg.my_account_id;
  const traces: Record<string, string> = {};

  const allTimelines = getTimelines(projectKey);
  const allTickets = getAllTickets(projectKey);
  const ticketMap = new Map(allTickets.map(t => [t.key, t]));

  // Filter to my tickets
  const myTimelines = myAccountId
    ? allTimelines.filter(tl => {
        const ticket = ticketMap.get(tl.key);
        return ticket?.assignee_id === myAccountId;
      })
    : allTimelines; // If no account configured, show all (degraded mode)

  const myTickets = myTimelines
    .map(tl => ticketMap.get(tl.key))
    .filter((t): t is ProcessedTicket => t != null);

  // Filter by period for resolved-ticket metrics
  const filteredTimelines = filterByPeriod(myTimelines, ticketMap, period);
  const filteredTickets = filteredTimelines
    .map(tl => ticketMap.get(tl.key))
    .filter((t): t is ProcessedTicket => t != null);

  // Cycle time trend (weekly p50 over 8 weeks)
  const cycleTimeTrend = computeWeeklyCycleTimeTrend(myTimelines, ticketMap);

  // Overall cycle time p50
  const cycleTimes = filteredTimelines
    .map(tl => tl.cycleTimeHours)
    .filter((h): h is number => h != null);
  const ctPerc = computePercentiles(cycleTimes, [50]);
  const cycleTimeP50 = ctPerc.p50 || null;

  // Throughput trend (tickets per week over 8 weeks)
  const throughput = computeWeeklyThroughputTrend(myTimelines, ticketMap);

  // My aging WIP
  const agingWip = computeMyAgingWip(myTimelines, ticketMap);

  // Time in each status (from resolved tickets)
  const timeInStatus = computeTimeInStatus(filteredTimelines);

  // Rework rate + trend
  const reworkCount = filteredTimelines.filter(tl => tl.hasRework).length;
  const reworkRate = filteredTimelines.length > 0 ? reworkCount / filteredTimelines.length : 0;
  const reworkTrend = computeWeeklyReworkTrend(myTimelines, ticketMap);

  // Scope trajectory (avg SP per ticket by month)
  const scopeTrajectory = computeScopeTrajectory(myTickets);

  // New metrics
  const spAccuracy = computeSpAccuracy(filteredTickets, filteredTimelines, cfg.sp_to_days ?? 1);
  const firstTimePassRate = 1 - reworkRate;
  const avgReviewWaitHours = computeReviewDuration(filteredTimelines, cfg.review_status_keywords);

  const productSet = new Set((cfg.product_type_names ?? ['story', 'task', 'feature', 'enhancement', 'improvement']).map(s => s.toLowerCase()));
  const productTicketCount = filteredTickets.filter(t => productSet.has(t.issue_type.toLowerCase())).length;
  const focusScore = filteredTickets.length > 0 ? productTicketCount / filteredTickets.length : null;

  // Totals
  const totalTickets = filteredTickets.length;
  const totalStoryPoints = filteredTickets.reduce((sum, t) => sum + (t.story_points ?? 0), 0);

  // Team comparison (opt-in only)
  let teamComparison: IcTeamComparison[] | null = null;
  if (cfg.opt_in_team_comparison && myAccountId) {
    teamComparison = computeTeamComparison(allTimelines, ticketMap, myAccountId, period);
  }

  // Goal progress
  let goalProgress: Array<{ metric: string; current: number; target: number }> | null = null;
  if (cfg.personal_goals && Object.keys(cfg.personal_goals).length > 0) {
    goalProgress = computeGoalProgress(cfg.personal_goals, {
      cycleTimeP50,
      reworkRate,
      totalTickets,
      totalStoryPoints,
    });
  }

  // Build computation traces
  traces.cycleTimeP50 = `${allTimelines.length} total timelines\nFiltered to my_account_id: ${myTimelines.length}\nPeriod "${period}": ${filteredTimelines.length} resolved\n${cycleTimes.length} had valid cycle time\n${cycleTimeP50 != null ? `p50 = ${cycleTimeP50.toFixed(1)}h` : 'No valid cycle times'}`;

  traces.reworkRate = `${filteredTimelines.length} resolved tickets\n${reworkCount} had backward transitions\nRework rate = ${(reworkRate * 100).toFixed(1)}%`;

  traces.tickets = `My tickets (${myAccountId ? 'filtered' : 'all'}), period "${period}"\n${totalTickets} resolved, ${totalStoryPoints} SP`;

  const icSpTickets = filteredTickets.filter(t => (t.story_points ?? 0) > 0 && (t.eng_hours ?? 0) > 0);
  traces.spAccuracy = `${filteredTickets.length} tickets\n${icSpTickets.length} had both SP > 0 and eng_hours > 0\nsp_to_days config = ${cfg.sp_to_days ?? 1}\n${spAccuracy != null ? `Avg accuracy = ${spAccuracy.toFixed(0)}%` : 'Not computable'}`;

  traces.firstTimePassRate = `1 − rework rate = 1 − ${(reworkRate * 100).toFixed(1)}% = ${(firstTimePassRate * 100).toFixed(1)}%`;

  traces.avgReviewWait = `${filteredTimelines.length} timelines\n${avgReviewWaitHours != null ? `Avg review wait = ${avgReviewWaitHours.toFixed(1)}h` : 'No review periods found'}`;

  traces.focusScore = `${filteredTickets.length} tickets\n${productTicketCount} product types (${(cfg.product_type_names ?? ['story', 'task', 'feature', 'enhancement', 'improvement']).join(', ')})\n${focusScore != null ? `Focus score = ${(focusScore * 100).toFixed(0)}%` : 'No data'}`;

  if (teamComparison) {
    traces.teamComparison = `${new Map(allTimelines.map(tl => [ticketMap.get(tl.key)?.assignee_id, true])).size} engineers in comparison\n${teamComparison.map(tc => `${tc.metric}: mine = ${tc.myValue.toFixed(1)}, team median = ${tc.teamMedian.toFixed(1)}`).join('\n')}`;
  }

  return {
    cycleTimeTrend,
    cycleTimeP50,
    throughput,
    agingWip,
    timeInStatus,
    reworkRate,
    reworkTrend,
    scopeTrajectory,
    spAccuracy,
    firstTimePassRate,
    avgReviewWaitHours,
    focusScore,
    totalTickets,
    totalStoryPoints,
    teamComparison,
    goalProgress,
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

/**
 * Weekly cycle time p50 trend over 8 weeks.
 */
function computeWeeklyCycleTimeTrend(
  timelines: TicketTimeline[],
  ticketMap: Map<string, ProcessedTicket>,
): IcWeeklyTrend[] {
  const weeks = 8;
  const now = new Date();
  const result: IcWeeklyTrend[] = [];

  for (let w = weeks - 1; w >= 0; w--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);

    const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    const weekCycleTimes = timelines
      .filter(tl => {
        if (tl.cycleTimeHours == null) return false;
        const ticket = ticketMap.get(tl.key);
        if (!ticket?.resolved) return false;
        const resolvedDate = new Date(ticket.resolved);
        return resolvedDate >= weekStart && resolvedDate < weekEnd;
      })
      .map(tl => tl.cycleTimeHours!)
      .filter((h): h is number => h != null);

    const perc = computePercentiles(weekCycleTimes, [50]);
    result.push({ week: weekLabel, value: perc.p50 });
  }

  return result;
}

/**
 * Weekly throughput (tickets done per week) over 8 weeks.
 */
function computeWeeklyThroughputTrend(
  timelines: TicketTimeline[],
  ticketMap: Map<string, ProcessedTicket>,
): IcWeeklyTrend[] {
  const weeks = 8;
  const now = new Date();
  const result: IcWeeklyTrend[] = [];

  for (let w = weeks - 1; w >= 0; w--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);

    const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    let count = 0;

    for (const tl of timelines) {
      const donePeriod = tl.statusPeriods.find(p => p.category === 'done');
      if (donePeriod) {
        const doneDate = new Date(donePeriod.enteredAt);
        if (doneDate >= weekStart && doneDate < weekEnd) {
          count++;
        }
      }
    }

    result.push({ week: weekLabel, value: count });
  }

  return result;
}

/**
 * My aging WIP — in-progress tickets.
 */
function computeMyAgingWip(
  timelines: TicketTimeline[],
  ticketMap: Map<string, ProcessedTicket>,
): IcAgingItem[] {
  const items: IcAgingItem[] = [];

  for (const tl of timelines) {
    const lastPeriod = tl.statusPeriods[tl.statusPeriods.length - 1];
    if (!lastPeriod || lastPeriod.category === 'done' || lastPeriod.category === 'wait') continue;

    const ticket = ticketMap.get(tl.key);
    if (!ticket) continue;

    items.push({
      key: tl.key,
      summary: ticket.summary,
      status: tl.currentStatus,
      daysInStatus: Math.round(tl.daysInCurrentStatus),
      storyPoints: ticket.story_points,
    });
  }

  return items.sort((a, b) => b.daysInStatus - a.daysInStatus);
}

/**
 * Time in each status aggregated from resolved timelines.
 */
function computeTimeInStatus(timelines: TicketTimeline[]): IcTimeInStatus[] {
  const byStatus = new Map<string, number>();
  let totalHours = 0;

  for (const tl of timelines) {
    for (const sp of tl.statusPeriods) {
      const current = byStatus.get(sp.status) ?? 0;
      byStatus.set(sp.status, current + sp.durationHours);
      totalHours += sp.durationHours;
    }
  }

  return Array.from(byStatus.entries())
    .map(([status, hours]) => ({
      status,
      hours,
      percentage: totalHours > 0 ? (hours / totalHours) * 100 : 0,
    }))
    .sort((a, b) => b.hours - a.hours);
}

/**
 * Weekly rework rate trend over 8 weeks.
 */
function computeWeeklyReworkTrend(
  timelines: TicketTimeline[],
  ticketMap: Map<string, ProcessedTicket>,
): IcWeeklyTrend[] {
  const weeks = 8;
  const now = new Date();
  const result: IcWeeklyTrend[] = [];

  for (let w = weeks - 1; w >= 0; w--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);

    const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    const weekTimelines = timelines.filter(tl => {
      const ticket = ticketMap.get(tl.key);
      if (!ticket?.resolved) return false;
      const resolvedDate = new Date(ticket.resolved);
      return resolvedDate >= weekStart && resolvedDate < weekEnd;
    });

    const reworkCount = weekTimelines.filter(tl => tl.hasRework).length;
    const rate = weekTimelines.length > 0 ? reworkCount / weekTimelines.length : 0;
    result.push({ week: weekLabel, value: rate });
  }

  return result;
}

/**
 * Scope trajectory — avg story points per ticket by month.
 */
function computeScopeTrajectory(
  tickets: ProcessedTicket[],
): Array<{ month: string; avgSp: number }> {
  const byMonth = new Map<string, { totalSP: number; count: number }>();

  for (const t of tickets) {
    if (!t.resolved) continue;
    const d = new Date(t.resolved);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = byMonth.get(monthKey) ?? { totalSP: 0, count: 0 };
    entry.totalSP += t.story_points ?? 0;
    entry.count++;
    byMonth.set(monthKey, entry);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      avgSp: data.count > 0 ? data.totalSP / data.count : 0,
    }));
}

/**
 * Anonymous team comparison — compares IC metrics to team medians.
 */
function computeTeamComparison(
  allTimelines: TicketTimeline[],
  ticketMap: Map<string, ProcessedTicket>,
  myAccountId: string,
  period: string,
): IcTeamComparison[] {
  // Group timelines by assignee
  const byAssignee = new Map<string, TicketTimeline[]>();
  for (const tl of allTimelines) {
    const ticket = ticketMap.get(tl.key);
    if (!ticket?.assignee_id) continue;
    if (!byAssignee.has(ticket.assignee_id)) {
      byAssignee.set(ticket.assignee_id, []);
    }
    byAssignee.get(ticket.assignee_id)!.push(tl);
  }

  // Compute per-engineer cycle time p50
  const engineerCycleTimesP50: number[] = [];
  let myCycleTimeP50 = 0;

  // Compute per-engineer rework rates
  const engineerReworkRates: number[] = [];
  let myReworkRate = 0;

  // Compute per-engineer ticket counts
  const engineerTicketCounts: number[] = [];
  let myTicketCount = 0;

  for (const [accountId, tls] of byAssignee) {
    const filteredTls = filterByPeriod(tls, ticketMap, period);
    const cts = filteredTls.map(tl => tl.cycleTimeHours).filter((h): h is number => h != null);
    const perc = computePercentiles(cts, [50]);
    const rework = filteredTls.length > 0
      ? filteredTls.filter(tl => tl.hasRework).length / filteredTls.length
      : 0;

    if (accountId === myAccountId) {
      myCycleTimeP50 = perc.p50;
      myReworkRate = rework;
      myTicketCount = filteredTls.length;
    }

    engineerCycleTimesP50.push(perc.p50);
    engineerReworkRates.push(rework);
    engineerTicketCounts.push(filteredTls.length);
  }

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };

  return [
    { metric: 'Cycle Time p50 (hours)', myValue: myCycleTimeP50, teamMedian: median(engineerCycleTimesP50) },
    { metric: 'Rework Rate', myValue: myReworkRate, teamMedian: median(engineerReworkRates) },
    { metric: 'Throughput (tickets)', myValue: myTicketCount, teamMedian: median(engineerTicketCounts) },
  ];
}

/**
 * Goal progress — compare current values to personal targets.
 */
function computeGoalProgress(
  goals: Record<string, number>,
  current: { cycleTimeP50: number | null; reworkRate: number; totalTickets: number; totalStoryPoints: number },
): Array<{ metric: string; current: number; target: number }> {
  const mapping: Record<string, { label: string; value: number }> = {
    cycle_time_p50: { label: 'Cycle Time p50 (hours)', value: current.cycleTimeP50 ?? 0 },
    rework_rate: { label: 'Rework Rate', value: current.reworkRate },
    tickets: { label: 'Tickets Completed', value: current.totalTickets },
    story_points: { label: 'Story Points', value: current.totalStoryPoints },
  };

  const result: Array<{ metric: string; current: number; target: number }> = [];
  for (const [key, target] of Object.entries(goals)) {
    const m = mapping[key];
    if (m) {
      result.push({ metric: m.label, current: m.value, target });
    }
  }
  return result;
}
