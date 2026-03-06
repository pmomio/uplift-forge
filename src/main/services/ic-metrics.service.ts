import { getConfig } from './config.service.js';
import { getTickets } from './ticket.service.js';
import { getTimelines, computeSpAccuracy, computePercentiles } from './timeline.service.js';
import type { IcPersonalMetricsResponse, ProcessedTicket, TicketTimeline, IcWeeklyTrend, IcTimeInStatus, IcAgingItem, IcTeamComparison } from '../../shared/types.js';

/**
 * IC Persona Metrics — private personal metrics for the logged-in user.
 */

export function getIcPersonalMetrics(period = 'all'): IcPersonalMetricsResponse {
  const cfg = getConfig();
  const myId = cfg.my_account_id;

  if (!myId) {
    return { error: 'Personal account ID not configured. Please set it in Settings.' } as any;
  }

  const allTickets = getTickets();
  const timelines = getTimelines();
  const timelineMap = new Map(timelines.map(tl => [tl.key, tl]));

  // Filter to my tickets only
  const myTickets = allTickets.filter(t => t.assignee_id === myId);
  
  const weeks = period === '4w' ? 4 : period === '12w' ? 12 : 0;
  const currentTickets = filterByPeriod(myTickets, weeks);
  const currentTimelines = currentTickets.map(t => timelineMap.get(t.key)).filter(Boolean) as TicketTimeline[];

  const traces: Record<string, string> = {};

  // 1. Cycle Time Trend (weekly p50)
  const cycleTimeTrend = computeValueTrend(myTickets, timelineMap, 8, tl => tl.cycleTimeHours);
  const cycleTimeValues = currentTimelines.map(tl => tl.cycleTimeHours).filter((h): h is number => h != null);
  const pct = computePercentiles(cycleTimeValues);
  traces.cycleTimeP50 = `${cycleTimeValues.length} resolved tickets\np50 = ${pct.p50.toFixed(1)}h`;

  // 2. Throughput Trend
  const throughputTrend = computeCountTrend(myTickets, 8);

  // 3. Aging WIP
  const agingWip = computeMyAgingWip(myTickets, timelineMap);

  // 4. Time in Status Breakdown
  const timeInStatus = computeTimeInStatus(currentTimelines);

  // 5. Rework Rate + Trend
  const reworkCount = currentTimelines.filter(tl => tl.hasRework).length;
  const reworkRate = currentTimelines.length > 0 ? (reworkCount / currentTimelines.length) * 100 : 0;
  const reworkTrend = computeValueTrend(myTickets, timelineMap, 8, tl => tl.hasRework ? 100 : 0);
  traces.reworkRate = `${reworkCount} tickets with rework / ${currentTimelines.length} total resolved tickets`;

  // 6. Scope Trajectory (avg SP per ticket by month)
  const scopeTrajectory = computeScopeTrajectory(myTickets, 6);

  // 7. SP Estimation Accuracy
  const spAccuracy = computeSpAccuracy(currentTickets, currentTimelines, cfg.sp_to_days);
  const icSpTickets = currentTickets.filter(t => (t.story_points ?? 0) > 0);
  traces.spAccuracy = `${currentTickets.length} tickets\n${icSpTickets.length} had SP > 0\nsp_to_days config = ${cfg.sp_to_days ?? 1}\n${spAccuracy != null ? `Avg accuracy = ${spAccuracy.toFixed(0)}%` : 'Not computable'}`;

  // 8. First-time pass rate
  const firstTimePassRate = 100 - reworkRate;
  traces.firstTimePassRate = `100% - ${reworkRate.toFixed(1)}% rework rate`;

  // 9. Avg Review Wait Time
  const reviewWaitHours = computeReviewWait(currentTimelines);
  traces.avgReviewWait = `${currentTimelines.length} resolved tickets\nAvg time in statuses containing "review": ${reviewWaitHours?.toFixed(1) ?? 0}h`;

  // 10. Focus Score
  const productTickets = currentTickets.filter(t => ['story', 'task', 'feature'].includes(t.issue_type.toLowerCase()));
  const focusScore = currentTickets.length > 0 ? (productTickets.length / currentTickets.length) * 100 : null;
  traces.focusScore = `${productTickets.length} product tickets / ${currentTickets.length} total resolved tickets`;

  // 11. Team Comparison (optional)
  let teamComparison: IcTeamComparison[] | null = null;
  if (cfg.opt_in_team_comparison) {
    teamComparison = computeTeamComparison(currentTickets, currentTimelines, allTickets, timelines, cfg.sp_to_days);
    traces.teamComparison = `Benchmark based on ${allTickets.length} tickets from the entire team`;
  }

  // 12. Goal Progress
  const goalProgress = computeGoalProgress(currentTickets, currentTimelines, cfg.personal_goals);

  return {
    cycleTimeTrend,
    cycleTimeP50: pct.p50 || null,
    throughput: throughputTrend,
    agingWip,
    timeInStatus,
    reworkRate,
    reworkTrend,
    scopeTrajectory,
    spAccuracy,
    firstTimePassRate,
    avgReviewWaitHours: reviewWaitHours,
    focusScore,
    totalTickets: currentTickets.length,
    totalStoryPoints: currentTickets.reduce((s, t) => s + (t.story_points ?? 0), 0),
    teamComparison,
    goalProgress,
    period,
    traces,
  };
}

// --- Helpers ---

function filterByPeriod(tickets: ProcessedTicket[], weeks: number): ProcessedTicket[] {
  if (weeks === 0) return tickets;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);
  return tickets.filter((t) => t.resolved && new Date(t.resolved) >= cutoff);
}

function computeValueTrend(tickets: ProcessedTicket[], timelineMap: Map<string, TicketTimeline>, weeks: number, valueFn: (tl: TicketTimeline) => number | null): IcWeeklyTrend[] {
  const result: IcWeeklyTrend[] = [];
  const now = new Date();

  for (let i = weeks - 1; i >= 0; i--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);

    const weekTickets = tickets.filter(t => t.resolved && new Date(t.resolved) >= weekStart && new Date(t.resolved) < weekEnd);
    const weekValues = weekTickets.map(t => {
      const tl = timelineMap.get(t.key);
      return tl ? valueFn(tl) : null;
    }).filter((v): v is number => v != null);

    const avg = weekValues.length > 0 ? weekValues.reduce((a, b) => a + b, 0) / weekValues.length : 0;

    result.push({
      week: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
      value: Math.round(avg * 10) / 10,
    });
  }
  return result;
}

function computeCountTrend(tickets: ProcessedTicket[], weeks: number): IcWeeklyTrend[] {
  const result: IcWeeklyTrend[] = [];
  const now = new Date();

  for (let i = weeks - 1; i >= 0; i--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);

    const count = tickets.filter(t => t.resolved && new Date(t.resolved) >= weekStart && new Date(t.resolved) < weekEnd).length;

    result.push({
      week: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
      value: count,
    });
  }
  return result;
}

function computeMyAgingWip(myTickets: ProcessedTicket[], timelineMap: Map<string, TicketTimeline>): IcAgingItem[] {
  const activeStatuses = getConfig().active_statuses.map(s => s.toLowerCase());
  const myWip = myTickets.filter(t => activeStatuses.includes(t.status.toLowerCase()));

  return myWip.map(t => {
    const tl = timelineMap.get(t.key);
    return {
      key: t.key,
      summary: t.summary,
      status: t.status,
      daysInStatus: tl ? Math.round(tl.daysInCurrentStatus * 10) / 10 : 0,
      storyPoints: t.story_points,
    };
  }).sort((a, b) => b.daysInStatus - a.daysInStatus);
}

function computeTimeInStatus(timelines: TicketTimeline[]): IcTimeInStatus[] {
  const byStatus = new Map<string, number>();
  let totalHours = 0;

  for (const tl of timelines) {
    for (const p of tl.statusPeriods) {
      if (p.category === 'done') continue;
      byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + p.durationHours);
      totalHours += p.durationHours;
    }
  }

  return Array.from(byStatus.entries()).map(([status, hours]) => ({
    status,
    hours: Math.round(hours),
    percentage: totalHours > 0 ? (hours / totalHours) * 100 : 0,
  })).sort((a, b) => b.hours - a.hours);
}

function computeScopeTrajectory(tickets: ProcessedTicket[], months: number): IcPersonalMetricsResponse['scopeTrajectory'] {
  const result: IcPersonalMetricsResponse['scopeTrajectory'] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

    const monthTickets = tickets.filter(t => t.resolved && new Date(t.resolved) >= monthStart && new Date(t.resolved) <= monthEnd);
    const totalSp = monthTickets.reduce((s, t) => s + (t.story_points ?? 0), 0);
    const avgSp = monthTickets.length > 0 ? totalSp / monthTickets.length : 0;

    result.push({
      month: monthStart.toLocaleString('default', { month: 'short' }),
      avgSp: Math.round(avgSp * 10) / 10,
    });
  }
  return result;
}

function computeReviewWait(timelines: TicketTimeline[]): number | null {
  const durations: number[] = [];
  for (const tl of timelines) {
    let hours = 0;
    let found = false;
    for (const p of tl.statusPeriods) {
      if (p.status.toLowerCase().includes('review')) {
        hours += p.durationHours;
        found = true;
      }
    }
    if (found) durations.push(hours);
  }
  return durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
}

function computeTeamComparison(
  myTickets: ProcessedTicket[],
  myTimelines: TicketTimeline[],
  allTickets: ProcessedTicket[],
  allTimelines: TicketTimeline[],
  spToDays: number
): IcTeamComparison[] {
  const myCycleP50 = computePercentiles(myTimelines.map(tl => tl.cycleTimeHours).filter((h): h is number => h != null)).p50;
  const teamCycleP50 = computePercentiles(allTimelines.map(tl => tl.cycleTimeHours).filter((h): h is number => h != null)).p50;

  const myRework = myTimelines.length > 0 ? (myTimelines.filter(tl => tl.hasRework).length / myTimelines.length) * 100 : 0;
  const teamRework = allTimelines.length > 0 ? (allTimelines.filter(tl => tl.hasRework).length / allTimelines.length) * 100 : 0;

  const myAccuracy = computeSpAccuracy(myTickets, myTimelines, spToDays) || 0;
  const teamAccuracy = computeSpAccuracy(allTickets, allTimelines, spToDays) || 0;

  return [
    { metric: 'Cycle Time (p50)', myValue: myCycleP50, teamMedian: teamCycleP50 },
    { metric: 'Rework Rate (%)', myValue: myRework, teamMedian: teamRework },
    { metric: 'Estimation Accuracy (%)', myValue: myAccuracy, teamMedian: teamAccuracy },
  ];
}

function computeGoalProgress(tickets: ProcessedTicket[], timelines: TicketTimeline[], goals?: Record<string, number>): IcPersonalMetricsResponse['goalProgress'] {
  if (!goals) return null;

  const results: Array<{ metric: string; current: number; target: number }> = [];

  if (goals.cycle_time) {
    const p50 = computePercentiles(timelines.map(tl => tl.cycleTimeHours).filter((h): h is number => h != null)).p50;
    results.push({ metric: 'Cycle Time (p50)', current: p50, target: goals.cycle_time });
  }
  if (goals.throughput) {
    results.push({ metric: 'Weekly Throughput', current: tickets.length / 4, target: goals.throughput });
  }

  return results.length > 0 ? results : null;
}
