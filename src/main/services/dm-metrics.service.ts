import { getConfig } from './config.service.js';
import { getAllTickets } from './ticket.service.js';
import {
  getTimelines, computePercentiles, computeWeeklyThroughput,
  computeTimeToFirstActivity, computeLeadTimeBreakdown,
} from './timeline.service.js';
import type {
  DmFlowMetricsResponse,
  CfdDataPoint,
  LeadTimeHistogramBucket,
  WipStatus,
  TieredAgingEntry,
  BlockerEntry,
  MonteCarloResult,
  ProcessedTicket,
  TicketTimeline,
} from '../../shared/types.js';

/**
 * DM Flow Metrics — CFD, lead time, WIP, aging WIP, blockers,
 * flow efficiency, throughput stability, Monte Carlo forecast.
 */
export function getDmFlowMetrics(period: string, projectKey?: string): DmFlowMetricsResponse {
  const timelines = getTimelines(projectKey);
  const tickets = getAllTickets(projectKey);
  const ticketMap = new Map(tickets.map(t => [t.key, t]));
  const cfg = getConfig();
  const traces: Record<string, string> = {};

  // Filter by period for resolved-ticket metrics
  const filteredTimelines = filterByPeriod(timelines, ticketMap, period);
  const filteredTickets = filteredTimelines
    .map(tl => ticketMap.get(tl.key))
    .filter((t): t is ProcessedTicket => t != null);

  // CFD
  const cfd = computeCfd(timelines, ticketMap);

  // Lead time distribution
  const leadTimes = filteredTimelines
    .map(tl => tl.leadTimeHours)
    .filter((h): h is number => h != null);
  const ltPerc = computePercentiles(leadTimes, [50, 85, 95]);
  const leadTimeDistribution = { p50: ltPerc.p50, p85: ltPerc.p85, p95: ltPerc.p95 };

  // Lead time histogram
  const leadTimeHistogram = computeLeadTimeHistogram(leadTimes);

  // WIP
  const wipLimit = cfg.wip_limit ?? null;
  const wip = computeWip(timelines, ticketMap, wipLimit);

  // Aging WIP tiered
  const thresholds = cfg.aging_thresholds ?? { warning_days: 3, critical_days: 7, escalation_days: 14 };
  const agingWipTiered = computeAgingWipTiered(timelines, ticketMap, thresholds);

  // Blockers
  const blockers = computeBlockers(timelines, ticketMap);

  // Flow efficiency
  const flowEfficiency = computeFlowEfficiency(filteredTimelines);

  // Weekly throughput
  const weeklyThroughput = computeWeeklyThroughput(timelines, 12);

  // Throughput stability
  const throughputStability = computeThroughputStability(weeklyThroughput);

  // Monte Carlo forecast
  const monteCarlo = runMonteCarlo(weeklyThroughput, wip.count);

  // New metrics
  const arrivalVsDeparture = computeArrivalVsDeparture(timelines, ticketMap);
  const batchSizeTrend = computeBatchSizeTrend(timelines, ticketMap);
  const timeToFirstActivityHours = computeTimeToFirstActivity(filteredTimelines, ticketMap);
  const leadTimeBreakdown = computeLeadTimeBreakdown(filteredTimelines);

  // Totals
  const totalTickets = filteredTickets.length;
  const totalStoryPoints = filteredTickets.reduce((sum, t) => sum + (t.story_points ?? 0), 0);

  // Build computation traces
  traces.leadTimeP50 = `${timelines.length} total timelines\nPeriod "${period}": ${filteredTimelines.length} resolved\n${leadTimes.length} had valid lead time (created → done)\n${leadTimes.length > 0 ? `Range: ${Math.min(...leadTimes).toFixed(1)}h – ${Math.max(...leadTimes).toFixed(1)}h\np50 = ${ltPerc.p50.toFixed(1)}h, p85 = ${ltPerc.p85.toFixed(1)}h, p95 = ${ltPerc.p95.toFixed(1)}h` : 'No valid lead times'}`;

  const feValid = filteredTimelines.map(tl => tl.flowEfficiency).filter((e): e is number => e != null);
  traces.flowEfficiency = `${filteredTimelines.length} resolved timelines\n${feValid.length} had computable flow efficiency\n${feValid.length > 0 ? `Avg = ${flowEfficiency.average.toFixed(1)}%, Median = ${flowEfficiency.median.toFixed(1)}%` : 'No data'}`;

  const wipBreakdown = wip.byStatus.map(s => `${s.status}: ${s.count}`).join(', ');
  traces.wip = `${timelines.length} total timelines\n${wip.count} in active statuses (WIP)\n${wipLimit != null ? `WIP limit: ${wipLimit} — ${wip.overLimit ? 'OVER LIMIT' : 'within limit'}` : 'No WIP limit configured'}\n${wipBreakdown ? `Breakdown: ${wipBreakdown}` : ''}`;

  const wtCounts = weeklyThroughput.map(w => w.count);
  const wtMean = wtCounts.length > 0 ? wtCounts.reduce((a, b) => a + b, 0) / wtCounts.length : 0;
  traces.throughputStability = `${weeklyThroughput.length} weeks of throughput data\nWeekly counts: [${wtCounts.join(', ')}]\nMean = ${wtMean.toFixed(1)}\nStability = ${(throughputStability * 100).toFixed(0)}%`;

  const mcNonZero = weeklyThroughput.map(w => w.count).filter(c => c > 0);
  traces.monteCarlo = `${wip.count} WIP items, ${weeklyThroughput.length} weeks history\n${mcNonZero.length} non-zero weeks used for sampling\n10,000 simulations\n${monteCarlo.confidenceLevels.map(c => `${c.percentile}% confidence: ${c.weeks} weeks`).join('\n')}`;

  return {
    cfd,
    leadTimeDistribution,
    leadTimeHistogram,
    wip,
    agingWipTiered,
    blockers,
    flowEfficiency,
    throughputStability,
    weeklyThroughput,
    monteCarlo,
    arrivalVsDeparture,
    batchSizeTrend,
    timeToFirstActivityHours,
    leadTimeBreakdown,
    totalTickets,
    totalStoryPoints,
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
 * Cumulative Flow Diagram — daily status counts over the last 30 days.
 * Reconstructed from ticket timelines.
 */
function computeCfd(
  timelines: TicketTimeline[],
  ticketMap: Map<string, ProcessedTicket>,
): CfdDataPoint[] {
  const days = 30;
  const now = new Date();
  const result: CfdDataPoint[] = [];

  // Collect all unique statuses
  const allStatuses = new Set<string>();
  for (const tl of timelines) {
    for (const sp of tl.statusPeriods) {
      allStatuses.add(sp.status);
    }
  }
  const statusList = Array.from(allStatuses);

  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    date.setHours(23, 59, 59, 999);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
    const dateTime = date.getTime();

    const point: CfdDataPoint = { date: dateStr };
    for (const status of statusList) {
      point[status] = 0;
    }

    // For each ticket, find which status it was in on this date
    for (const tl of timelines) {
      const ticket = ticketMap.get(tl.key);
      if (!ticket?.created) continue;
      const createdTime = new Date(ticket.created).getTime();
      if (createdTime > dateTime) continue; // ticket didn't exist yet

      // Find the status period that contains this date
      let foundStatus: string | null = null;
      for (const sp of tl.statusPeriods) {
        const enteredTime = new Date(sp.enteredAt).getTime();
        const exitedTime = sp.exitedAt ? new Date(sp.exitedAt).getTime() : Date.now();
        if (enteredTime <= dateTime && dateTime <= exitedTime) {
          foundStatus = sp.status;
          break;
        }
      }

      // If not found in any period, use the last known status before this date
      if (!foundStatus) {
        for (let i = tl.statusPeriods.length - 1; i >= 0; i--) {
          const sp = tl.statusPeriods[i];
          if (new Date(sp.enteredAt).getTime() <= dateTime) {
            foundStatus = sp.status;
            break;
          }
        }
      }

      if (foundStatus && foundStatus in point) {
        (point[foundStatus] as number)++;
      }
    }

    result.push(point);
  }

  return result;
}

/**
 * Lead time histogram with day-range buckets.
 */
function computeLeadTimeHistogram(leadTimesHours: number[]): LeadTimeHistogramBucket[] {
  const buckets: Array<{ range: string; maxDays: number; count: number }> = [
    { range: '0-1d', maxDays: 1, count: 0 },
    { range: '1-3d', maxDays: 3, count: 0 },
    { range: '3-7d', maxDays: 7, count: 0 },
    { range: '1-2w', maxDays: 14, count: 0 },
    { range: '2-4w', maxDays: 28, count: 0 },
    { range: '4w+', maxDays: Infinity, count: 0 },
  ];

  for (const hours of leadTimesHours) {
    const days = hours / 24;
    for (const bucket of buckets) {
      if (days <= bucket.maxDays) {
        bucket.count++;
        break;
      }
    }
  }

  return buckets.map(b => ({ range: b.range, count: b.count }));
}

/**
 * WIP count — active tickets (not done, not backlog).
 */
function computeWip(
  timelines: TicketTimeline[],
  ticketMap: Map<string, ProcessedTicket>,
  wipLimit: number | null,
): WipStatus {
  const byStatus = new Map<string, number>();
  let count = 0;

  for (const tl of timelines) {
    const lastPeriod = tl.statusPeriods[tl.statusPeriods.length - 1];
    if (!lastPeriod) continue;
    if (lastPeriod.category === 'done' || lastPeriod.category === 'wait') continue;

    count++;
    const current = byStatus.get(lastPeriod.status) ?? 0;
    byStatus.set(lastPeriod.status, current + 1);
  }

  return {
    count,
    limit: wipLimit,
    overLimit: wipLimit != null && count > wipLimit,
    byStatus: Array.from(byStatus.entries())
      .map(([status, cnt]) => ({ status, count: cnt }))
      .sort((a, b) => b.count - a.count),
  };
}

/**
 * Aging WIP with 3 tiers based on config thresholds.
 */
function computeAgingWipTiered(
  timelines: TicketTimeline[],
  ticketMap: Map<string, ProcessedTicket>,
  thresholds: { warning_days: number; critical_days: number; escalation_days: number },
): TieredAgingEntry[] {
  const entries: TieredAgingEntry[] = [];

  for (const tl of timelines) {
    const lastPeriod = tl.statusPeriods[tl.statusPeriods.length - 1];
    if (!lastPeriod || lastPeriod.category === 'done' || lastPeriod.category === 'wait') continue;

    const days = tl.daysInCurrentStatus;
    if (days < thresholds.warning_days) continue;

    const ticket = ticketMap.get(tl.key);
    if (!ticket) continue;

    const tier: 'warning' | 'critical' | 'escalation' = days >= thresholds.escalation_days
      ? 'escalation'
      : days >= thresholds.critical_days
        ? 'critical'
        : 'warning';

    entries.push({
      key: tl.key,
      summary: ticket.summary,
      assignee: ticket.assignee,
      status: tl.currentStatus,
      daysInStatus: Math.round(days),
      storyPoints: ticket.story_points,
      tier,
    });
  }

  return entries.sort((a, b) => b.daysInStatus - a.daysInStatus);
}

/**
 * Top blocked tickets — sorted by blocked hours.
 */
function computeBlockers(
  timelines: TicketTimeline[],
  ticketMap: Map<string, ProcessedTicket>,
): BlockerEntry[] {
  return timelines
    .filter(tl => tl.blockedTimeHours > 0)
    .map(tl => {
      const ticket = ticketMap.get(tl.key);
      return {
        key: tl.key,
        summary: ticket?.summary ?? tl.key,
        assignee: ticket?.assignee ?? 'Unknown',
        blockedHours: tl.blockedTimeHours,
        currentStatus: tl.currentStatus,
      };
    })
    .sort((a, b) => b.blockedHours - a.blockedHours)
    .slice(0, 20);
}

/**
 * Average and median flow efficiency across timelines.
 */
function computeFlowEfficiency(timelines: TicketTimeline[]): { average: number; median: number } {
  const efficiencies = timelines
    .map(tl => tl.flowEfficiency)
    .filter((e): e is number => e != null);

  if (efficiencies.length === 0) return { average: 0, median: 0 };

  const average = efficiencies.reduce((s, e) => s + e, 0) / efficiencies.length;
  const sorted = [...efficiencies].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];

  return { average, median };
}

/**
 * Throughput stability = 1 - (stddev / mean) of weekly throughput counts.
 * Returns 0 if no data or mean is 0. Clamped to [0, 1].
 */
function computeThroughputStability(
  weeklyThroughput: Array<{ week: string; count: number }>,
): number {
  const counts = weeklyThroughput.map(w => w.count);
  if (counts.length === 0) return 0;

  const mean = counts.reduce((s, c) => s + c, 0) / counts.length;
  if (mean === 0) return 0;

  const variance = counts.reduce((s, c) => s + (c - mean) ** 2, 0) / counts.length;
  const stddev = Math.sqrt(variance);
  const cv = stddev / mean; // coefficient of variation

  return Math.max(0, Math.min(1, 1 - cv));
}

/**
 * Monte Carlo forecast — how many weeks to complete current WIP.
 * Runs 10000 simulations sampling from historical weekly throughput.
 */
function runMonteCarlo(
  weeklyThroughput: Array<{ week: string; count: number }>,
  wipCount: number,
  simulations = 10000,
): MonteCarloResult {
  const counts = weeklyThroughput.map(w => w.count).filter(c => c > 0);

  if (counts.length === 0 || wipCount === 0) {
    return {
      targetItems: wipCount,
      confidenceLevels: [
        { percentile: 50, weeks: 0 },
        { percentile: 85, weeks: 0 },
        { percentile: 95, weeks: 0 },
      ],
    };
  }

  const results: number[] = [];

  for (let i = 0; i < simulations; i++) {
    let remaining = wipCount;
    let weeks = 0;
    const maxWeeks = 52; // safety limit

    while (remaining > 0 && weeks < maxWeeks) {
      // Sample a random week's throughput
      const sample = counts[Math.floor(Math.random() * counts.length)];
      remaining -= sample;
      weeks++;
    }

    results.push(weeks);
  }

  results.sort((a, b) => a - b);

  const getPercentile = (p: number) => {
    const idx = Math.min(Math.floor((p / 100) * results.length), results.length - 1);
    return results[idx];
  };

  return {
    targetItems: wipCount,
    confidenceLevels: [
      { percentile: 50, weeks: getPercentile(50) },
      { percentile: 85, weeks: getPercentile(85) },
      { percentile: 95, weeks: getPercentile(95) },
    ],
  };
}

/**
 * Arrival vs Departure — tickets created vs resolved per week over 12 weeks.
 */
function computeArrivalVsDeparture(
  timelines: TicketTimeline[],
  ticketMap: Map<string, ProcessedTicket>,
): Array<{ week: string; arrived: number; departed: number }> {
  const weeks = 12;
  const now = new Date();
  const result: Array<{ week: string; arrived: number; departed: number }> = [];

  for (let w = weeks - 1; w >= 0; w--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);
    const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;

    let arrived = 0;
    let departed = 0;

    for (const tl of timelines) {
      const ticket = ticketMap.get(tl.key);
      if (!ticket) continue;

      // Arrived: ticket created in this week
      if (ticket.created) {
        const createdDate = new Date(ticket.created);
        if (createdDate >= weekStart && createdDate < weekEnd) arrived++;
      }

      // Departed: ticket entered done in this week
      const donePeriod = tl.statusPeriods.find(p => p.category === 'done');
      if (donePeriod) {
        const doneDate = new Date(donePeriod.enteredAt);
        if (doneDate >= weekStart && doneDate < weekEnd) departed++;
      }
    }

    result.push({ week: weekLabel, arrived, departed });
  }

  return result;
}

/**
 * Batch size trend — average story points per resolved ticket each week (12 weeks).
 */
function computeBatchSizeTrend(
  timelines: TicketTimeline[],
  ticketMap: Map<string, ProcessedTicket>,
): Array<{ week: string; avgSp: number }> {
  const weeks = 12;
  const now = new Date();
  const result: Array<{ week: string; avgSp: number }> = [];

  for (let w = weeks - 1; w >= 0; w--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);
    const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;

    let totalSp = 0;
    let count = 0;

    for (const tl of timelines) {
      const donePeriod = tl.statusPeriods.find(p => p.category === 'done');
      if (!donePeriod) continue;
      const doneDate = new Date(donePeriod.enteredAt);
      if (doneDate >= weekStart && doneDate < weekEnd) {
        const ticket = ticketMap.get(tl.key);
        totalSp += ticket?.story_points ?? 0;
        count++;
      }
    }

    result.push({ week: weekLabel, avgSp: count > 0 ? totalSp / count : 0 });
  }

  return result;
}
