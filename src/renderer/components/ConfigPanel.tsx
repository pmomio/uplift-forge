import React, { useState, useEffect } from 'react';
import { Save, Search, Calculator, Download, Filter, X, TrendingUp, BarChart3, Link, Clock, Users, Check, Settings, RefreshCw, ExternalLink, Sparkles, Eye, EyeOff, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getConfig, saveConfig, getJiraFields, getJiraStatuses, getJiraMembers, checkForUpdates, downloadUpdate, getAiConfig, setAiConfig, deleteAiConfig, testAiConnection } from '../api';
import RuleBuilder from './RuleBuilder';
import type { UpdateInfo, AiProvider } from '../../shared/types';

interface ConfigPanelProps {
  onConfigSaved?: () => void;
}

// --- Feature section header ---
const FeatureHeader = ({ icon, title, description, color }: {
  icon: React.ReactNode; title: string; description: string; color: string;
}) => (
  <div className="flex items-start gap-3 pt-2 pb-1">
    <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md shadow-black/20`}>
      {icon}
    </div>
    <div>
      <h2 className="text-sm font-bold text-slate-100">{title}</h2>
      <p className="text-xs text-slate-500 mt-0.5">{description}</p>
    </div>
  </div>
);

const ConfigPanel: React.FC<ConfigPanelProps> = ({ onConfigSaved }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'metrics' | 'attribution' | 'settings'>('general');
  const [config, setConfig] = useState<any>(null);
  const [jiraFields, setJiraFields] = useState<any[]>([]);
  const [jiraStatuses, setJiraStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [fetchingFields, setFetchingFields] = useState(false);
  const [fieldsFetched, setFieldsFetched] = useState(false);
  const [jiraMembers, setJiraMembers] = useState<any[]>([]);
  const [fetchingMembers, setFetchingMembers] = useState(false);

  // Update related state
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  // AI config state
  const [aiProvider, setAiProvider] = useState<AiProvider>('openai');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiHasKey, setAiHasKey] = useState(false);
  const [aiShowKey, setAiShowKey] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);

  useEffect(() => {
    loadConfig();
    // Pre-load update info if available
    checkForUpdates().then(res => setUpdateInfo(res.data as UpdateInfo)).catch(() => {});
    // Load AI config
    getAiConfig().then(res => {
      const cfg = res.data as { provider: AiProvider; hasKey: boolean };
      setAiProvider(cfg.provider);
      setAiHasKey(cfg.hasKey);
    }).catch(() => {});
  }, []);

  const handleCheckForUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const res = await checkForUpdates();
      const info = res.data as UpdateInfo;
      setUpdateInfo(info);
      if (info.updateAvailable) {
        toast.success(`Version ${info.latestVersion} is available!`);
      } else {
        toast.success('You are on the latest version');
      }
    } catch {
      toast.error('Failed to check for updates');
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleDownload = async () => {
    try {
      await downloadUpdate();
    } catch {
      if (updateInfo?.releaseUrl) window.api.openExternal(updateInfo.releaseUrl);
    }
  };

  const loadConfig = async () => {
    setLoadError(false);
    try {
      const res = await getConfig();
      setConfig(res.data);
      if (res.data?.project_key?.trim()) {
        fetchFieldsAndStatuses();
      }
    } catch (err) {
      console.error('Failed to load config', err);
      setLoadError(true);
    }
  };

  const fetchFieldsAndStatuses = async () => {
    setFetchingFields(true);
    try {
      const [fieldsRes, statusesRes] = await Promise.all([
        getJiraFields(),
        getJiraStatuses(),
      ]);
      if (!fieldsRes.data.error) {
        setJiraFields(fieldsRes.data.sort((a: any, b: any) => a.name.localeCompare(b.name)));
      }
      if (!statusesRes.data.error) {
        setJiraStatuses(statusesRes.data);
      }
      setFieldsFetched(true);
    } catch (err) {
      console.error('Failed to fetch JIRA fields/statuses', err);
    } finally {
      setFetchingFields(false);
    }
  };

  const handleFetchFields = async () => {
    if (!config?.project_key?.trim()) {
      toast.error('Please enter a JIRA Project Key first');
      return;
    }
    try {
      await fetchFieldsAndStatuses();
      toast.success('Fields and statuses refreshed');
    } catch {
      toast.error('Failed to fetch fields from JIRA');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await saveConfig({
        project_key: config.project_key,
        field_ids: config.field_ids,
        eng_start_status: config.eng_start_status,
        eng_end_status: config.eng_end_status,
        eng_excluded_statuses: config.eng_excluded_statuses || [],
        ticket_filter: config.ticket_filter || { mode: 'last_x_months', months: 6 },
        mapping_rules: config.mapping_rules || { tpd_bu: {}, work_stream: {} },
        sp_to_days: config.sp_to_days ?? 1,
        tracked_engineers: config.tracked_engineers || [],
      });
      if (result.data.sync_triggered) {
        toast.success(`Config saved — synced ${result.data.ticket_count} tickets`);
      } else {
        toast.success(`Config saved — ${result.data.ticket_count} tickets`);
      }
      if (onConfigSaved) onConfigSaved();
    } catch (err) {
      console.error('Failed to save config', err);
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const updateFieldId = (key: string, value: string) => {
    setConfig({
      ...config,
      field_ids: { ...config.field_ids, [key]: value }
    });
  };

  const updateMappingRules = (type: 'tpd_bu' | 'work_stream', groups: any) => {
    setConfig({
      ...config,
      mapping_rules: { ...config.mapping_rules, [type]: groups }
    });
  };

  const isMissingFieldsMode = config?.ticket_filter?.mode === 'missing_fields';

  // --- Field dropdown helper ---
  const FieldSelect = ({ fieldKey, label }: { fieldKey: string; label: string }) => (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      <select
        className="bg-slate-700/60 border border-slate-600/60 text-slate-200 text-sm rounded-md w-full px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400/50 cursor-pointer"
        value={config?.field_ids?.[fieldKey] || ''}
        onChange={(e) => updateFieldId(fieldKey, e.target.value)}
      >
        <option value="">Select JIRA Field...</option>
        {jiraFields.map(f => <option key={f.id} value={f.id}>{f.name} ({f.id})</option>)}
      </select>
    </div>
  );

  // --- Status dropdown helper ---
  const StatusSelect = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div>
      <label className="block text-xs font-medium text-emerald-300/70 mb-1">{label}</label>
      <select
        className="bg-slate-700/60 border border-slate-600/60 text-slate-200 text-sm rounded-md w-full px-2 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400/50 cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select Status...</option>
        {jiraStatuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
      </select>
    </div>
  );

  const TABS = [
    { id: 'general', label: 'General', icon: <Link size={16} /> },
    { id: 'metrics', label: 'Metrics', icon: <TrendingUp size={16} /> },
    { id: 'attribution', label: 'Engineering Attribution', icon: <BarChart3 size={16} /> },
    { id: 'settings', label: 'Application Settings', icon: <Settings size={16} /> },
  ] as const;

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center flex-shrink-0 bg-slate-900/40 backdrop-blur-sm z-10">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage JIRA integration and calculation logic</p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading || !config}
          className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white text-sm font-medium px-5 py-2 rounded-lg shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 transition-all"
        >
          <Save size={16} />
          <span>{loading ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="px-6 border-b border-slate-700/50 bg-slate-900/20 flex-shrink-0">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative ${
                activeTab === tab.id
                  ? 'text-indigo-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 animate-fade-in">
        {config ? (
          <div className="max-w-4xl mx-auto">
            {activeTab === 'general' && (
              <div className="space-y-8 animate-slide-up">
                <div className="space-y-4">
                  <FeatureHeader
                    icon={<Link size={16} className="text-white" />}
                    title="JIRA Connection"
                    description="Connect to your JIRA project and set the data time range. Required for all features."
                    color="bg-indigo-500"
                  />

                  <section className="bg-indigo-500/10 p-4 rounded-lg border border-indigo-500/20">
                    <label className="block text-xs font-semibold text-indigo-300 mb-2 uppercase tracking-wider">
                      Project Key
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="bg-slate-700/60 border border-slate-600/60 text-slate-100 text-lg rounded-md flex-1 p-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400/50"
                        value={config.project_key}
                        onChange={(e) => setConfig({...config, project_key: e.target.value.toUpperCase()})}
                        placeholder="e.g. ACTIN"
                      />
                      <button
                        onClick={handleFetchFields}
                        disabled={fetchingFields || !config.project_key?.trim()}
                        className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white text-sm font-medium px-4 rounded-md shadow-sm shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                      >
                        <Download size={16} className={fetchingFields ? 'animate-pulse' : ''} />
                        <span>{fetchingFields ? 'Fetching...' : fieldsFetched ? 'Refresh Fields' : 'Fetch Fields'}</span>
                      </button>
                    </div>
                  </section>

                  <section className="bg-indigo-500/10 p-4 rounded-lg border border-indigo-500/20">
                    <label className="block text-xs font-semibold text-indigo-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                      <Clock size={14} />
                      Data Time Range
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-300">Fetch tickets from the last</span>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        className="bg-slate-700/60 border border-slate-600/60 text-slate-200 text-sm rounded-md w-20 px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400/50 tabular-nums text-center"
                        value={config.ticket_filter?.months || 6}
                        onChange={(e) => setConfig({
                          ...config,
                          ticket_filter: { ...config.ticket_filter, months: Math.min(parseInt(e.target.value) || 6, 12) }
                        })}
                      />
                      <span className="text-sm text-slate-300">months</span>
                      <span className="text-xs text-slate-500 ml-1">(max 12)</span>
                    </div>
                  </section>
                </div>

                <div className="space-y-4">
                  <FeatureHeader
                    icon={<Search size={16} className="text-white" />}
                    title="JIRA Field Mappings"
                    description="Map your JIRA custom fields to Uplift Forge fields."
                    color="bg-slate-500"
                  />
                  <section className={`bg-slate-500/10 p-4 rounded-lg border border-slate-500/20 ${!fieldsFetched ? 'opacity-60' : ''}`}>
                    {!fieldsFetched ? (
                      <p className="text-sm text-slate-500 italic py-2 text-center">Fetch fields above to configure.</p>
                    ) : (
                      <div className="space-y-3">
                        <FieldSelect fieldKey="tpd_bu" label="TPD Business Unit Field" />
                        <FieldSelect fieldKey="eng_hours" label="Engineering Hours Field" />
                        <FieldSelect fieldKey="work_stream" label="Work Stream Field" />
                        <FieldSelect fieldKey="story_points" label="Story Points Field" />
                      </div>
                    )}
                  </section>
                </div>

                <div className="space-y-4">
                  <FeatureHeader
                    icon={<Filter size={16} className="text-white" />}
                    title="Display Settings"
                    description="Configure how data is presented in the application."
                    color="bg-slate-600"
                  />
                  <section className="bg-slate-600/10 p-4 rounded-lg border border-slate-600/20">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={isMissingFieldsMode}
                          onChange={(e) => setConfig({
                            ...config,
                            ticket_filter: {
                              ...config.ticket_filter,
                              mode: e.target.checked ? 'missing_fields' : 'last_x_months'
                            }
                          })}
                        />
                        <div className="w-9 h-5 bg-slate-700 rounded-full peer-checked:bg-indigo-500 peer-checked:shadow-sm peer-checked:shadow-indigo-500/25 transition-colors" />
                        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-slate-300 rounded-full shadow-sm peer-checked:translate-x-4 peer-checked:bg-white transition-transform" />
                      </div>
                      <div>
                        <span className="text-sm text-slate-200 group-hover:text-slate-100">Show only tickets with missing fields by default</span>
                        <p className="text-xs text-slate-500 mt-0.5">Focus on tickets that need manual attribution.</p>
                      </div>
                    </label>
                  </section>
                </div>
              </div>
            )}

            {activeTab === 'metrics' && (
              <div className="space-y-8 animate-slide-up">
                <div className="space-y-4">
                  <FeatureHeader
                    icon={<TrendingUp size={16} className="text-white" />}
                    title="Performance Calibration"
                    description="Set benchmarks for story point estimation and man-hour calculations."
                    color="bg-cyan-500"
                  />
                  <section className="bg-cyan-500/10 p-4 rounded-lg border border-cyan-500/20">
                    <h3 className="text-xs font-semibold text-cyan-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                      <Calculator size={14} />
                      Story Point Calibration
                    </h3>
                    <p className="text-xs text-cyan-300/50 mb-3">
                      How many working days should an average engineer take to complete a 1 story point task?
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-300 whitespace-nowrap">1 Story Point =</span>
                      <input
                        type="number"
                        min="0.25"
                        max="20"
                        step="0.25"
                        className="bg-slate-700/60 border border-slate-600/60 text-slate-200 text-sm rounded-md w-24 px-2 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-400/50 tabular-nums text-center"
                        value={config.sp_to_days ?? 1}
                        onChange={(e) => setConfig({...config, sp_to_days: parseFloat(e.target.value) || 1})}
                      />
                      <span className="text-sm text-slate-300">man-day(s)</span>
                      <span className="text-xs text-slate-500 ml-2">= {((config.sp_to_days ?? 1) * 8).toFixed(0)}h per SP</span>
                    </div>
                  </section>
                </div>

                <div className="space-y-4">
                  <FeatureHeader
                    icon={<Users size={16} className="text-white" />}
                    title="Team Management"
                    description="Select which engineers to include in individual metrics dashboards."
                    color="bg-orange-500"
                  />
                  <section className="bg-orange-500/10 p-4 rounded-lg border border-orange-500/20">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-orange-300 uppercase tracking-wider flex items-center gap-2">
                        <Users size={14} />
                        Tracked Engineers
                      </h3>
                      <button
                        onClick={async () => {
                          if (!config?.project_key?.trim()) {
                            toast.error('Enter a Project Key first', { id: 'members-err' });
                            return;
                          }
                          setFetchingMembers(true);
                          try {
                            const res = await getJiraMembers();
                            if (res.data.error) {
                              toast.error('Failed to fetch members: ' + res.data.error, { id: 'members-err' });
                            } else {
                              setJiraMembers(res.data);
                              toast.success(`Found ${res.data.length} team members`, { id: 'members-ok' });
                            }
                          } catch {
                            toast.error('Failed to fetch JIRA members', { id: 'members-err' });
                          } finally {
                            setFetchingMembers(false);
                          }
                        }}
                        disabled={fetchingMembers || !config?.project_key?.trim()}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-300 hover:text-orange-200 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 px-3 py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Download size={13} className={fetchingMembers ? 'animate-pulse' : ''} />
                        {fetchingMembers ? 'Fetching...' : 'Fetch Members'}
                      </button>
                    </div>

                    {(config.tracked_engineers || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {(config.tracked_engineers || []).map((eng: any) => (
                          <span key={eng.accountId} className="bg-orange-500/15 border border-orange-500/30 text-orange-300 px-2 py-0.5 rounded text-xs flex items-center gap-1.5 group">
                            {eng.avatar && <img src={eng.avatar} alt="" className="w-4 h-4 rounded-full" />}
                            {eng.displayName}
                            <button
                              onClick={() => setConfig({
                                ...config,
                                tracked_engineers: (config.tracked_engineers || []).filter((e: any) => e.accountId !== eng.accountId)
                              })}
                              className="text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {jiraMembers.length > 0 ? (
                      <div className="max-h-52 overflow-y-auto rounded-md border border-slate-700/50 divide-y divide-slate-700/30">
                        {jiraMembers.filter(m => m.active).map((member: any) => {
                          const isTracked = (config.tracked_engineers || []).some((e: any) => e.accountId === member.accountId);
                          return (
                            <button
                              key={member.accountId}
                              onClick={() => {
                                if (isTracked) {
                                  setConfig({
                                    ...config,
                                    tracked_engineers: (config.tracked_engineers || []).filter((e: any) => e.accountId !== member.accountId)
                                  });
                                } else {
                                  setConfig({
                                    ...config,
                                    tracked_engineers: [...(config.tracked_engineers || []), {
                                      accountId: member.accountId,
                                      displayName: member.displayName,
                                      avatar: member.avatar,
                                    }]
                                  });
                                }
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                                isTracked
                                  ? 'bg-orange-500/10 text-orange-200'
                                  : 'hover:bg-slate-700/30 text-slate-300'
                              }`}
                            >
                              {member.avatar && <img src={member.avatar} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />}
                              <span className="text-sm flex-1 truncate">{member.displayName}</span>
                              {isTracked && <Check size={14} className="text-orange-400 flex-shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic text-center py-2">
                        {(config.tracked_engineers || []).length > 0
                          ? 'Click "Fetch Members" to modify the selection.'
                          : 'Sync tickets first, then click "Fetch Members" to see engineers.'}
                      </p>
                    )}
                  </section>
                </div>
              </div>
            )}

            {activeTab === 'attribution' && (
              <div className="space-y-8 animate-slide-up">
                {/* ═══════════════════════════════════════════════
                    MAPPING RULES
                    ═══════════════════════════════════════════════ */}
                <div className="space-y-4">
                  <FeatureHeader
                    icon={<BarChart3 size={16} className="text-white" />}
                    title="Automated Mapping Rules"
                    description="Define logic to automatically assign Business Units and Work Streams based on ticket metadata."
                    color="bg-violet-500"
                  />
                  <div className="space-y-6">
                    <RuleBuilder
                      title="TPD Business Unit Rules"
                      color="violet"
                      groups={config.mapping_rules?.tpd_bu || {}}
                      onChange={(groups) => updateMappingRules('tpd_bu', groups)}
                    />
                    <div className="border-t border-slate-700/20" />
                    <RuleBuilder
                      title="Work Stream Rules"
                      color="violet"
                      groups={config.mapping_rules?.work_stream || {}}
                      onChange={(groups) => updateMappingRules('work_stream', groups)}
                    />
                  </div>
                </div>

                <div className="border-t border-slate-700/20 my-4" />

                {/* ═══════════════════════════════════════════════
                    WORK CYCLE
                    ═══════════════════════════════════════════════ */}
                <div className="space-y-4">
                  <FeatureHeader
                    icon={<Clock size={16} className="text-white" />}
                    title="Work Cycle Definition"
                    description="Configure how engineering time is measured from JIRA transitions."
                    color="bg-emerald-500"
                  />
                  <section className={`bg-emerald-500/10 p-4 rounded-lg border border-emerald-500/20 ${!fieldsFetched ? 'opacity-60' : ''}`}>
                    {!fieldsFetched ? (
                      <p className="text-sm text-slate-500 italic py-4 text-center">Fetch fields in General tab to load available statuses.</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <StatusSelect
                            label="Start Status (clock starts)"
                            value={config.eng_start_status || ''}
                            onChange={(v) => setConfig({...config, eng_start_status: v})}
                          />
                          <StatusSelect
                            label="End Status (clock stops)"
                            value={config.eng_end_status || ''}
                            onChange={(v) => setConfig({...config, eng_end_status: v})}
                          />
                        </div>
                        <div className="mt-6">
                          <label className="block text-xs font-medium text-emerald-300/70 mb-2 uppercase tracking-wider">Excluded Statuses</label>
                          <p className="text-xs text-slate-500 mb-3">Time spent in these statuses is automatically subtracted from the total engineering hours.</p>
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {(config.eng_excluded_statuses || []).length === 0 && (
                              <span className="text-xs text-slate-500 italic">No statuses excluded yet.</span>
                            )}
                            {(config.eng_excluded_statuses || []).map((status: string) => (
                              <span key={status} className="bg-amber-500/15 border border-amber-500/30 text-amber-300 px-3 py-1 rounded-md text-xs flex items-center group">
                                {status}
                                <button
                                  onClick={() => setConfig({
                                    ...config,
                                    eng_excluded_statuses: (config.eng_excluded_statuses || []).filter((s: string) => s !== status)
                                  })}
                                  className="ml-2 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                          <select
                            className="bg-slate-700/60 border border-slate-600/60 text-slate-200 text-sm rounded-md w-full px-2 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400/50 cursor-pointer"
                            value=""
                            onChange={(e) => {
                              if (e.target.value && !(config.eng_excluded_statuses || []).includes(e.target.value)) {
                                setConfig({
                                  ...config,
                                  eng_excluded_statuses: [...(config.eng_excluded_statuses || []), e.target.value]
                                });
                              }
                            }}
                          >
                            <option value="">+ Add status to exclude...</option>
                            {jiraStatuses
                              .filter(s => !(config.eng_excluded_statuses || []).includes(s.name))
                              .map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                          </select>
                        </div>
                      </>
                    )}
                  </section>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-8 animate-slide-up">
                {/* AI-Powered Suggestions */}
                <div className="space-y-4">
                  <FeatureHeader
                    icon={<Sparkles size={16} className="text-white" />}
                    title="AI-Powered Suggestions"
                    description="Connect an AI provider to get actionable improvement suggestions for your KPI metrics."
                    color="bg-violet-500"
                  />

                  <section className="bg-violet-500/10 p-5 rounded-lg border border-violet-500/20">
                    {/* Provider toggle */}
                    <label className="block text-xs font-semibold text-violet-300 mb-2 uppercase tracking-wider">Provider</label>
                    <div className="flex gap-2 mb-4">
                      {(['openai', 'claude'] as AiProvider[]).map(p => (
                        <button
                          key={p}
                          onClick={() => setAiProvider(p)}
                          className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                            aiProvider === p
                              ? 'bg-violet-500/20 border-violet-500/40 text-violet-300 shadow-sm shadow-violet-500/15'
                              : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                          }`}
                        >
                          {p === 'openai' ? 'OpenAI' : 'Claude'}
                        </button>
                      ))}
                    </div>

                    {/* API Key input */}
                    <label className="block text-xs font-semibold text-violet-300 mb-2 uppercase tracking-wider">API Key</label>
                    <div className="flex gap-2 mb-4">
                      <div className="relative flex-1">
                        <input
                          type={aiShowKey ? 'text' : 'password'}
                          className="bg-slate-700/60 border border-slate-600/60 text-slate-100 text-sm rounded-md w-full px-3 py-2 pr-10 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400/50"
                          value={aiApiKey}
                          onChange={(e) => setAiApiKey(e.target.value)}
                          placeholder={aiHasKey ? '••••••••••••••••••••' : `Enter your ${aiProvider === 'openai' ? 'OpenAI' : 'Anthropic'} API key`}
                        />
                        <button
                          onClick={() => setAiShowKey(!aiShowKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          {aiShowKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={async () => {
                          if (!aiApiKey.trim()) {
                            toast.error('Please enter an API key');
                            return;
                          }
                          setAiSaving(true);
                          try {
                            await setAiConfig(aiProvider, aiApiKey);
                            setAiHasKey(true);
                            setAiApiKey('');
                            setAiShowKey(false);
                            toast.success('AI API key saved');
                          } catch {
                            toast.error('Failed to save API key');
                          } finally {
                            setAiSaving(false);
                          }
                        }}
                        disabled={aiSaving || !aiApiKey.trim()}
                        className="inline-flex items-center gap-2 bg-violet-500 hover:bg-violet-400 active:bg-violet-600 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm shadow-violet-500/20 transition-all disabled:opacity-50"
                      >
                        <Save size={14} />
                        {aiSaving ? 'Saving...' : 'Save Key'}
                      </button>

                      <button
                        onClick={async () => {
                          if (!aiHasKey) {
                            toast.error('Save an API key first');
                            return;
                          }
                          setAiTesting(true);
                          try {
                            const res = await testAiConnection();
                            const result = res.data as { success: boolean; error?: string };
                            if (result.success) {
                              toast.success('Connection successful!');
                            } else {
                              toast.error(result.error || 'Connection failed');
                            }
                          } catch {
                            toast.error('Connection test failed');
                          } finally {
                            setAiTesting(false);
                          }
                        }}
                        disabled={aiTesting || !aiHasKey}
                        className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium px-4 py-2 rounded-lg border border-slate-600/50 transition-all disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={aiTesting ? 'animate-spin' : ''} />
                        {aiTesting ? 'Testing...' : 'Test Connection'}
                      </button>

                      {aiHasKey && (
                        <button
                          onClick={async () => {
                            try {
                              await deleteAiConfig();
                              setAiHasKey(false);
                              setAiApiKey('');
                              toast.success('AI API key removed');
                            } catch {
                              toast.error('Failed to remove API key');
                            }
                          }}
                          className="inline-flex items-center gap-2 text-rose-400 hover:text-rose-300 text-sm font-medium px-3 py-2 rounded-lg hover:bg-rose-500/10 transition-all"
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Status indicator */}
                    {aiHasKey && (
                      <div className="mt-4 flex items-center gap-2 text-emerald-400/80 bg-emerald-500/5 border border-emerald-500/10 px-3 py-2 rounded-md w-fit">
                        <Check size={14} />
                        <span className="text-[11px] font-medium uppercase tracking-wider">
                          {aiProvider === 'openai' ? 'OpenAI' : 'Claude'} key configured
                        </span>
                      </div>
                    )}
                  </section>
                </div>

                <div className="space-y-4">
                  <FeatureHeader
                    icon={<Settings size={16} className="text-white" />}
                    title="Software Updates"
                    description="Keep Uplift Forge up to date with the latest features and security improvements."
                    color="bg-slate-700"
                  />

                  <section className="bg-slate-700/10 p-5 rounded-lg border border-slate-700/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-200">Current Version</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          You are currently running version <span className="font-mono text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">{updateInfo?.currentVersion || '1.0.0'}</span>
                        </p>
                      </div>
                      <button
                        onClick={handleCheckForUpdates}
                        disabled={checkingUpdates}
                        className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-slate-200 text-sm font-medium px-4 py-2 rounded-lg border border-slate-600/50 transition-all disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={checkingUpdates ? 'animate-spin' : ''} />
                        <span>{checkingUpdates ? 'Checking...' : 'Check for Updates'}</span>
                      </button>
                    </div>

                    {updateInfo?.updateAvailable && (
                      <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg animate-pulse-slow">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                            <Download size={20} className="text-indigo-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-indigo-300">New Update Available: v{updateInfo.latestVersion}</h4>
                            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                              {updateInfo.releaseNotes || 'Bug fixes and performance improvements.'}
                            </p>
                            <div className="flex gap-3 mt-4">
                              <button
                                onClick={handleDownload}
                                className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-4 py-2 rounded-md shadow-sm shadow-indigo-500/20 transition-all"
                              >
                                <Download size={14} />
                                Download & Install
                              </button>
                              {updateInfo.releaseUrl && (
                                <button
                                  onClick={() => window.api.openExternal(updateInfo.releaseUrl!)}
                                  className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium px-4 py-2 rounded-md border border-slate-700 transition-all"
                                >
                                  <ExternalLink size={14} />
                                  Release Notes
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {!updateInfo?.updateAvailable && !checkingUpdates && (
                      <div className="mt-6 flex items-center gap-2 text-emerald-400/80 bg-emerald-500/5 border border-emerald-500/10 px-3 py-2 rounded-md w-fit">
                        <Check size={14} />
                        <span className="text-[11px] font-medium uppercase tracking-wider">Uplift Forge is up to date</span>
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}
          </div>
        ) : loadError ? (
          <div className="flex flex-col justify-center items-center py-12 gap-3">
            <p className="text-sm text-rose-400">Failed to load configuration from backend.</p>
            <p className="text-xs text-slate-500">Check your connection and try again.</p>
            <button
              onClick={loadConfig}
              className="text-sm text-indigo-400 hover:text-indigo-300 underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-indigo-400"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfigPanel;
