import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, HelpCircle, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';
import { getIndividualMetrics, triggerSync } from '../api';
import type { ProjectInfo } from '../App';

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#64748b'];

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
  { value: 'weekly', label: 'Weekly' },
];

// --- KPI definitions ---
interface HelpContent {
  what: string;
  why: string;
  target: string;
  trend_up: string;
  trend_down: string;
}

interface KpiDef {
  key: string;
  label: string;
  suffix: string;
  lowerIsBetter: boolean;
  format: (v: number | null | undefined) => string;
  help: HelpContent;
}

const KPI_DEFS: KpiDef[] = [
  {
    key: 'total_tickets', label: 'Tickets', suffix: '', lowerIsBetter: false,
    format: v => v != null ? String(v) : '—',
    help: {
      what: 'Total completed tickets in the selected period for this engineer.',
      why: 'Raw output volume. Are they shipping consistently? Helps spot blockers or capacity issues early.',
      target: 'Varies by role and ticket granularity. Compare against team average for context.',
      trend_up: 'More tickets completed — higher throughput. Check if quality is holding.',
      trend_down: 'Fewer tickets. Could indicate blockers, larger tickets, or reduced capacity.',
    },
  },
  {
    key: 'total_story_points', label: 'Story Points', suffix: ' SP', lowerIsBetter: false,
    format: v => v != null ? String(v) : '—',
    help: {
      what: 'Total story points delivered across all completed tickets.',
      why: 'Weighted throughput — normalizes for ticket complexity. More meaningful than ticket count alone.',
      target: 'Should be stable or growing period-over-period. Compare against team average.',
      trend_up: 'Delivering more estimated effort. Positive if sustainable and quality holds.',
      trend_down: 'Lower velocity. May mean harder problems, smaller scope, or capacity issues.',
    },
  },
  {
    key: 'total_eng_hours', label: 'Eng Hours', suffix: 'h', lowerIsBetter: false,
    format: v => v != null ? `${v}` : '—',
    help: {
      what: 'Total engineering hours spent, calculated from JIRA status transitions.',
      why: 'Measures actual time invested. Compare against SP to assess estimation accuracy and utilization.',
      target: 'Should correlate with SP delivered. Large gaps signal estimation issues or non-ticket work.',
      trend_up: 'More time invested. Good if SP also grew (more output). Concerning if SP stayed flat.',
      trend_down: 'Less time logged. Could mean fewer tickets, faster delivery, or time off.',
    },
  },
  {
    key: 'avg_cycle_time_hours', label: 'Avg Cycle Time', suffix: 'h', lowerIsBetter: true,
    format: v => v != null ? `${v}` : '—',
    help: {
      what: 'Average engineering hours per ticket (only tickets with recorded hours).',
      why: 'Speed indicator. Shorter cycle times mean faster feedback loops and better flow.',
      target: '4-16h for well-scoped tickets. Consistently > 40h suggests tickets need breaking down.',
      trend_up: 'Tickets taking longer. May indicate larger scope, more blockers, or process friction.',
      trend_down: 'Completing work faster. Great sign — better flow and efficiency.',
    },
  },
  {
    key: 'avg_eng_hours_per_sp', label: 'Hours / SP', suffix: 'h', lowerIsBetter: true,
    format: v => v != null ? `${v}` : '—',
    help: {
      what: 'Engineering hours spent per story point.',
      why: 'Efficiency metric. Reveals the real cost of a story point for this engineer.',
      target: 'Should be close to the configured hours-per-SP. Consistently exceeding it suggests under-estimation.',
      trend_up: 'Each SP costs more hours — efficiency declining. Investigate blockers or scope creep.',
      trend_down: 'Each SP costs fewer hours — delivering more efficiently.',
    },
  },
  {
    key: 'estimation_accuracy', label: 'Est. Accuracy', suffix: 'x', lowerIsBetter: false,
    format: v => v != null ? `${v}` : '—',
    help: {
      what: 'Ratio of estimated effort to actual hours: (SP × hours-per-SP) / Eng Hours.',
      why: 'Predictability — can the team plan around this engineer? Accurate estimators make the team more reliable.',
      target: '0.9-1.1x is excellent. > 1.2x = over-estimation. < 0.8x = under-estimation.',
      trend_up: 'Estimates becoming more generous relative to actuals. Moving toward 1.0 is ideal.',
      trend_down: 'Work taking longer than estimated. May signal growing complexity or under-estimation.',
    },
  },
  {
    key: 'bug_ratio', label: 'Bug Ratio', suffix: '', lowerIsBetter: true,
    format: v => v != null ? `${Math.round(v * 100)}%` : '—',
    help: {
      what: 'Percentage of completed tickets that are bugs (Bug/Defect types).',
      why: 'Quality signal. High bug ratio means more time spent fixing than building.',
      target: '< 15% is good. < 10% is excellent. > 25% needs attention.',
      trend_up: 'Larger share of work is bugs — quality may be declining or in a bug-fix sprint.',
      trend_down: 'Fewer bugs proportionally — more time on features. Healthy signal.',
    },
  },
  {
    key: 'complexity_score', label: 'Complexity', suffix: ' SP/ticket', lowerIsBetter: false,
    format: v => v != null ? `${v}` : '—',
    help: {
      what: 'Average story points per ticket. Measures the size of work being taken on.',
      why: 'Growth indicator. Engineers raising the bar should gradually tackle harder, higher-SP problems.',
      target: 'Should grow over time as the engineer gains expertise. Compare against team average.',
      trend_up: 'Taking on bigger challenges — a positive growth signal if cycle time stays reasonable.',
      trend_down: 'Smaller tickets. Could be intentional (better scoping) or a sign of avoiding complex work.',
    },
  },
  {
    key: 'focus_ratio', label: 'Focus Ratio', suffix: '', lowerIsBetter: false,
    format: v => v != null ? `${Math.round(v * 100)}%` : '—',
    help: {
      what: 'Percentage of tickets in the "Product" work stream vs operational/tech debt.',
      why: 'Alignment — how much time goes to product delivery vs maintenance. High focus = more impact.',
      target: '60-70% Product is healthy for most engineers. Some roles may intentionally skew operational.',
      trend_up: 'More product-focused work. Higher impact on business outcomes.',
      trend_down: 'More operational/maintenance work. May be intentional or indicate being pulled into support.',
    },
  },
];

// --- Trend helpers ---
function calcTrend(current: number | null | undefined, previous: number | null | undefined) {
  if (current == null || previous == null || previous === 0) return { direction: null as string | null, pct: null as number | null };
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (pct > 2) return { direction: 'up', pct };
  if (pct < -2) return { direction: 'down', pct };
  return { direction: 'flat', pct: 0 };
}

function trendColor(lowerIsBetter: boolean, direction: string | null): string {
  if (!direction || direction === 'flat') return 'text-slate-500';
  const goodUp = !lowerIsBetter;
  if (direction === 'up') return goodUp ? 'text-emerald-400' : 'text-rose-400';
  return goodUp ? 'text-rose-400' : 'text-emerald-400';
}

function compareColor(value: number | null | undefined, teamAvg: number | null | undefined, lowerIsBetter: boolean): string {
  if (value == null || teamAvg == null || teamAvg === 0) return 'text-slate-300';
  const ratio = value / teamAvg;
  if (lowerIsBetter) {
    if (ratio < 0.85) return 'text-emerald-400';
    if (ratio > 1.15) return 'text-rose-400';
  } else {
    if (ratio > 1.15) return 'text-emerald-400';
    if (ratio < 0.85) return 'text-rose-400';
  }
  return 'text-slate-300';
}

// --- Trend Badge (matches TeamMetrics style) ---
const TrendBadge = ({ current, prev, lowerIsBetter, format }: {
  current: number | null | undefined;
  prev: number | null | undefined;
  lowerIsBetter: boolean;
  format: (v: number | null | undefined) => string;
}) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const { direction, pct } = calcTrend(current, prev);
  if (!direction || pct === null) return null;

  const color = trendColor(lowerIsBetter, direction);
  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;

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
      <Icon size={11} />
      {direction !== 'flat' && <span>{Math.abs(pct)}%</span>}
      {pos && (
        <span
          className="fixed z-[9999]"
          style={{ top: pos.top, left: pos.left, transform: 'translateX(-50%)' }}
        >
          <span className="block bg-slate-900 border border-slate-600/60 rounded-lg shadow-xl shadow-black/40 px-3 py-2 text-left whitespace-nowrap">
            <span className="block text-[11px] text-slate-400 mb-1">
              Previous: <span className="text-slate-200 font-semibold">{format(prev)}</span>
            </span>
            <span className="block text-[11px] text-slate-400">
              Current: <span className="text-slate-200 font-semibold">{format(current)}</span>
            </span>
            <span className={`block text-[11px] mt-1 pt-1 border-t border-slate-700/60 font-medium ${color}`}>
              {direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'} {Math.abs(pct)}% {direction === 'flat' ? 'no change' : direction}
            </span>
          </span>
        </span>
      )}
    </span>
  );
};

// --- Help tooltip (matches TeamMetrics style) ---
const HelpTooltip = ({ help }: { help: HelpContent }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const handleEnter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const left = Math.min(rect.left + rect.width / 2, window.innerWidth - 160);
    setPos({ top: rect.bottom + 8, left: Math.max(left, 160) });
  };

  return (
    <span className="inline-flex" onMouseEnter={handleEnter} onMouseLeave={() => setPos(null)}>
      <HelpCircle size={13} className="text-slate-500 hover:text-orange-400 transition-colors cursor-help" />
      {pos && (
        <span
          className="fixed w-80 z-[9999]"
          style={{ top: pos.top, left: pos.left, transform: 'translateX(-50%)' }}
        >
          <span className="block bg-slate-900 border border-slate-600/60 rounded-lg shadow-xl shadow-black/40 p-3 text-left max-h-[70vh] overflow-y-auto">
            <span className="block text-[11px] font-semibold text-orange-300 mb-1">What is this?</span>
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

interface IndividualMetricsProps {
  refreshKey: number;
  project?: ProjectInfo | null;
}

const IndividualMetrics: React.FC<IndividualMetricsProps> = ({ refreshKey, project }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [period, setPeriod] = useState('all');
  const [expandedEngineer, setExpandedEngineer] = useState<string | null>(null);

  const fetchData = useCallback(async (p?: string) => {
    setLoading(true);
    try {
      const res = await getIndividualMetrics(p ?? period);
      setData(res.data);
    } catch {
      console.error('Failed to fetch individual metrics');
    } finally {
      setLoading(false);
    }
  }, [period]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await triggerSync();
      await fetchData();
      toast.success('Metrics refreshed', { id: 'ind-sync' });
    } catch {
      toast.error('Sync failed', { id: 'ind-sync-err' });
    } finally {
      setSyncing(false);
    }
  }, [fetchData]);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  const handlePeriodChange = (p: string) => {
    setPeriod(p);
    fetchData(p);
  };

  const engineers = data?.engineers || [];
  const teamAvg = data?.team_averages || {};
  const prevTeamAvg = data?.prev_team_averages || {};
  const hasPrev = period !== 'all';

  // Chart data: comparison bar chart per KPI
  const comparisonChartData = KPI_DEFS.filter(k => !['bug_ratio', 'focus_ratio', 'estimation_accuracy'].includes(k.key)).map(kpi => {
    const row: any = { metric: kpi.label };
    for (const eng of engineers) {
      row[eng.displayName] = eng.metrics?.[kpi.key] ?? 0;
    }
    return row;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">
            {project?.name ? `${project.name} — Individual Metrics` : 'Individual Metrics'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Per-engineer KPIs with team comparison</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex bg-slate-800/80 border border-slate-700/60 rounded-lg p-0.5">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => handlePeriodChange(p.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === p.value
                    ? 'bg-orange-500/20 text-orange-300 shadow-sm shadow-orange-500/15'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 text-sm font-medium px-4 py-2 rounded-lg transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Syncing...' : 'Sync & Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 animate-fade-in">
        {loading && !data ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-orange-400"></div>
          </div>
        ) : engineers.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 text-sm">No tracked engineers configured.</p>
            <p className="text-slate-500 text-xs mt-1">Go to Settings → Metrics to select team members.</p>
          </div>
        ) : (
          <div className="max-w-7xl space-y-6">
            {/* Team Average Row */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden shadow-sm shadow-black/10">
              <div className="px-4 py-3 border-b border-slate-700/40 bg-slate-800/60">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Team Average (per engineer)</span>
              </div>
              <div className="grid grid-cols-9 gap-px bg-slate-700/30">
                {KPI_DEFS.map(kpi => {
                  const val = teamAvg[kpi.key];
                  const prev = prevTeamAvg[kpi.key];
                  return (
                    <div key={kpi.key} className="bg-slate-800/80 px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{kpi.label}</span>
                        <HelpTooltip help={kpi.help} />
                      </div>
                      <span className="text-sm font-semibold text-slate-300 tabular-nums">{kpi.format(val)}</span>
                      {hasPrev && <TrendBadge current={val} prev={prev} lowerIsBetter={kpi.lowerIsBetter} format={kpi.format} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Engineer Rows */}
            {engineers.map((eng: any, engIdx: number) => {
              const isExpanded = expandedEngineer === eng.accountId;
              return (
                <div key={eng.accountId} className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden hover:border-slate-600/50 transition-colors duration-200">
                  {/* Engineer header */}
                  <button
                    onClick={() => setExpandedEngineer(isExpanded ? null : eng.accountId)}
                    className="w-full px-4 py-3 border-b border-slate-700/40 bg-slate-800/60 flex items-center gap-3 hover:bg-slate-700/40 transition-all duration-200"
                  >
                    {isExpanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                    {eng.avatar && <img src={eng.avatar} alt="" className="w-6 h-6 rounded-full" />}
                    <span className="text-sm font-semibold text-slate-200">{eng.displayName}</span>
                    <span className="text-xs text-slate-500 ml-auto">{eng.metrics?.total_tickets || 0} tickets</span>
                  </button>

                  {/* KPI cells */}
                  <div className="grid grid-cols-9 gap-px bg-slate-700/30">
                    {KPI_DEFS.map(kpi => {
                      const val = eng.metrics?.[kpi.key];
                      const prev = eng.prev_metrics?.[kpi.key];
                      const avg = teamAvg[kpi.key];
                      const cmpColor = compareColor(val, avg, kpi.lowerIsBetter);

                      return (
                        <div key={kpi.key} className="bg-slate-800/80 px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">{kpi.label}</span>
                            <HelpTooltip help={kpi.help} />
                          </div>
                          <span className={`text-sm font-semibold tabular-nums ${cmpColor}`}>
                            {kpi.format(val)}
                          </span>
                          {hasPrev && <TrendBadge current={val} prev={prev} lowerIsBetter={kpi.lowerIsBetter} format={kpi.format} />}
                          {/* vs team avg */}
                          {avg != null && val != null && (
                            <div className="text-[9px] text-slate-600 mt-0.5">
                              avg: {kpi.format(avg)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 py-4 border-t border-slate-700/40 bg-slate-900/30">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Bar chart: key metrics vs team avg */}
                        <div>
                          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">vs Team Average</h3>
                          <div className="h-52">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={KPI_DEFS.filter(k => ['total_tickets', 'total_story_points', 'total_eng_hours', 'avg_cycle_time_hours', 'complexity_score'].includes(k.key)).map(k => ({
                                metric: k.label,
                                engineer: eng.metrics?.[k.key] ?? 0,
                                team: teamAvg[k.key] ?? 0,
                              }))} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                <YAxis dataKey="metric" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={90} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12, color: '#e2e8f0' }} labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#e2e8f0' }} />
                                <Bar dataKey="engineer" name={eng.displayName} fill="#f97316" radius={[0, 3, 3, 0]} />
                                <Bar dataKey="team" name="Team Avg" fill="#475569" radius={[0, 3, 3, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Ratio metrics */}
                        <div>
                          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Ratios & Quality</h3>
                          <div className="space-y-3">
                            {KPI_DEFS.filter(k => ['estimation_accuracy', 'bug_ratio', 'focus_ratio', 'avg_eng_hours_per_sp'].includes(k.key)).map(kpi => {
                              const val = eng.metrics?.[kpi.key];
                              const avg = teamAvg[kpi.key];
                              const pctOfAvg = val != null && avg != null && avg > 0 ? Math.round((val / avg) * 100) : null;
                              return (
                                <div key={kpi.key} className="flex items-center gap-3">
                                  <span className="text-xs text-slate-400 w-28 flex items-center gap-1">
                                    {kpi.label}
                                    <HelpTooltip help={kpi.help} />
                                  </span>
                                  <div className="flex-1 bg-slate-700/40 rounded-full h-2.5 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        compareColor(val, avg, kpi.lowerIsBetter) === 'text-emerald-400' ? 'bg-emerald-500'
                                        : compareColor(val, avg, kpi.lowerIsBetter) === 'text-rose-400' ? 'bg-rose-500'
                                        : 'bg-orange-500'
                                      }`}
                                      style={{ width: `${Math.min(pctOfAvg ?? 50, 200) / 2}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs tabular-nums font-medium w-16 text-right ${compareColor(val, avg, kpi.lowerIsBetter)}`}>
                                    {kpi.format(val)}
                                  </span>
                                  <span className="text-[10px] text-slate-600 w-16 text-right">avg {kpi.format(avg)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Comparison chart */}
            {engineers.length > 1 && (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden p-4 shadow-sm shadow-black/10">
                <h2 className="text-sm font-semibold text-slate-200 mb-4">Team Comparison</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12, color: '#e2e8f0' }} labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#e2e8f0' }} />
                      {engineers.map((eng: any, i: number) => (
                        <Bar key={eng.accountId} dataKey={eng.displayName} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default IndividualMetrics;
