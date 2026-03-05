import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, Clock, Users, Bug, RotateCcw, CheckCircle2, Target, ClipboardList, Layers, Timer } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import { getEmTeamMetrics, triggerSync, syncAllProjects, getAiConfig } from '../api';
import MetricCard, { SectionTitle } from '../components/MetricCard';
import SuggestionPanel from '../components/SuggestionPanel';
import type { ProjectInfo } from '../App';
import type { EmTeamMetricsResponse, AiProvider, AiSuggestRequest } from '../../shared/types';

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'half-yearly', label: 'Half Year' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
];

const SEVERITY_COLORS = {
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-400', badge: 'bg-amber-500/20 border-amber-500/30' },
  critical: { bg: 'bg-orange-500/10', text: 'text-orange-400', badge: 'bg-orange-500/20 border-orange-500/30' },
  escalation: { bg: 'bg-rose-500/10', text: 'text-rose-400', badge: 'bg-rose-500/20 border-rose-500/30' },
};

// Tooltip content: What the metric is + target for high-performing teams
const TOOLTIPS = {
  totalTickets: {
    description: 'Number of tickets resolved by tracked engineers in the selected time period.',
    target: 'High-performing teams: 5-10 tickets per engineer per sprint. Track trend over time.',
    trendUp: 'More tickets completed — team velocity increasing',
    trendDown: 'Fewer tickets completed — may indicate blockers or capacity change',
    derivation: 'Data source: JIRA tickets with a resolution date falling within the selected period.\nComputation: Count of resolved tickets. When tracked_engineers is configured, only tickets assigned to those engineers are counted.\nFilters: Period filter (daily/weekly/bi-weekly/monthly/quarterly/half-yearly/all). Project filter (single project or aggregated across all).\nConfig dependency: tracked_engineers list, done_statuses.',
  },
  cycleTimeP50: {
    description: 'Median time from first active status to done (calendar time). Lower is better.',
    target: 'Elite: <2 days. High-performing: <5 days. Average: 5-10 days.',
    trendUp: 'Cycle time increasing — tickets taking longer to complete',
    trendDown: 'Cycle time decreasing — faster delivery',
    derivation: 'Data source: JIRA changelogs — status transition history for each ticket.\nComputation: Timeline engine extracts the first transition into an active-category status and the first transition into a done-category status. Cycle time = done timestamp − first active timestamp (calendar hours). The 50th percentile (median) is taken across all resolved tickets.\nFilters: Only resolved tickets with both an active and done transition. Scoped to tracked engineers when configured.\nConfig dependency: active_statuses, done_statuses.',
  },
  reworkRate: {
    description: 'Percentage of tickets with backward status transitions (e.g., Code Review back to In Progress). Lower is better.',
    target: 'Elite: <5%. High-performing: <15%. Above 25% signals process issues.',
    trendUp: 'More rework — quality or requirements clarity may be declining',
    trendDown: 'Less rework — better first-pass quality',
    derivation: 'Data source: JIRA changelogs — status transition history.\nComputation: A ticket has rework if any status transition moves backward in the configured status order (e.g., Code Review → In Progress). Rework rate = count(tickets with backward transitions) ÷ total resolved tickets.\nFilters: Only resolved tickets in the selected period. Scoped to tracked engineers.\nConfig dependency: The status order is inferred from active_statuses and done_statuses configuration.',
  },
  totalSP: {
    description: 'Total story points delivered by tracked engineers in the selected period.',
    target: 'Team-specific. Track trend over time; consistency matters more than absolute value.',
    trendUp: 'More story points delivered — increased capacity or velocity',
    trendDown: 'Fewer story points — may indicate smaller tickets or reduced capacity',
    derivation: 'Data source: JIRA story_points field from each ticket.\nComputation: Sum of story_points across all resolved tickets in the period.\nFilters: Period and project filters. Scoped to tracked engineers.\nConfig dependency: field_ids.story_points (JIRA custom field ID).',
  },
  cycleTimeTrend: {
    description: 'Weekly p50 and p85 cycle time over the last 4 weeks. Shows if the team is speeding up or slowing down.',
    target: 'Look for a downward trend. Stable or decreasing p85 indicates predictability.',
    trendUp: 'Rising cycle times — investigate bottlenecks or process changes',
    trendDown: 'Falling cycle times — team is getting faster',
    derivation: 'Data source: JIRA changelogs — same cycle time computation as Cycle Time p50.\nComputation: Resolved tickets are bucketed by their resolution week. For each week, p50 and p85 percentiles of cycle time hours are calculated. Last 4 weeks are shown.\nFilters: Only weeks with at least 1 resolved ticket. Scoped to tracked engineers.\nConfig dependency: active_statuses, done_statuses.',
  },
  throughputByStream: {
    description: 'Number of tickets completed per work stream. Shows where effort is distributed.',
    target: 'Balanced distribution across streams. Product work should be >60% of total effort.',
    trendUp: 'More tickets in this stream — effort shifting here',
    trendDown: 'Fewer tickets in this stream — effort shifting away',
    derivation: 'Data source: JIRA work_stream mapped field on each ticket.\nComputation: Group resolved tickets by their work_stream value (determined by mapping rules). Count tickets and sum SP per group.\nFilters: Period and project filters. Scoped to tracked engineers. Tickets without a work_stream are grouped as "Unmapped".\nConfig dependency: mapping_rules (rule-based field mapping), field_ids.',
  },
  weeklyThroughput: {
    description: 'Number of tickets completed per week. Shows delivery consistency.',
    target: 'Stable week-over-week. High-performing teams have coefficient of variation <30%.',
    trendUp: 'Throughput increasing — more tickets completed per week',
    trendDown: 'Throughput decreasing — fewer completions per week',
    derivation: 'Data source: JIRA resolution dates.\nComputation: Resolved tickets bucketed by ISO week of resolution date. Count per week over the last 8 weeks.\nFilters: Period and project filters. Scoped to tracked engineers.\nConfig dependency: done_statuses.',
  },
  contributionSpread: {
    description: 'Story points per tracked engineer normalized against team average. Shows work distribution.',
    target: 'Even spread (all bars similar length). Large gaps may indicate bottlenecks or unbalanced load.',
    trendUp: 'Engineer output increasing relative to team',
    trendDown: 'Engineer output decreasing relative to team',
    derivation: 'Data source: JIRA assignee + story_points fields.\nComputation: For each tracked engineer, sum their story points. Normalized score = engineer SP ÷ team average SP. A score of 1.0 means exactly average.\nFilters: Period and project filters. Only tracked engineers.\nConfig dependency: tracked_engineers, field_ids.story_points.',
  },
  bugRatio: {
    description: 'Percentage of each tracked engineer\'s tickets that are bugs. Higher means more time on fixes.',
    target: 'Team average <15%. If one person is >30%, they may be stuck in firefighting mode.',
    trendUp: 'More bugs — quality may be declining or more bugs being reported',
    trendDown: 'Fewer bugs — better code quality or fewer incoming defects',
    derivation: 'Data source: JIRA issue_type field per ticket.\nComputation: Per engineer: count(tickets where issue_type = "Bug") ÷ total tickets for that engineer.\nFilters: Period and project filters. Only tracked engineers.\nConfig dependency: tracked_engineers. Bug detection uses the JIRA issue_type field.',
  },
  agingWip: {
    description: 'Tickets stuck in active statuses beyond configured thresholds. Signals delivery risk.',
    target: 'Zero escalation-tier tickets. Fewer than 3 critical-tier. Address warning-tier within the week.',
    trendUp: 'More tickets aging — growing delivery risk',
    trendDown: 'Fewer tickets aging — better flow through the pipeline',
    derivation: 'Data source: JIRA changelogs — current status and time since last status change.\nComputation: Timeline engine calculates daysInCurrentStatus for each open ticket. Tickets are tiered: warning (>5 days), critical (>10 days), escalation (>15 days).\nFilters: Only tickets currently in active statuses (not done, not backlog). Scoped to tracked engineers.\nConfig dependency: active_statuses, done_statuses, tracked_engineers.',
  },
  spAccuracy: {
    description: 'Ratio of actual engineering hours to estimated (SP x sp_to_days x 8h). 100% = perfect estimation.',
    target: '80-120% is healthy. <60% = over-estimating. >150% = under-estimating.',
    trendUp: 'Estimates becoming less accurate — team under-estimating more',
    trendDown: 'Estimates improving — actual work converging toward estimates',
    derivation: 'Data source: JIRA story_points + computed engineering hours (from field-engine).\nComputation: Per ticket: accuracy = (actual_eng_hours ÷ (story_points × sp_to_days × 8)) × 100. Team average across all tickets that have both SP and eng hours.\nFilters: Only resolved tickets with story_points > 0 and computed eng hours > 0. Period and project filters.\nConfig dependency: sp_to_days, eng_start_status, eng_end_status, office_hours, field_ids.story_points.',
  },
  firstTimePassRate: {
    description: 'Percentage of tickets completed without any backward status transitions.',
    target: 'Elite: >95%. Good: >85%. Below 75% signals review/QA issues.',
    trendUp: 'More tickets passing first time — quality improving',
    trendDown: 'More rework happening — investigate review or requirements quality',
    derivation: 'Data source: JIRA changelogs — status transition history.\nComputation: 1 − reworkRate. A ticket "passes first time" if it has zero backward status transitions.\nFilters: Same as rework rate — only resolved tickets, scoped to tracked engineers.\nConfig dependency: active_statuses, done_statuses (for status order detection).',
  },
  avgReviewDuration: {
    description: 'Average time tickets spend in review statuses (Code Review, In Review, etc.).',
    target: '<4 hours is elite. <1 day is good. >2 days = review bottleneck.',
    trendUp: 'Reviews taking longer — may need more reviewers or smaller PRs',
    trendDown: 'Reviews getting faster — healthier flow',
    derivation: 'Data source: JIRA changelogs — status periods from timeline engine.\nComputation: Timeline engine identifies periods spent in review-matching statuses (e.g., "Code Review", "In Review"). Average total review hours across all resolved tickets.\nFilters: Only resolved tickets with at least one review period. Period and project filters. Scoped to tracked engineers.\nConfig dependency: Statuses matching review are detected from active_statuses containing "review" (case-insensitive).',
  },
  workTypeDistribution: {
    description: 'Breakdown of completed tickets by type (Story, Task, Bug, Sub-task, etc.).',
    target: '>60% product work (stories+tasks). Bug work <20%.',
    trendUp: 'More of this type being completed',
    trendDown: 'Less of this type — effort shifting elsewhere',
    derivation: 'Data source: JIRA issue_type field.\nComputation: Group resolved tickets by issue_type. Count and calculate percentage per type.\nFilters: Period and project filters. Scoped to tracked engineers.\nConfig dependency: tracked_engineers.',
  },
  unestimatedRatio: {
    description: 'Percentage of resolved tickets with no story point estimate.',
    target: '<5%. Unestimated work hides capacity and undermines forecasting.',
    trendUp: 'More unestimated tickets — planning discipline declining',
    trendDown: 'Fewer unestimated tickets — better planning hygiene',
    derivation: 'Data source: JIRA story_points field.\nComputation: count(resolved tickets where story_points is null or 0) ÷ total resolved tickets.\nFilters: Period and project filters. Scoped to tracked engineers.\nConfig dependency: field_ids.story_points.',
  },
  leadTimeBreakdown: {
    description: 'Average time split: active work vs waiting vs blocked. Shows where lead time is spent.',
    target: 'Active >50%. Wait <30%. Blocked <10%.',
    trendUp: 'More time in this category',
    trendDown: 'Less time in this category',
    derivation: 'Data source: JIRA changelogs — status periods from timeline engine.\nComputation: Each status period is categorized as active, wait, or blocked based on config. Per ticket, total hours in each category as a percentage of lead time. Averaged across all resolved tickets.\nFilters: Only resolved tickets with timeline data. Period and project filters.\nConfig dependency: active_statuses, blocked_statuses, done_statuses.',
  },
};

interface EmTeamDashboardProps {
  refreshKey: number;
  project?: ProjectInfo | null;
  projectCount?: number;
}

const EmTeamDashboard: React.FC<EmTeamDashboardProps> = ({ refreshKey, project, projectCount }) => {
  const isMultiProject = (projectCount ?? 1) > 1;
  const [metrics, setMetrics] = useState<EmTeamMetricsResponse | null>(null);
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
      const res = await getEmTeamMetrics(period);
      if (res.data && !('error' in res.data)) {
        setMetrics(res.data as EmTeamMetricsResponse);
      }
    } catch {
      toast.error('Failed to load team metrics');
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
      context: `EM Team Dashboard. Period: ${period}. Total tickets: ${metrics?.totalTickets ?? 0}, Total SP: ${metrics?.totalStoryPoints ?? 0}, Rework rate: ${metrics ? (metrics.reworkRate * 100).toFixed(1) : 0}%.`,
    });
    setSuggestionOpen(true);
  };

  const fmtHours = (h: number) => h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700/50 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">
            {isMultiProject ? 'All Projects — Team Dashboard' : project?.name ? `${project.name} — Team Dashboard` : 'Team Dashboard'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Cycle time, throughput, contribution spread, and team health</p>
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
        {loading && !metrics ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw size={24} className="text-indigo-400 animate-spin" />
          </div>
        ) : metrics ? (
          <div className="space-y-6 max-w-6xl mx-auto">
            {/* Top KPI row */}
            {(() => {
              // Compute trends from available weekly data
              const wt = metrics.weeklyThroughput.filter(w => w.count > 0);
              const ticketTrend = wt.length >= 2
                ? { change: ((wt[wt.length - 1].count - wt[wt.length - 2].count) / wt[wt.length - 2].count) * 100 }
                : undefined;

              const ct = metrics.cycleTime.trend.filter(t => t.p50 > 0);
              const cycleTrend = ct.length >= 2
                ? { change: ((ct[ct.length - 1].p50 - ct[ct.length - 2].p50) / ct[ct.length - 2].p50) * 100, lowerIsBetter: true }
                : undefined;

              return (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <MetricCard
                    icon={<Users size={16} />}
                    label="Total Tickets"
                    value={String(metrics.totalTickets)}
                    color="indigo"
                    trend={ticketTrend}
                    tooltip={TOOLTIPS.totalTickets}
                    dynamicDerivation={metrics.traces?.totalTickets}
                    aiConfigured={aiConfigured}
                    onAiSuggest={() => openSuggestion('Total Tickets', metrics.totalTickets, TOOLTIPS.totalTickets.description)}
                  />
                  <MetricCard
                    icon={<Clock size={16} />}
                    label="Cycle Time p50"
                    value={metrics.cycleTime.p50 > 0 ? fmtHours(metrics.cycleTime.p50) : '—'}
                    color="cyan"
                    trend={cycleTrend}
                    tooltip={TOOLTIPS.cycleTimeP50}
                    dynamicDerivation={metrics.traces?.cycleTimeP50}
                    aiConfigured={aiConfigured}
                    onAiSuggest={() => openSuggestion('Cycle Time p50', metrics.cycleTime.p50 > 0 ? `${fmtHours(metrics.cycleTime.p50)}` : null, TOOLTIPS.cycleTimeP50.description)}
                  />
                  <MetricCard
                    icon={<RotateCcw size={16} />}
                    label="Rework Rate"
                    value={`${(metrics.reworkRate * 100).toFixed(1)}%`}
                    color="amber"
                    tooltip={TOOLTIPS.reworkRate}
                    dynamicDerivation={metrics.traces?.reworkRate}
                    aiConfigured={aiConfigured}
                    onAiSuggest={() => openSuggestion('Rework Rate', `${(metrics.reworkRate * 100).toFixed(1)}%`, TOOLTIPS.reworkRate.description)}
                  />
                  <MetricCard
                    icon={<CheckCircle2 size={16} />}
                    label="First-Time Pass Rate"
                    value={`${(metrics.firstTimePassRate * 100).toFixed(1)}%`}
                    color="emerald"
                    tooltip={TOOLTIPS.firstTimePassRate}
                    dynamicDerivation={metrics.traces?.reworkRate}
                    aiConfigured={aiConfigured}
                    onAiSuggest={() => openSuggestion('First-Time Pass Rate', `${(metrics.firstTimePassRate * 100).toFixed(1)}%`, TOOLTIPS.firstTimePassRate.description)}
                  />
                  <MetricCard
                    icon={<Target size={16} />}
                    label="SP Accuracy"
                    value={metrics.spAccuracy != null ? `${metrics.spAccuracy.toFixed(0)}%` : 'N/A'}
                    color="violet"
                    subtitle={metrics.unestimatedRatio > 0 ? `${(metrics.unestimatedRatio * 100).toFixed(0)}% unestimated` : undefined}
                    tooltip={TOOLTIPS.spAccuracy}
                    dynamicDerivation={metrics.traces?.spAccuracy}
                    aiConfigured={aiConfigured}
                    onAiSuggest={() => openSuggestion('SP Estimation Accuracy', metrics.spAccuracy != null ? `${metrics.spAccuracy.toFixed(0)}%` : null, TOOLTIPS.spAccuracy.description)}
                  />
                  <MetricCard
                    icon={<Timer size={16} />}
                    label="Avg Review Duration"
                    value={metrics.avgReviewDurationHours != null ? fmtHours(metrics.avgReviewDurationHours) : 'N/A'}
                    color="rose"
                    tooltip={TOOLTIPS.avgReviewDuration}
                    dynamicDerivation={metrics.traces?.avgReviewDuration}
                    aiConfigured={aiConfigured}
                    onAiSuggest={() => openSuggestion('Avg Code Review Duration', metrics.avgReviewDurationHours != null ? fmtHours(metrics.avgReviewDurationHours) : null, TOOLTIPS.avgReviewDuration.description)}
                  />
                </div>
              );
            })()}

            {/* Cycle time trend */}
            {metrics.cycleTime.trend.length > 0 && (
              <div className="glass-card p-5">
                <SectionTitle
                  title="Cycle Time Trend (4 weeks)"
                  tooltip={TOOLTIPS.cycleTimeTrend}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Cycle Time Trend', `p50: ${fmtHours(metrics.cycleTime.p50)}, p85: ${fmtHours(metrics.cycleTime.p85)}`, TOOLTIPS.cycleTimeTrend.description)}
                />
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={metrics.cycleTime.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#cbd5e1' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="p50" stroke="#06b6d4" name="p50" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="p85" stroke="#8b5cf6" name="p85" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Throughput by work stream + weekly throughput */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {metrics.throughputByWorkStream.length > 0 && (
                <div className="glass-card p-5">
                  <SectionTitle
                    title="Throughput by Work Stream"
                    tooltip={TOOLTIPS.throughputByStream}
                    aiConfigured={aiConfigured}
                    onAiSuggest={() => openSuggestion('Throughput by Work Stream', metrics.throughputByWorkStream.map(w => `${w.workStream}: ${w.count}`).join(', '), TOOLTIPS.throughputByStream.description)}
                  />
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={metrics.throughputByWorkStream} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis dataKey="workStream" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={100} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#cbd5e1' }} />
                      <Bar dataKey="count" fill="#6366f1" name="Tickets" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {metrics.weeklyThroughput.length > 0 && (
                <div className="glass-card p-5">
                  <SectionTitle
                    title="Weekly Throughput"
                    tooltip={TOOLTIPS.weeklyThroughput}
                    aiConfigured={aiConfigured}
                    onAiSuggest={() => openSuggestion('Weekly Throughput', metrics.weeklyThroughput.map(w => `${w.week}: ${w.count}`).join(', '), TOOLTIPS.weeklyThroughput.description)}
                  />
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={metrics.weeklyThroughput}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#cbd5e1' }} />
                      <Bar dataKey="count" fill="#10b981" name="Completed" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Contribution spread */}
            {metrics.contributionSpread.length > 0 && (
              <div className="glass-card p-5">
                <SectionTitle
                  title="Contribution Spread"
                  tooltip={TOOLTIPS.contributionSpread}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Contribution Spread', metrics.contributionSpread.map(c => `${c.displayName}: ${c.storyPoints} SP`).join(', '), TOOLTIPS.contributionSpread.description)}
                />
                <div className="space-y-2">
                  {metrics.contributionSpread.map(c => (
                    <div key={c.accountId} className="flex items-center gap-3">
                      <span className="text-xs text-slate-300 w-28 truncate">{c.displayName}</span>
                      <div className="flex-1 bg-slate-800/50 rounded-full h-5 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all"
                          style={{ width: `${Math.min(c.normalizedScore * 100, 200) / 2}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 w-16 text-right">{c.storyPoints} SP</span>
                      <span className="text-xs text-slate-500 w-16 text-right">{c.tickets} tix</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bug ratio by engineer */}
            {metrics.bugRatioByEngineer.length > 0 && (
              <div className="glass-card p-5">
                <SectionTitle
                  title="Bug Ratio by Engineer"
                  tooltip={TOOLTIPS.bugRatio}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Bug Ratio by Engineer', metrics.bugRatioByEngineer.map(b => `${b.displayName}: ${(b.bugRatio * 100).toFixed(0)}%`).join(', '), TOOLTIPS.bugRatio.description)}
                />
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={metrics.bugRatioByEngineer} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" domain={[0, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis dataKey="displayName" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={100} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#cbd5e1' }} formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                    <Bar dataKey="bugRatio" fill="#ef4444" name="Bug Ratio" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Work Type Distribution + Lead Time Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {metrics.workTypeDistribution.length > 0 && (
                <div className="glass-card p-5">
                  <SectionTitle
                    title="Work Type Distribution"
                    tooltip={TOOLTIPS.workTypeDistribution}
                    aiConfigured={aiConfigured}
                    onAiSuggest={() => openSuggestion('Work Type Distribution', metrics.workTypeDistribution.map(w => `${w.type}: ${w.count} (${w.percentage.toFixed(0)}%)`).join(', '), TOOLTIPS.workTypeDistribution.description)}
                  />
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={metrics.workTypeDistribution} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis dataKey="type" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={80} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#cbd5e1' }} formatter={(v: number) => [v, 'Tickets']} />
                      <Bar dataKey="count" fill="#8b5cf6" name="Tickets" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {metrics.leadTimeBreakdown && (
                <div className="glass-card p-5">
                  <SectionTitle
                    title="Lead Time Breakdown"
                    tooltip={TOOLTIPS.leadTimeBreakdown}
                    aiConfigured={aiConfigured}
                    onAiSuggest={() => openSuggestion('Lead Time Breakdown', `Active: ${metrics.leadTimeBreakdown!.activePercent.toFixed(0)}%, Wait: ${metrics.leadTimeBreakdown!.waitPercent.toFixed(0)}%, Blocked: ${metrics.leadTimeBreakdown!.blockedPercent.toFixed(0)}%`, TOOLTIPS.leadTimeBreakdown.description)}
                  />
                  <div className="space-y-3 mt-4">
                    {[
                      { label: 'Active Work', pct: metrics.leadTimeBreakdown.activePercent, color: 'bg-emerald-500' },
                      { label: 'Waiting', pct: metrics.leadTimeBreakdown.waitPercent, color: 'bg-amber-500' },
                      { label: 'Blocked', pct: metrics.leadTimeBreakdown.blockedPercent, color: 'bg-rose-500' },
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
            </div>

            {/* Aging WIP */}
            {metrics.agingWip.length > 0 && (
              <div className="glass-card p-5">
                <SectionTitle
                  title={`Aging WIP (${metrics.agingWip.length} tickets)`}
                  icon={<AlertTriangle size={16} className="text-amber-400" />}
                  tooltip={TOOLTIPS.agingWip}
                  aiConfigured={aiConfigured}
                  onAiSuggest={() => openSuggestion('Aging WIP', `${metrics.agingWip.length} tickets aging`, TOOLTIPS.agingWip.description)}
                />
                <div className="space-y-2">
                  {metrics.agingWip.slice(0, 10).map(item => {
                    const colors = SEVERITY_COLORS[item.severity];
                    return (
                      <div key={item.key} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${colors.bg}`}>
                        <span className={`text-xs font-mono font-semibold ${colors.text}`}>{item.key}</span>
                        <span className="text-xs text-slate-300 flex-1 truncate">{item.summary}</span>
                        <span className="text-xs text-slate-400">{item.assignee}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded border ${colors.badge}`}>
                          {item.daysInStatus}d in {item.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <Users size={32} className="mb-2 opacity-50" />
            <p className="text-sm">No data yet. Sync your project to see team metrics.</p>
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

export default EmTeamDashboard;
