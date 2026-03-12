import { getConfig } from './config.service.js';
import { getTickets } from './ticket.service.js';
import { getTimelines, computeSpAccuracy, computeReviewDuration, computeLeadTimeBreakdown, computeWorkTypeDistribution, computePercentiles } from './timeline.service.js';
import type { EmTeamMetricsResponse, EmIndividualMetricsResponse, ProcessedTicket, TicketTimeline, CycleTimeDistribution, ContributionEntry, AgingWipEntry, EngineerBugRatio } from '../../shared/types.js';

/**
 * EM Persona Metrics — computed from tickets and timelines.
 */

export function getEmTeamMetrics(period = 'all', projectKey?: string): EmTeamMetricsResponse {
  const allTickets = getTickets(projectKey);
  const timelines = getTimelines(projectKey);
  const timelineMap = new Map(timelines.map(tl => [tl.key, tl]));
  const cfg = getConfig();

  // Filter by tracked engineers if configured
  const trackedIds = cfg.tracked_engineers.map(e => e.accountId);
  const scopedTickets = trackedIds.length > 0 
    ? allTickets.filter(t => t.assignee_id && trackedIds.includes(t.assignee_id))
    : allTickets;

  const weeks = period === '4w' ? 4 : period === '12w' ? 12 : 0;
  const currentTickets = filterByPeriod(scopedTickets, weeks);
  const currentTimelines = currentTickets.map(t => timelineMap.get(t.key)).filter(Boolean) as TicketTimeline[];

  const traces: Record<string, string> = {};

  // 1. Cycle Time Distribution
  const cycleTimeValues = currentTimelines.map(tl => tl.cycleTimeHours).filter((h): h is number => h != null);
  const pct = computePercentiles(cycleTimeValues);
  const cycleTime: CycleTimeDistribution = {
    p50: pct.p50,
    p85: pct.p85,
    p95: pct.p95,
    trend: computeCycleTimeTrend(scopedTickets, timelineMap, 4),
  };
  traces.cycleTimeP50 = `${cycleTimeValues.length} resolved tickets with valid cycle time\np50 = ${pct.p50.toFixed(1)}h`;

  // 2. Weekly Throughput (8 weeks)
  const weeklyThroughput = computeWeeklyThroughputWithSP(scopedTickets, timelineMap, 8);

  // 3. Contribution Spread (normalized SP)
  const contributionSpread = computeContributionSpread(currentTickets);

  // 4. Aging WIP (from all tickets, not just resolved)
  const agingWip = computeAgingWip(allTickets, timelineMap);

  // 5. Bug Ratio by Engineer
  const bugRatioByEngineer = computeBugRatioByEngineer(currentTickets);

  // 6. Rework Rate
  const reworkCount = currentTimelines.filter(tl => tl.hasRework).length;
  const reworkRate = currentTimelines.length > 0 ? (reworkCount / currentTimelines.length) * 100 : 0;
  traces.reworkRate = `${reworkCount} tickets with rework / ${currentTimelines.length} total resolved tickets`;

  // 7. SP Estimation Accuracy
  const spAccuracy = computeSpAccuracy(currentTickets, currentTimelines, cfg.sp_to_days);
  const spTickets = currentTickets.filter(t => (t.story_points ?? 0) > 0);
  traces.spAccuracy = `${currentTickets.length} tickets\n${spTickets.length} had SP > 0\nsp_to_days config = ${cfg.sp_to_days ?? 1}\n${spAccuracy != null ? `Avg accuracy = ${spAccuracy.toFixed(0)}%` : 'Not computable (no qualifying tickets)'}`;

  // 8. First-time pass rate
  const firstTimePassRate = 100 - reworkRate;

  // 9. Avg Review Duration
  const avgReviewDurationHours = computeReviewDuration(currentTimelines);
  traces.avgReviewDuration = `${currentTimelines.length} resolved tickets\nAvg time in statuses containing \"review\": ${avgReviewDurationHours?.toFixed(1) ?? 0}h`;

  // 10. Work Type Distribution
  const workTypeDistribution = computeWorkTypeDistribution(currentTickets);

  // 11. Unestimated Ratio
  const unestimatedCount = currentTickets.filter(t => t.story_points == null || t.story_points === 0).length;
  const unestimatedRatio = currentTickets.length > 0 ? (unestimatedCount / currentTickets.length) * 100 : 0;
  traces.unestimatedRatio = `${unestimatedCount} unestimated / ${currentTickets.length} total tickets`;

  // 12. Lead Time Breakdown
  const leadTimeBreakdown = computeLeadTimeBreakdown(currentTimelines);

  return {
    cycleTime,
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
    totalTickets: currentTickets.length,
    totalStoryPoints: currentTickets.reduce((s, t) => s + (t.story_points ?? 0), 0),
    period,
    traces,
  };
}

export function getEmIndividualMetrics(period = 'all', projectKey?: string): EmIndividualMetricsResponse {
  const allTickets = getTickets(projectKey);
  const timelines = getTimelines(projectKey);
  const timelineMap = new Map(timelines.map(tl => [tl.key, tl]));
  const cfg = getConfig();

  const trackedIds = cfg.tracked_engineers.map(e => e.accountId);
  const engineers = cfg.tracked_engineers.length > 0 
    ? cfg.tracked_engineers 
    : Array.from(new Set(allTickets.map(t => t.assignee_id))).filter(Boolean).map(id => ({
        accountId: id!,
        displayName: allTickets.find(t => t.assignee_id === id)?.assignee ?? 'Unknown',
      }));

  const weeks = period === '4w' ? 4 : period === '12w' ? 12 : 0;
  const currentTickets = filterByPeriod(allTickets, weeks);

  const engineerMetrics = engineers.map(eng => {
    const eTickets = currentTickets.filter(t => t.assignee_id === eng.accountId);
    const eTimelines = eTickets.map(t => timelineMap.get(t.key)).filter(Boolean) as TicketTimeline[];
    
    const cycleTimes = eTimelines.map(tl => tl.cycleTimeHours).filter((h): h is number => h != null);
    const pct = computePercentiles(cycleTimes);
    
    const reworkCount = eTimelines.filter(tl => tl.hasRework).length;
    const reworkRate = eTimelines.length > 0 ? (reworkCount / eTimelines.length) * 100 : 0;
    
    const bugs = eTickets.filter(t => t.issue_type.toLowerCase().includes('bug')).length;
    const bugRatio = eTickets.length > 0 ? (bugs / eTickets.length) * 100 : 0;

    // Focus ratio: % of product work vs bugs/maint
    const productTickets = eTickets.filter(t => ['story', 'task', 'feature'].includes(t.issue_type.toLowerCase()));
    const focusRatio = eTickets.length > 0 ? (productTickets.length / eTickets.length) * 100 : null;

    return {
      accountId: eng.accountId,
      displayName: eng.displayName,
      cycleTimeP50: pct.p50 || null,
      cycleTimeP85: pct.p85 || null,
      reworkRate,
      bugRatio,
      tickets: eTickets.length,
      storyPoints: eTickets.reduce((s, t) => s + (t.story_points ?? 0), 0),
      complexityScore: eTickets.length > 0 ? eTickets.reduce((s, t) => s + (t.story_points ?? 0), 0) / eTickets.length : null,
      focusRatio,
      spAccuracy: computeSpAccuracy(eTickets, eTimelines, cfg.sp_to_days),
      firstTimePassRate: 100 - reworkRate,
    };
  });

  // Team averages
  const teamTimelines = currentTickets.map(t => timelineMap.get(t.key)).filter(Boolean) as TicketTimeline[];
  const teamCycleTimes = teamTimelines.map(tl => tl.cycleTimeHours).filter((h): h is number => h != null);
  const teamPct = computePercentiles(teamCycleTimes);
  const teamReworkCount = teamTimelines.filter(tl => tl.hasRework).length;
  const teamReworkRate = teamTimelines.length > 0 ? (teamReworkCount / teamTimelines.length) * 100 : 0;
  const teamBugs = currentTickets.filter(t => t.issue_type.toLowerCase().includes('bug')).length;

  const traces: Record<string, string> = {
    teamAvg: `Computed from ${currentTickets.length} tickets across ${engineers.length} tracked engineers`,
  };

  return {
    engineers: engineerMetrics,
    teamAverages: {
      cycleTimeP50: teamPct.p50 || null,
      reworkRate: teamReworkRate,
      bugRatio: currentTickets.length > 0 ? (teamBugs / currentTickets.length) * 100 : 0,
      tickets: currentTickets.length / (engineers.length || 1),
      storyPoints: currentTickets.reduce((s, t) => s + (t.story_points ?? 0), 0) / (engineers.length || 1),
      spAccuracy: computeSpAccuracy(currentTickets, teamTimelines, cfg.sp_to_days),
      firstTimePassRate: 100 - teamReworkRate,
    },
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

function computeCycleTimeTrend(tickets: ProcessedTicket[], timelineMap: Map<string, TicketTimeline>, weeks: number): CycleTimeDistribution['trend'] {
  const result: CycleTimeDistribution['trend'] = [];
  const now = new Date();

  for (let i = weeks - 1; i >= 0; i--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);

    const weekTickets = tickets.filter(t => t.resolved && new Date(t.resolved) >= weekStart && new Date(t.resolved) < weekEnd);
    const weekTimelines = weekTickets.map(t => timelineMap.get(t.key)).filter(Boolean) as TicketTimeline[];
    const cycleTimes = weekTimelines.map(tl => tl.cycleTimeHours).filter((h): h is number => h != null);
    const pct = computePercentiles(cycleTimes);

    result.push({
      week: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
      p50: pct.p50,
      p85: pct.p85,
    });
  }
  return result;
}

function computeWeeklyThroughputWithSP(tickets: ProcessedTicket[], timelineMap: Map<string, TicketTimeline>, weeks: number): EmTeamMetricsResponse['weeklyThroughput'] {
  const result: EmTeamMetricsResponse['weeklyThroughput'] = [];
  const now = new Date();

  for (let i = weeks - 1; i >= 0; i--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);

    const weekTickets = tickets.filter(t => t.resolved && new Date(t.resolved) >= weekStart && new Date(t.resolved) < weekEnd);
    
    result.push({
      week: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
      count: weekTickets.length,
      storyPoints: weekTickets.reduce((s, t) => s + (t.story_points ?? 0), 0),
    });
  }
  return result;
}

function computeContributionSpread(tickets: ProcessedTicket[]): ContributionEntry[] {
  const byEng = new Map<string, { displayName: string; sp: number; tickets: number }>();
  for (const t of tickets) {
    const id = t.assignee_id || t.assignee;
    const entry = byEng.get(id) || { displayName: t.assignee, sp: 0, tickets: 0 };
    entry.sp += t.story_points ?? 0;
    entry.tickets++;
    byEng.set(id, entry);
  }

  const entries = Array.from(byEng.entries()).map(([id, data]) => ({
    accountId: id,
    displayName: data.displayName,
    storyPoints: data.sp,
    tickets: data.tickets,
    normalizedScore: 0, // Computed below
  }));

  const avgSp = entries.length > 0 ? entries.reduce((s, e) => s + e.storyPoints, 0) / entries.length : 0;
  entries.forEach(e => {
    e.normalizedScore = avgSp > 0 ? (e.storyPoints / avgSp) : 1;
  });

  return entries.sort((a, b) => b.storyPoints - a.storyPoints);
}

function computeAgingWip(allTickets: ProcessedTicket[], timelineMap: Map<string, TicketTimeline>): AgingWipEntry[] {
  const activeStatuses = getConfig().active_statuses.map(s => s.toLowerCase());
  const wip = allTickets.filter(t => activeStatuses.includes(t.status.toLowerCase()));
  
  return wip.map(t => {
    const tl = timelineMap.get(t.key);
    const days = tl ? tl.daysInCurrentStatus : 0;
    
    let severity: AgingWipEntry['severity'] = 'warning';
    if (days > 14) severity = 'escalation';
    else if (days > 7) severity = 'critical';

    return {
      key: t.key,
      summary: t.summary,
      assignee: t.assignee,
      status: t.status,
      daysInStatus: Math.round(days * 10) / 10,
      storyPoints: t.story_points,
      severity,
    };
  }).sort((a, b) => b.daysInStatus - a.daysInStatus);
}

function computeBugRatioByEngineer(tickets: ProcessedTicket[]): EngineerBugRatio[] {
  const byEng = new Map<string, { displayName: string; bugs: number; total: number }>();
  for (const t of tickets) {
    const id = t.assignee_id || t.assignee;
    const entry = byEng.get(id) || { displayName: t.assignee, bugs: 0, total: 0 };
    entry.total++;
    if (t.issue_type.toLowerCase().includes('bug')) entry.bugs++;
    byEng.set(id, entry);
  }

  return Array.from(byEng.entries()).map(([id, data]) => ({
    accountId: id,
    displayName: data.displayName,
    bugCount: data.bugs,
    totalCount: data.total,
    bugRatio: (data.bugs / data.total) * 100,
  })).sort((a, b) => b.bugRatio - a.bugRatio);
}
