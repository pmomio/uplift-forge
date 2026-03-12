import { getConfig } from './config.service.js';
import { getTickets } from './ticket.service.js';
import { getTimelines, computeSpAccuracy } from './timeline.service.js';
import type { MetricsSummary, BreakdownEntry, MonthlyTrendEntry, TeamMetricsResponse, IndividualMetricsResponse, ProcessedTicket, TicketTimeline } from '../../shared/types.js';

/**
 * Metric computation service — aggregates ticket data into KPIs.
 * Legacy service used by some components.
 */

/**
 * Filter tickets by resolution date period (last X weeks).
 */
function filterByPeriod(tickets: ProcessedTicket[], weeks: number): ProcessedTicket[] {
  if (weeks === 0) return tickets;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);
  return tickets.filter((t) => t.resolved && new Date(t.resolved) >= cutoff);
}

/**
 * Get aggregate metrics for the team.
 */
export function getTeamMetrics(period = 'all', projectKey?: string): TeamMetricsResponse {
  const allTickets = getTickets(projectKey);
  const timelines = getTimelines(projectKey);
  const timelineMap = new Map(timelines.map(tl => [tl.key, tl]));

  const weeks = period === '4w' ? 4 : period === '12w' ? 12 : 0;
  const currentTickets = filterByPeriod(allTickets, weeks);
  const prevTickets = weeks > 0 ? filterByPeriod(allTickets, weeks * 2).filter(t => !currentTickets.includes(t)) : [];

  const currentTimelines = currentTickets.map(t => timelineMap.get(t.key)).filter(Boolean) as TicketTimeline[];
  const prevTimelines = prevTickets.map(t => timelineMap.get(t.key)).filter(Boolean) as TicketTimeline[];

  return {
    summary: computeSummary(currentTickets, currentTimelines),
    prev_summary: computeSummary(prevTickets, prevTimelines),
    monthly_trend: computeMonthlyTrend(currentTickets),
    issue_type_breakdown: computeBreakdown(currentTickets, 'issue_type'),
    prev_issue_type_breakdown: computeBreakdown(prevTickets, 'issue_type'),
    period,
  };
}

function computeSummary(tickets: ProcessedTicket[], timelines: TicketTimeline[]): MetricsSummary {
  const cfg = getConfig();
  const bugs = tickets.filter((t) => t.issue_type.toLowerCase().includes('bug'));

  const totalTickets = tickets.length;
  const totalSP = tickets.reduce((s, t) => s + (t.story_points ?? 0), 0);

  const estimationAccuracy = computeSpAccuracy(tickets, timelines, cfg.sp_to_days);

  const cycleTimes = timelines.map(tl => tl.cycleTimeHours).filter((h): h is number => h != null);
  const avgCycleTime = cycleTimes.length > 0
    ? Math.round((cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) * 10) / 10
    : null;

  return {
    total_tickets: totalTickets,
    total_story_points: totalSP,
    estimation_accuracy: estimationAccuracy,
    avg_cycle_time_hours: avgCycleTime,
    bug_count: bugs.length,
    bug_ratio: totalTickets > 0 ? Math.round((bugs.length / totalTickets) * 100) : 0,
  };
}

function computeBreakdown(tickets: ProcessedTicket[], field: keyof ProcessedTicket): Record<string, BreakdownEntry> {
  const breakdown: Record<string, BreakdownEntry> = {};

  for (const t of tickets) {
    const val = String(t[field] ?? 'Unknown');
    if (!breakdown[val]) breakdown[val] = { tickets: 0, story_points: 0 };
    breakdown[val].tickets++;
    breakdown[val].story_points += t.story_points ?? 0;
  }

  return breakdown;
}

function computeMonthlyTrend(tickets: ProcessedTicket[]): MonthlyTrendEntry[] {
  const monthly: Record<string, { tickets: number; story_points: number; bug_count: number }> = {};

  for (const t of tickets) {
    if (!t.resolved) continue;
    const date = new Date(t.resolved);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthly[monthKey]) monthly[monthKey] = { tickets: 0, story_points: 0, bug_count: 0 };
    monthly[monthKey].tickets++;
    monthly[monthKey].story_points += t.story_points ?? 0;
    if (t.issue_type.toLowerCase().includes('bug')) monthly[monthKey].bug_count++;
  }

  return Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      ...v,
    }));
}

/**
 * Get individual metrics for all engineers.
 */
export function getIndividualMetrics(period = 'all', projectKey?: string): IndividualMetricsResponse {
  const allTickets = getTickets(projectKey);
  const timelines = getTimelines(projectKey);
  const timelineMap = new Map(timelines.map(tl => [tl.key, tl]));

  const weeks = period === '4w' ? 4 : period === '12w' ? 12 : 0;
  const currentTickets = filterByPeriod(allTickets, weeks);
  const prevTickets = weeks > 0 ? filterByPeriod(allTickets, weeks * 2).filter(t => !currentTickets.includes(t)) : [];

  const engineers = Array.from(new Set(allTickets.map(t => t.assignee))).filter(a => a !== 'Unassigned');

  const engineerData = engineers.map(name => {
    const eTickets = currentTickets.filter(t => t.assignee === name);
    const ePrevTickets = prevTickets.filter(t => t.assignee === name);
    const eTimelines = eTickets.map(t => timelineMap.get(t.key)).filter(Boolean) as TicketTimeline[];
    const ePrevTimelines = ePrevTickets.map(t => timelineMap.get(t.key)).filter(Boolean) as TicketTimeline[];

    return {
      accountId: eTickets[0]?.assignee_id ?? name,
      displayName: name,
      metrics: computeIndividualSummary(eTickets, eTimelines),
      prev_metrics: computeIndividualSummary(ePrevTickets, ePrevTimelines),
    };
  });

  return {
    engineers: engineerData,
    team_averages: computeIndividualSummary(currentTickets, currentTickets.map(t => timelineMap.get(t.key)).filter(Boolean) as TicketTimeline[]),
    prev_team_averages: computeIndividualSummary(prevTickets, prevTickets.map(t => timelineMap.get(t.key)).filter(Boolean) as TicketTimeline[]),
    period,
  };
}

function computeIndividualSummary(tickets: ProcessedTicket[], timelines: TicketTimeline[]): MetricsSummary & { complexity_score: number | null; focus_ratio: number | null } {
  const summary = computeSummary(tickets, timelines);

  // Complexity score: avg SP per ticket
  const complexityScore = tickets.length > 0
    ? Math.round((summary.total_story_points / tickets.length) * 10) / 10
    : null;

  // Focus ratio: % of tickets that are Stories or Tasks (vs Bugs/Sub-tasks)
  const productTickets = tickets.filter(t => ['story', 'task', 'feature'].includes(t.issue_type.toLowerCase()));
  const focusRatio = tickets.length > 0
    ? Math.round((productTickets.length / tickets.length) * 100)
    : null;

  return {
    ...summary,
    complexity_score: complexityScore,
    focus_ratio: focusRatio,
  };
}
