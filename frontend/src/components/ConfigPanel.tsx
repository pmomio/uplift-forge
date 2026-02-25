import React, { useState, useEffect } from 'react';
import { Save, Search, Calculator, Download, Filter, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getConfig, saveConfig, getJiraFields, getJiraStatuses } from '../api';
import RuleBuilder from './RuleBuilder';

interface ConfigPanelProps {
  onConfigSaved?: () => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ onConfigSaved }) => {
  const [config, setConfig] = useState<any>(null);
  const [jiraFields, setJiraFields] = useState<any[]>([]);
  const [jiraStatuses, setJiraStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [fetchingFields, setFetchingFields] = useState(false);
  const [fieldsFetched, setFieldsFetched] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

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
        ticket_filter: config.ticket_filter || { mode: 'all', months: 3 },
        mapping_rules: config.mapping_rules || { tpd_bu: {}, work_stream: {} }
      });
      if (result.data.sync_triggered) {
        toast.success(`Config saved — synced ${result.data.ticket_count} tickets`);
      } else {
        toast.success(`Config saved — ${result.data.ticket_count} tickets`);
      }
      if (onConfigSaved) onConfigSaved();
    } catch (err) {
      console.error('Failed to save config', err);
      toast.error('Failed to save configuration');
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

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center flex-shrink-0">
        <h1 className="text-lg font-semibold text-slate-100">Configuration</h1>
        <button
          onClick={handleSave}
          disabled={loading || !config}
          className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white text-sm font-medium px-5 py-2 rounded-lg shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all"
        >
          <Save size={16} />
          <span>{loading ? 'Saving...' : 'Save Configuration'}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {config ? (
          <div className="max-w-4xl space-y-6">
            {/* Project Key */}
            <section className="bg-indigo-500/10 p-4 rounded-lg border border-indigo-500/20">
              <label className="block text-xs font-semibold text-indigo-300 mb-2 uppercase tracking-wider">
                JIRA Project Key
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

            {/* Ticket Filter */}
            <section className="bg-sky-500/8 p-4 rounded-lg border border-sky-500/20">
              <h3 className="text-sm font-semibold text-sky-300 mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Filter size={16} />
                Ticket Filter
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-sky-300/70 mb-1">Filter Mode</label>
                  <select
                    className="bg-slate-700/60 border border-slate-600/60 text-slate-200 text-sm rounded-md w-full px-2 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400/50 cursor-pointer"
                    value={config.ticket_filter?.mode || 'all'}
                    onChange={(e) => setConfig({
                      ...config,
                      ticket_filter: { ...config.ticket_filter, mode: e.target.value }
                    })}
                  >
                    <option value="all">All Tickets</option>
                    <option value="last_x_months">Last X Months</option>
                    <option value="missing_fields">Missing Required Fields</option>
                  </select>
                </div>
                {config.ticket_filter?.mode === 'last_x_months' && (
                  <div>
                    <label className="block text-xs font-medium text-sky-300/70 mb-1">Months</label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      className="bg-slate-700/60 border border-slate-600/60 text-slate-200 text-sm rounded-md w-full px-2 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400/50 tabular-nums"
                      value={config.ticket_filter?.months || 3}
                      onChange={(e) => setConfig({
                        ...config,
                        ticket_filter: { ...config.ticket_filter, months: parseInt(e.target.value) || 3 }
                      })}
                    />
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-sky-400/50 italic">
                {config.ticket_filter?.mode === 'all' && 'Shows all completed tickets from the project.'}
                {config.ticket_filter?.mode === 'last_x_months' && `Only fetches tickets resolved/completed in the last ${config.ticket_filter?.months || 3} month(s) from JIRA.`}
                {config.ticket_filter?.mode === 'missing_fields' && 'Shows only tickets that are missing TPD BU, Eng Hours, or Work Stream.'}
              </p>
            </section>

            {/* Field ID Mappings */}
            <section className={`bg-slate-700/30 p-4 rounded-lg border border-slate-700/50 ${!fieldsFetched ? 'opacity-60' : ''}`}>
              <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Search size={16} className="text-slate-400" />
                JIRA Field ID Mappings
              </h3>
              {!fieldsFetched ? (
                <p className="text-sm text-slate-500 italic py-4 text-center">Click "Fetch Fields" above to load available JIRA fields.</p>
              ) : (
                <div className="space-y-3">
                  {[
                    { key: 'tpd_bu', label: 'TPD Business Unit Field' },
                    { key: 'eng_hours', label: 'Engineering Hours Field' },
                    { key: 'work_stream', label: 'Work Stream Field' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
                      <select
                        className="bg-slate-700/60 border border-slate-600/60 text-slate-200 text-sm rounded-md w-full px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400/50 cursor-pointer"
                        value={config.field_ids?.[key] || ''}
                        onChange={(e) => updateFieldId(key, e.target.value)}
                      >
                        <option value="">Select JIRA Field...</option>
                        {jiraFields.map(f => <option key={f.id} value={f.id}>{f.name} ({f.id})</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* TPD Business Unit Rules */}
            <RuleBuilder
              title="TPD Business Unit Rules"
              color="indigo"
              groups={config.mapping_rules?.tpd_bu || {}}
              onChange={(groups) => updateMappingRules('tpd_bu', groups)}
            />

            {/* Work Stream Rules */}
            <RuleBuilder
              title="Work Stream Rules"
              color="emerald"
              groups={config.mapping_rules?.work_stream || {}}
              onChange={(groups) => updateMappingRules('work_stream', groups)}
            />

            {/* Engineering Hours Statuses */}
            <section className={`bg-emerald-500/8 p-4 rounded-lg border border-emerald-500/20 ${!fieldsFetched ? 'opacity-60' : ''}`}>
              <h3 className="text-sm font-semibold text-emerald-300 mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Calculator size={16} />
                Engineering Hours Calculation
              </h3>
              {!fieldsFetched ? (
                <p className="text-sm text-slate-500 italic py-4 text-center">Click "Fetch Fields" above to load available statuses.</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-emerald-300/70 mb-1">Start Status</label>
                      <select
                        className="bg-slate-700/60 border border-slate-600/60 text-slate-200 text-sm rounded-md w-full px-2 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400/50 cursor-pointer"
                        value={config.eng_start_status || ''}
                        onChange={(e) => setConfig({...config, eng_start_status: e.target.value})}
                      >
                        <option value="">Select Status...</option>
                        {jiraStatuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-emerald-300/70 mb-1">End Status</label>
                      <select
                        className="bg-slate-700/60 border border-slate-600/60 text-slate-200 text-sm rounded-md w-full px-2 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400/50 cursor-pointer"
                        value={config.eng_end_status || ''}
                        onChange={(e) => setConfig({...config, eng_end_status: e.target.value})}
                      >
                        <option value="">Select Status...</option>
                        {jiraStatuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-emerald-300/70 mb-2">Excluded Statuses (time in these statuses is not counted)</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(config.eng_excluded_statuses || []).length === 0 && (
                        <span className="text-xs text-slate-500 italic">No excluded statuses</span>
                      )}
                      {(config.eng_excluded_statuses || []).map((status: string) => (
                        <span key={status} className="bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded text-xs flex items-center group">
                          {status}
                          <button
                            onClick={() => setConfig({
                              ...config,
                              eng_excluded_statuses: (config.eng_excluded_statuses || []).filter((s: string) => s !== status)
                            })}
                            className="ml-1 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={11} />
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
                      <option value="">Add excluded status...</option>
                      {jiraStatuses
                        .filter(s => !(config.eng_excluded_statuses || []).includes(s.name))
                        .map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                </>
              )}
            </section>
          </div>
        ) : loadError ? (
          <div className="flex flex-col justify-center items-center py-12 gap-3">
            <p className="text-sm text-rose-400">Failed to load configuration from backend.</p>
            <p className="text-xs text-slate-500">Make sure the backend is running on port 8000.</p>
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
