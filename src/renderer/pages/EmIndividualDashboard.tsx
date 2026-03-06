import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, Users, Clock, RotateCcw, Bug, Sparkles, BarChart3, TrendingUp, HelpCircle, BookOpen } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';
import { getEmIndividualMetrics, triggerSync, syncAllProjects, getAiConfig } from '../api';
import { SectionTitle, ExplainModal } from '../components/MetricCard';
import SuggestionPanel from '../components/SuggestionPanel';
import type { ProjectInfo } from '../App';
import type { EmIndividualMetricsResponse, EmEngineerDetail, AiProvider, AiSuggestRequest } from '../../shared/types';

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'half-yearly', label: 'Half Year' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
];

// Tooltip content
const TOOLTIPS = {
  teamAvg: {
    description: 'Aggregated averages across all tracked engineers. Used as a baseline for individual comparison.',
    target: 'Cycle p50 <5 days, Rework <15%, Bug ratio <15%. Improving averages signals whole-team growth.',
    trendUp: 'Team average rising — may be good (throughput) or bad (cycle time, rework)',
    trendDown: 'Team average falling — may indicate improvement or concern depending on the metric',
    derivation: 'Data source: All resolved tickets assigned to tracked engineers.\nComputation: Each metric (cycle time, rework, bug ratio, SP accuracy, first-time pass rate) is computed per-engineer then averaged. Cycle time uses timeline engine, rework uses backward transition detection.\nFilters: Period and project filters. Only tracked engineers.\nConfig dependency: tracked_engineers, active_statuses, done_statuses.',
  },
  outputComparison: {
    description: 'Tickets and story points per tracked engineer. Shows relative output distribution.',
    target: 'Balanced output across engineers. Large gaps may indicate workload imbalance.',
    trendUp: 'Engineer output increasing — higher individual velocity',
    trendDown: 'Engineer output decreasing — may indicate blockers or capacity shifts',
    derivation: 'Data source: JIRA assignee, story_points, and resolution date.\nComputation: Per engineer: count of resolved tickets and sum of story points. Displayed as a grouped bar chart.\nFilters: Period and project filters. Only tracked engineers.\nConfig dependency: tracked_engineers, field_ids.story_points.',
  },
  engineerCards: {
    description: 'Per-engineer cycle time, rework, bug ratio, complexity, and focus. Expandable for detail.',
    target: 'Green metrics = better than team avg. Focus on improving red metrics through coaching.',
    trendUp: 'Metric rising vs team avg — green if the metric benefits from increase, red otherwise',
    trendDown: 'Metric falling vs team avg — green if lower is better (cycle time, rework), red otherwise',
    derivation: 'Data source: JIRA changelogs + ticket fields per engineer.\nComputation: Each engineer card shows cycle time p50/p85 (timeline engine), rework rate (backward transitions), bug ratio (bug tickets ÷ total), SP accuracy (active time ÷ estimated), first-time pass rate (1 − rework), complexity score (avg SP/ticket), and focus ratio (product tickets ÷ total). Color-coded vs team average: green = better, red = worse.\nFilters: Period and project filters. Only tracked engineers.\nConfig dependency: tracked_engineers, active_statuses, done_statuses, sp_to_days.',
  },
};

// Per-card help text for inline tooltips on team average KPI cards
const CARD_HELP: Record<string, { text: string; derivation: string }> = {
  cycleP50: {
    text: 'Median cycle time across tracked engineers. Lower is better. Up = slower, down = faster.',
    derivation: 'Data source: JIRA changelogs via timeline engine.\nComputation: Average of per-engineer median cycle times (first active → done, calendar hours).\nFilters: Only resolved tickets. Scoped to tracked engineers.\nConfig dependency: active_statuses, done_statuses.',
  },
  rework: {
    text: 'Average rework rate. Lower is better. Up = more re-opens, down = cleaner delivery.',
    derivation: 'Data source: JIRA changelogs — backward status transitions.\nComputation: Average rework rate across all tracked engineers. Per engineer: tickets with backward transitions ÷ total resolved tickets.\nFilters: Period and project filters.\nConfig dependency: active_statuses, done_statuses.',
  },
  bugRatio: {
    text: 'Average bug ratio. Lower is better. Up = more bugs, down = better quality.',
    derivation: 'Data source: JIRA issue_type field.\nComputation: Average bug ratio across tracked engineers. Per engineer: count(Bug type) ÷ total tickets.\nFilters: Period and project filters.\nConfig dependency: tracked_engineers.',
  },
  tickets: {
    text: 'Total tickets completed by tracked engineers in selected period.',
    derivation: 'Data source: JIRA resolved tickets.\nComputation: Sum of resolved ticket count across all tracked engineers.\nFilters: Period and project filters.\nConfig dependency: tracked_engineers, done_statuses.',
  },
  storyPoints: {
    text: 'Total story points delivered. Higher indicates more output.',
    derivation: 'Data source: JIRA story_points field.\nComputation: Sum of story_points across all resolved tickets assigned to tracked engineers.\nFilters: Period and project filters.\nConfig dependency: tracked_engineers, field_ids.story_points.',
  },
};

// Tiny inline help tooltip for custom KPI cards
const CardHelp: React.FC<{ text: string; derivation?: string; dynamicDerivation?: string; label?: string }> = ({ text, derivation, dynamicDerivation, label }) => {
  const [show, setShow] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  return (
    <>
      <span className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
        <HelpCircle size={10} className="text-slate-500 hover:text-slate-300 transition-colors cursor-help" />
        {show && (
          <span className="absolute z-50 top-full mt-1 left-0 w-52 bg-slate-800/95 backdrop-blur-md border border-slate-600/50 rounded-lg shadow-2xl p-2 text-[10px] text-slate-300 leading-relaxed animate-fade-in">
            {text}
          </span>
        )}
      </span>
      {(dynamicDerivation ?? derivation) && (
        <button
          onClick={() => setShowExplain(true)}
          className="text-slate-500 hover:text-slate-300 transition-colors"
          aria-label={`Explain: ${label ?? 'metric'}`}
        >
          <BookOpen size={10} />
        </button>
      )}
      {showExplain && (dynamicDerivation ?? derivation) && (
        <ExplainModal title={label ?? 'Metric'} derivation={(dynamicDerivation ?? derivation)!} onClose={() => setShowExplain(false)} />
      )}
    </>
  );
};

interface EmIndividualDashboardProps {
  refreshKey: number;
  project?: ProjectInfo | null;
  projectCount?: number;
}

const EmIndividualDashboard: React.FC<EmIndividualDashboardProps> = ({ refreshKey, project, projectCount }) => {
  const isMultiProject = (projectCount ?? 1) > 1;
  const [data, setData] = useState<EmIndividualMetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [period, setPeriod] = useState('all');
  const [expandedEngineer, setExpandedEngineer] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiProvider, setAiProvider] = useState<AiProvider>('openai');
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionRequest, setSuggestionRequest] = useState<AiSuggestRequest | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEmIndividualMetrics(period);
      if (res.data && !('error' in res.data)) {
        setData(res.data as EmIndividualMetricsResponse);
      }
    } catch {
      toast.error('Failed to load individual metrics');
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
      context: `EM Individual Dashboard. Period: ${period}. ${data?.engineers.length ?? 0} tracked engineers. Team avg cycle p50: ${fmtHours(data?.teamAverages.cycleTimeP50 ?? null)}, rework: ${fmtPct(data?.teamAverages.reworkRate ?? 0)}.`,
    });
    setSuggestionOpen(true);
  };

  const openEngineerSuggestion = (eng: EmEngineerDetail) => {
    setSuggestionRequest({
      metricLabel: `${eng.displayName} — Individual Metrics`,
      currentValue: `${eng.tickets} tickets, ${eng.storyPoints} SP`,
      helpText: 'Per-engineer performance metrics with team comparison',
      context: `Engineer: ${eng.displayName}. Cycle p50: ${fmtHours(eng.cycleTimeP50)}, Rework: ${fmtPct(eng.reworkRate)}, Bug ratio: ${fmtPct(eng.bugRatio)}, Complexity: ${eng.complexityScore?.toFixed(1) ?? 'N/A'}, Focus: ${eng.focusRatio != null ? fmtPct(eng.focusRatio) : 'N/A'}. Team avg cycle p50: ${fmtHours(data?.teamAverages.cycleTimeP50 ?? null)}, rework: ${fmtPct(data?.teamAverages.reworkRate ?? 0)}, bug ratio: ${fmtPct(data?.teamAverages.bugRatio ?? 0)}.`,
    });
    setSuggestionOpen(true);
  };

  const fmtHours = (h: number | null) => {
    if (h == null || h === 0) return '—';
    return h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`;
  };

  const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

  const compareToAvg = (value: number | null, avg: number | null, lowerIsBetter = false): string => {
    if (value == null || avg == null || avg === 0) return '';
    const diff = ((value - avg) / avg) * 100;
    if (Math.abs(diff) < 5) return 'text-slate-400';
    if (lowerIsBetter) {
      return diff < 0 ? 'text-emerald-400' : 'text-rose-400';
    }
    return diff > 0 ? 'text-emerald-400' : 'text-rose-400';
  };

  // Chart data for overview
  const chartData = data?.engineers.map(e => ({
    name: e.displayName,
    tickets: e.tickets,
    sp: e.storyPoints,
    rework: e.reworkRate * 100,
  })) ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700/50 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">
            {isMultiProject ? 'All Projects — Individual Metrics' : project?.name ? `${project.name} — Individual Metrics` : 'Individual Metrics'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Per-engineer cycle time, rework, bug ratio, and contribution</p>
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
        ) : data && data.engineers.length > 0 ? (
          <div className="space-y-6 max-w-6xl mx-auto">
            {/* Team averages — KPI cards */}
            {(() => {
              const avg = data.teamAverages;
              const ctHours = avg.cycleTimeP50 ?? 0;
              const ctHealth = ctHours <= 48 ? 'good' : ctHours <= 120 ? 'ok' : 'bad';
              const rwPct = avg.reworkRate * 100;
              const rwHealth = rwPct <= 15 ? 'good' : rwPct <= 25 ? 'ok' : 'bad';
              const brPct = avg.bugRatio * 100;
              const brHealth = brPct <= 10 ? 'good' : brPct <= 20 ? 'ok' : 'bad';

              const healthColor = { good: 'text-emerald-400', ok: 'text-amber-400', bad: 'text-rose-400' };
              const healthBg = { good: 'bg-emerald-500/10 border-emerald-500/20', ok: 'bg-amber-500/10 border-amber-500/20', bad: 'bg-rose-500/10 border-rose-500/20' };
              const healthDot = { good: 'bg-emerald-400', ok: 'bg-amber-400', bad: 'bg-rose-400' };
              const healthLabel = { good: 'Healthy', ok: 'Monitor', bad: 'At risk' };

              return (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Team Averages</h3>
                    {aiConfigured && (
                      <button
                        onClick={() => openSuggestion('Team Averages', `Cycle p50: ${fmtHours(avg.cycleTimeP50)}, Rework: ${fmtPct(avg.reworkRate)}, Bug Ratio: ${fmtPct(avg.bugRatio)}`, TOOLTIPS.teamAvg.description)}
                        className="text-violet-400/60 hover:text-violet-400 transition-colors"
                        aria-label="AI suggestions for team averages"
                      >
                        <Sparkles size={13} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {/* Cycle Time p50 */}
                    <div className={`glass-card p-4 border ${healthBg[ctHealth]} group`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 rounded-lg bg-slate-800/60 ${healthColor[ctHealth]}`}>
                          <Clock size={13} />
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Cycle p50</span>
                        <CardHelp text={CARD_HELP.cycleP50.text} derivation={CARD_HELP.cycleP50.derivation} dynamicDerivation={data.traces?.teamAvg} label="Cycle p50" />
                        <span className={`w-1.5 h-1.5 rounded-full ${healthDot[ctHealth]} ${ctHealth !== 'good' ? 'animate-pulse' : ''} ml-auto`} />
                      </div>
                      <p className={`text-xl font-bold ${healthColor[ctHealth]}`}>{fmtHours(avg.cycleTimeP50)}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{healthLabel[ctHealth]}</p>
                    </div>

                    {/* Rework Rate */}
                    <div className={`glass-card p-4 border ${healthBg[rwHealth]} group`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 rounded-lg bg-slate-800/60 ${healthColor[rwHealth]}`}>
                          <RotateCcw size={13} />
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Rework</span>
                        <CardHelp text={CARD_HELP.rework.text} derivation={CARD_HELP.rework.derivation} dynamicDerivation={data.traces?.teamAvg} label="Rework" />
                        <span className={`w-1.5 h-1.5 rounded-full ${healthDot[rwHealth]} ${rwHealth !== 'good' ? 'animate-pulse' : ''} ml-auto`} />
                      </div>
                      <p className={`text-xl font-bold ${healthColor[rwHealth]}`}>{fmtPct(avg.reworkRate)}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{healthLabel[rwHealth]}</p>
                    </div>

                    {/* Bug Ratio */}
                    <div className={`glass-card p-4 border ${healthBg[brHealth]} group`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 rounded-lg bg-slate-800/60 ${healthColor[brHealth]}`}>
                          <Bug size={13} />
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Bug Ratio</span>
                        <CardHelp text={CARD_HELP.bugRatio.text} derivation={CARD_HELP.bugRatio.derivation} dynamicDerivation={data.traces?.teamAvg} label="Bug Ratio" />
                        <span className={`w-1.5 h-1.5 rounded-full ${healthDot[brHealth]} ${brHealth !== 'good' ? 'animate-pulse' : ''} ml-auto`} />
                      </div>
                      <p className={`text-xl font-bold ${healthColor[brHealth]}`}>{fmtPct(avg.bugRatio)}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{healthLabel[brHealth]}</p>
                    </div>

                    {/* Tickets */}
                    <div className="glass-card p-4 border bg-indigo-500/10 border-indigo-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-slate-800/60 text-indigo-400">
                          <BarChart3 size={13} />
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Tickets</span>
                        <CardHelp text={CARD_HELP.tickets.text} derivation={CARD_HELP.tickets.derivation} dynamicDerivation={data.traces?.teamAvg} label="Tickets" />
                      </div>
                      <p className="text-xl font-bold text-indigo-400">{avg.tickets}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{data.engineers.length} engineers</p>
                    </div>

                    {/* Story Points */}
                    <div className="glass-card p-4 border bg-cyan-500/10 border-cyan-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-slate-800/60 text-cyan-400">
                          <TrendingUp size={13} />
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Story Points</span>
                        <CardHelp text={CARD_HELP.storyPoints.text} derivation={CARD_HELP.storyPoints.derivation} dynamicDerivation={data.traces?.teamAvg} label="Story Points" />
                      </div>
                      <p className="text-xl font-bold text-cyan-400">{avg.storyPoints}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{avg.tickets > 0 ? `${(avg.storyPoints / avg.tickets).toFixed(1)} SP/ticket` : '—'}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Overview chart */}
            {chartData.length > 0 && (
              <div className="glass-card p-5">
                <SectionTitle
                  title="Engineer Output Comparison"
                  tooltip={TOOLTIPS.outputComparison}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Engineer Output Comparison', chartData.map(c => `${c.name}: ${c.tickets} tix, ${c.sp} SP`).join('; '), TOOLTIPS.outputComparison.description)}
                />
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#cbd5e1' }} />
                    <Bar dataKey="tickets" fill="#6366f1" name="Tickets" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sp" fill="#10b981" name="Story Points" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Engineer cards */}
            <div className="space-y-3">
              <SectionTitle
                title="Engineer Details"
                tooltip={TOOLTIPS.engineerCards}
              />
              {data.engineers.map(eng => {
                const isExpanded = expandedEngineer === eng.accountId;
                return (
                  <div key={eng.accountId} className="glass-card overflow-hidden">
                    <div className="flex items-center">
                      <button
                        onClick={() => setExpandedEngineer(isExpanded ? null : eng.accountId)}
                        className="flex-1 flex items-center gap-4 p-4 hover:bg-slate-700/30 transition-colors text-left"
                      >
                        <span className="text-slate-400">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                        <span className="text-sm font-semibold text-slate-200 w-36 truncate">{eng.displayName}</span>
                        <MetricPill label="Cycle p50" value={fmtHours(eng.cycleTimeP50)} colorClass={compareToAvg(eng.cycleTimeP50, data.teamAverages.cycleTimeP50, true)} />
                        <MetricPill label="Rework" value={fmtPct(eng.reworkRate)} colorClass={compareToAvg(eng.reworkRate, data.teamAverages.reworkRate, true)} />
                        <MetricPill label="Bug Ratio" value={fmtPct(eng.bugRatio)} colorClass={compareToAvg(eng.bugRatio, data.teamAverages.bugRatio, true)} />
                        <MetricPill label="SP Acc" value={eng.spAccuracy != null ? `${eng.spAccuracy.toFixed(0)}%` : '—'} colorClass={eng.spAccuracy != null ? (eng.spAccuracy >= 80 && eng.spAccuracy <= 120 ? 'text-emerald-400' : 'text-amber-400') : ''} />
                        <MetricPill label="Pass %" value={`${(eng.firstTimePassRate * 100).toFixed(0)}%`} colorClass={compareToAvg(eng.firstTimePassRate, data.teamAverages.firstTimePassRate, false)} />
                        <MetricPill label="Tickets" value={String(eng.tickets)} colorClass="" />
                        <MetricPill label="SP" value={String(eng.storyPoints)} colorClass="" />
                      </button>
                      {aiConfigured && (
                        <button
                          onClick={() => openEngineerSuggestion(eng)}
                          className="text-violet-400/60 hover:text-violet-400 transition-colors px-3"
                          aria-label={`AI suggestions for ${eng.displayName}`}
                        >
                          <Sparkles size={14} />
                        </button>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-slate-700/30 grid grid-cols-2 md:grid-cols-5 gap-4">
                        <DetailItem label="Cycle Time p50" value={fmtHours(eng.cycleTimeP50)} />
                        <DetailItem label="Cycle Time p85" value={fmtHours(eng.cycleTimeP85)} />
                        <DetailItem label="Rework Rate" value={fmtPct(eng.reworkRate)} />
                        <DetailItem label="Bug Ratio" value={fmtPct(eng.bugRatio)} />
                        <DetailItem label="SP Accuracy" value={eng.spAccuracy != null ? `${eng.spAccuracy.toFixed(0)}%` : '—'} />
                        <DetailItem label="First-Time Pass" value={fmtPct(eng.firstTimePassRate)} />
                        <DetailItem label="Complexity" value={eng.complexityScore != null ? eng.complexityScore.toFixed(1) : '—'} />
                        <DetailItem label="Focus Ratio" value={eng.focusRatio != null ? fmtPct(eng.focusRatio) : '—'} />
                        <DetailItem label="Total Tickets" value={String(eng.tickets)} />
                        <DetailItem label="Total SP" value={String(eng.storyPoints)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
              <Users size={32} className="opacity-20" />
            </div>
            <h3 className="text-slate-300 font-medium mb-1">No tracked engineers configured</h3>
            <p className="text-xs max-w-xs text-center leading-relaxed">
              Individual metrics require a list of engineers to track.
              Configure them in <span className="text-indigo-400 font-medium">Settings</span> to see data here.
            </p>
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

const MetricPill = ({ label, value, colorClass }: { label: string; value: string; colorClass: string }) => (
  <div className="text-center">
    <span className="text-[10px] text-slate-500 block">{label}</span>
    <span className={`text-xs font-semibold ${colorClass || 'text-slate-300'}`}>{value}</span>
  </div>
);

const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
    <p className="text-sm font-medium text-slate-200">{value}</p>
  </div>
);

export default EmIndividualDashboard;
