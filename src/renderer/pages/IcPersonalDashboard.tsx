import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Clock, RotateCcw, Target, TrendingUp, TrendingDown, Minus, BarChart3, AlertTriangle, Sparkles, Zap, CheckCircle2, Timer, Crosshair, BookOpen } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';
import { getIcPersonalMetrics, triggerSync, syncAllProjects, getAiConfig } from '../api';
import MetricCard, { SectionTitle, ExplainModal } from '../components/MetricCard';
import SuggestionPanel from '../components/SuggestionPanel';
import type { ProjectInfo } from '../App';
import type { IcPersonalMetricsResponse, AiProvider, AiSuggestRequest } from '../../shared/types';

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'half-yearly', label: 'Half Year' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
];

// Tooltip content: What the metric is + target for high-performing ICs
const TOOLTIPS = {
  cycleTimeP50: {
    description: 'Your median time from first active status to done. Lower means faster delivery.',
    target: 'Top performers: <2 days. Good: <5 days. Reduce wait time between statuses to improve.',
    trendUp: 'Your cycle time is increasing — tickets taking longer to complete',
    trendDown: 'Your cycle time is decreasing — faster delivery',
    derivation: 'Data source: JIRA changelogs for your tickets (filtered by my_account_id).\nComputation: Timeline engine extracts first active → done transition. Calendar hours. 50th percentile of your resolved tickets.\nFilters: Only your resolved tickets in the selected period.\nConfig dependency: my_account_id, active_statuses, done_statuses.',
  },
  reworkRate: {
    description: 'Percentage of your tickets with backward status transitions (e.g., back from Code Review to In Progress).',
    target: 'Top performers: <10%. Reducing rework improves velocity and code quality.',
    trendUp: 'More rework — consider improving first-pass quality or clarifying requirements',
    trendDown: 'Less rework — better first-pass quality',
    derivation: 'Data source: JIRA changelogs — backward status transitions on your tickets.\nComputation: count(your tickets with backward transitions) ÷ total resolved tickets.\nFilters: Only your tickets. Period filter.\nConfig dependency: my_account_id, active_statuses, done_statuses.',
  },
  tickets: {
    description: 'Number of tickets you completed in the selected period.',
    target: 'Focus on consistency over volume. A steady completion rate shows sustainable pace.',
    trendUp: 'Completing more tickets — velocity increasing',
    trendDown: 'Completing fewer tickets — may indicate larger tickets or blockers',
    derivation: 'Data source: JIRA resolved tickets assigned to you.\nComputation: Count of your resolved tickets in the period.\nFilters: Filtered to my_account_id. Period filter.\nConfig dependency: my_account_id, done_statuses.',
  },
  storyPoints: {
    description: 'Total story points you delivered in the selected period.',
    target: 'Track your trend. Increasing SP/ticket over time shows growth in capability.',
    trendUp: 'More story points delivered — increased output',
    trendDown: 'Fewer story points — may indicate simpler work or reduced capacity',
    derivation: 'Data source: JIRA story_points field on your tickets.\nComputation: Sum of story_points across your resolved tickets.\nFilters: Filtered to my_account_id. Period filter.\nConfig dependency: my_account_id, field_ids.story_points.',
  },
  spAccuracy: {
    description: 'Ratio of your actual engineering hours to estimated (SP x sp_to_days x 8h). 100% = perfectly calibrated.',
    target: '80-120% is well calibrated. <60% = over-estimating. >150% = under-estimating.',
    trendUp: 'Your estimates becoming less accurate',
    trendDown: 'Your estimates improving',
    derivation: 'Data source: JIRA story_points + computed engineering hours from field-engine.\nComputation: Per ticket: (actual_eng_hours ÷ (SP × sp_to_days × 8)) × 100. Averaged across your tickets with both values.\nFilters: Only your resolved tickets with SP > 0 and eng hours > 0.\nConfig dependency: my_account_id, sp_to_days, eng_start_status, eng_end_status, office_hours.',
  },
  firstTimePassRate: {
    description: 'Percentage of your tickets completed without backward status transitions.',
    target: 'Top performers: >90%. Below 75% means frequent rework.',
    trendUp: 'More tickets passing first time',
    trendDown: 'More rework happening',
    derivation: 'Data source: JIRA changelogs.\nComputation: 1 − your personal rework rate.\nFilters: Only your resolved tickets.\nConfig dependency: my_account_id, active_statuses, done_statuses.',
  },
  avgReviewWait: {
    description: 'Average time your tickets spend waiting in review statuses.',
    target: 'Elite: <4h. Good: <1 day. >2 days = review bottleneck affecting you.',
    trendUp: 'Your reviews taking longer',
    trendDown: 'Your reviews getting faster',
    derivation: 'Data source: JIRA changelogs — status periods in review statuses.\nComputation: Timeline engine finds periods in review-matching statuses for your tickets. Average hours.\nFilters: Only your resolved tickets with review periods.\nConfig dependency: my_account_id, active_statuses (review-matching).',
  },
  focusScore: {
    description: 'Percentage of your work on product features vs bugs and maintenance.',
    target: '>70% product work. Below 50% means you are spending most time on bugs/maintenance.',
    trendUp: 'More product-focused work',
    trendDown: 'More bug/maintenance work',
    derivation: 'Data source: JIRA issue_type field on your tickets.\nComputation: count(product types like Story, Task) ÷ total tickets × 100.\nFilters: Only your resolved tickets.\nConfig dependency: my_account_id.',
  },
  cycleTimeTrend: {
    description: 'Your weekly p50 cycle time over 8 weeks. Shows if you are getting faster over time.',
    target: 'Downward or stable trend. Spikes often correlate with unfamiliar domains or complex tickets.',
    trendUp: 'Weekly cycle time rising — investigate if tickets are getting more complex',
    trendDown: 'Weekly cycle time falling — you are getting faster',
    derivation: 'Data source: JIRA changelogs — cycle time per ticket.\nComputation: Your resolved tickets bucketed by resolution week. p50 cycle time per week, over 8 weeks.\nFilters: Only your resolved tickets.\nConfig dependency: my_account_id, active_statuses, done_statuses.',
  },
  throughput: {
    description: 'Tickets you completed each week.',
    target: 'Consistency matters most. 2-4 tickets/week is typical for most IC roles.',
    trendUp: 'Throughput rising — more completions per week',
    trendDown: 'Throughput falling — fewer completions per week',
    derivation: 'Data source: JIRA resolution dates on your tickets.\nComputation: Your resolved tickets bucketed by ISO week. Count per week.\nFilters: Only your resolved tickets.\nConfig dependency: my_account_id, done_statuses.',
  },
  timeInStatus: {
    description: 'How your total time is distributed across workflow states.',
    target: '>60% in active statuses (In Progress, Code Review). <20% in waiting states.',
    trendUp: 'More time in this status — check if it is a bottleneck for you',
    trendDown: 'Less time in this status — moving through faster',
    derivation: 'Data source: JIRA changelogs — status periods from timeline engine.\nComputation: Total hours your tickets spent in each status, as a percentage of total time across all statuses.\nFilters: Only your resolved tickets with timeline data.\nConfig dependency: my_account_id.',
  },
  scopeTrajectory: {
    description: 'Average story points per ticket by month. Shows complexity growth over time.',
    target: 'Gradual increase shows you are taking on more complex work over time.',
    trendUp: 'Taking on larger/more complex tickets',
    trendDown: 'Working on smaller tickets — may be intentional or indicate scope changes',
    derivation: 'Data source: JIRA story_points + resolution dates.\nComputation: Your resolved tickets grouped by resolution month. Average SP per ticket per month.\nFilters: Only your resolved tickets with story points.\nConfig dependency: my_account_id, field_ids.story_points.',
  },
  agingWip: {
    description: 'Your tickets currently in active statuses with days in current status.',
    target: 'Keep WIP to 1-2 items. Tickets >5 days in same status need attention.',
    trendUp: 'More aging tickets — consider finishing before starting new work',
    trendDown: 'Fewer aging tickets — keeping WIP fresh',
    derivation: 'Data source: JIRA changelogs — current status and time since last transition.\nComputation: Your open tickets in active statuses. daysInCurrentStatus from timeline engine.\nFilters: Only your tickets in active statuses.\nConfig dependency: my_account_id, active_statuses, done_statuses.',
  },
  teamComparison: {
    description: 'Your metrics compared to anonymous team medians. Opt-in via Settings.',
    target: 'At or above team median. Use as a benchmark for growth, not a competition.',
    trendUp: 'Metric rising relative to team — may be improvement or regression depending on metric',
    trendDown: 'Metric falling relative to team — check if this is the right direction for this metric',
    derivation: 'Data source: All team members\' resolved tickets.\nComputation: For each metric (cycle time, rework, throughput), compute your value and the team median (all engineers). Displayed side by side. Team values are anonymous.\nFilters: Opt-in via Settings. Period filter.\nConfig dependency: my_account_id.',
  },
  goalProgress: {
    description: 'Progress toward your personal targets set in Settings.',
    target: '100% of goals. Adjust targets if consistently under- or over-achieving.',
    trendUp: 'Getting closer to your goal — on track',
    trendDown: 'Moving away from your goal — may need to adjust approach',
    derivation: 'Data source: Your current metric values + configured goal targets.\nComputation: Per goal: (current_value ÷ target) × 100. Goals are configured in Settings.\nFilters: Period filter.\nConfig dependency: personal_goals (configured targets), my_account_id.',
  },
};

// Inline explain button for IC health cards
const IcExplainButton: React.FC<{ label: string; derivation?: string; dynamicDerivation?: string }> = ({ label, derivation, dynamicDerivation }) => {
  const [show, setShow] = useState(false);
  const text = dynamicDerivation ?? derivation;
  if (!text) return null;
  return (
    <>
      <button onClick={() => setShow(true)} className="text-slate-500 hover:text-slate-300 transition-colors opacity-0 group-hover:opacity-100" aria-label={`Explain: ${label}`}>
        <BookOpen size={11} />
      </button>
      {show && <ExplainModal title={label} derivation={text} onClose={() => setShow(false)} />}
    </>
  );
};

interface IcPersonalDashboardProps {
  refreshKey: number;
  project?: ProjectInfo | null;
  projectCount?: number;
}

const IcPersonalDashboard: React.FC<IcPersonalDashboardProps> = ({ refreshKey, project, projectCount }) => {
  const isMultiProject = (projectCount ?? 1) > 1;
  const [data, setData] = useState<IcPersonalMetricsResponse | null>(null);
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
      const res = await getIcPersonalMetrics(period);
      if (res.data && !('error' in res.data && !res.data.cycleTimeTrend)) {
        setData(res.data as IcPersonalMetricsResponse);
      }
    } catch {
      toast.error('Failed to load personal metrics');
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
      context: `IC Personal Dashboard. Period: ${period}. Tickets: ${data?.totalTickets ?? 0}, SP: ${data?.totalStoryPoints ?? 0}, Rework rate: ${data ? (data.reworkRate * 100).toFixed(0) : 0}%.`,
    });
    setSuggestionOpen(true);
  };

  const fmtHours = (h: number | null) => {
    if (h == null || h === 0) return '—';
    return h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700/50 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">
            {project?.name ? `${project.name} — My Metrics` : 'My Metrics'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Your personal performance trends and growth insights</p>
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
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Personal KPI cards */}
            {(() => {
              // Compute trends from weekly data
              const ctTrend = data.cycleTimeTrend.filter(t => t.value > 0);
              const ctChange = ctTrend.length >= 2
                ? ((ctTrend[ctTrend.length - 1].value - ctTrend[ctTrend.length - 2].value) / ctTrend[ctTrend.length - 2].value) * 100
                : null;
              const rwTrend = data.reworkTrend.filter(t => t.value > 0);
              const rwChange = rwTrend.length >= 2
                ? ((rwTrend[rwTrend.length - 1].value - rwTrend[rwTrend.length - 2].value) / rwTrend[rwTrend.length - 2].value) * 100
                : null;
              const tpTrend = data.throughput.filter(t => t.value > 0);
              const tpChange = tpTrend.length >= 2
                ? ((tpTrend[tpTrend.length - 1].value - tpTrend[tpTrend.length - 2].value) / tpTrend[tpTrend.length - 2].value) * 100
                : null;

              // Health thresholds
              const reworkPct = data.reworkRate * 100;
              const reworkHealth = reworkPct <= 10 ? 'good' : reworkPct <= 20 ? 'ok' : 'bad';
              const ctHours = data.cycleTimeP50 ?? 0;
              const ctHealth = ctHours <= 48 ? 'good' : ctHours <= 120 ? 'ok' : 'bad';

              const healthColors = { good: 'text-emerald-400', ok: 'text-amber-400', bad: 'text-rose-400' };
              const healthBgs = { good: 'bg-emerald-500/10 border-emerald-500/20', ok: 'bg-amber-500/10 border-amber-500/20', bad: 'bg-rose-500/10 border-rose-500/20' };
              const healthDots = { good: 'bg-emerald-400', ok: 'bg-amber-400', bad: 'bg-rose-400' };

              // Trend arrow component (lower-is-better = invert)
              const TrendArrow: React.FC<{ change: number | null; invertColor?: boolean }> = ({ change, invertColor }) => {
                if (change == null || !isFinite(change)) return null;
                const absChange = Math.abs(change);
                if (absChange < 1) return <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500"><Minus size={10} />stable</span>;
                const isUp = change > 0;
                // For cycle time & rework, going up is bad. For throughput, up is good.
                const isPositive = invertColor ? !isUp : isUp;
                const color = isPositive ? 'text-emerald-400' : 'text-rose-400';
                const Icon = isUp ? TrendingUp : TrendingDown;
                return (
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${color}`}>
                    <Icon size={10} />
                    {absChange.toFixed(0)}%
                  </span>
                );
              };

              return (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Cycle Time p50 */}
                  <div className={`glass-card p-4 border ${healthBgs[ctHealth]} relative overflow-hidden group`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg bg-slate-800/60 ${healthColors[ctHealth]}`}>
                          <Clock size={14} />
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">Cycle Time p50</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${healthDots[ctHealth]} ${ctHealth !== 'good' ? 'animate-pulse' : ''}`} />
                        <IcExplainButton label="Cycle Time p50" derivation={TOOLTIPS.cycleTimeP50.derivation} dynamicDerivation={data.traces?.cycleTimeP50} />
                        {aiConfigured && (
                          <button onClick={() => openSuggestion('Cycle Time p50', fmtHours(data.cycleTimeP50), TOOLTIPS.cycleTimeP50.description)} className="text-violet-400/40 hover:text-violet-400 transition-colors opacity-0 group-hover:opacity-100" aria-label="AI suggestions">
                            <Sparkles size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <p className={`text-2xl font-bold ${healthColors[ctHealth]}`}>{fmtHours(data.cycleTimeP50)}</p>
                      <TrendArrow change={ctChange} invertColor />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {ctHealth === 'good' ? 'Fast delivery' : ctHealth === 'ok' ? 'Room to improve' : 'Needs attention'}
                    </p>
                  </div>

                  {/* Rework Rate */}
                  <div className={`glass-card p-4 border ${healthBgs[reworkHealth]} relative overflow-hidden group`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg bg-slate-800/60 ${healthColors[reworkHealth]}`}>
                          <RotateCcw size={14} />
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">Rework Rate</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${healthDots[reworkHealth]} ${reworkHealth !== 'good' ? 'animate-pulse' : ''}`} />
                        <IcExplainButton label="Rework Rate" derivation={TOOLTIPS.reworkRate.derivation} dynamicDerivation={data.traces?.reworkRate} />
                        {aiConfigured && (
                          <button onClick={() => openSuggestion('Rework Rate', `${reworkPct.toFixed(0)}%`, TOOLTIPS.reworkRate.description)} className="text-violet-400/40 hover:text-violet-400 transition-colors opacity-0 group-hover:opacity-100" aria-label="AI suggestions">
                            <Sparkles size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <p className={`text-2xl font-bold ${healthColors[reworkHealth]}`}>{reworkPct.toFixed(0)}%</p>
                      <TrendArrow change={rwChange} invertColor />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {reworkHealth === 'good' ? 'Clean delivery' : reworkHealth === 'ok' ? 'Some re-opens' : 'High rework'}
                    </p>
                  </div>

                  {/* Tickets */}
                  <div className="glass-card p-4 border bg-emerald-500/10 border-emerald-500/20 relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-slate-800/60 text-emerald-400">
                          <Zap size={14} />
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">Tickets</span>
                      </div>
                      <IcExplainButton label="Tickets" derivation={TOOLTIPS.tickets.derivation} dynamicDerivation={data.traces?.tickets} />
                      {aiConfigured && (
                        <button onClick={() => openSuggestion('Tickets Completed', data.totalTickets, TOOLTIPS.tickets.description)} className="text-violet-400/40 hover:text-violet-400 transition-colors opacity-0 group-hover:opacity-100" aria-label="AI suggestions">
                          <Sparkles size={11} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-end justify-between">
                      <p className="text-2xl font-bold text-emerald-400">{data.totalTickets}</p>
                      <TrendArrow change={tpChange} />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">{data.totalStoryPoints} story points</p>
                  </div>

                  {/* Velocity / Personal Score */}
                  <div className="glass-card p-4 border bg-indigo-500/10 border-indigo-500/20 relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-slate-800/60 text-indigo-400">
                          <BarChart3 size={14} />
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">Story Points</span>
                      </div>
                      <IcExplainButton label="Story Points" derivation={TOOLTIPS.storyPoints.derivation} dynamicDerivation={data.traces?.tickets} />
                      {aiConfigured && (
                        <button onClick={() => openSuggestion('Story Points Delivered', data.totalStoryPoints, TOOLTIPS.storyPoints.description)} className="text-violet-400/40 hover:text-violet-400 transition-colors opacity-0 group-hover:opacity-100" aria-label="AI suggestions">
                          <Sparkles size={11} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-end justify-between">
                      <p className="text-2xl font-bold text-indigo-400">{data.totalStoryPoints}</p>
                      <span className="text-[10px] text-slate-500">
                        {data.totalTickets > 0 ? `${(data.totalStoryPoints / data.totalTickets).toFixed(1)} SP/ticket` : '—'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">{data.totalTickets} tickets delivered</p>
                  </div>
                </div>
              );
            })()}

            {/* New metrics row: Estimation Accuracy, First-Time Pass, Review Wait, Focus Score */}
            {(() => {
              const spAccHealth = data.spAccuracy != null
                ? (data.spAccuracy >= 80 && data.spAccuracy <= 120 ? 'good' : data.spAccuracy >= 60 && data.spAccuracy <= 150 ? 'ok' : 'bad')
                : null;
              const fprHealth = data.firstTimePassRate >= 0.90 ? 'good' : data.firstTimePassRate >= 0.75 ? 'ok' : 'bad';
              const reviewHealth = data.avgReviewWaitHours != null
                ? (data.avgReviewWaitHours <= 4 ? 'good' : data.avgReviewWaitHours <= 24 ? 'ok' : 'bad')
                : null;
              const focusHealth = data.focusScore != null
                ? (data.focusScore >= 0.70 ? 'good' : data.focusScore >= 0.50 ? 'ok' : 'bad')
                : null;

              const healthColors = { good: 'text-emerald-400', ok: 'text-amber-400', bad: 'text-rose-400' };
              const healthBgs = { good: 'bg-emerald-500/10 border-emerald-500/20', ok: 'bg-amber-500/10 border-amber-500/20', bad: 'bg-rose-500/10 border-rose-500/20' };
              const healthDots = { good: 'bg-emerald-400', ok: 'bg-amber-400', bad: 'bg-rose-400' };

              return (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Estimation Accuracy */}
                  <div className={`glass-card p-4 border ${spAccHealth ? healthBgs[spAccHealth] : 'bg-slate-800/30 border-slate-700/30'} relative overflow-hidden group`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg bg-slate-800/60 ${spAccHealth ? healthColors[spAccHealth] : 'text-slate-400'}`}>
                          <Target size={14} />
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">SP Accuracy</span>
                      </div>
                      <IcExplainButton label="SP Accuracy" derivation={TOOLTIPS.spAccuracy.derivation} dynamicDerivation={data.traces?.spAccuracy} />
                      {spAccHealth && <span className={`w-2 h-2 rounded-full ${healthDots[spAccHealth]} ${spAccHealth !== 'good' ? 'animate-pulse' : ''}`} />}
                    </div>
                    <p className={`text-2xl font-bold ${spAccHealth ? healthColors[spAccHealth] : 'text-slate-400'}`}>
                      {data.spAccuracy != null ? `${data.spAccuracy.toFixed(0)}%` : 'N/A'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {spAccHealth === 'good' ? 'Well calibrated' : spAccHealth === 'ok' ? 'Room to improve' : spAccHealth === 'bad' ? 'Needs attention' : 'No data'}
                    </p>
                  </div>

                  {/* First-Time Pass Rate */}
                  <div className={`glass-card p-4 border ${healthBgs[fprHealth]} relative overflow-hidden group`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg bg-slate-800/60 ${healthColors[fprHealth]}`}>
                          <CheckCircle2 size={14} />
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">First-Time Pass</span>
                      </div>
                      <IcExplainButton label="First-Time Pass" derivation={TOOLTIPS.firstTimePassRate.derivation} dynamicDerivation={data.traces?.firstTimePassRate} />
                      <span className={`w-2 h-2 rounded-full ${healthDots[fprHealth]} ${fprHealth !== 'good' ? 'animate-pulse' : ''}`} />
                    </div>
                    <p className={`text-2xl font-bold ${healthColors[fprHealth]}`}>
                      {(data.firstTimePassRate * 100).toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {fprHealth === 'good' ? 'Excellent quality' : fprHealth === 'ok' ? 'Some rework' : 'High rework'}
                    </p>
                  </div>

                  {/* Review Wait Time */}
                  <div className={`glass-card p-4 border ${reviewHealth ? healthBgs[reviewHealth] : 'bg-slate-800/30 border-slate-700/30'} relative overflow-hidden group`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg bg-slate-800/60 ${reviewHealth ? healthColors[reviewHealth] : 'text-slate-400'}`}>
                          <Timer size={14} />
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">Review Wait</span>
                      </div>
                      <IcExplainButton label="Review Wait" derivation={TOOLTIPS.avgReviewWait.derivation} dynamicDerivation={data.traces?.avgReviewWait} />
                      {reviewHealth && <span className={`w-2 h-2 rounded-full ${healthDots[reviewHealth]} ${reviewHealth !== 'good' ? 'animate-pulse' : ''}`} />}
                    </div>
                    <p className={`text-2xl font-bold ${reviewHealth ? healthColors[reviewHealth] : 'text-slate-400'}`}>
                      {data.avgReviewWaitHours != null ? fmtHours(data.avgReviewWaitHours) : 'N/A'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {reviewHealth === 'good' ? 'Fast reviews' : reviewHealth === 'ok' ? 'Acceptable' : reviewHealth === 'bad' ? 'Review bottleneck' : 'No data'}
                    </p>
                  </div>

                  {/* Focus Score */}
                  <div className={`glass-card p-4 border ${focusHealth ? healthBgs[focusHealth] : 'bg-slate-800/30 border-slate-700/30'} relative overflow-hidden group`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg bg-slate-800/60 ${focusHealth ? healthColors[focusHealth] : 'text-slate-400'}`}>
                          <Crosshair size={14} />
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">Focus Score</span>
                      </div>
                      <IcExplainButton label="Focus Score" derivation={TOOLTIPS.focusScore.derivation} dynamicDerivation={data.traces?.focusScore} />
                      {focusHealth && <span className={`w-2 h-2 rounded-full ${healthDots[focusHealth]} ${focusHealth !== 'good' ? 'animate-pulse' : ''}`} />}
                    </div>
                    <p className={`text-2xl font-bold ${focusHealth ? healthColors[focusHealth] : 'text-slate-400'}`}>
                      {data.focusScore != null ? `${(data.focusScore * 100).toFixed(0)}%` : 'N/A'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {focusHealth === 'good' ? 'Product-focused' : focusHealth === 'ok' ? 'Mixed work' : focusHealth === 'bad' ? 'Bug-heavy' : 'No data'}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Cycle time trend */}
            {data.cycleTimeTrend.length > 0 && data.cycleTimeTrend.some(t => t.value > 0) && (
              <div className="glass-card p-5">
                <SectionTitle
                  title="Cycle Time Trend (weekly p50)"
                  tooltip={TOOLTIPS.cycleTimeTrend}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Cycle Time Trend', fmtHours(data.cycleTimeP50), TOOLTIPS.cycleTimeTrend.description)}
                />
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={data.cycleTimeTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#cbd5e1' }}
                      formatter={(value: number) => [fmtHours(value), 'p50']}
                    />
                    <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Cycle Time p50" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Throughput trend */}
            {data.throughput.length > 0 && data.throughput.some(t => t.value > 0) && (
              <div className="glass-card p-5">
                <SectionTitle
                  title="Weekly Throughput"
                  tooltip={TOOLTIPS.throughput}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Weekly Throughput', data.throughput.map(t => `${t.week}: ${t.value}`).join(', '), TOOLTIPS.throughput.description)}
                />
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.throughput}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#cbd5e1' }} />
                    <Bar dataKey="value" fill="#10b981" name="Tickets Done" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Time in status */}
            {data.timeInStatus.length > 0 && (
              <div className="glass-card p-5">
                <SectionTitle
                  title="Time in Each Status"
                  tooltip={TOOLTIPS.timeInStatus}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Time in Each Status', data.timeInStatus.map(s => `${s.status}: ${s.percentage.toFixed(0)}%`).join(', '), TOOLTIPS.timeInStatus.description)}
                />
                <div className="space-y-2">
                  {data.timeInStatus.map(s => (
                    <div key={s.status} className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 w-28 truncate">{s.status}</span>
                      <div className="flex-1 bg-slate-800/50 rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full bg-indigo-500/60 rounded-full transition-all"
                          style={{ width: `${Math.min(s.percentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-300 w-16 text-right">{s.percentage.toFixed(0)}%</span>
                      <span className="text-xs text-slate-500 w-16 text-right">{fmtHours(s.hours)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scope trajectory */}
            {data.scopeTrajectory.length > 1 && (
              <div className="glass-card p-5">
                <SectionTitle
                  title="Scope Trajectory (avg SP/ticket by month)"
                  tooltip={TOOLTIPS.scopeTrajectory}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Scope Trajectory', data.scopeTrajectory.map(s => `${s.month}: ${s.avgSp.toFixed(1)} SP`).join(', '), TOOLTIPS.scopeTrajectory.description)}
                />
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={data.scopeTrajectory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#cbd5e1' }} />
                    <Line type="monotone" dataKey="avgSp" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} name="Avg SP" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* My aging WIP */}
            {data.agingWip.length > 0 && (
              <div className="glass-card p-5">
                <SectionTitle
                  title="My In-Progress Tickets"
                  icon={<AlertTriangle size={16} className="text-amber-400" />}
                  tooltip={TOOLTIPS.agingWip}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('My In-Progress Tickets', `${data.agingWip.length} tickets in progress`, TOOLTIPS.agingWip.description)}
                />
                <div className="space-y-2">
                  {data.agingWip.map(item => (
                    <div key={item.key} className="flex items-center gap-4 p-3 bg-slate-800/40 rounded-lg border border-slate-700/20">
                      <span className="text-xs text-slate-300 font-mono w-20">{item.key}</span>
                      <span className="text-xs text-slate-200 flex-1 truncate">{item.summary}</span>
                      <span className="text-xs text-slate-400">{item.status}</span>
                      <span className={`text-xs font-semibold ${item.daysInStatus > 7 ? 'text-rose-400' : item.daysInStatus > 3 ? 'text-amber-400' : 'text-slate-300'}`}>
                        {item.daysInStatus}d
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Team comparison (opt-in) */}
            {data.teamComparison && (
              <div className="glass-card p-5">
                <SectionTitle
                  title="Team Comparison (anonymous)"
                  tooltip={TOOLTIPS.teamComparison}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Team Comparison', data.teamComparison?.map(tc => `${tc.metric}: You ${tc.myValue.toFixed(1)} vs Team ${tc.teamMedian.toFixed(1)}`).join(', ') ?? null, TOOLTIPS.teamComparison.description)}
                />
                <div className="space-y-3">
                  {data.teamComparison.map(tc => (
                    <div key={tc.metric} className="flex items-center gap-4">
                      <span className="text-xs text-slate-400 w-40">{tc.metric}</span>
                      <div className="flex gap-4 flex-1">
                        <span className="text-xs text-indigo-300">You: {tc.myValue.toFixed(1)}</span>
                        <span className="text-xs text-slate-400">Team median: {tc.teamMedian.toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Goal progress */}
            {data.goalProgress && data.goalProgress.length > 0 && (
              <div className="glass-card p-5">
                <SectionTitle
                  title="Goal Progress"
                  icon={<Target size={16} className="text-emerald-400" />}
                  tooltip={TOOLTIPS.goalProgress}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Goal Progress', data.goalProgress?.map(g => `${g.metric}: ${g.current.toFixed(0)}/${g.target}`).join(', ') ?? null, TOOLTIPS.goalProgress.description)}
                />
                <div className="space-y-3">
                  {data.goalProgress.map(g => {
                    const pct = g.target > 0 ? Math.min((g.current / g.target) * 100, 100) : 0;
                    return (
                      <div key={g.metric}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-300">{g.metric}</span>
                          <span className="text-slate-400">{g.current.toFixed(1)} / {g.target}</span>
                        </div>
                        <div className="bg-slate-800/50 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500/60'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <TrendingUp size={32} className="mb-2 opacity-50" />
            <p className="text-sm">No data yet. Sync and set your account ID in Settings to see personal metrics.</p>
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

export default IcPersonalDashboard;
