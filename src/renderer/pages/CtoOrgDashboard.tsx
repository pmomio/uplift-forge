import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, BarChart3, Bug, Wrench, Zap, Users, FolderOpen, Gauge, Layers, BookOpen } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import { getCtoOrgMetrics, syncAllProjects, getAiConfig } from '../api';
import MetricCard, { SectionTitle, ExplainModal } from '../components/MetricCard';
import SuggestionPanel from '../components/SuggestionPanel';
import type { ProjectInfo } from '../App';
import type { CtoOrgMetricsResponse, AiProvider, AiSuggestRequest } from '../../shared/types';

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'half-yearly', label: 'Half Year' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
];

const TOOLTIPS = {
  totalTickets: {
    description: 'Total number of tickets resolved across all configured projects in the selected period.',
    target: 'Track trend over time. Consistent throughput indicates a healthy delivery pipeline.',
    trendUp: 'More tickets resolved — org velocity increasing',
    trendDown: 'Fewer tickets resolved — may indicate blockers or capacity changes',
    derivation: 'Data source: JIRA resolved tickets across all configured projects.\nComputation: Sum of resolved ticket counts from each project.\nFilters: Period filter. Aggregated across all projects.\nConfig dependency: projects[] configuration, done_statuses per project.',
  },
  bugEscapeRate: {
    description: 'Ratio of bugs to non-bug tickets delivered. Measures quality of releases. Lower is better.',
    target: 'Elite: <5%. High-performing: <10%. Above 20% signals systemic quality issues.',
    trendUp: 'Bug escape rate rising — quality gates may need strengthening',
    trendDown: 'Bug escape rate falling — better release quality',
    derivation: 'Data source: JIRA issue_type field across all projects.\nComputation: count(tickets where issue_type = "Bug") ÷ count(tickets where issue_type ≠ "Bug"). Aggregated across all configured projects.\nFilters: Only resolved tickets. Period filter.\nConfig dependency: projects[] configuration.',
  },
  techDebtRatio: {
    description: 'Percentage of total capacity spent on bugs and tech-debt-labeled tickets vs feature work.',
    target: 'Healthy: <20%. 20-35% is manageable. Above 35% means the org is spending too much on maintenance.',
    trendUp: 'More time on tech debt and bugs — less capacity for features',
    trendDown: 'Less time on tech debt — more capacity for product work',
    derivation: 'Data source: JIRA issue_type + labels fields.\nComputation: count(bugs + tickets with tech-debt labels) ÷ total resolved tickets × 100. Aggregated across all projects.\nFilters: Only resolved tickets. Period filter.\nConfig dependency: projects[] configuration. Tech debt detection uses issue_type and labels.',
  },
  flowEfficiency: {
    description: 'Average flow efficiency across all projects — ratio of active work time to total lead time.',
    target: 'Elite: >40%. High-performing: 25-40%. Below 25% means too much wait time in the pipeline.',
    trendUp: 'More active time relative to wait time — better flow',
    trendDown: 'More wait time in the pipeline — investigate bottlenecks',
    derivation: 'Data source: JIRA changelogs via timeline engine, across all projects.\nComputation: Per ticket: active_hours ÷ lead_time_hours × 100. Average and median computed across all resolved tickets from all projects.\nFilters: Only resolved tickets with timeline data. Period filter.\nConfig dependency: active_statuses, blocked_statuses, done_statuses per project.',
  },
  headcount: {
    description: 'Total tickets completed divided by number of tracked engineers. Measures per-person output.',
    target: 'Context-dependent. Track trend — a declining ratio may signal process overhead or growing complexity.',
    trendUp: 'Per-person output increasing — improved efficiency',
    trendDown: 'Per-person output decreasing — may signal process overhead or growing complexity',
    derivation: 'Data source: JIRA resolved tickets + tracked_engineers config.\nComputation: total resolved tickets ÷ count(unique tracked engineers across all projects).\nFilters: Period filter. Aggregated across all projects.\nConfig dependency: tracked_engineers per project.',
  },
  cycleTimeByProject: {
    description: 'p85 cycle time for each project. Identifies which teams are fastest and which need attention.',
    target: 'Compare across projects. Large gaps may indicate process differences or resource imbalances.',
    trendUp: 'Cycle time growing — project slowing down',
    trendDown: 'Cycle time shrinking — project delivering faster',
    derivation: 'Data source: JIRA changelogs per project via timeline engine.\nComputation: Per project: 85th percentile of cycle time hours (first active → done) across resolved tickets. Displayed as horizontal bar chart.\nFilters: Only resolved tickets per project. Period filter.\nConfig dependency: active_statuses, done_statuses per project.',
  },
  throughputByProject: {
    description: 'Weekly ticket completion trend for each project over the last 8 weeks.',
    target: 'Look for consistent or growing throughput. Dips may correlate with holidays, incidents, or planning overhead.',
    trendUp: 'Project throughput increasing — more completions',
    trendDown: 'Project throughput decreasing — investigate capacity or blockers',
    derivation: 'Data source: JIRA resolution dates per project.\nComputation: Per project: resolved tickets bucketed by week. Displayed as multi-line chart over 8 weeks.\nFilters: Period filter. Per project.\nConfig dependency: done_statuses per project, projects[] configuration.',
  },
  weeklyThroughput: {
    description: 'Aggregate weekly throughput across all projects. Shows overall org delivery pace.',
    target: 'Stable week-over-week. Coefficient of variation <30% indicates predictable delivery.',
    trendUp: 'Org-wide throughput rising — more tickets completed per week',
    trendDown: 'Org-wide throughput falling — investigate cross-project causes',
    derivation: 'Data source: JIRA resolution dates across all projects.\nComputation: Sum of resolved tickets per week across all configured projects.\nFilters: Period filter.\nConfig dependency: done_statuses per project, projects[] configuration.',
  },
  deliveryPredictability: {
    description: 'Coefficient of variation of cycle time per project. Lower = more predictable delivery.',
    target: 'Elite: <30%. Good: <50%. >70% = highly unpredictable.',
    trendUp: 'Becoming less predictable',
    trendDown: 'Becoming more predictable',
    derivation: 'Data source: JIRA changelogs per project via timeline engine.\nComputation: Per project: stddev(cycle time hours) ÷ mean(cycle time hours) × 100. Color-coded: <30% green, 30-50% amber, >50% red.\nFilters: Only resolved tickets with cycle time data. Period filter.\nConfig dependency: active_statuses, done_statuses per project.',
  },
  workTypeByProject: {
    description: 'Feature vs Bug vs Task breakdown per project. Shows engineering investment allocation.',
    target: '>60% features. Bug-heavy projects may need quality investment.',
    trendUp: 'More of this type in this project',
    trendDown: 'Less of this type',
    derivation: 'Data source: JIRA issue_type field per project.\nComputation: Per project: group resolved tickets by issue_type. Count and percentage per type. Displayed as stacked horizontal bars.\nFilters: Only resolved tickets. Period filter.\nConfig dependency: projects[] configuration.',
  },
};

// Traffic-light thresholds
function trafficLight(metric: 'bugEscape' | 'techDebt' | 'flowEfficiency', value: number): 'green' | 'amber' | 'red' {
  if (metric === 'bugEscape') return value < 0.10 ? 'green' : value < 0.20 ? 'amber' : 'red';
  if (metric === 'techDebt') return value < 0.20 ? 'green' : value < 0.35 ? 'amber' : 'red';
  if (metric === 'flowEfficiency') return value > 40 ? 'green' : value > 25 ? 'amber' : 'red';
  return 'green';
}

const TRAFFIC_COLORS = {
  green: 'bg-emerald-400',
  amber: 'bg-amber-400 animate-pulse',
  red: 'bg-rose-400 animate-pulse',
};

const TrafficDot: React.FC<{ status: 'green' | 'amber' | 'red' }> = ({ status }) => (
  <span className={`inline-block w-3 h-3 rounded-full ${TRAFFIC_COLORS[status]} flex-shrink-0`} />
);

// Inline explain button for CTO traffic-light cards
const CtoExplainButton: React.FC<{ label: string; derivation?: string; dynamicDerivation?: string }> = ({ label, derivation, dynamicDerivation }) => {
  const [show, setShow] = useState(false);
  const text = dynamicDerivation ?? derivation;
  if (!text) return null;
  return (
    <>
      <button onClick={() => setShow(true)} className="text-slate-500 hover:text-slate-300 transition-colors" aria-label={`Explain: ${label}`}>
        <BookOpen size={13} />
      </button>
      {show && <ExplainModal title={label} derivation={text} onClose={() => setShow(false)} />}
    </>
  );
};

// Project colors for multi-line chart
const PROJECT_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

interface CtoOrgDashboardProps {
  refreshKey: number;
  project?: ProjectInfo | null;
  projectCount?: number;
}

const CtoOrgDashboard: React.FC<CtoOrgDashboardProps> = ({ refreshKey, project, projectCount }) => {
  const [data, setData] = useState<CtoOrgMetricsResponse | null>(null);
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
      const res = await getCtoOrgMetrics(period);
      if (res.data && !('error' in res.data)) {
        setData(res.data as CtoOrgMetricsResponse);
      }
    } catch {
      toast.error('Failed to load org metrics');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

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
      await syncAllProjects();
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
      metricKey: metricLabel.toLowerCase().replace(/\s+/g, '_'),
      metricLabel,
      currentValue: typeof currentValue === 'string' ? parseFloat(currentValue) || null : currentValue,
      previousValue: null,
      trendDirection: null,
      trendPct: null,
      helpContent: helpText ?? '',
      context: 'team',
    });
    setSuggestionOpen(true);
  };

  const fmtHours = (h: number) => h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`;
  const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

  // Build multi-line throughput data for LineChart
  const throughputLineData = data?.throughputByProject && data.throughputByProject.length > 0
    ? (() => {
        const weekMap = new Map<string, Record<string, number>>();
        for (const proj of data.throughputByProject) {
          for (const w of proj.weeks) {
            if (!weekMap.has(w.week)) weekMap.set(w.week, {});
            weekMap.get(w.week)![proj.projectKey] = w.count;
          }
        }
        return Array.from(weekMap.entries()).map(([week, counts]) => ({ week, ...counts }));
      })()
    : [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700/50 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">
            Organizational Health Radar
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-project delivery, quality, and efficiency metrics
            {data && data.totalProjects > 0 && ` across ${data.totalProjects} project${data.totalProjects > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800/50 rounded-lg p-0.5 border border-slate-700/30">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === p.value
                    ? 'bg-violet-500/20 text-violet-300 shadow-sm scale-105'
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
            className="inline-flex items-center gap-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 text-xs font-medium px-3 py-2 rounded-lg border border-violet-500/20 transition-all"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync All Projects'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && !data ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw size={24} className="text-violet-400 animate-spin" />
          </div>
        ) : data && data.totalProjects > 0 ? (
          <div className="space-y-6 max-w-6xl mx-auto">
            {/* Top KPI row with traffic lights */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="animate-fade-in" style={{ animationDelay: '0ms' }}>
                <MetricCard
                  icon={<BarChart3 size={16} />}
                  label="Total Tickets"
                  value={String(data.totalTickets)}
                  color="indigo"
                  subtitle={`${data.totalStoryPoints} SP across ${data.totalProjects} projects`}
                  trend={(() => {
                    const wt = data.weeklyThroughput.filter(w => w.count > 0);
                    return wt.length >= 2
                      ? { change: ((wt[wt.length - 1].count - wt[wt.length - 2].count) / wt[wt.length - 2].count) * 100 }
                      : undefined;
                  })()}
                  tooltip={TOOLTIPS.totalTickets}
                  dynamicDerivation={data.traces?.totalTickets}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Total Tickets', data.totalTickets, TOOLTIPS.totalTickets.description)}
                />
              </div>
              <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
                <div className="glass-card p-4 border bg-rose-500/10 border-rose-500/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Bug size={16} className="text-rose-400" />
                    <span className="text-xs text-slate-400 font-medium flex-1">Bug Escape Rate</span>
                    <CtoExplainButton label="Bug Escape Rate" derivation={TOOLTIPS.bugEscapeRate.derivation} dynamicDerivation={data.traces?.bugEscapeRate} />
                    <TrafficDot status={trafficLight('bugEscape', data.bugEscapeRate)} />
                  </div>
                  <p className="text-xl font-bold text-slate-100">{fmtPct(data.bugEscapeRate)}</p>
                  <span className="text-[10px] text-slate-500">bugs per delivered story</span>
                </div>
              </div>
              <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
                <div className="glass-card p-4 border bg-amber-500/10 border-amber-500/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Wrench size={16} className="text-amber-400" />
                    <span className="text-xs text-slate-400 font-medium flex-1">Tech Debt Ratio</span>
                    <CtoExplainButton label="Tech Debt Ratio" derivation={TOOLTIPS.techDebtRatio.derivation} dynamicDerivation={data.traces?.techDebtRatio} />
                    <TrafficDot status={trafficLight('techDebt', data.techDebtRatio)} />
                  </div>
                  <p className="text-xl font-bold text-slate-100">{fmtPct(data.techDebtRatio)}</p>
                  <span className="text-[10px] text-slate-500">capacity on bugs & tech debt</span>
                </div>
              </div>
              <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
                <div className="glass-card p-4 border bg-emerald-500/10 border-emerald-500/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Zap size={16} className="text-emerald-400" />
                    <span className="text-xs text-slate-400 font-medium flex-1">Flow Efficiency</span>
                    <CtoExplainButton label="Flow Efficiency" derivation={TOOLTIPS.flowEfficiency.derivation} dynamicDerivation={data.traces?.flowEfficiency} />
                    <TrafficDot status={trafficLight('flowEfficiency', data.flowEfficiency.average)} />
                  </div>
                  <p className="text-xl font-bold text-slate-100">{data.flowEfficiency.average.toFixed(1)}%</p>
                  <span className="text-[10px] text-slate-500">avg active / lead time</span>
                </div>
              </div>
            </div>

            {/* Headcount Normalized Throughput */}
            {data.headcountNormalizedThroughput != null && (
              <div className="animate-fade-in" style={{ animationDelay: '400ms' }}>
                <MetricCard
                  icon={<Users size={16} />}
                  label="Headcount-Normalized Throughput"
                  value={data.headcountNormalizedThroughput.toFixed(1)}
                  color="violet"
                  subtitle="tickets per tracked engineer"
                  tooltip={TOOLTIPS.headcount}
                  dynamicDerivation={data.traces?.headcount}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Headcount-Normalized Throughput', data.headcountNormalizedThroughput, TOOLTIPS.headcount.description)}
                  trend={(() => {
                    const wt = data.weeklyThroughput.filter(w => w.count > 0);
                    return wt.length >= 2
                      ? { change: ((wt[wt.length - 1].count - wt[wt.length - 2].count) / wt[wt.length - 2].count) * 100 }
                      : undefined;
                  })()}
                />
              </div>
            )}

            {/* Cycle Time p85 by Project — horizontal bar chart */}
            {data.cycleTimeByProject.length > 0 && (
              <div className="glass-card p-5 animate-fade-in" style={{ animationDelay: '500ms' }}>
                <SectionTitle
                  title="Cycle Time p85 by Project"
                  tooltip={TOOLTIPS.cycleTimeByProject}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion(
                    'Cycle Time p85 by Project',
                    data.cycleTimeByProject.map(p => `${p.projectKey}: ${fmtHours(p.p85)}`).join(', '),
                    TOOLTIPS.cycleTimeByProject.description
                  )}
                />
                <ResponsiveContainer width="100%" height={Math.max(150, data.cycleTimeByProject.length * 50)}>
                  <BarChart data={data.cycleTimeByProject} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => fmtHours(v)} />
                    <YAxis dataKey="projectKey" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={80} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#cbd5e1' }}
                      formatter={(value: number) => [fmtHours(value), 'p85 Cycle Time']}
                    />
                    <Bar dataKey="p85" fill="#8b5cf6" name="p85" radius={[0, 4, 4, 0]} animationDuration={800} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Throughput Trend by Project — multi-line chart */}
            {throughputLineData.length > 0 && (
              <div className="glass-card p-5 animate-fade-in" style={{ animationDelay: '600ms' }}>
                <SectionTitle
                  title="Throughput Trend by Project"
                  tooltip={TOOLTIPS.throughputByProject}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion(
                    'Throughput Trend by Project',
                    data.throughputByProject.map(p => `${p.projectKey}: ${p.weeks.reduce((s, w) => s + w.count, 0)} total`).join(', '),
                    TOOLTIPS.throughputByProject.description
                  )}
                />
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={throughputLineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#cbd5e1' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {data.throughputByProject.map((proj, i) => (
                      <Line
                        key={proj.projectKey}
                        type="monotone"
                        dataKey={proj.projectKey}
                        stroke={PROJECT_COLORS[i % PROJECT_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name={proj.projectName}
                        animationDuration={1000}
                        animationBegin={i * 200}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Weekly Throughput (aggregate) */}
            {data.weeklyThroughput.length > 0 && (
              <div className="glass-card p-5 animate-fade-in" style={{ animationDelay: '700ms' }}>
                <SectionTitle
                  title="Weekly Throughput (All Projects)"
                  tooltip={TOOLTIPS.weeklyThroughput}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion(
                    'Weekly Throughput',
                    data.weeklyThroughput.map(w => `${w.week}: ${w.count}`).join(', '),
                    TOOLTIPS.weeklyThroughput.description
                  )}
                />
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.weeklyThroughput}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#cbd5e1' }} />
                    <Bar dataKey="count" fill="#8b5cf6" name="Completed" radius={[4, 4, 0, 0]} animationDuration={600} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Delivery Predictability by Project */}
            {data.deliveryPredictability.length > 0 && (
              <div className="glass-card p-5 animate-fade-in" style={{ animationDelay: '800ms' }}>
                <SectionTitle
                  title="Delivery Predictability by Project"
                  icon={<Gauge size={16} className="text-violet-400" />}
                  tooltip={TOOLTIPS.deliveryPredictability}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion(
                    'Delivery Predictability',
                    data.deliveryPredictability.map(p => `${p.projectKey}: CoV ${p.coefficientOfVariation.toFixed(0)}%`).join(', '),
                    TOOLTIPS.deliveryPredictability.description
                  )}
                />
                <ResponsiveContainer width="100%" height={Math.max(120, data.deliveryPredictability.length * 50)}>
                  <BarChart data={data.deliveryPredictability} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                    <YAxis dataKey="projectKey" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={80} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#cbd5e1' }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'CoV']}
                    />
                    <Bar dataKey="coefficientOfVariation" name="Coefficient of Variation" radius={[0, 4, 4, 0]} animationDuration={800}>
                      {data.deliveryPredictability.map((entry, i) => (
                        <Cell key={i} fill={entry.coefficientOfVariation < 30 ? '#10b981' : entry.coefficientOfVariation < 50 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />&lt;30% Predictable</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />30-50% Variable</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />&gt;50% Unpredictable</span>
                </div>
              </div>
            )}

            {/* Work Type Distribution by Project */}
            {data.workTypeByProject.length > 0 && (
              <div className="glass-card p-5 animate-fade-in" style={{ animationDelay: '900ms' }}>
                <SectionTitle
                  title="Work Type by Project"
                  icon={<Layers size={16} className="text-violet-400" />}
                  tooltip={TOOLTIPS.workTypeByProject}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion(
                    'Work Type by Project',
                    data.workTypeByProject.map(p => `${p.projectKey}: ${p.types.map(t => `${t.type}(${t.count})`).join(', ')}`).join('; '),
                    TOOLTIPS.workTypeByProject.description
                  )}
                />
                <div className="space-y-4">
                  {data.workTypeByProject.map(proj => {
                    const total = proj.types.reduce((s, t) => s + t.count, 0);
                    return (
                      <div key={proj.projectKey}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-slate-300">{proj.projectName}</span>
                          <span className="text-[10px] text-slate-500">{total} tickets</span>
                        </div>
                        <div className="flex h-5 rounded-md overflow-hidden">
                          {proj.types.map((t, i) => {
                            const pct = total > 0 ? (t.count / total) * 100 : 0;
                            return (
                              <div
                                key={t.type}
                                className="h-full transition-all relative group/bar"
                                style={{ width: `${pct}%`, backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length], minWidth: pct > 0 ? 4 : 0 }}
                                title={`${t.type}: ${t.count} (${pct.toFixed(0)}%)`}
                              />
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                          {proj.types.map((t, i) => (
                            <span key={t.type} className="text-[10px] text-slate-400 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length] }} />
                              {t.type}: {t.count}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-64 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center mb-4">
              <FolderOpen size={28} className="text-slate-500" />
            </div>
            <p className="text-sm text-slate-400 font-medium">No projects configured yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">
              Add projects in Settings to see your organizational health radar.
            </p>
          </div>
        )}
      </div>

      {/* AI Suggestion Panel */}
      <SuggestionPanel
        open={suggestionOpen}
        onClose={() => setSuggestionOpen(false)}
        request={suggestionRequest}
        aiProvider={aiProvider}
      />
    </div>
  );
};

export default CtoOrgDashboard;
