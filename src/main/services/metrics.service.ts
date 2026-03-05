import { getConfig } from './config.service.js';
import { getTickets } from './ticket.service.js';
import type {
  ProcessedTicket,
  MetricsSummary,
  BreakdownEntry,
  MonthlyTrendEntry,
  TeamMetricsResponse,
  IndividualSummary,
  IndividualMetricsResponse,
  Persona,
} from '../../shared/types.js';

/**
 * Port of the metrics computation from backend/routes/tickets.py.
 */

/** Default metrics shown by persona in priority order (team-level KPIs). */
export const PERSONA_DEFAULT_METRICS: Record<Persona, { visible: string[]; hidden: string[] }> = {
  engineering_manager: {
    visible: ['total_tickets', 'total_story_points', 'total_eng_hours', 'estimation_accuracy', 'avg_eng_hours_per_sp', 'avg_cycle_time_hours', 'bug_count', 'bug_ratio', 'bug_eng_hours_pct'],
    hidden: [],
  },
  individual: {
    visible: ['total_tickets', 'total_eng_hours', 'total_story_points', 'estimation_accuracy', 'complexity_score', 'focus_ratio'],
    hidden: ['bug_count', 'bug_ratio', 'bug_eng_hours_pct', 'avg_cycle_time_hours'],
  },
  delivery_manager: {
    visible: ['total_tickets', 'total_story_points', 'total_eng_hours', 'avg_cycle_time_hours', 'bug_count'],
    hidden: ['estimation_accuracy', 'avg_eng_hours_per_sp', 'bug_ratio', 'bug_eng_hours_pct'],
  },
};

const PERIOD_DAYS: Record<string, number> = {
  weekly: 7,
  'bi-weekly': 14,
  monthly: 30,
};

function parseResolved(t: ProcessedTicket): Date | null {
  if (!t.resolved) return null;
  try {
    return new Date(t.resolved.replace('Z', '+00:00'));
  } catch {
    return null;
  }
}

function toDateOnly(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function computeMetrics(tickets: ProcessedTicket[]): {
  summary: MetricsSummary;
  byBu: Record<string, BreakdownEntry>;
  byWs: Record<string, BreakdownEntry>;
  byType: Record<string, BreakdownEntry>;
} {
  const empty: MetricsSummary = {
    total_tickets: 0,
    total_story_points: 0,
    total_eng_hours: 0,
    estimation_accuracy: null,
    avg_eng_hours_per_sp: null,
    avg_cycle_time_hours: null,
    bug_count: 0,
    bug_ratio: 0,
    bug_eng_hours_pct: 0,
  };

  if (tickets.length === 0) {
    return { summary: empty, byBu: {}, byWs: {}, byType: {} };
  }

  const cfg = getConfig();
  const bugSet = new Set((cfg.bug_type_names ?? ['bug', 'defect']).map(s => s.toLowerCase()));
  const totalTickets = tickets.length;
  const totalSp = tickets.reduce((s, t) => s + (t.story_points ?? 0), 0);
  const totalEngHours = tickets.reduce((s, t) => s + (t.eng_hours ?? 0), 0);

  const paired = tickets.filter((t) => t.story_points && t.eng_hours);
  const pairedSp = paired.reduce((s, t) => s + t.story_points!, 0);
  const pairedHours = paired.reduce((s, t) => s + t.eng_hours!, 0);
  const hoursPerSp = cfg.sp_to_days * 8;
  const estimationAccuracy = pairedHours > 0 ? Math.round(((pairedSp * hoursPerSp) / pairedHours) * 100) / 100 : null;

  const avgHoursPerSp = totalSp > 0 ? Math.round((totalEngHours / totalSp) * 10) / 10 : null;

  const ticketsWithHours = tickets.filter((t) => t.eng_hours);
  const avgCycleTime =
    ticketsWithHours.length > 0
      ? Math.round((ticketsWithHours.reduce((s, t) => s + t.eng_hours!, 0) / ticketsWithHours.length) * 10) / 10
      : null;

  const bugs = tickets.filter((t) => bugSet.has((t.issue_type ?? '').toLowerCase()));
  const bugCount = bugs.length;
  const bugEngHours = bugs.reduce((s, t) => s + (t.eng_hours ?? 0), 0);

  const summary: MetricsSummary = {
    total_tickets: totalTickets,
    total_story_points: Math.round(totalSp * 10) / 10,
    total_eng_hours: Math.round(totalEngHours * 10) / 10,
    estimation_accuracy: estimationAccuracy,
    avg_eng_hours_per_sp: avgHoursPerSp,
    avg_cycle_time_hours: avgCycleTime,
    bug_count: bugCount,
    bug_ratio: totalTickets > 0 ? Math.round((bugCount / totalTickets) * 100) / 100 : 0,
    bug_eng_hours_pct: totalEngHours > 0 ? Math.round((bugEngHours / totalEngHours) * 1000) / 10 : 0,
  };

  // Breakdowns
  const byBu: Record<string, BreakdownEntry> = {};
  const byWs: Record<string, BreakdownEntry> = {};
  const byType: Record<string, BreakdownEntry> = {};

  for (const t of tickets) {
    const bu = t.tpd_bu || 'Unassigned';
    if (!byBu[bu]) byBu[bu] = { tickets: 0, story_points: 0, eng_hours: 0 };
    byBu[bu].tickets += 1;
    byBu[bu].story_points += t.story_points ?? 0;
    byBu[bu].eng_hours += t.eng_hours ?? 0;

    const ws = t.work_stream || 'Unassigned';
    if (!byWs[ws]) byWs[ws] = { tickets: 0, story_points: 0, eng_hours: 0 };
    byWs[ws].tickets += 1;
    byWs[ws].story_points += t.story_points ?? 0;
    byWs[ws].eng_hours += t.eng_hours ?? 0;

    const it = t.issue_type || 'Unknown';
    if (!byType[it]) byType[it] = { tickets: 0, story_points: 0, eng_hours: 0 };
    byType[it].tickets += 1;
    byType[it].story_points += t.story_points ?? 0;
    byType[it].eng_hours += t.eng_hours ?? 0;
  }

  // Round breakdown values
  for (const bd of [byBu, byWs, byType]) {
    for (const v of Object.values(bd)) {
      v.story_points = Math.round(v.story_points * 10) / 10;
      v.eng_hours = Math.round(v.eng_hours * 10) / 10;
    }
  }

  return { summary, byBu, byWs, byType };
}

/**
 * Compute team-level KPIs from the ticket cache.
 */
export function getTeamMetrics(period = 'all', projectKey?: string): TeamMetricsResponse {
  // Get all final-status tickets, optionally scoped by project
  const allTickets = getTickets(projectKey);

  if (allTickets.length === 0) {
    return {
      summary: {} as MetricsSummary,
      prev_summary: {} as MetricsSummary,
      by_business_unit: {},
      prev_by_business_unit: {},
      by_work_stream: {},
      prev_by_work_stream: {},
      monthly_trend: [],
      issue_type_breakdown: {},
      prev_issue_type_breakdown: {},
      period,
    };
  }

  const today = new Date();
  const todayDate = toDateOnly(today);
  const days = PERIOD_DAYS[period];

  let currentTickets: ProcessedTicket[];
  let prevTickets: ProcessedTicket[];

  if (days) {
    const cutoffCurrent = todayDate - days * 86400000;
    const cutoffPrev = cutoffCurrent - days * 86400000;
    currentTickets = allTickets.filter((t) => {
      const resolved = parseResolved(t);
      return resolved ? toDateOnly(resolved) >= cutoffCurrent : false;
    });
    prevTickets = allTickets.filter((t) => {
      const resolved = parseResolved(t);
      if (!resolved) return false;
      const rd = toDateOnly(resolved);
      return rd >= cutoffPrev && rd < cutoffCurrent;
    });
  } else {
    currentTickets = allTickets;
    prevTickets = [];
  }

  const { summary, byBu, byWs, byType } = computeMetrics(currentTickets);
  const { summary: prevSummary, byBu: prevByBu, byWs: prevByWs, byType: prevByType } = computeMetrics(prevTickets);

  // Monthly trend (always from all tickets)
  const cfg = getConfig();
  const bugSetForTrend = new Set((cfg.bug_type_names ?? ['bug', 'defect']).map(s => s.toLowerCase()));
  const monthly: Record<string, { tickets: number; story_points: number; eng_hours: number; bug_count: number }> = {};
  for (const t of allTickets) {
    if (!t.resolved) continue;
    const monthKey = t.resolved.substring(0, 7);
    if (!monthly[monthKey]) monthly[monthKey] = { tickets: 0, story_points: 0, eng_hours: 0, bug_count: 0 };
    monthly[monthKey].tickets += 1;
    monthly[monthKey].story_points += t.story_points ?? 0;
    monthly[monthKey].eng_hours += t.eng_hours ?? 0;
    if (bugSetForTrend.has((t.issue_type ?? '').toLowerCase())) {
      monthly[monthKey].bug_count += 1;
    }
  }

  const monthlyTrend: MonthlyTrendEntry[] = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      tickets: v.tickets,
      story_points: Math.round(v.story_points * 10) / 10,
      eng_hours: Math.round(v.eng_hours * 10) / 10,
      bug_count: v.bug_count,
    }));

  return {
    summary,
    prev_summary: prevSummary,
    by_business_unit: byBu,
    prev_by_business_unit: prevByBu,
    by_work_stream: byWs,
    prev_by_work_stream: prevByWs,
    monthly_trend: monthlyTrend,
    issue_type_breakdown: byType,
    prev_issue_type_breakdown: prevByType,
    period,
  };
}

function computeIndividualSummary(tickets: ProcessedTicket[]): IndividualSummary {
  if (tickets.length === 0) {
    return {
      total_tickets: 0,
      total_story_points: 0,
      total_eng_hours: 0,
      avg_cycle_time_hours: null,
      avg_eng_hours_per_sp: null,
      estimation_accuracy: null,
      bug_ratio: 0,
      complexity_score: null,
      focus_ratio: null,
    };
  }

  const cfg = getConfig();
  const bugSet = new Set((cfg.bug_type_names ?? ['bug', 'defect']).map(s => s.toLowerCase()));
  const productWsSet = new Set((cfg.product_work_stream_names ?? ['product']).map(s => s.toLowerCase()));
  const totalTickets = tickets.length;
  const totalSp = tickets.reduce((s, t) => s + (t.story_points ?? 0), 0);
  const totalEngHours = tickets.reduce((s, t) => s + (t.eng_hours ?? 0), 0);

  const ticketsWithHours = tickets.filter((t) => t.eng_hours);
  const avgCycleTime =
    ticketsWithHours.length > 0
      ? Math.round((ticketsWithHours.reduce((s, t) => s + t.eng_hours!, 0) / ticketsWithHours.length) * 10) / 10
      : null;

  const avgHoursPerSp = totalSp > 0 ? Math.round((totalEngHours / totalSp) * 10) / 10 : null;

  const paired = tickets.filter((t) => t.story_points && t.eng_hours);
  const pairedSp = paired.reduce((s, t) => s + t.story_points!, 0);
  const pairedHours = paired.reduce((s, t) => s + t.eng_hours!, 0);
  const hoursPerSp = cfg.sp_to_days * 8;
  const estimationAccuracy = pairedHours > 0 ? Math.round(((pairedSp * hoursPerSp) / pairedHours) * 100) / 100 : null;

  const bugs = tickets.filter((t) => bugSet.has((t.issue_type ?? '').toLowerCase()));
  const bugRatio = totalTickets > 0 ? Math.round((bugs.length / totalTickets) * 100) / 100 : 0;

  const ticketsWithSp = tickets.filter((t) => t.story_points);
  const complexityScore = ticketsWithSp.length > 0 ? Math.round((totalSp / ticketsWithSp.length) * 10) / 10 : null;

  const productTickets = tickets.filter((t) => productWsSet.has((t.work_stream ?? '').toLowerCase()));
  const focusRatio = totalTickets > 0 ? Math.round((productTickets.length / totalTickets) * 100) / 100 : null;

  return {
    total_tickets: totalTickets,
    total_story_points: Math.round(totalSp * 10) / 10,
    total_eng_hours: Math.round(totalEngHours * 10) / 10,
    avg_cycle_time_hours: avgCycleTime,
    avg_eng_hours_per_sp: avgHoursPerSp,
    estimation_accuracy: estimationAccuracy,
    bug_ratio: bugRatio,
    complexity_score: complexityScore,
    focus_ratio: focusRatio,
  };
}

/**
 * Compute per-engineer KPIs for tracked engineers.
 */
export function getIndividualMetrics(period = 'all', projectKey?: string): IndividualMetricsResponse {
  const cfg = getConfig();
  const tracked = cfg.tracked_engineers;
  if (!tracked || tracked.length === 0) {
    return {
      engineers: [],
      team_averages: computeIndividualSummary([]),
      prev_team_averages: computeIndividualSummary([]),
      period,
    };
  }

  const trackedNames = new Set(tracked.map((e) => e.displayName));
  const allTickets = getTickets(projectKey);

  const today = new Date();
  const todayDate = toDateOnly(today);
  const days = PERIOD_DAYS[period];

  let currentTickets: ProcessedTicket[];
  let prevTickets: ProcessedTicket[];

  if (days) {
    const cutoffCurrent = todayDate - days * 86400000;
    const cutoffPrev = cutoffCurrent - days * 86400000;
    currentTickets = allTickets.filter((t) => {
      const resolved = parseResolved(t);
      return resolved ? toDateOnly(resolved) >= cutoffCurrent : false;
    });
    prevTickets = allTickets.filter((t) => {
      const resolved = parseResolved(t);
      if (!resolved) return false;
      const rd = toDateOnly(resolved);
      return rd >= cutoffPrev && rd < cutoffCurrent;
    });
  } else {
    currentTickets = allTickets;
    prevTickets = [];
  }

  // Group by assignee
  const byAssigneeCurrent = new Map<string, ProcessedTicket[]>();
  for (const t of currentTickets) {
    const name = t.assignee || 'Unassigned';
    if (!byAssigneeCurrent.has(name)) byAssigneeCurrent.set(name, []);
    byAssigneeCurrent.get(name)!.push(t);
  }

  const byAssigneePrev = new Map<string, ProcessedTicket[]>();
  for (const t of prevTickets) {
    const name = t.assignee || 'Unassigned';
    if (!byAssigneePrev.has(name)) byAssigneePrev.set(name, []);
    byAssigneePrev.get(name)!.push(t);
  }

  // Team averages across tracked engineers
  const trackedCurrent = currentTickets.filter((t) => trackedNames.has(t.assignee));
  const trackedPrev = prevTickets.filter((t) => trackedNames.has(t.assignee));
  const teamAvg = computeIndividualSummary(trackedCurrent);
  const prevTeamAvg = computeIndividualSummary(trackedPrev);

  // Per-engineer averages: divide totals by number of tracked engineers
  const n = tracked.length;
  if (n > 1) {
    for (const key of ['total_tickets', 'total_story_points', 'total_eng_hours'] as const) {
      teamAvg[key] = Math.round((teamAvg[key] / n) * 10) / 10;
      prevTeamAvg[key] = Math.round((prevTeamAvg[key] / n) * 10) / 10;
    }
  }

  const engineers = tracked.map((eng) => {
    const name = eng.displayName;
    const current = computeIndividualSummary(byAssigneeCurrent.get(name) ?? []);
    const prev = computeIndividualSummary(byAssigneePrev.get(name) ?? []);
    return {
      accountId: eng.accountId,
      displayName: name,
      avatar: eng.avatar,
      metrics: current,
      prev_metrics: prev,
    };
  });

  return {
    engineers,
    team_averages: teamAvg,
    prev_team_averages: prevTeamAvg,
    period,
  };
}
