import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, Plus, X, Save, Search, Calculator, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { getConfig, saveConfig, getJiraFields, getJiraStatuses } from '../api';

const ConfigPanel: React.FC<{ onConfigChange?: () => void }> = ({ onConfigChange }) => {
  const [config, setConfig] = useState<any>(null);
  const [jiraFields, setJiraFields] = useState<any[]>([]);
  const [jiraStatuses, setJiraStatuses] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingFields, setFetchingFields] = useState(false);
  const [fieldsFetched, setFieldsFetched] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
    if (!isOpen) {
      setFieldsFetched(false);
      setJiraFields([]);
      setJiraStatuses([]);
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      const res = await getConfig();
      setConfig(res.data);
    } catch (err) {
      console.error('Failed to load config', err);
    }
  };

  const handleFetchFields = async () => {
    if (!config?.project_key?.trim()) {
      toast.error('Please enter a JIRA Project Key first');
      return;
    }
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
      toast.success(`Loaded ${fieldsRes.data.length} fields and ${statusesRes.data.length} statuses`);
    } catch (err) {
      console.error('Failed to fetch JIRA fields/statuses', err);
      toast.error('Failed to fetch fields from JIRA');
    } finally {
      setFetchingFields(false);
    }
  };

  const handleAddKey = (type: 'tpd' | 'ws', group: string) => {
    const key = prompt('Enter JIRA Parent Key (e.g. ACTIN-123):');
    if (!key) return;

    const newConfig = { ...config };
    const mapping = type === 'tpd' ? newConfig.tpd_mapping : newConfig.work_stream_mapping;
    if (!mapping[group].includes(key)) {
      mapping[group].push(key);
      setConfig(newConfig);
    }
  };

  const handleRemoveKey = (type: 'tpd' | 'ws', group: string, key: string) => {
    const newConfig = { ...config };
    const mapping = type === 'tpd' ? newConfig.tpd_mapping : newConfig.work_stream_mapping;
    mapping[group] = mapping[group].filter((k: string) => k !== key);
    setConfig(newConfig);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await saveConfig({
        project_key: config.project_key,
        tpd_mapping: config.tpd_mapping,
        work_stream_mapping: config.work_stream_mapping,
        field_ids: config.field_ids,
        eng_start_status: config.eng_start_status,
        eng_end_status: config.eng_end_status
      });
      setIsOpen(false);
      toast.success('Configuration saved successfully!');
      if (onConfigChange) {
        onConfigChange();
      }
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
      field_ids: {
        ...config.field_ids,
        [key]: value
      }
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium py-2 px-4 rounded-lg border border-slate-600 transition-colors"
      >
        <Settings size={16} />
        <span>Configure</span>
      </button>
    );
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-start z-40 p-4 pt-8 overflow-y-auto">
      <div className="bg-slate-800 rounded-xl shadow-2xl shadow-black/40 border border-slate-700/50 w-full max-w-4xl flex flex-col my-4">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-100">Configure Mappings</h2>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {config ? (
            <>
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
                    <span>{fetchingFields ? 'Fetching...' : 'Fetch Fields'}</span>
                  </button>
                </div>
                <p className="mt-2 text-xs text-indigo-300/70">Enter your project key and click "Fetch Fields" to load available fields and statuses.</p>
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
                  <>
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
                    <p className="mt-3 text-xs text-slate-500 italic">Select the corresponding custom field for each value.</p>
                  </>
                )}
              </section>

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
                    <p className="mt-2 text-xs text-emerald-400/50 italic">Calculates time between the first transition TO these statuses.</p>
                  </>
                )}
              </section>

              {/* TPD Business Units */}
              <section>
                <h3 className="text-sm font-semibold text-indigo-300 mb-3 uppercase tracking-wider border-b border-slate-700/50 pb-2">
                  TPD Business Units
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(config.tpd_mapping).map(([bu, keys]: [string, any]) => (
                    <div key={bu} className="bg-slate-700/30 p-3 rounded-lg border border-slate-700/50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-200">{bu}</span>
                        <button onClick={() => handleAddKey('tpd', bu)} className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-400/10 p-0.5 rounded transition-colors">
                          <Plus size={16} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {keys.length === 0 && <span className="text-xs text-slate-500 italic">No keys mapped</span>}
                        {keys.map((key: string) => (
                          <span key={key} className="bg-slate-600/50 border border-slate-600/50 text-slate-300 px-2 py-0.5 rounded text-xs flex items-center group font-mono">
                            {key}
                            <button onClick={() => handleRemoveKey('tpd', bu, key)} className="ml-1 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Work Streams */}
              <section>
                <h3 className="text-sm font-semibold text-emerald-300 mb-3 uppercase tracking-wider border-b border-slate-700/50 pb-2">
                  Work Streams
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(config.work_stream_mapping).map(([ws, keys]: [string, any]) => (
                    <div key={ws} className="bg-slate-700/30 p-3 rounded-lg border border-slate-700/50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-200">{ws}</span>
                        <button onClick={() => handleAddKey('ws', ws)} className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10 p-0.5 rounded transition-colors">
                          <Plus size={16} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {keys.length === 0 && <span className="text-xs text-slate-500 italic">No keys mapped</span>}
                        {keys.map((key: string) => (
                          <span key={key} className="bg-slate-600/50 border border-slate-600/50 text-slate-300 px-2 py-0.5 rounded text-xs flex items-center group font-mono">
                            {key}
                            <button onClick={() => handleRemoveKey('ws', ws, key)} className="ml-1 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-indigo-400"></div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700/50 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700/50 border border-slate-600/50 rounded-md hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white text-sm font-medium px-5 py-2 rounded-md shadow-sm shadow-indigo-500/20 disabled:opacity-50 transition-all"
          >
            <Save size={16} />
            <span>{loading ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfigPanel;
