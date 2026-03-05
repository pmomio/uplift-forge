import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, Timer, Activity, Target, TrendingUp, Gauge, ArrowLeftRight, Layers } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line,
} from 'recharts';
import toast from 'react-hot-toast';
import { getDmFlowMetrics, triggerSync, syncAllProjects, getAiConfig } from '../api';
import MetricCard, { SectionTitle } from '../components/MetricCard';
import SuggestionPanel from '../components/SuggestionPanel';
import type { ProjectInfo } from '../App';
import type { DmFlowMetricsResponse, AiProvider, AiSuggestRequest } from '../../shared/types';

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'half-yearly', label: 'Half Year' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
];

const TIER_COLORS: Record<string, string> = {
  warning: 'text-amber-400',
  critical: 'text-orange-400',
  escalation: 'text-rose-400',
};

const TIER_BG: Record<string, string> = {
  warning: 'bg-amber-500/10 border-amber-500/30',
  critical: 'bg-orange-500/10 border-orange-500/30',
  escalation: 'bg-rose-500/10 border-rose-500/30',
};

// Tooltip content: What the metric is + target for high-performing teams
const TOOLTIPS = {
  leadTimeP50: {
    description: 'Median time from ticket creation to resolution. Includes all wait, blocked, and active time.',
    target: 'Elite: <3 days. High-performing: <7 days. >14 days indicates systemic delays.',
    trendUp: 'Lead time increasing — tickets taking longer from creation to done',
    trendDown: 'Lead time decreasing — faster end-to-end delivery',
    derivation: 'Data source: JIRA created date + changelogs (resolution/done transition).\nComputation: Lead time = done timestamp − created timestamp (calendar hours). The 50th percentile across all resolved tickets.\nFilters: Only resolved tickets in the selected period and project.\nConfig dependency: done_statuses.',
  },
  flowEfficiency: {
    description: 'Percentage of lead time spent in active work vs waiting. Higher means less idle time.',
    target: 'Elite: >40%. Good: >25%. Below 15% means most time is spent waiting.',
    trendUp: 'More time in active work — less waste in the pipeline',
    trendDown: 'More time waiting — investigate queues and handoff delays',
    derivation: 'Data source: JIRA changelogs — status periods from timeline engine.\nComputation: Per ticket: active_hours ÷ lead_time_hours × 100. The average and median are computed across all resolved tickets.\nFilters: Only resolved tickets with timeline data. Period and project filters.\nConfig dependency: active_statuses, blocked_statuses, done_statuses.',
  },
  wip: {
    description: 'Number of tickets currently in active workflow statuses.',
    target: '1-2 items per engineer. WIP above limit signals overcommitment and context switching.',
    trendUp: 'WIP growing — team may be starting more than finishing',
    trendDown: 'WIP shrinking — team is finishing work and reducing multitasking',
    derivation: 'Data source: JIRA current ticket statuses.\nComputation: Count of tickets whose current status is in active_statuses (not done, not backlog). Over-limit flag compares count to configured WIP limit.\nFilters: All open tickets in the project.\nConfig dependency: active_statuses, done_statuses, wip_limit (if configured).',
  },
  throughputStability: {
    description: 'Consistency of weekly throughput (1 - coefficient of variation). Higher is more predictable.',
    target: 'Elite: >80%. Good: >60%. Below 40% means highly unpredictable delivery.',
    trendUp: 'Delivery becoming more predictable',
    trendDown: 'Delivery becoming less predictable — investigate variability sources',
    derivation: 'Data source: Weekly throughput counts.\nComputation: 1 − (standard deviation of weekly ticket counts ÷ mean of weekly ticket counts). Uses the last 12 weeks of throughput data.\nFilters: Period and project filters.\nConfig dependency: done_statuses.',
  },
  leadTimeDistribution: {
    description: 'Histogram of ticket lead times with percentile markers (p50/p85/p95).',
    target: 'Tight distribution (narrow histogram). p95 should be <3x the p50.',
    trendUp: 'Distribution spreading — more outlier tickets with long lead times',
    trendDown: 'Distribution tightening — more consistent delivery times',
    derivation: 'Data source: JIRA created date + done transition from changelogs.\nComputation: Lead time hours are bucketed into day-ranges (0-1d, 1-3d, 3-7d, 1-2w, 2-4w, 4w+). Percentiles (p50, p85, p95) are calculated from the sorted lead time array.\nFilters: Only resolved tickets. Period and project filters.\nConfig dependency: done_statuses.',
  },
  weeklyThroughput: {
    description: 'Tickets completed per week. Feeds the Monte Carlo forecasting model.',
    target: 'Consistent numbers. Large dips indicate blockers or capacity issues.',
    trendUp: 'More tickets completed per week — higher velocity',
    trendDown: 'Fewer tickets completed — may indicate blockers or capacity drop',
    derivation: 'Data source: JIRA resolution dates.\nComputation: Resolved tickets bucketed by ISO week. Count per week over last 8+ weeks.\nFilters: Period and project filters.\nConfig dependency: done_statuses.',
  },
  cfd: {
    description: 'Cumulative flow of tickets through statuses over 30 days. Parallel bands = steady flow.',
    target: 'Even band widths. Widening bands in early statuses = growing WIP bottleneck.',
    trendUp: 'Bands widening — WIP accumulating in earlier statuses',
    trendDown: 'Bands narrowing — work flowing through more smoothly',
    derivation: 'Data source: JIRA changelogs — daily status snapshots.\nComputation: For each day in the last 30 days, count the number of tickets in each status at end-of-day. Displayed as a stacked area chart.\nFilters: All tickets created before or during the 30-day window. Project filter.\nConfig dependency: All configured statuses (active, blocked, done).',
  },
  monteCarlo: {
    description: 'Probabilistic delivery forecast using 10,000 simulations based on historical throughput.',
    target: 'Use the 85% confidence level for planning. Gap between 50% and 95% shows predictability.',
    trendUp: 'Forecast lengthening — more remaining work or lower throughput',
    trendDown: 'Forecast shortening — on track for earlier delivery',
    derivation: 'Data source: Historical weekly throughput (12 weeks) + current WIP count.\nComputation: 10,000 Monte Carlo simulations. Each simulation randomly samples a weekly throughput from the last 12 weeks and counts how many weeks until all current WIP items are completed. Reports 50th, 85th, and 95th percentile of simulated weeks.\nFilters: Uses current WIP as target items. Project filter.\nConfig dependency: done_statuses, active_statuses.',
  },
  wipBreakdown: {
    description: 'Distribution of in-progress work across workflow statuses.',
    target: 'Most WIP in active statuses. Accumulation in review/QA indicates a bottleneck.',
    trendUp: 'More items accumulating in this status',
    trendDown: 'Fewer items in this status — bottleneck clearing',
    derivation: 'Data source: JIRA current ticket statuses.\nComputation: Group current WIP tickets by their status. Count per status.\nFilters: Only tickets in active workflow statuses.\nConfig dependency: active_statuses, done_statuses.',
  },
  agingWip: {
    description: 'Tickets exceeding configured age thresholds, grouped by severity tier.',
    target: 'Zero escalation items. Review critical items daily. Resolve warnings within the sprint.',
    trendUp: 'More aging tickets — growing delivery risk',
    trendDown: 'Fewer aging tickets — stale work being addressed',
    derivation: 'Data source: JIRA changelogs — time since last status transition.\nComputation: Timeline engine calculates daysInCurrentStatus for each open ticket. Tiered: warning (>5d), critical (>10d), escalation (>15d).\nFilters: Only tickets currently in active statuses. Project filter.\nConfig dependency: active_statuses, done_statuses.',
  },
  blockers: {
    description: 'Tickets with the most time spent in blocked status. Shows delivery impediments.',
    target: 'No tickets blocked >3 days. Address blockers within 24 hours.',
    trendUp: 'More blocked time — blockers accumulating or persisting',
    trendDown: 'Less blocked time — blockers being resolved faster',
    derivation: 'Data source: JIRA changelogs — status periods in blocked statuses.\nComputation: Timeline engine sums total hours each ticket spent in blocked-category statuses. Sorted by blocked hours descending. Top 10 shown.\nFilters: Tickets with any blocked period. Project filter.\nConfig dependency: blocked_statuses.',
  },
  arrivalVsDeparture: {
    description: 'Tickets created vs resolved per week. When arrivals > departures, backlog grows.',
    target: 'Departure >= arrival. Growing gap = unsustainable.',
    trendUp: 'More tickets arriving/departing',
    trendDown: 'Fewer tickets arriving/departing',
    derivation: 'Data source: JIRA created dates + resolution dates.\nComputation: Per week: count(tickets created) vs count(tickets resolved). Displayed over 12 weeks.\nFilters: Project filter.\nConfig dependency: done_statuses.',
  },
  batchSizeTrend: {
    description: 'Average story points per completed ticket each week. Smaller batches flow faster.',
    target: 'Decreasing or stable. Spikes indicate large tickets clogging flow.',
    trendUp: 'Larger batches — may slow flow',
    trendDown: 'Smaller batches — faster flow',
    derivation: 'Data source: JIRA story_points + resolution dates.\nComputation: Per week: sum(story_points of resolved tickets) ÷ count(resolved tickets). Displayed over 12 weeks.\nFilters: Only resolved tickets with story points. Project filter.\nConfig dependency: field_ids.story_points, done_statuses.',
  },
  timeToFirstActivity: {
    description: 'Average time from ticket creation to first active status. Measures pickup delay.',
    target: 'Elite: <4h. Good: <1 day. >3 days = backlog management issue.',
    trendUp: 'Longer pickup delay — tickets sitting in backlog longer',
    trendDown: 'Faster pickup — work being started sooner',
    derivation: 'Data source: JIRA created date + changelogs (first active status transition).\nComputation: Per ticket: hours from created timestamp to first transition into an active-category status. Averaged across all resolved tickets.\nFilters: Only tickets that have at least one active transition. Period and project filters.\nConfig dependency: active_statuses.',
  },
  leadTimeBreakdown: {
    description: 'Average time split: active work vs waiting vs blocked. Shows where lead time is spent.',
    target: 'Active >50%. Wait <30%. Blocked <10%.',
    trendUp: 'More time in this category',
    trendDown: 'Less time in this category',
    derivation: 'Data source: JIRA changelogs — status periods from timeline engine.\nComputation: Each status period is categorized as active, wait, or blocked. Per ticket: hours in each category as percentage of lead time. Averaged across all resolved tickets.\nFilters: Only resolved tickets with timeline data. Period and project filters.\nConfig dependency: active_statuses, blocked_statuses, done_statuses.',
  },
};

interface DmFlowDashboardProps {
  refreshKey: number;
  project?: ProjectInfo | null;
  projectCount?: number;
}

const DmFlowDashboard: React.FC<DmFlowDashboardProps> = ({ refreshKey, project, projectCount }) => {
  const isMultiProject = (projectCount ?? 1) > 1;
  const [data, setData] = useState<DmFlowMetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [period, setPeriod] = useState('all');
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiProvider, setAiProvider] = useState<AiProvider>('openai');
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionRequest, setSuggestionRequest] = useState<AiSuggestRequest | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDmFlowMetrics(period);
      if (res.data && !('error' in res.data && !res.data.cfd)) {
        setData(res.data as DmFlowMetricsResponse);
      }
    } catch {
      toast.error('Failed to load flow metrics');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  useEffect(() => {
    getAiConfig().then(res => {
      if (res.data?.hasKey) {
        setAiConfigured(true);
        setAiProvider(res.data.provider);
      }
    }).catch(() => {});
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      if (isMultiProject) {
        await syncAllProjects();
      } else {
        await triggerSync();
      }
      await fetchData();
      toast.success('Synced & refreshed');
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const openSuggestion = (metricLabel: string, currentValue: string | number | null, helpText?: string) => {
    setSuggestionRequest({
      metricLabel,
      currentValue,
      helpText: helpText ?? '',
      context: `DM Flow Dashboard. Period: ${period}. Total tickets: ${data?.totalTickets ?? 0}, WIP: ${data?.wip.count ?? 0}, Flow Efficiency: ${data ? data.flowEfficiency.average.toFixed(0) : 0}%.`,
    });
    setSuggestionOpen(true);
  };

  const fmtHours = (h: number) => {
    if (h === 0) return '—';
    return h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`;
  };

  // Collect unique statuses for CFD chart from data
  const cfdStatuses = data?.cfd && data.cfd.length > 0
    ? Object.keys(data.cfd[0]).filter(k => k !== 'date')
    : [];

  const CFD_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#64748b', '#14b8a6', '#f97316'];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700/50 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">
            {isMultiProject ? 'All Projects — Flow Dashboard' : project?.name ? `${project.name} — Flow Dashboard` : 'Flow Dashboard'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Lead time, WIP, flow efficiency, throughput, and delivery forecast</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800/50 rounded-lg p-0.5 border border-slate-700/30">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === p.value
                    ? 'bg-indigo-500/20 text-indigo-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-medium px-3 py-2 rounded-lg border border-indigo-500/20 transition-all"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync & Refresh'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && !data ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw size={24} className="text-indigo-400 animate-spin" />
          </div>
        ) : data ? (
          <div className="space-y-6 max-w-6xl mx-auto">
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <MetricCard
                icon={<Timer size={16} />}
                label="Lead Time p50"
                value={fmtHours(data.leadTimeDistribution.p50)}
                color="indigo"
                tooltip={TOOLTIPS.leadTimeP50}
                dynamicDerivation={data.traces?.leadTimeP50}
                aiConfigured={aiConfigured}
                onAiSuggest={() => openSuggestion('Lead Time p50', fmtHours(data.leadTimeDistribution.p50), TOOLTIPS.leadTimeP50.description)}
              />
              <MetricCard
                icon={<Gauge size={16} />}
                label="Flow Efficiency"
                value={`${data.flowEfficiency.average.toFixed(0)}%`}
                color="emerald"
                tooltip={TOOLTIPS.flowEfficiency}
                dynamicDerivation={data.traces?.flowEfficiency}
                aiConfigured={aiConfigured}
                onAiSuggest={() => openSuggestion('Flow Efficiency', `${data.flowEfficiency.average.toFixed(0)}%`, TOOLTIPS.flowEfficiency.description)}
              />
              <MetricCard
                icon={<Activity size={16} />}
                label="WIP"
                value={String(data.wip.count)}
                color={data.wip.overLimit ? 'rose' : 'cyan'}
                subtitle={data.wip.limit != null ? `Limit: ${data.wip.limit}` : undefined}
                tooltip={TOOLTIPS.wip}
                dynamicDerivation={data.traces?.wip}
                aiConfigured={aiConfigured}
                onAiSuggest={() => openSuggestion('WIP', data.wip.count, TOOLTIPS.wip.description)}
              />
              <MetricCard
                icon={<TrendingUp size={16} />}
                label="Throughput Stability"
                value={`${(data.throughputStability * 100).toFixed(0)}%`}
                color="amber"
                tooltip={TOOLTIPS.throughputStability}
                dynamicDerivation={data.traces?.throughputStability}
                aiConfigured={aiConfigured}
                onAiSuggest={() => openSuggestion('Throughput Stability', `${(data.throughputStability * 100).toFixed(0)}%`, TOOLTIPS.throughputStability.description)}
              />
              <MetricCard
                icon={<ArrowLeftRight size={16} />}
                label="Time to First Activity"
                value={data.timeToFirstActivityHours != null ? fmtHours(data.timeToFirstActivityHours) : 'N/A'}
                color="violet"
                tooltip={TOOLTIPS.timeToFirstActivity}
                aiConfigured={aiConfigured}
                onAiSuggest={() => openSuggestion('Time to First Activity', data.timeToFirstActivityHours != null ? fmtHours(data.timeToFirstActivityHours) : null, TOOLTIPS.timeToFirstActivity.description)}
              />
            </div>

            {/* Lead time histogram */}
            {data.leadTimeHistogram.length > 0 && (
              <div className="glass-card p-5">
                <SectionTitle
                  title="Lead Time Distribution"
                  tooltip={TOOLTIPS.leadTimeDistribution}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Lead Time Distribution', `p50: ${fmtHours(data.leadTimeDistribution.p50)}, p85: ${fmtHours(data.leadTimeDistribution.p85)}, p95: ${fmtHours(data.leadTimeDistribution.p95)}`, TOOLTIPS.leadTimeDistribution.description)}
                />
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.leadTimeHistogram}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="range" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#cbd5e1' }} />
                    <Bar dataKey="count" fill="#6366f1" name="Tickets" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-6 mt-2 text-xs text-slate-400">
                  <span>p50: {fmtHours(data.leadTimeDistribution.p50)}</span>
                  <span>p85: {fmtHours(data.leadTimeDistribution.p85)}</span>
                  <span>p95: {fmtHours(data.leadTimeDistribution.p95)}</span>
                </div>
              </div>
            )}

            {/* Weekly throughput */}
            {data.weeklyThroughput.length > 0 && (
              <div className="glass-card p-5">
                <SectionTitle
                  title="Weekly Throughput"
                  tooltip={TOOLTIPS.weeklyThroughput}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Weekly Throughput', data.weeklyThroughput.map(w => `${w.week}: ${w.count}`).join(', '), TOOLTIPS.weeklyThroughput.description)}
                />
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.weeklyThroughput}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#cbd5e1' }} />
                    <Bar dataKey="count" fill="#10b981" name="Tickets Done" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* CFD */}
            {data.cfd.length > 0 && cfdStatuses.length > 0 && (
              <div className="glass-card p-5">
                <SectionTitle
                  title="Cumulative Flow Diagram (30 days)"
                  tooltip={TOOLTIPS.cfd}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Cumulative Flow Diagram', `${cfdStatuses.length} statuses tracked over ${data.cfd.length} days`, TOOLTIPS.cfd.description)}
                />
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={data.cfd}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#cbd5e1' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {cfdStatuses.map((status, i) => (
                      <Area
                        key={status}
                        type="monotone"
                        dataKey={status}
                        stackId="1"
                        fill={CFD_COLORS[i % CFD_COLORS.length]}
                        stroke={CFD_COLORS[i % CFD_COLORS.length]}
                        fillOpacity={0.6}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Monte Carlo forecast */}
            {data.monteCarlo.targetItems > 0 && (
              <div className="glass-card p-5">
                <SectionTitle
                  title="Delivery Forecast (Monte Carlo)"
                  icon={<Target size={16} className="text-indigo-400" />}
                  tooltip={TOOLTIPS.monteCarlo}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Monte Carlo Forecast', data.monteCarlo.confidenceLevels.map(c => `${c.percentile}%: ${c.weeks} weeks`).join(', '), TOOLTIPS.monteCarlo.description)}
                />
                <p className="text-xs text-slate-400 mb-4">
                  Based on historical throughput, estimated weeks to complete {data.monteCarlo.targetItems} in-progress items:
                </p>
                <div className="grid grid-cols-3 gap-4">
                  {data.monteCarlo.confidenceLevels.map(cl => (
                    <div key={cl.percentile} className="text-center p-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">{cl.percentile}% confidence</span>
                      <span className="text-lg font-bold text-slate-200">{cl.weeks}</span>
                      <span className="text-xs text-slate-400 ml-1">weeks</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* WIP by status */}
            {data.wip.byStatus.length > 0 && (
              <div className="glass-card p-5">
                <SectionTitle
                  title="WIP Breakdown"
                  tooltip={TOOLTIPS.wipBreakdown}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('WIP Breakdown', data.wip.byStatus.map(s => `${s.status}: ${s.count}`).join(', '), TOOLTIPS.wipBreakdown.description)}
                />
                <div className="flex flex-wrap gap-3">
                  {data.wip.byStatus.map(s => (
                    <div key={s.status} className="px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/30 text-center">
                      <span className="text-[10px] text-slate-500 block">{s.status}</span>
                      <span className="text-sm font-semibold text-slate-200">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aging WIP tiered */}
            {data.agingWipTiered.length > 0 && (
              <div className="glass-card p-5">
                <SectionTitle
                  title="Aging WIP"
                  icon={<AlertTriangle size={16} className="text-amber-400" />}
                  tooltip={TOOLTIPS.agingWip}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Aging WIP', `${data.agingWipTiered.length} tickets aging`, TOOLTIPS.agingWip.description)}
                />
                <div className="space-y-2">
                  {data.agingWipTiered.map(entry => (
                    <div
                      key={entry.key}
                      className={`flex items-center gap-4 p-3 rounded-lg border ${TIER_BG[entry.tier]}`}
                    >
                      <span className={`text-xs font-bold uppercase w-20 ${TIER_COLORS[entry.tier]}`}>{entry.tier}</span>
                      <span className="text-xs text-slate-300 font-mono w-20">{entry.key}</span>
                      <span className="text-xs text-slate-200 flex-1 truncate">{entry.summary}</span>
                      <span className="text-xs text-slate-400">{entry.assignee}</span>
                      <span className="text-xs text-slate-400">{entry.status}</span>
                      <span className={`text-xs font-semibold ${TIER_COLORS[entry.tier]}`}>{entry.daysInStatus}d</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Arrival vs Departure + Batch Size Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {data.arrivalVsDeparture.length > 0 && (
                <div className="glass-card p-5">
                  <SectionTitle
                    title="Arrival vs Departure Rate"
                    tooltip={TOOLTIPS.arrivalVsDeparture}
                    aiConfigured={aiConfigured}
                    onAiSuggest={() => openSuggestion('Arrival vs Departure Rate', data.arrivalVsDeparture.slice(-4).map(e => `${e.week}: +${e.arrived}/-${e.departed}`).join(', '), TOOLTIPS.arrivalVsDeparture.description)}
                  />
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={data.arrivalVsDeparture}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#cbd5e1' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="arrived" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} name="Arrived" />
                      <Line type="monotone" dataKey="departed" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} name="Departed" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {data.batchSizeTrend.length > 0 && (
                <div className="glass-card p-5">
                  <SectionTitle
                    title="Batch Size Trend (avg SP/ticket)"
                    tooltip={TOOLTIPS.batchSizeTrend}
                    aiConfigured={aiConfigured}
                    onAiSuggest={() => openSuggestion('Batch Size Trend', data.batchSizeTrend.slice(-4).map(e => `${e.week}: ${e.avgSp.toFixed(1)} SP`).join(', '), TOOLTIPS.batchSizeTrend.description)}
                  />
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={data.batchSizeTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#cbd5e1' }} formatter={(v: number) => [v.toFixed(1), 'Avg SP']} />
                      <Line type="monotone" dataKey="avgSp" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} name="Avg SP/ticket" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Lead Time Breakdown */}
            {data.leadTimeBreakdown && (
              <div className="glass-card p-5">
                <SectionTitle
                  title="Lead Time Breakdown"
                  tooltip={TOOLTIPS.leadTimeBreakdown}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Lead Time Breakdown', `Active: ${data.leadTimeBreakdown!.activePercent.toFixed(0)}%, Wait: ${data.leadTimeBreakdown!.waitPercent.toFixed(0)}%, Blocked: ${data.leadTimeBreakdown!.blockedPercent.toFixed(0)}%`, TOOLTIPS.leadTimeBreakdown.description)}
                />
                <div className="space-y-3 mt-2">
                  {[
                    { label: 'Active Work', pct: data.leadTimeBreakdown.activePercent, color: 'bg-emerald-500' },
                    { label: 'Waiting', pct: data.leadTimeBreakdown.waitPercent, color: 'bg-amber-500' },
                    { label: 'Blocked', pct: data.leadTimeBreakdown.blockedPercent, color: 'bg-rose-500' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 w-24">{item.label}</span>
                      <div className="flex-1 bg-slate-800/50 rounded-full h-4 overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${Math.min(item.pct, 100)}%` }} />
                      </div>
                      <span className="text-xs text-slate-300 w-12 text-right">{item.pct.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Blockers */}
            {data.blockers.length > 0 && (
              <div className="glass-card p-5">
                <SectionTitle
                  title="Top Blocked Tickets"
                  tooltip={TOOLTIPS.blockers}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Top Blocked Tickets', data.blockers.slice(0, 5).map(b => `${b.key}: ${fmtHours(b.blockedHours)}`).join(', '), TOOLTIPS.blockers.description)}
                />
                <div className="space-y-2">
                  {data.blockers.slice(0, 10).map(b => (
                    <div key={b.key} className="flex items-center gap-4 p-3 bg-slate-800/40 rounded-lg border border-slate-700/20">
                      <span className="text-xs text-slate-300 font-mono w-20">{b.key}</span>
                      <span className="text-xs text-slate-200 flex-1 truncate">{b.summary}</span>
                      <span className="text-xs text-slate-400">{b.assignee}</span>
                      <span className="text-xs font-semibold text-rose-400">{fmtHours(b.blockedHours)} blocked</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <Activity size={32} className="mb-2 opacity-50" />
            <p className="text-sm">No data yet. Sync to see flow metrics.</p>
          </div>
        )}
      </div>

      <SuggestionPanel
        open={suggestionOpen}
        onClose={() => setSuggestionOpen(false)}
        request={suggestionRequest}
        aiProvider={aiProvider}
      />
    </div>
  );
};

export default DmFlowDashboard;
