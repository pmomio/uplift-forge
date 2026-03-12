import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { getEpics, syncEpics, getAiConfig, getAiSuggestions, syncAllProjects } from '../api';
import type { ProjectInfo } from '../App';
import type { EpicSummary, AiProvider, Persona } from '../../shared/types';

const RISK_COLORS = {
  low: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  medium: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', bar: 'bg-amber-500' },
  high: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400', bar: 'bg-rose-500' },
};

interface EpicTrackerProps {
  refreshKey: number;
  project?: ProjectInfo | null;
  persona?: Persona;
  projectCount?: number;
}

const EpicTracker: React.FC<EpicTrackerProps> = ({ refreshKey, project, persona, projectCount }) => {
  const isMultiProject = (persona === 'engineering_manager' || persona === 'management') && (projectCount ?? 1) > 1;
  const [epics, setEpics] = useState<EpicSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiProvider, setAiProvider] = useState<AiProvider>('openai');
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, string[]>>({});

  const fetchEpics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEpics();
      setEpics(res.data as EpicSummary[]);
    } catch {
      console.error('Failed to fetch epics');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      if (isMultiProject) {
        await syncAllProjects();
        const res = await getEpics();
        setEpics(res.data as EpicSummary[]);
      } else {
        const res = await syncEpics();
        setEpics(res.data as EpicSummary[]);
      }
      toast.success('Epics refreshed');
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [isMultiProject]);

  useEffect(() => { fetchEpics(); }, [fetchEpics]);
  useEffect(() => { if (refreshKey > 0) fetchEpics(); }, [refreshKey, fetchEpics]);

  useEffect(() => {
    getAiConfig().then(res => {
      const cfg = res.data as { provider: AiProvider; hasKey: boolean };
      setAiConfigured(cfg.hasKey);
      setAiProvider(cfg.provider);
    }).catch(() => {});
  }, []);

  const handleAiSuggest = useCallback(async (epic: EpicSummary) => {
    if (!aiConfigured) return;
    setAiLoading(epic.key);
    try {
      const res = await getAiSuggestions({
        metricKey: 'epic_progress',
        metricLabel: `Epic: ${epic.summary}`,
        currentValue: epic.progressPct,
        previousValue: null,
        trendDirection: null,
        trendPct: null,
        helpContent: `Epic ${epic.key}: ${epic.summary}\nProgress: ${Math.round(epic.progressPct * 100)}% (${epic.resolvedTickets}/${epic.totalTickets} tickets)\nRisk: ${epic.riskLevel} (${epic.riskScore})\nRisk factors: ${epic.riskFactors.join('; ')}\nTotal SP: ${epic.totalSP}, Resolved SP: ${epic.resolvedSP}\nAvg Cycle Time: ${epic.avgCycleTime ?? 'N/A'}h`,
        context: 'team',
      });
      const data = res.data as { suggestions: string[]; error?: string };
      if (data.suggestions.length > 0) {
        setAiSuggestions(prev => ({ ...prev, [epic.key]: data.suggestions }));
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch {
      toast.error('Failed to get AI suggestions');
    } finally {
      setAiLoading(null);
    }
  }, [aiConfigured]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">
            {isMultiProject ? 'All Projects — Epic Tracker' : project?.name ? `${project.name} — Epic Tracker` : 'Epic Tracker'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Track epic progress, identify risks, and monitor delivery</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          <span>{syncing ? 'Syncing...' : 'Sync & Refresh'}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 animate-fade-in">
        {loading && epics.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-64 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-600 border-t-indigo-400" />
            <p className="text-sm text-slate-400">Loading epics...</p>
          </div>
        ) : epics.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-64 gap-2">
            <p className="text-slate-300 font-medium">No epics found</p>
            <p className="text-sm text-slate-500">Sync tickets first. Epics are detected from parent ticket relationships in JIRA.</p>
          </div>
        ) : (
          <div className="max-w-5xl space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <StatCard label="Total Epics" value={epics.length} />
              <StatCard label="High Risk" value={epics.filter(e => e.riskLevel === 'high').length} color="text-rose-400" />
              <StatCard label="Medium Risk" value={epics.filter(e => e.riskLevel === 'medium').length} color="text-amber-400" />
              <StatCard label="Low Risk" value={epics.filter(e => e.riskLevel === 'low').length} color="text-emerald-400" />
            </div>

            {/* Epic cards */}
            {epics.map(epic => {
              const isExpanded = expanded === epic.key;
              const colors = RISK_COLORS[epic.riskLevel];
              const suggestions = aiSuggestions[epic.key];

              return (
                <div key={epic.key} className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden transition-all`}>
                  {/* Epic header */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : epic.key)}
                    className="w-full px-5 py-4 flex items-center gap-4 hover:bg-white/5 transition-colors text-left"
                  >
                    {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-500">{epic.key}</span>
                        {isMultiProject && epic.childTickets[0]?.project_key && (
                          <span className="px-1.5 py-0.5 bg-slate-700/60 text-slate-400 rounded text-[10px] font-mono">
                            {epic.childTickets[0].project_key}
                          </span>
                        )}
                        <RiskBadge level={epic.riskLevel} score={epic.riskScore} />
                      </div>
                      <span className="text-sm font-semibold text-slate-200 block truncate">{epic.summary}</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-48 flex-shrink-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-500">{epic.resolvedTickets}/{epic.totalTickets} tickets</span>
                        <span className="text-xs font-semibold text-slate-300">{Math.round(epic.progressPct * 100)}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                        <div className={`h-full ${colors.bar} rounded-full transition-all`} style={{ width: `${Math.round(epic.progressPct * 100)}%` }} />
                      </div>
                    </div>

                    {/* SP */}
                    <div className="text-right flex-shrink-0 w-20">
                      <span className="text-xs text-slate-500">SP</span>
                      <span className="block text-sm font-semibold text-slate-300 tabular-nums">{epic.resolvedSP}/{epic.totalSP}</span>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-slate-700/30 pt-4 space-y-4">
                      {/* Risk factors */}
                      {epic.riskFactors.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Risk Factors</h4>
                          <ul className="space-y-1.5">
                            {epic.riskFactors.map((factor, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                <AlertTriangle size={12} className={`${colors.text} mt-0.5 flex-shrink-0`} />
                                {factor}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="grid grid-cols-4 gap-3">
                        <MiniStat label="Avg Cycle Time" value={epic.avgCycleTime ? `${epic.avgCycleTime}h` : 'N/A'} />
                        <MiniStat label="Risk Score" value={epic.riskScore.toFixed(2)} />
                        <MiniStat label="Total SP" value={String(epic.totalSP)} />
                        <MiniStat label="Resolved SP" value={String(epic.resolvedSP)} />
                      </div>

                      {/* Child tickets */}
                      <div>
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Child Tickets ({epic.childTickets.length})
                        </h4>
                        <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-700/30">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-slate-800">
                              <tr className="text-slate-500 uppercase tracking-wider">
                                <th className="text-left px-3 py-2">Key</th>
                                <th className="text-left px-3 py-2">Summary</th>
                                <th className="text-left px-3 py-2">Status</th>
                                <th className="text-right px-3 py-2">SP</th>
                                <th className="text-right px-3 py-2">Hours</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/20">
                              {epic.childTickets.map(ticket => (
                                <tr key={ticket.key} className="hover:bg-slate-700/20">
                                  <td className="px-3 py-2 font-mono text-slate-400">{ticket.key}</td>
                                  <td className="px-3 py-2 text-slate-300 truncate max-w-[200px]">{ticket.summary}</td>
                                  <td className="px-3 py-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      ticket.status === 'Done' || ticket.status === 'Resolved' ? 'bg-emerald-500/15 text-emerald-400' :
                                      ticket.status === 'Blocked' ? 'bg-rose-500/15 text-rose-400' :
                                      'bg-slate-700/50 text-slate-400'
                                    }`}>
                                      {ticket.status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right text-slate-400 tabular-nums">{ticket.story_points ?? '—'}</td>
                                  <td className="px-3 py-2 text-right text-slate-400 tabular-nums">{ticket.eng_hours != null ? `${ticket.eng_hours}h` : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* AI Suggestions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAiSuggest(epic)}
                          disabled={!aiConfigured || aiLoading === epic.key}
                          className={`inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                            aiConfigured
                              ? 'text-violet-400 border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20'
                              : 'text-slate-600 border-slate-700/30 cursor-not-allowed'
                          }`}
                          title={aiConfigured ? 'Get AI risk mitigation suggestions' : 'Configure AI in Settings first'}
                        >
                          <Sparkles size={12} className={aiLoading === epic.key ? 'animate-pulse' : ''} />
                          {aiLoading === epic.key ? 'Analyzing...' : 'AI Risk Analysis'}
                        </button>
                      </div>

                      {suggestions && suggestions.length > 0 && (
                        <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-4">
                          <h4 className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-2">AI Suggestions</h4>
                          <ul className="space-y-2">
                            {suggestions.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                                <Sparkles size={10} className="text-violet-400 mt-0.5 flex-shrink-0" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, color }: { label: string; value: number; color?: string }) => (
  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
    <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
    <span className={`block text-2xl font-bold tabular-nums mt-1 ${color || 'text-slate-100'}`}>{value}</span>
  </div>
);

const MiniStat = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-slate-800/30 rounded-lg px-3 py-2 text-center">
    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">{label}</span>
    <span className="text-sm font-semibold text-slate-300 tabular-nums">{value}</span>
  </div>
);

const RiskBadge = ({ level, score }: { level: 'low' | 'medium' | 'high'; score: number }) => {
  const colors = RISK_COLORS[level];
  const Icon = level === 'high' ? AlertTriangle : level === 'medium' ? Clock : CheckCircle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${colors.bg} ${colors.text} border ${colors.border}`}>
      <Icon size={10} />
      {level} ({score.toFixed(2)})
    </span>
  );
};

export default EpicTracker;
