import { getConfig } from './config.service.js';
import { getAllTickets } from './ticket.service.js';
import { getTimelines, computePercentiles, computeWeeklyThroughput } from './timeline.service.js';
import { listProjects } from './project.service.js';
import type {
  CtoOrgMetricsResponse,
  ProjectThroughputTrend,
  ProjectCycleTime,
  ProcessedTicket,
  TicketTimeline,
} from '../../shared/types.js';

const BUG_TYPES = new Set(['bug', 'defect']);
const TECH_DEBT_LABELS = new Set(['tech-debt', 'technical-debt', 'debt', 'maintenance']);

/**
 * Management Org Metrics — cross-project throughput, cycle time,
 * bug escape rate, tech debt ratio, flow efficiency, headcount-normalized throughput.
 *
 * No tracked_engineers filtering — Management sees full org picture.
 */
export function getCtoOrgMetrics(period: string): CtoOrgMetricsResponse {
  const cfg = getConfig();
  const projects = listProjects();
  const traces: Record<string, string> = {};

  if (projects.length === 0) {
    return emptyResponse(period);
  }

  const throughputByProject: ProjectThroughputTrend[] = [];
  const cycleTimeByProject: ProjectCycleTime[] = [];

  let allTimelines: TicketTimeline[] = [];
  let allTickets: ProcessedTicket[] = [];

  // Per-project metrics
  for (const proj of projects) {
    const projectTimelines = getTimelines(proj.project_key);
    const projectTickets = getAllTickets(proj.project_key);
    const ticketMap = new Map(projectTickets.map(t => [t.key, t]));

    const filtered = filterByPeriod(projectTimelines, ticketMap, period);

    // Weekly throughput per project
    const weeklyData = computeWeeklyThroughput(filtered, 8);
    throughputByProject.push({
      projectKey: proj.project_key,
      projectName: proj.project_name ?? proj.project_key,
      weeks: weeklyData,
    });

    // Cycle time percentiles per project
    const cycleTimes = filtered
      .map(tl => tl.cycleTimeHours)
      .filter((h): h is number => h != null);
    const perc = computePercentiles(cycleTimes, [50, 85, 95]);
    cycleTimeByProject.push({
      projectKey: proj.project_key,
      projectName: proj.project_name ?? proj.project_key,
      p50: perc.p50,
      p85: perc.p85,
      p95: perc.p95,
    });

    allTimelines = allTimelines.concat(filtered);
    allTickets = allTickets.concat(
      filtered.map(tl => ticketMap.get(tl.key)).filter((t): t is ProcessedTicket => t != null)
    );
  }

  // Deduplicate tickets across projects (same ticket key could appear in multiple projects)
  const seenKeys = new Set<string>();
  const uniqueTickets: ProcessedTicket[] = [];
  for (const t of allTickets) {
    if (!seenKeys.has(t.key)) {
      seenKeys.add(t.key);
      uniqueTickets.push(t);
    }
  }

  // Aggregate metrics
  const totalTickets = uniqueTickets.length;
  const totalStoryPoints = uniqueTickets.reduce((sum, t) => sum + (t.story_points ?? 0), 0);

  // Bug escape rate
  const bugCount = uniqueTickets.filter(t => BUG_TYPES.has(t.issue_type.toLowerCase())).length;
  const storyCount = uniqueTickets.filter(t => !BUG_TYPES.has(t.issue_type.toLowerCase())).length;
  const bugEscapeRate = storyCount > 0 ? bugCount / storyCount : 0;

  // Tech debt ratio: bugs + tech-debt-labeled tickets vs total
  const techDebtCount = uniqueTickets.filter(t => {
    if (BUG_TYPES.has(t.issue_type.toLowerCase())) return true;
    if (t.labels && t.labels.some(l => TECH_DEBT_LABELS.has(l.toLowerCase()))) return true;
    return false;
  }).length;
  const techDebtRatio = totalTickets > 0 ? techDebtCount / totalTickets : 0;

  // Flow efficiency (deduplicated timelines)
  const seenTlKeys = new Set<string>();
  const uniqueTimelines: TicketTimeline[] = [];
  for (const tl of allTimelines) {
    if (!seenTlKeys.has(tl.key)) {
      seenTlKeys.add(tl.key);
      uniqueTimelines.push(tl);
    }
  }

  const flowEfficiencies = uniqueTimelines
    .map(tl => tl.flowEfficiency)
    .filter((fe): fe is number => fe != null);
  const avgFlowEff = flowEfficiencies.length > 0
    ? flowEfficiencies.reduce((a, b) => a + b, 0) / flowEfficiencies.length
    : 0;
  const sortedFe = [...flowEfficiencies].sort((a, b) => a - b);
  const medianFlowEff = sortedFe.length > 0
    ? sortedFe[Math.floor(sortedFe.length / 2)]
    : 0;

  // Headcount-normalized throughput
  const trackedCount = (cfg.tracked_engineers ?? []).length;
  const headcountNormalizedThroughput = trackedCount > 0
    ? totalTickets / trackedCount
    : null;

  // Aggregate weekly throughput
  const weeklyThroughput = computeWeeklyThroughput(uniqueTimelines, 8);

  // Delivery predictability (CoV of cycle time per project)
  const deliveryPredictability: Array<{ projectKey: string; projectName: string; coefficientOfVariation: number }> = [];
  for (const proj of projects) {
    const projectTimelines = getTimelines(proj.project_key);
    const projectTickets = getAllTickets(proj.project_key);
    const pTicketMap = new Map(projectTickets.map(t => [t.key, t]));
    const pFiltered = filterByPeriod(projectTimelines, pTicketMap, period);
    const cycleTimes = pFiltered
      .map(tl => tl.cycleTimeHours)
      .filter((h): h is number => h != null);

    if (cycleTimes.length >= 2) {
      const mean = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length;
      if (mean > 0) {
        const variance = cycleTimes.reduce((s, c) => s + (c - mean) ** 2, 0) / cycleTimes.length;
        const stddev = Math.sqrt(variance);
        deliveryPredictability.push({
          projectKey: proj.project_key,
          projectName: proj.project_name ?? proj.project_key,
          coefficientOfVariation: (stddev / mean) * 100,
        });
      }
    }
  }

  // Work type distribution per project
  const workTypeByProject: Array<{ projectKey: string; projectName: string; types: Array<{ type: string; count: number }> }> = [];
  for (const proj of projects) {
    const projectTickets = getAllTickets(proj.project_key);
    const pTicketMap = new Map(projectTickets.map(t => [t.key, t]));
    const pFiltered = filterByPeriod(getTimelines(proj.project_key), pTicketMap, period);
    const pResolvedTickets = pFiltered
      .map(tl => pTicketMap.get(tl.key))
      .filter((t): t is ProcessedTicket => t != null);

    const byType = new Map<string, number>();
    for (const t of pResolvedTickets) {
      byType.set(t.issue_type, (byType.get(t.issue_type) ?? 0) + 1);
    }
    workTypeByProject.push({
      projectKey: proj.project_key,
      projectName: proj.project_name ?? proj.project_key,
      types: Array.from(byType.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
    });
  }

  // Build computation traces
  traces.totalTickets = `${projects.length} projects\nPeriod "${period}": ${allTickets.length} tickets across projects\n${uniqueTickets.length} unique tickets (deduplicated)\n${totalStoryPoints} SP`;

  traces.bugEscapeRate = `${uniqueTickets.length} unique tickets\n${bugCount} bugs, ${storyCount} non-bug tickets\nBug escape rate = ${bugCount}/${storyCount} = ${(bugEscapeRate * 100).toFixed(1)}%`;

  traces.techDebtRatio = `${uniqueTickets.length} tickets\n${techDebtCount} bugs + tech-debt-labeled\nTech debt ratio = ${techDebtCount}/${totalTickets} = ${(techDebtRatio * 100).toFixed(1)}%`;

  traces.flowEfficiency = `${uniqueTimelines.length} unique timelines\n${flowEfficiencies.length} had computable flow efficiency\n${flowEfficiencies.length > 0 ? `Avg = ${avgFlowEff.toFixed(1)}%, Median = ${medianFlowEff.toFixed(1)}%` : 'No data'}`;

  traces.headcount = `${totalTickets} tickets / ${trackedCount > 0 ? trackedCount : 'no'} tracked engineers = ${headcountNormalizedThroughput != null ? headcountNormalizedThroughput.toFixed(1) : 'N/A'} tickets/engineer`;

  return {
    throughputByProject,
    cycleTimeByProject,
    bugEscapeRate,
    techDebtRatio,
    flowEfficiency: { average: avgFlowEff, median: medianFlowEff },
    headcountNormalizedThroughput,
    weeklyThroughput,
    deliveryPredictability,
    workTypeByProject,
    totalTickets,
    totalStoryPoints,
    totalProjects: projects.length,
    period,
    traces,
  };
}

function emptyResponse(period: string): CtoOrgMetricsResponse {
  return {
    throughputByProject: [],
    cycleTimeByProject: [],
    bugEscapeRate: 0,
    techDebtRatio: 0,
    flowEfficiency: { average: 0, median: 0 },
    headcountNormalizedThroughput: null,
    weeklyThroughput: [],
    deliveryPredictability: [],
    workTypeByProject: [],
    totalTickets: 0,
    totalStoryPoints: 0,
    totalProjects: 0,
    period,
  };
}

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
