import React, { useState, useEffect } from 'react';
import { Save, Search, Calculator, Download, Filter, X, TrendingUp, BarChart3, Link, Clock, Users, Check, Settings, RefreshCw, ExternalLink, Sparkles, Eye, EyeOff, Trash2, User, ClipboardList, Target, LineChart, ShieldCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  getConfig, 
  saveConfig, 
  getJiraFields, 
  getJiraStatuses, 
  getJiraProject,
  getJiraMembers,
  resetApp
} from '../api';
import type { AppConfig, FieldIds, TicketFilter, TrackedEngineer, JiraField, JiraStatus, ProjectInfo } from '../../shared/types';
import ModalDialog from './ModalDialog';

interface ConfigPanelProps {
  onConfigSaved?: () => void;
}

type TabType = 'project' | 'metrics' | 'application';

const ConfigPanel: React.FC<ConfigPanelProps> = ({ onConfigSaved }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingFields, setFetchingFields] = useState(false);
  const [jiraFields, setJiraFields] = useState<JiraField[]>([]);
  const [jiraStatuses, setJiraStatuses] = useState<JiraStatus[]>([]);
  const [fieldsFetched, setFieldsFetched] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('project');
  const [loadError, setLoadError] = useState(false);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [jiraMembers, setJiraMembers] = useState<TrackedEngineer[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // AI Config State
  const [aiProvider, setAiProvider] = useState<'openai' | 'claude'>('openai');
  const [aiApiKey, setAiApiKey] = useState('');
  const [hasAiKey, setHasAiKey] = useState(false);
  const [showAiKey, setShowAiKey] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [configRes, aiConfigRes] = await Promise.all([
        getConfig(),
        window.api.getAiConfig()
      ]);
      
      setConfig(configRes.data);
      setAiProvider(aiConfigRes.data.provider);
      setHasAiKey(aiConfigRes.data.hasKey);

      if (configRes.data.project_key) {
        fetchProjectInfo();
        fetchFieldsAndStatuses();
        fetchJiraMembers();
      }
    } catch (err) {
      console.error('Failed to load config', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectInfo = async () => {
    try {
      const res = await getJiraProject();
      if (!res.data.error) {
        setProjectInfo(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch project info', err);
    }
  };

  const fetchJiraMembers = async () => {
    try {
      const res = await getJiraMembers();
      setJiraMembers(res.data);
    } catch (err) {
      console.error('Failed to fetch JIRA members', err);
    }
  };

  const fetchFieldsAndStatuses = async () => {
    setFetchingFields(true);
    try {
      const [fieldsRes, statusesRes] = await Promise.all([
        getJiraFields(),
        getJiraStatuses(),
      ]);
      if (fieldsRes.data.error) {
        throw new Error(fieldsRes.data.error);
      }
      if (statusesRes.data.error) {
        throw new Error(statusesRes.data.error);
      }
      setJiraFields(fieldsRes.data.sort((a: any, b: any) => a.name.localeCompare(b.name)));
      setJiraStatuses(statusesRes.data);
      setFieldsFetched(true);
    } catch (err) {
      console.error('Failed to fetch JIRA fields/statuses', err);
      setLoadError(true);
      throw err;
    } finally {
      setFetchingFields(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setLoading(true);
    try {
      const result = await saveConfig({
        project_key: config.project_key,
        field_ids: config.field_ids,
        ticket_filter: config.ticket_filter || { mode: 'last_x_months', months: 6 },
        sp_to_days: config.sp_to_days ?? 1,
        tracked_engineers: config.tracked_engineers || [],
        persona: config.persona,
        metric_preferences: config.metric_preferences,
        projects: config.projects,
        active_statuses: config.active_statuses,
        blocked_statuses: config.blocked_statuses,
        done_statuses: config.done_statuses,
        wip_limit: config.wip_limit,
        aging_thresholds: config.aging_thresholds,
        my_account_id: config.my_account_id,
        personal_goals: config.personal_goals,
        opt_in_team_comparison: config.opt_in_team_comparison,
        seniority_field_id: config.seniority_field_id,
      });
      if (result.data.sync_triggered) {
        toast.success(`Config saved — synced ${result.data.ticket_count} tickets`);
      } else {
        toast.success(`Config saved — ${result.data.ticket_count} tickets`);
      }
      if (onConfigSaved) onConfigSaved();
    } catch (err: any) {
      console.error('Failed to save config', err);
      const message = err?.message || 'Failed to save settings';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleAiKeySave = async () => {
    if (!aiApiKey) return;
    try {
      await window.api.setAiConfig(aiProvider, aiApiKey);
      setHasAiKey(true);
      setAiApiKey('');
      toast.success(`${aiProvider === 'openai' ? 'OpenAI' : 'Claude'} API key saved`);
    } catch (err) {
      toast.error('Failed to save AI API key');
    }
  };

  const handleAiKeyDelete = async () => {
    try {
      await window.api.deleteAiConfig();
      setHasAiKey(false);
      toast.success('AI configuration cleared');
    } catch (err) {
      toast.error('Failed to clear AI configuration');
    }
  };

  const handleResetApp = async () => {
    try {
      await resetApp();
      // App will relaunch automatically from main process
    } catch (err) {
      toast.error('Failed to reset app');
    }
  };

  const updateFieldIds = (patch: Partial<FieldIds>) => {
    if (!config) return;
    setConfig({
      ...config,
      field_ids: { ...config.field_ids, ...patch },
    });
  };

  const toggleTrackedEngineer = (eng: TrackedEngineer) => {
    if (!config) return;
    const current = config.tracked_engineers || [];
    const exists = current.find(e => e.accountId === eng.accountId);
    
    const next = exists 
      ? current.filter(e => e.accountId !== eng.accountId)
      : [...current, eng];
      
    setConfig({ ...config, tracked_engineers: next });
  };

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      {loadError && (
        <div className="px-6 py-3 bg-rose-500/10 border-b border-rose-500/20 flex items-center gap-3 text-rose-400 animate-in slide-in-from-top duration-300 sticky top-0 z-50">
          <X size={18} />
          <span className="text-sm font-medium">There was an error loading your configuration. Please check your JIRA connection.</span>
          <button onClick={() => setLoadError(false)} className="ml-auto p-1 hover:bg-rose-500/10 rounded-md">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Settings className="text-indigo-400" size={24} />
          <h1 className="text-xl font-semibold">Settings</h1>
          
          {config.persona && (
            <div className="ml-4 px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-[10px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5 shadow-sm">
              <ShieldCheck size={10} />
              {config.persona.replace('_', ' ')}
            </div>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-all shadow-lg shadow-indigo-900/20 font-medium cursor-pointer"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Save Changes
        </button>
      </div>

      <div className="flex border-b border-slate-800 bg-slate-900/50 sticky top-0 z-10">
        <button
          onClick={() => setActiveTab('project')}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'project' ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Link size={16} />
          JIRA Connection
        </button>
        <button
          onClick={() => setActiveTab('metrics')}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'metrics' ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp size={16} />
          Metrics & Workflow
        </button>
        <button
          onClick={() => setActiveTab('application')}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'application' ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings size={16} />
          Application
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {activeTab === 'project' && (
          <div className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <section>
              <h2 className="text-lg font-medium text-slate-100 mb-4 flex items-center gap-2">
                <Link size={20} className="text-indigo-400" />
                Primary Project
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 rounded-xl bg-slate-800/50 border border-slate-700 shadow-inner">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">JIRA Project Key</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={config.project_key}
                      onChange={(e) => setConfig({ ...config, project_key: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                      placeholder="e.g. PROJ"
                    />
                    <button
                      onClick={fetchFieldsAndStatuses}
                      disabled={fetchingFields || !config.project_key}
                      className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
                      title="Fetch fields and statuses from JIRA"
                    >
                      {fetchingFields ? <RefreshCw className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                      <span className="text-xs font-medium">Fetch Fields</span>
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 italic">Primary project key used for data sync and dashboard defaults.</p>
                </div>

                {projectInfo && (
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                    {projectInfo.avatar && <img src={projectInfo.avatar} className="w-12 h-12 rounded-lg" alt="Project" />}
                    <div>
                      <div className="font-bold text-slate-100">{projectInfo.name}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                        <Users size={12} />
                        Lead: {projectInfo.lead || 'Unknown'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-medium text-slate-100 mb-4 flex items-center gap-2">
                <BarChart3 size={20} className="text-indigo-400" />
                JIRA Field Mapping
              </h2>
              <div className="p-5 rounded-xl bg-slate-800/50 border border-slate-700 shadow-inner space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Story Points Field</label>
                    <select
                      value={config.field_ids.story_points}
                      onChange={(e) => updateFieldIds({ story_points: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">-- Automatic Detection --</option>
                      {jiraFields.map(f => <option key={f.id} value={f.id}>{f.name} ({f.id})</option>)}
                    </select>
                  </div>
                </div>
                {!fieldsFetched && !fetchingFields && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                    <Clock size={16} />
                    Fields haven't been fetched yet. Click "Fetch Fields" to load JIRA metadata.
                  </div>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-medium text-slate-100 mb-4 flex items-center gap-2">
                <Filter size={20} className="text-indigo-400" />
                Data Sync Filter
              </h2>
              <div className="p-5 rounded-xl bg-slate-800/50 border border-slate-700 shadow-inner">
                <div className="flex flex-wrap gap-6 items-center">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      id="filter-months"
                      name="filter-mode"
                      checked={config.ticket_filter.mode === 'last_x_months'}
                      onChange={() => setConfig({ ...config, ticket_filter: { ...config.ticket_filter, mode: 'last_x_months' }})}
                      className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700"
                    />
                    <label htmlFor="filter-months" className="text-sm text-slate-300">Last</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={config.ticket_filter.months || 6}
                      onChange={(e) => setConfig({ ...config, ticket_filter: { ...config.ticket_filter, months: parseInt(e.target.value) }})}
                      disabled={config.ticket_filter.mode !== 'last_x_months'}
                      className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-center disabled:opacity-50"
                    />
                    <span className="text-sm text-slate-300">Months</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      id="filter-missing"
                      name="filter-mode"
                      checked={config.ticket_filter.mode === 'missing_fields'}
                      onChange={() => setConfig({ ...config, ticket_filter: { ...config.ticket_filter, mode: 'missing_fields' }})}
                      className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700"
                    />
                    <label htmlFor="filter-missing" className="text-sm text-slate-300">All Missing Story Points</label>
                  </div>
                </div>
                <p className="mt-4 text-xs text-slate-500 flex items-center gap-1.5 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
                  <Clock size={12} />
                  Note: Changing filters will trigger a full ticket re-sync from JIRA.
                </p>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <section>
              <h2 className="text-lg font-medium text-slate-100 mb-4 flex items-center gap-2">
                <Target size={20} className="text-emerald-400" />
                Estimation Calibration
              </h2>
              <div className="p-5 rounded-xl bg-slate-800/50 border border-slate-700 shadow-inner">
                <div className="max-w-xs">
                  <label className="block text-sm font-medium text-slate-400 mb-2">1 Story Point = X Days</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={config.sp_to_days}
                      onChange={(e) => setConfig({ ...config, sp_to_days: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                    <div className="px-3 py-2 bg-slate-700 rounded-lg text-xs font-mono text-slate-300 whitespace-nowrap">
                      {(config.sp_to_days * 8).toFixed(1)} Active Hours
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500 leading-relaxed italic">
                    Used to calculate estimation accuracy (Actual Active Time / Estimated Time). 
                    Assumes an 8-hour productive workday.
                  </p>
                </div>
              </div>
            </section>

            {(config.persona === 'engineering_manager' || config.persona === 'delivery_manager' || config.persona === 'management') && (
              <section>
                <h2 className="text-lg font-medium text-slate-100 mb-4 flex items-center gap-2">
                  <Users size={20} className="text-blue-400" />
                  Tracked Engineers
                </h2>
                <div className="p-5 rounded-xl bg-slate-800/50 border border-slate-700 shadow-inner">
                  <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                    Select the engineers whose metrics should contribute to team dashboards and individual comparisons.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {jiraMembers.length === 0 ? (
                      <div className="col-span-full py-8 text-center text-slate-500 italic bg-slate-900/30 rounded-lg border border-dashed border-slate-700">
                        No team members found in cached issues.
                      </div>
                    ) : (
                      jiraMembers.map(member => {
                        const isTracked = config.tracked_engineers?.some(e => e.accountId === member.accountId);
                        return (
                          <button
                            key={member.accountId}
                            onClick={() => toggleTrackedEngineer(member)}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all group relative cursor-pointer ${
                              isTracked 
                                ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-200' 
                                : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600'
                            }`}
                          >
                            <div className="relative">
                              {member.avatar ? (
                                <img src={member.avatar} className="w-8 h-8 rounded-full" alt={member.displayName} />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">
                                  {member.displayName.charAt(0)}
                                </div>
                              )}
                              {isTracked && (
                                <div className="absolute -top-1 -right-1 bg-indigo-500 text-white rounded-full p-0.5 shadow-sm">
                                  <Check size={8} />
                                </div>
                              )}
                            </div>
                            <span className="text-xs font-medium truncate">{member.displayName}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-700/50 pt-3">
                    <span>{config.tracked_engineers?.length || 0} engineers selected</span>
                    <button 
                      onClick={() => setConfig({ ...config, tracked_engineers: [] })}
                      className="hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              </section>
            )}

            <section>
              <h2 className="text-lg font-medium text-slate-100 mb-4 flex items-center gap-2">
                <LineChart size={20} className="text-amber-400" />
                Status Classification
              </h2>
              <div className="p-5 rounded-xl bg-slate-800/50 border border-slate-700 shadow-inner space-y-6">
                <p className="text-sm text-slate-400 leading-relaxed italic">
                  Categorize your JIRA statuses to enable flow metrics, cycle time, and timeline analysis. 
                  Statuses not selected below are treated as "Waiting".
                </p>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
                      <Calculator size={14} />
                      Active Statuses
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {jiraStatuses.map(s => {
                        const isActive = config.active_statuses?.includes(s.name);
                        return (
                          <button
                            key={s.id}
                            onClick={() => {
                              const current = config.active_statuses || [];
                              const next = isActive ? current.filter(n => n !== s.name) : [...current, s.name];
                              setConfig({ ...config, active_statuses: next });
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                              isActive 
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-900/20' 
                                : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400'
                            }`}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-amber-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
                      <Clock size={14} />
                      Blocked Statuses
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {jiraStatuses.map(s => {
                        const isBlocked = config.blocked_statuses?.includes(s.name);
                        return (
                          <button
                            key={s.id}
                            onClick={() => {
                              const current = config.blocked_statuses || [];
                              const next = isBlocked ? current.filter(n => n !== s.name) : [...current, s.name];
                              setConfig({ ...config, blocked_statuses: next });
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                              isBlocked 
                                ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm shadow-amber-900/20' 
                                : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400'
                            }`}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
                      <Check size={14} />
                      Done Statuses
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {jiraStatuses.map(s => {
                        const isDone = config.done_statuses?.includes(s.name);
                        return (
                          <button
                            key={s.id}
                            onClick={() => {
                              const current = config.done_statuses || [];
                              const next = isDone ? current.filter(n => n !== s.name) : [...current, s.name];
                              setConfig({ ...config, done_statuses: next });
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                              isDone 
                                ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-sm shadow-blue-900/20' 
                                : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400'
                            }`}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'application' && (
          <div className="max-w-3xl space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <section>
              <h2 className="text-lg font-medium text-slate-100 mb-4 flex items-center gap-2">
                <Sparkles size={20} className="text-purple-400" />
                AI Assistant Setup
              </h2>
              <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700 shadow-inner">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-400 mb-3">AI Model Provider</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setAiProvider('openai')}
                      className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all cursor-pointer ${
                        aiProvider === 'openai' 
                          ? 'bg-purple-500/10 border-purple-500 text-purple-200' 
                          : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"></div>
                      OpenAI
                    </button>
                    <button
                      onClick={() => setAiProvider('claude')}
                      className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all cursor-pointer ${
                        aiProvider === 'claude' 
                          ? 'bg-amber-500/10 border-amber-500 text-amber-200' 
                          : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                      Claude
                    </button>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-400 mb-3">API Key</label>
                  <div className="relative group">
                    <input
                      type={showAiKey ? "text" : "password"}
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                      placeholder={hasAiKey ? "••••••••••••••••••••••••••••" : `Enter your ${aiProvider === 'openai' ? 'OpenAI' : 'Claude'} API key`}
                      className="w-full pl-4 pr-12 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder:text-slate-600"
                    />

                    <button
                      type="button"
                      onClick={() => setShowAiKey(!showAiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      {showAiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="mt-3 text-[11px] text-slate-500 leading-relaxed bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/50 italic">
                    Keys are encrypted and stored in your OS keychain. They are never sent to our servers.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleAiKeySave}
                    disabled={!aiApiKey}
                    className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-all font-medium flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <Save size={18} />
                    {hasAiKey ? 'Update Key' : 'Save Key'}
                  </button>
                  {hasAiKey && (
                    <button
                      onClick={handleAiKeyDelete}
                      className="px-4 py-2.5 border border-slate-700 hover:bg-rose-500/10 hover:border-rose-500/50 hover:text-rose-400 text-slate-400 rounded-lg transition-all font-medium flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Trash2 size={18} />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="pt-6 border-t border-slate-800">
              <h2 className="text-lg font-medium text-slate-100 mb-4 flex items-center gap-2 text-rose-400">
                <Trash2 size={20} />
                Danger Zone
              </h2>
              <div className="p-6 rounded-xl bg-rose-500/5 border border-rose-500/20">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
                    <ShieldCheck size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-100">Reset Application</h3>
                    <p className="text-sm text-slate-400 mt-1 mb-4 leading-relaxed">
                      Wipes all configuration, cached tickets, and API tokens. You will be returned to the login screen. 
                      <span className="text-rose-400 block mt-1 font-medium italic">This action cannot be undone.</span>
                    </p>
                    <button
                      onClick={() => setShowResetConfirm(true)}
                      className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600 border border-rose-600/50 text-rose-200 hover:text-white rounded-lg transition-all text-sm font-bold shadow-lg shadow-rose-950/20 cursor-pointer"
                    >
                      Reset All Data
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      <ModalDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Reset Application"
        footer={
          <div className="flex gap-3 w-full">
            <button
              onClick={() => setShowResetConfirm(false)}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleResetApp}
              className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors font-bold cursor-pointer"
            >
              Reset App
            </button>
          </div>
        }
      >
        <div className="text-slate-300 space-y-4">
          <p>Are you absolutely sure you want to reset Uplift Forge?</p>
          <ul className="list-disc list-inside text-sm text-slate-400 space-y-1">
            <li>All JIRA and AI API credentials will be cleared</li>
            <li>All cached tickets and timelines will be deleted</li>
            <li>All mapping rules and project settings will be lost</li>
          </ul>
          <p className="text-xs text-rose-400 italic">This will return the app to a fresh installation state.</p>
        </div>
      </ModalDialog>
    </div>
  );
};

export default ConfigPanel;
