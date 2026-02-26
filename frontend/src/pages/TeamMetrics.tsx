import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, HelpCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import { getTeamMetrics, triggerSync } from '../api';
import type { ProjectInfo } from '../App';

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#64748b'];

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
  { value: 'weekly', label: 'Weekly' },
];

// --- KPI help content ---
interface HelpContent {
  what: string;
  why: string;
  target: string;
  trend_up: string;
  trend_down: string;
}

const KPI_HELP: Record<string, HelpContent> = {
  total_tickets: {
    what: 'Total number of completed tickets in the selected time range.',
    why: 'Baseline measure of team output volume. Helps gauge whether the team is handling an appropriate workload.',
    target: 'Varies by team size. A healthy team of 5-7 engineers typically completes 30-60 tickets/month depending on complexity.',
    trend_up: 'More tickets completed than previous period. The team is delivering more work — check if quality is holding.',
    trend_down: 'Fewer tickets completed. Could indicate blockers, holidays, larger tickets, or reduced capacity. Investigate if unexpected.',
  },
  total_story_points: {
    what: 'Sum of story points across all completed tickets, based on your configured SP-to-days calibration.',
    why: 'Story points normalize effort across different ticket sizes, giving a more accurate picture of throughput than ticket count alone.',
    target: 'A team of 6 engineers has ~120 SP/month capacity (6 x 20 working days). High-performing teams consistently deliver 70-85% of capacity.',
    trend_up: 'Higher velocity — the team delivered more estimated effort. Positive sign if sustainable.',
    trend_down: 'Lower velocity. May mean smaller scope, harder problems, or capacity loss. Check if eng hours also dropped.',
  },
  total_eng_hours: {
    what: 'Total engineering hours spent across all tickets, calculated from status transitions during office hours.',
    why: 'Measures actual time invested. Compare against story points to understand estimation accuracy and identify hidden overhead.',
    target: 'Should correlate with total SP x configured hours-per-SP. Large gaps indicate either estimation issues or significant non-ticket work.',
    trend_up: 'More engineering time spent. Good if SP also increased (more output). Bad if SP stayed flat (lower efficiency).',
    trend_down: 'Less engineering time logged. Could mean fewer tickets, faster delivery, or team members on leave.',
  },
  estimation_accuracy: {
    what: 'Ratio of estimated effort to actual engineering hours. Formula: (Total SP x configured hours-per-SP) / Total Eng Hours.',
    why: 'Accurate estimation is a hallmark of mature teams. It enables reliable planning, realistic commitments, and predictable delivery.',
    target: '0.9 - 1.1x is excellent. > 1.2x means systematic over-estimation. < 0.8x means under-estimation and likely missed deadlines.',
    trend_up: 'Accuracy ratio increased — estimates are becoming more generous relative to actual hours. Moving toward 1.0 is ideal; going above 1.2 means over-estimation.',
    trend_down: 'Accuracy ratio dropped — work is taking longer than estimated. Could signal under-estimation, unexpected complexity, or process overhead.',
  },
  avg_hours_per_sp: {
    what: 'Average engineering hours spent per story point across all tickets.',
    why: 'Reveals the real cost of a story point for this team. Helps calibrate future estimates and identify efficiency trends.',
    target: 'Should be close to your configured hours-per-SP. Consistently exceeding it suggests under-estimation or process overhead.',
    trend_up: 'Each story point is costing more hours. The team is becoming less efficient per unit of estimated work — investigate blockers or scope creep.',
    trend_down: 'Each story point costs fewer hours. The team is delivering more efficiently — a positive signal if quality is maintained.',
  },
  avg_cycle_time: {
    what: 'Average engineering hours per ticket (only tickets with recorded hours).',
    why: 'Shorter cycle times mean faster feedback loops, less WIP, and lower risk of scope creep. A key indicator of team flow.',
    target: 'Depends on ticket granularity. For well-scoped tickets: 4-16h (0.5 - 2 days). Consistently > 40h suggests tickets need breaking down.',
    trend_up: 'Tickets are taking longer on average. May indicate larger/harder tickets, more blockers, or process slowdowns.',
    trend_down: 'Tickets are being completed faster. Great sign — faster feedback loops and better flow. Ensure quality isn\'t being sacrificed.',
  },
  bug_count: {
    what: 'Number of completed tickets classified as Bug or Defect.',
    why: 'Tracks the volume of reactive work. High bug counts may indicate quality issues in upstream development or testing.',
    target: 'Bugs should be < 20% of total tickets. Trending downward over time indicates improving code quality.',
    trend_up: 'More bugs being fixed. Could mean more bugs being found (bad) or faster bug resolution (good). Check bug ratio for context.',
    trend_down: 'Fewer bugs. Positive signal — either fewer defects are being introduced, or the team is prioritizing feature work.',
  },
  bug_ratio: {
    what: 'Percentage of completed tickets that are bugs (Bug Count / Total Tickets).',
    why: 'Normalizes bug volume against total output. A rising ratio means quality is declining relative to feature output.',
    target: '< 15% is good. < 10% is excellent. > 25% signals a quality problem that needs attention.',
    trend_up: 'A larger share of work is going to bugs. Quality may be declining, or the team is in a bug-fixing sprint. Sustained increases need action.',
    trend_down: 'Bugs are a smaller share of work. The team is spending proportionally more time on features — a healthy signal.',
  },
  bug_hours_pct: {
    what: 'Percentage of total engineering hours spent fixing bugs.',
    why: 'Even if bug count is low, complex bugs can consume disproportionate engineering time. This reveals the true cost of defects.',
    target: '< 15% is healthy. > 30% means the team is spending more time firefighting than building.',
    trend_up: 'More engineering time consumed by bugs. The team is firefighting more — investigate root causes and consider investing in testing.',
    trend_down: 'Less time spent on bugs. More capacity is going to feature work and improvements — a positive trend.',
  },
  monthly_trend: {
    what: 'Month-over-month view of tickets completed, story points delivered, and engineering hours spent.',
    why: 'Reveals velocity trends, seasonal patterns, and the impact of team changes. Consistent or improving trends indicate a stable, healthy team.',
    target: 'Look for: stable or rising SP trend, eng hours proportional to SP, no sudden drops. Declining SP with stable hours signals increasing complexity or process issues.',
    trend_up: 'Overall upward trend in the lines indicates growing team output over time.',
    trend_down: 'Declining lines suggest reduced output — correlate with team size changes, holidays, or shifting priorities.',
  },
  eng_hours_by_bu: {
    what: 'Distribution of engineering hours across business units (e.g. B2C, B2B, O4B).',
    why: 'Shows where engineering effort is actually going versus where the business wants it. Misalignment here is a leading indicator of strategic drift.',
    target: 'Should match the team\'s planned allocation. If B2C gets 80% of hours but only 50% is planned, priorities need re-alignment.',
    trend_up: 'Total eng hours across BUs increased — more work delivered overall. Check if the distribution still matches planned allocation.',
    trend_down: 'Total eng hours decreased. Verify whether the drop is uniform or concentrated in specific BUs.',
  },
  eng_hours_by_ws: {
    what: 'Split of engineering hours by work stream: Product (new features), Operational (maintenance), Tech Debt.',
    why: 'The most important allocation metric. Teams that spend too little on tech debt accumulate it; too much means product stalls.',
    target: 'High-performing teams: ~60-70% Product, ~15-20% Operational, ~10-20% Tech Debt. Adjust based on team maturity and debt levels.',
    trend_up: 'Total eng hours in work streams increased. Check if the Product vs Operational vs Tech Debt ratio is still healthy.',
    trend_down: 'Less total work stream hours. Look at which stream shrank — losing Product hours is concerning, losing Operational hours may be good.',
  },
  sp_by_bu: {
    what: 'Story points delivered per business unit.',
    why: 'Complements eng hours by BU — if a BU has high SP but low hours, the work was well-estimated. High hours but low SP suggests complex or under-estimated work.',
    target: 'SP distribution should roughly mirror eng hours distribution. Large discrepancies reveal estimation biases per BU.',
    trend_up: 'More story points delivered across BUs. Higher planned throughput — verify it matches eng hours growth.',
    trend_down: 'Fewer story points delivered. Could indicate smaller scope planned or tickets not being pointed.',
  },
  issue_type_breakdown: {
    what: 'Distribution of completed tickets by type: Story, Task, Bug, Sub-task, etc.',
    why: 'Reveals the nature of the team\'s work. A healthy team has a mix weighted toward Stories (feature work) with manageable Bugs and Tasks.',
    target: 'Stories: 40-60%, Tasks: 20-30%, Bugs: < 15%, Sub-tasks: varies. Heavy Task % may indicate too much ops/process overhead.',
    trend_up: 'More total tickets completed. Check if the mix is shifting — more Stories is good, more Bugs is a warning sign.',
    trend_down: 'Fewer total tickets. If Stories dropped but Bugs held steady, the team may be stuck in reactive mode.',
  },
};

// --- Trend calculation ---
function calcTrend(current: number | null | undefined, previous: number | null | undefined): { direction: 'up' | 'down' | 'flat' | null; pct: number | null } {
  if (current == null || previous == null || previous === 0) return { direction: null, pct: null };
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (pct > 2) return { direction: 'up', pct };
  if (pct < -2) return { direction: 'down', pct };
  return { direction: 'flat', pct: 0 };
}

// For metrics where DOWN is good (bug_ratio, bug_hours_pct, avg_cycle_time, avg_hours_per_sp)
const LOWER_IS_BETTER = new Set(['bug_ratio', 'bug_count', 'bug_hours_pct', 'avg_cycle_time', 'avg_hours_per_sp']);

function trendColor(key: string, direction: 'up' | 'down' | 'flat' | null): string {
  if (!direction || direction === 'flat') return 'text-slate-400';
  const goodUp = !LOWER_IS_BETTER.has(key);
  if (direction === 'up') return goodUp ? 'text-emerald-400' : 'text-rose-400';
  return goodUp ? 'text-rose-400' : 'text-emerald-400';
}

interface TeamMetricsProps {
  refreshKey: number;
  project?: ProjectInfo | null;
}

const TeamMetrics: React.FC<TeamMetricsProps> = ({ refreshKey, project }) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [period, setPeriod] = useState('all');

  const fetchMetrics = useCallback(async (p?: string) => {
    setLoading(true);
    try {
      const res = await getTeamMetrics(p ?? period);
      setMetrics(res.data);
    } catch {
      console.error('Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  }, [period]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await triggerSync();
      const res = await getTeamMetrics(period);
      setMetrics(res.data);
      toast.success('Metrics refreshed');
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [period]);

  const handlePeriodChange = useCallback((newPeriod: string) => {
    setPeriod(newPeriod);
    fetchMetrics(newPeriod);
  }, [fetchMetrics]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);
  useEffect(() => { if (refreshKey > 0) fetchMetrics(); }, [refreshKey, fetchMetrics]);

  const s = metrics?.summary;
  const ps = metrics?.prev_summary;
  const hasSummary = s && s.total_tickets > 0;
  const hasPrev = ps && ps.total_tickets > 0;

  // Transform grouped data for recharts
  const buData = metrics?.by_business_unit
    ? Object.entries(metrics.by_business_unit).map(([name, v]: any) => ({ name, ...v }))
    : [];
  const wsData = metrics?.by_work_stream
    ? Object.entries(metrics.by_work_stream).map(([name, v]: any) => ({ name, ...v }))
    : [];
  const typeData = metrics?.issue_type_breakdown
    ? Object.entries(metrics.issue_type_breakdown).map(([name, v]: any) => ({ name, ...v }))
    : [];
  const trend = metrics?.monthly_trend || [];

  // Compute section-level trends with raw values for tooltips
  const sumField = (data: Record<string, any>, field: string) =>
    Object.values(data).reduce((s: number, v: any) => s + (v[field] || 0), 0);

  const buEngCurr = hasSummary ? sumField(metrics.by_business_unit, 'eng_hours') : 0;
  const buEngPrev = hasPrev ? sumField(metrics.prev_by_business_unit, 'eng_hours') : 0;
  const buTrend = hasPrev ? calcTrend(buEngCurr, buEngPrev) : { direction: null, pct: null };

  const wsEngCurr = hasSummary ? sumField(metrics.by_work_stream, 'eng_hours') : 0;
  const wsEngPrev = hasPrev ? sumField(metrics.prev_by_work_stream, 'eng_hours') : 0;
  const wsTrend = hasPrev ? calcTrend(wsEngCurr, wsEngPrev) : { direction: null, pct: null };

  const spBuCurr = hasSummary ? sumField(metrics.by_business_unit, 'story_points') : 0;
  const spBuPrev = hasPrev ? sumField(metrics.prev_by_business_unit, 'story_points') : 0;
  const spBuTrend = hasPrev ? calcTrend(spBuCurr, spBuPrev) : { direction: null, pct: null };

  const typeCurr = hasSummary ? sumField(metrics.issue_type_breakdown, 'tickets') : 0;
  const typePrev = hasPrev ? sumField(metrics.prev_issue_type_breakdown, 'tickets') : 0;
  const typeTrend = hasPrev ? calcTrend(typeCurr, typePrev) : { direction: null, pct: null };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-slate-100">
            {project?.name ? `${project.name} — Team Metrics` : 'Team Metrics'}
          </h1>
          <div className="flex bg-slate-800 rounded-lg border border-slate-700/50 p-0.5">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => handlePeriodChange(p.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === p.value
                    ? 'bg-indigo-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-md shadow-indigo-500/20 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={syncing ? 'animate-spin' : ''} size={16} />
          <span>{syncing ? 'Syncing...' : 'Sync & Refresh'}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && !metrics ? (
          <div className="flex flex-col justify-center items-center h-64 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-600 border-t-indigo-400" />
            <p className="text-sm text-slate-400">Loading metrics...</p>
          </div>
        ) : !hasSummary ? (
          <div className="flex flex-col justify-center items-center h-64 gap-2">
            <p className="text-slate-300 font-medium">No data available{period !== 'all' ? ` for this ${period} period` : ''}</p>
            <p className="text-sm text-slate-500">
              {period !== 'all'
                ? 'Try a longer time range, or click "Sync & Refresh" to fetch latest data.'
                : 'Click "Sync & Refresh" to fetch tickets from JIRA first.'}
            </p>
          </div>
        ) : (
          <div className="max-w-7xl space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <KpiCard label="Total Tickets" value={s.total_tickets} helpKey="total_tickets" trendKey="total_tickets" prev={ps?.total_tickets} />
              <KpiCard label="Total Story Points" value={s.total_story_points} helpKey="total_story_points" trendKey="total_story_points" prev={ps?.total_story_points} />
              <KpiCard label="Total Eng Hours" value={s.total_eng_hours} suffix="h" helpKey="total_eng_hours" trendKey="total_eng_hours" prev={ps?.total_eng_hours} />
              <KpiCard
                label="Estimation Accuracy"
                value={s.estimation_accuracy}
                suffix="x"
                helpKey="estimation_accuracy"
                trendKey="estimation_accuracy"
                prev={ps?.estimation_accuracy}
                color={s.estimation_accuracy === null ? undefined : s.estimation_accuracy >= 0.8 && s.estimation_accuracy <= 1.2 ? 'text-emerald-400' : 'text-amber-400'}
              />
              <KpiCard label="Avg Hours / SP" value={s.avg_eng_hours_per_sp} suffix="h" helpKey="avg_hours_per_sp" trendKey="avg_hours_per_sp" prev={ps?.avg_eng_hours_per_sp} />
              <KpiCard label="Avg Cycle Time" value={s.avg_cycle_time_hours} suffix="h" helpKey="avg_cycle_time" trendKey="avg_cycle_time" prev={ps?.avg_cycle_time_hours} />
              <KpiCard label="Bug Count" value={s.bug_count} helpKey="bug_count" trendKey="bug_count" prev={ps?.bug_count} />
              <KpiCard label="Bug Ratio" value={Math.round(s.bug_ratio * 100)} suffix="%" helpKey="bug_ratio" trendKey="bug_ratio" prev={ps?.bug_ratio != null ? Math.round(ps.bug_ratio * 100) : null} />
              <KpiCard label="Bug Hours %" value={s.bug_eng_hours_pct} suffix="%" helpKey="bug_hours_pct" trendKey="bug_hours_pct" prev={ps?.bug_eng_hours_pct} />
            </div>

            {/* Monthly Trend */}
            {trend.length > 1 && (
              <Section title="Monthly Trend" helpKey="monthly_trend">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 13, color: '#e2e8f0' }} labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#e2e8f0' }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="story_points" name="Story Points" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="eng_hours" name="Eng Hours" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="tickets" name="Tickets" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            )}

            {/* Eng Hours by Business Unit + Work Stream side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {buData.length > 0 && (
                <Section title="Eng Hours by Business Unit" helpKey="eng_hours_by_bu" trend={buTrend} trendLabel="total eng hours" trendCurrentVal={buEngCurr} trendPrevVal={buEngPrev}>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={buData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} width={100} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 13, color: '#e2e8f0' }} labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#e2e8f0' }} />
                        <Bar dataKey="eng_hours" name="Eng Hours" radius={[0, 4, 4, 0]}>
                          {buData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Section>
              )}

              {wsData.length > 0 && (
                <Section title="Eng Hours by Work Stream" helpKey="eng_hours_by_ws" trend={wsTrend} trendLabel="total eng hours" trendCurrentVal={wsEngCurr} trendPrevVal={wsEngPrev}>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={wsData} dataKey="eng_hours" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {wsData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 13, color: '#e2e8f0' }} labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#e2e8f0' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Section>
              )}
            </div>

            {/* Story Points by BU + Issue Type Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {buData.length > 0 && (
                <Section title="Story Points by Business Unit" helpKey="sp_by_bu" trend={spBuTrend} trendLabel="total SP" trendCurrentVal={spBuCurr} trendPrevVal={spBuPrev}>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={buData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} width={100} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 13, color: '#e2e8f0' }} labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#e2e8f0' }} />
                        <Bar dataKey="story_points" name="Story Points" radius={[0, 4, 4, 0]}>
                          {buData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Section>
              )}

              {typeData.length > 0 && (
                <Section title="Issue Type Breakdown" helpKey="issue_type_breakdown" trend={typeTrend} trendLabel="total tickets" trendCurrentVal={typeCurr} trendPrevVal={typePrev}>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={typeData} dataKey="tickets" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 13, color: '#e2e8f0' }} labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#e2e8f0' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Help Tooltip (fixed position, no clipping) ---
const HelpTooltip = ({ helpKey }: { helpKey: string }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const help = KPI_HELP[helpKey];
  if (!help) return null;

  const handleEnter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const left = Math.min(rect.left + rect.width / 2, window.innerWidth - 160);
    setPos({ top: rect.bottom + 8, left: Math.max(left, 160) });
  };

  return (
    <span className="inline-flex" onMouseEnter={handleEnter} onMouseLeave={() => setPos(null)}>
      <HelpCircle size={13} className="text-slate-500 hover:text-indigo-400 transition-colors cursor-help" />
      {pos && (
        <span
          className="fixed w-80 z-[9999]"
          style={{ top: pos.top, left: pos.left, transform: 'translateX(-50%)' }}
        >
          <span className="block bg-slate-900 border border-slate-600/60 rounded-lg shadow-xl shadow-black/40 p-3 text-left max-h-[70vh] overflow-y-auto">
            <span className="block text-[11px] font-semibold text-indigo-300 mb-1">What is this?</span>
            <span className="block text-[11px] text-slate-300 leading-relaxed mb-2">{help.what}</span>
            <span className="block text-[11px] font-semibold text-emerald-300 mb-1">Why it matters</span>
            <span className="block text-[11px] text-slate-300 leading-relaxed mb-2">{help.why}</span>
            <span className="block text-[11px] font-semibold text-amber-300 mb-1">High-performing target</span>
            <span className="block text-[11px] text-slate-300 leading-relaxed mb-2">{help.target}</span>
            <span className="block border-t border-slate-700/60 pt-2 mt-1">
              <span className="flex items-start gap-1.5 mb-1.5">
                <TrendingUp size={11} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-[11px] text-slate-300 leading-relaxed"><span className="font-semibold text-emerald-400">Up trend: </span>{help.trend_up}</span>
              </span>
              <span className="flex items-start gap-1.5">
                <TrendingDown size={11} className="text-rose-400 mt-0.5 flex-shrink-0" />
                <span className="text-[11px] text-slate-300 leading-relaxed"><span className="font-semibold text-rose-400">Down trend: </span>{help.trend_down}</span>
              </span>
            </span>
          </span>
        </span>
      )}
    </span>
  );
};

// --- Trend Badge ---
const TrendBadge = ({ trendKey, current, prev, suffix }: { trendKey: string; current: number | null | undefined; prev: number | null | undefined; suffix?: string }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const { direction, pct } = calcTrend(current, prev);
  if (!direction || pct === null) return null;

  const color = trendColor(trendKey, direction);
  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  const sfx = suffix || '';

  const handleEnter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const left = Math.min(rect.left + rect.width / 2, window.innerWidth - 100);
    setPos({ top: rect.bottom + 6, left: Math.max(left, 100) });
  };

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${color} cursor-default`}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setPos(null)}
    >
      <Icon size={12} />
      {direction !== 'flat' && <span>{Math.abs(pct)}%</span>}
      {pos && (
        <span
          className="fixed z-[9999]"
          style={{ top: pos.top, left: pos.left, transform: 'translateX(-50%)' }}
        >
          <span className="block bg-slate-900 border border-slate-600/60 rounded-lg shadow-xl shadow-black/40 px-3 py-2 text-left whitespace-nowrap">
            <span className="block text-[11px] text-slate-400 mb-1">
              Previous: <span className="text-slate-200 font-semibold">{prev}{sfx}</span>
            </span>
            <span className="block text-[11px] text-slate-400">
              Current: <span className="text-slate-200 font-semibold">{current}{sfx}</span>
            </span>
            <span className={`block text-[11px] mt-1 pt-1 border-t border-slate-700/60 font-medium ${color}`}>
              {direction === 'up' ? '\u2191' : direction === 'down' ? '\u2193' : '\u2192'} {Math.abs(pct)}% {direction === 'flat' ? 'no change' : direction}
            </span>
          </span>
        </span>
      )}
    </span>
  );
};

// --- Section Trend Badge (for chart headers) ---
const SectionTrendBadge = ({ trend, label, currentVal, prevVal }: {
  trend: { direction: 'up' | 'down' | 'flat' | null; pct: number | null };
  label: string;
  currentVal?: number;
  prevVal?: number;
}) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  if (!trend.direction || trend.pct === null) return null;
  const color = trend.direction === 'up' ? 'text-emerald-400' : trend.direction === 'down' ? 'text-rose-400' : 'text-slate-400';
  const Icon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;

  const handleEnter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const left = Math.min(rect.left + rect.width / 2, window.innerWidth - 120);
    setPos({ top: rect.bottom + 6, left: Math.max(left, 120) });
  };

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium ${color} ml-1 cursor-default`}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setPos(null)}
    >
      <Icon size={12} />
      {trend.direction !== 'flat' && <span>{Math.abs(trend.pct)}%</span>}
      <span className="text-slate-500 font-normal">{label} vs prev period</span>
      {pos && currentVal != null && prevVal != null && (
        <span
          className="fixed z-[9999]"
          style={{ top: pos.top, left: pos.left, transform: 'translateX(-50%)' }}
        >
          <span className="block bg-slate-900 border border-slate-600/60 rounded-lg shadow-xl shadow-black/40 px-3 py-2 text-left whitespace-nowrap">
            <span className="block text-[11px] text-slate-400 mb-1">
              Previous {label}: <span className="text-slate-200 font-semibold">{Math.round(prevVal)}</span>
            </span>
            <span className="block text-[11px] text-slate-400">
              Current {label}: <span className="text-slate-200 font-semibold">{Math.round(currentVal)}</span>
            </span>
            <span className={`block text-[11px] mt-1 pt-1 border-t border-slate-700/60 font-medium ${color}`}>
              {trend.direction === 'up' ? '\u2191' : trend.direction === 'down' ? '\u2193' : '\u2192'} {Math.abs(trend.pct)}% {trend.direction === 'flat' ? 'no change' : trend.direction}
            </span>
          </span>
        </span>
      )}
    </span>
  );
};

// --- KPI Card ---
const KpiCard = ({ label, value, suffix, helpKey, trendKey, prev, color }: {
  label: string; value: any; suffix?: string; helpKey: string; trendKey: string; prev?: number | null; color?: string;
}) => (
  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-1">
    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
      {label}
      <HelpTooltip helpKey={helpKey} />
    </span>
    <div className="flex items-end gap-2">
      <span className={`text-2xl font-bold tabular-nums ${color || 'text-slate-100'}`}>
        {value === null || value === undefined ? '\u2014' : `${value}${suffix || ''}`}
      </span>
      <TrendBadge trendKey={trendKey} current={value} prev={prev} suffix={suffix} />
    </div>
  </div>
);

// --- Section wrapper ---
const Section = ({ title, helpKey, trend, trendLabel, trendCurrentVal, trendPrevVal, children }: {
  title: string; helpKey: string; children: React.ReactNode;
  trend?: { direction: 'up' | 'down' | 'flat' | null; pct: number | null };
  trendLabel?: string;
  trendCurrentVal?: number;
  trendPrevVal?: number;
}) => (
  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
    <h3 className="text-sm font-semibold text-slate-200 mb-4 uppercase tracking-wider flex items-center gap-2">
      {title}
      <HelpTooltip helpKey={helpKey} />
      {trend && trendLabel && <SectionTrendBadge trend={trend} label={trendLabel} currentVal={trendCurrentVal} prevVal={trendPrevVal} />}
    </h3>
    {children}
  </div>
);

export default TeamMetrics;
