import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, Clock, Users, Bug, RotateCcw, CheckCircle2, Target, ClipboardList, Layers, Timer } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, Legend, PieChart, Pie, Cell
} from 'recharts';
import toast from 'react-hot-toast';
import { getEmTeamMetrics, getAiConfig, getAiSuggestions, syncAllProjects, triggerSync } from '../api';
import type { EmTeamMetricsResponse, AiProvider, ProjectInfo } from '../../shared/types';
import MetricCard, { SectionTitle } from '../components/MetricCard';
import SuggestionPanel from '../components/SuggestionPanel';
import type { Persona } from '../../shared/types';

interface EmTeamDashboardProps {
  refreshKey: number;
  project?: ProjectInfo | null;
  projectCount?: number;
}

const TOOLTIPS: Record<string, { description: string; target: string; trendUp: string; derivation: string }> = {
  totalTickets: {
    description: 'Total number of tickets resolved within the selected period.',
    target: 'Volume KPI. Target varies by team size and sprint capacity.',
    trendUp: 'Higher output volume',
    derivation: 'Data source: JIRA resolved tickets.\nComputation: Count of all tickets where status matches one of the "Done Statuses" in Settings.\nFilters: Period and project filters. Scoped to tracked engineers.',
  },
  cycleTimeP50: {
    description: 'Median time from first activity to resolution (calendar hours).',
    target: 'Elite: <48h. Strong: <96h. High cycle time suggests bottlenecks.',
    trendUp: 'Work taking longer to complete (Negative)',
    derivation: 'Data source: JIRA changelogs.\nComputation: For each resolved ticket, time from first transition to an "Active Status" until the first transition to a "Done Status". Median (p50) value calculated.\nFilters: Only resolved tickets. Period and project filters.',
  },
  reworkRate: {
    description: 'Percentage of tickets that moved backward in the workflow (e.g. QA to In Progress).',
    target: 'Elite: <5%. Target: <15%. High rework indicates poor requirements or quality issues.',
    trendUp: 'More churn/rework (Negative)',
    derivation: 'Data source: JIRA changelogs.\nComputation: (Count of tickets with at least one backward status transition ÷ Total resolved tickets) × 100.\nFilters: Only resolved tickets. Period and project filters.',
  },
  spAccuracy: {
    description: 'Ratio of actual active hours to estimated hours (SP × sp_to_days × 8h).',
    target: 'Healthy range: 80%–120%. Over 100% means under-estimation; under means over-estimation.',
    trendUp: 'Accuracy increasing (Positive)',
    derivation: 'Data source: JIRA story_points + computed active time (from history).\nComputation: Per ticket: accuracy = (active_time_hours ÷ (story_points × sp_to_days × 8)) × 100. Team average across all tickets that have both SP and active time.\nFilters: Only resolved tickets with story_points > 0 and computed active time > 0. Period and project filters.\nConfig dependency: sp_to_days, active_statuses, field_ids.story_points.',
  },
  avgReviewDuration: {
    description: 'Average time tickets spend in "Review" or "PR" statuses.',
    target: 'Elite: <4h. Target: <24h. Long review times block delivery flow.',
    trendUp: 'Reviews taking longer (Negative)',
    derivation: 'Data source: JIRA changelogs.\nComputation: Sum of duration in all statuses containing "Review" (case-insensitive) for resolved tickets, divided by ticket count.\nFilters: Only resolved tickets. Period and project filters.',
  },
  unestimatedRatio: {
    description: 'Percentage of resolved tickets that have no Story Point estimate.',
    target: 'Target: <10%. High ratio makes capacity planning and accuracy metrics unreliable.',
    trendUp: 'More unestimated work (Negative)',
    derivation: 'Data source: JIRA story_points field.\nComputation: (Count of resolved tickets where story_points is 0 or null ÷ Total resolved tickets) × 100.\nFilters: Only resolved tickets. Period and project filters.',
  },
};

const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee'];

const EmTeamDashboard: React.FC<EmTeamDashboardProps> = ({ refreshKey, project, projectCount }) => {
  const [data, setData] = useState<EmTeamMetricsResponse | null>(null);
  const [period, setPeriod] = useState('4w');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiProvider, setAiProvider] = useState<AiProvider>('openai');
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionRequest, setSuggestionRequest] = useState<any>(null);

  const isMultiProject = projectCount && projectCount > 1;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEmTeamMetrics(period);
      setData(res.data);
    } catch (err) {
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
        await triggerSync(project?.key);
      }
      await fetchData();
      toast.success('Synced & refreshed');
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleAiSuggest = (metricKey: string, metricLabel: string, value: number | null, help: typeof TOOLTIPS.totalTickets) => {
    if (!aiConfigured) {
      toast.error('Configure AI API Key in Settings first ✨');
      return;
    }
    
    setSuggestionRequest({
      metricKey,
      metricLabel,
      currentValue: value,
      previousValue: null,
      trendDirection: null,
      trendPct: null,
      helpContent: help.description,
      context: 'team'
    });
    setSuggestionOpen(true);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div data-testid="em-team-dashboard" className="flex flex-col h-full bg-slate-950 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/20 backdrop-blur-sm sticky top-0 z-30">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            {isMultiProject ? 'All Projects — Team Dashboard' : project?.name ? `${project.name} — Team Dashboard` : 'Team Dashboard'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">Engineering performance, quality, and delivery flow</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 shadow-inner">
            {[
              { label: '4W', value: '4w' },
              { label: '12W', value: '12w' },
              { label: 'All', value: 'all' }
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
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
      <div className="p-8 space-y-10 pb-24">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <MetricCard
            title="Total Tickets"
            value={data?.totalTickets ?? 0}
            unit="resolved"
            icon={<ClipboardList size={20} />}
            tooltip={TOOLTIPS.totalTickets}
            dynamicDerivation={data?.traces?.totalTickets}
            aiConfigured={aiConfigured}
            onAiSuggest={() => handleAiSuggest('totalTickets', 'Total Tickets', data?.totalTickets ?? 0, TOOLTIPS.totalTickets)}
          />
          <MetricCard
            title="Cycle Time p50"
            value={(data?.cycleTime.p50 ?? 0).toFixed(2)}
            unit="hours"
            icon={<Clock size={20} />}
            tooltip={TOOLTIPS.cycleTimeP50}
            dynamicDerivation={data?.traces?.cycleTimeP50}
            aiConfigured={aiConfigured}
            onAiSuggest={() => handleAiSuggest('cycleTimeP50', 'Cycle Time p50', data?.cycleTime.p50 ?? 0, TOOLTIPS.cycleTimeP50)}
          />
          <MetricCard
            title="Rework Rate"
            value={(data?.reworkRate ?? 0).toFixed(2)}
            unit="%"
            icon={<RotateCcw size={20} />}
            tooltip={TOOLTIPS.reworkRate}
            dynamicDerivation={data?.traces?.reworkRate}
            aiConfigured={aiConfigured}
            onAiSuggest={() => handleAiSuggest('reworkRate', 'Rework Rate', data?.reworkRate ?? 0, TOOLTIPS.reworkRate)}
          />
          <MetricCard
            title="SP Accuracy"
            value={(data?.spAccuracy ?? 0).toFixed(2)}
            unit="%"
            icon={<Target size={20} />}
            tooltip={TOOLTIPS.spAccuracy}
            dynamicDerivation={data?.traces?.spAccuracy}
            aiConfigured={aiConfigured}
            onAiSuggest={() => handleAiSuggest('spAccuracy', 'SP Accuracy', data?.spAccuracy ?? 0, TOOLTIPS.spAccuracy)}
          />
          <MetricCard
            title="Review Duration"
            value={(data?.avgReviewDurationHours ?? 0).toFixed(2)}
            unit="hours"
            icon={<Timer size={20} />}
            tooltip={TOOLTIPS.avgReviewDuration}
            dynamicDerivation={data?.traces?.avgReviewDuration}
            aiConfigured={aiConfigured}
            onAiSuggest={() => handleAiSuggest('avgReviewDuration', 'Review Duration', data?.avgReviewDurationHours ?? 0, TOOLTIPS.avgReviewDuration)}
          />
          <MetricCard
            title="Unestimated Ratio"
            value={(data?.unestimatedRatio ?? 0).toFixed(2)}
            unit="%"
            icon={<AlertTriangle size={20} />}
            tooltip={TOOLTIPS.unestimatedRatio}
            dynamicDerivation={data?.traces?.unestimatedRatio}
            aiConfigured={aiConfigured}
            onAiSuggest={() => handleAiSuggest('unestimatedRatio', 'Unestimated Ratio', data?.unestimatedRatio ?? 0, TOOLTIPS.unestimatedRatio)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Cycle Time Trend */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 shadow-sm">
            <SectionTitle 
              title="Cycle Time Distribution" 
              tooltip={{ description: 'Weekly median (p50) and p85 cycle time trend.', derivation: TOOLTIPS.cycleTimeP50.derivation }}
              aiConfigured={aiConfigured}
              onAiSuggest={() => handleAiSuggest('cycleTimeDistribution', 'Cycle Time Distribution', `p50: ${data?.cycleTime.p50}h, p85: ${data?.cycleTime.p85}h`, { description: 'Cycle time distribution across the team' })}
            />
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.cycleTime.trend || []}>
                  <defs>
                    <linearGradient id="colorP50" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="week" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} dx={-10} unit="h" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ padding: '2px 0' }}
                    formatter={(v: any) => [typeof v === 'number' ? v.toFixed(2) : v, 'Value']}
                  />
                  <Legend verticalAlign="top" align="right" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                  <Area type="monotone" dataKey="p50" name="p50 (Median)" stroke="#818cf8" strokeWidth={3} fillOpacity={1} fill="url(#colorP50)" />
                  <Line type="monotone" dataKey="p85" name="p85 (Worst Case)" stroke="#fbbf24" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Weekly Throughput */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 shadow-sm">
            <SectionTitle 
              title="Weekly Throughput" 
              tooltip={{ description: 'Number of tickets and Story Points completed per week.', derivation: TOOLTIPS.totalTickets.derivation }}
              aiConfigured={aiConfigured}
              onAiSuggest={() => handleAiSuggest('weeklyThroughput', 'Weekly Throughput', data?.weeklyThroughput.map(t => `${t.week}: ${t.count} tix, ${t.storyPoints} SP`).join('; ') ?? 'No data', { description: 'Weekly throughput trend' })}
            />
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.weeklyThroughput || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="week" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} dx={-10} />
                  <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} dx={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(v: any) => [typeof v === 'number' ? v.toFixed(2) : v, 'Value']}
                  />
                  <Bar yAxisId="left" dataKey="count" name="Tickets" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={30} />
                  <Bar yAxisId="right" dataKey="storyPoints" name="Story Points" fill="#34d399" radius={[4, 4, 0, 0]} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Work Type Distribution */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 shadow-sm">
            <SectionTitle 
              title="Work Type Distribution" 
              aiConfigured={aiConfigured}
              onAiSuggest={() => handleAiSuggest('workTypeDistribution', 'Work Type Distribution', data?.workTypeDistribution.map(w => `${w.type}: ${w.count}`).join('; ') ?? 'No data', { description: 'Types of work being delivered' })}
            />
            <div className="h-[300px] w-full mt-4 flex items-center">
              <div className="flex-1 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    layout="vertical" 
                    data={data?.workTypeDistribution || []}
                    margin={{ left: 40, right: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="type" 
                      type="category" 
                      stroke="#94a3b8" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      width={80}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(v: any) => [typeof v === 'number' ? v.toFixed(2) : v, 'Value']}
                    />
                    <Bar dataKey="count" name="Tickets" fill="#818cf8" radius={[0, 4, 4, 0]} barSize={20} label={{ position: 'right', fill: '#94a3b8', fontSize: 10 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Lead Time Breakdown */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 shadow-sm">
            <SectionTitle 
              title="Lead Time Breakdown" 
              tooltip={{ description: 'How much time is spent actively working vs waiting vs blocked.' }} 
              aiConfigured={aiConfigured}
              onAiSuggest={() => handleAiSuggest('leadTimeBreakdown', 'Lead Time Breakdown', `Active: ${data?.leadTimeBreakdown.activePercent}%, Wait: ${data?.leadTimeBreakdown.waitPercent}%, Blocked: ${data?.leadTimeBreakdown.blockedPercent}%`, { description: 'Lead time efficiency breakdown' })}
            />
            <div className="h-[300px] w-full mt-4 flex flex-col justify-center px-10">
              {data?.leadTimeBreakdown ? (
                <div className="space-y-8">
                  <div className="flex h-12 w-full rounded-full overflow-hidden shadow-inner border border-slate-700/50">
                    <div 
                      className="bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-emerald-950"
                      style={{ width: `${data.leadTimeBreakdown.activePercent}%` }}
                      title={`Active: ${data.leadTimeBreakdown.activePercent.toFixed(2)}%`}
                    >
                      {data.leadTimeBreakdown.activePercent > 10 && `${data.leadTimeBreakdown.activePercent.toFixed(2)}%`}
                    </div>
                    <div 
                      className="bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-indigo-950"
                      style={{ width: `${data.leadTimeBreakdown.waitPercent}%` }}
                      title={`Waiting: ${data.leadTimeBreakdown.waitPercent.toFixed(2)}%`}
                    >
                      {data.leadTimeBreakdown.waitPercent > 10 && `${data.leadTimeBreakdown.waitPercent.toFixed(2)}%`}
                    </div>
                    <div 
                      className="bg-rose-500 flex items-center justify-center text-[10px] font-bold text-rose-950"
                      style={{ width: `${data.leadTimeBreakdown.blockedPercent}%` }}
                      title={`Blocked: ${data.leadTimeBreakdown.blockedPercent.toFixed(2)}%`}
                    >
                      {data.leadTimeBreakdown.blockedPercent > 10 && `${data.leadTimeBreakdown.blockedPercent.toFixed(2)}%`}
                    </div>
                  </div>
                  <div className="flex justify-center gap-8 text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-slate-300">Active</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-indigo-500" />
                      <span className="text-slate-300">Waiting</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-rose-500" />
                      <span className="text-slate-300">Blocked</span>
                    </div>
                  </div>
                  <p className="text-center text-[10px] text-slate-500 italic">
                    Target flow efficiency (Active %) is &gt;40% for elite teams.
                  </p>

                </div>
              ) : (
                <div className="text-center text-slate-500 italic">No lead time data available</div>
              )}
            </div>
          </div>
        </div>

        {/* Aging WIP */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 shadow-sm">
          <SectionTitle 
            title="Aging WIP" 
            icon={<Layers size={18} className="text-amber-400" />} 
            aiConfigured={aiConfigured}
            onAiSuggest={() => handleAiSuggest('agingWip', 'Aging WIP', data?.agingWip.length ?? 0, { description: 'Analysis of tickets stuck in current statuses' })}
          />
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ticket</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Assignee</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Days in Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {data?.agingWip.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500 italic">No active work-in-progress found</td>
                  </tr>
                ) : (
                  data?.agingWip.slice(0, 10).map((wip) => (
                    <tr key={wip.key} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-xs font-mono font-bold text-indigo-400">{wip.key}</span>
                          <span className="text-xs text-slate-300 truncate max-w-[300px]">{wip.summary}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{wip.assignee}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium border border-slate-700">
                          {wip.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-300">{wip.daysInStatus.toFixed(2)}d</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          wip.severity === 'escalation' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                          wip.severity === 'critical' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}>
                          {wip.severity}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
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
