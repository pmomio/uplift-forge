import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import TicketTable from '../components/TicketTable';
import TicketSummary from '../components/TicketSummary';
import { getTickets, triggerSync, syncAllProjects, getConfig, getJiraFieldOptions } from '../api';
import type { ProjectInfo } from '../App';
import type { Persona, MappingRules } from '../../shared/types';

export type MissingFilter = 'tpd_bu' | 'eng_hours' | 'work_stream' | null;

interface EngineeringAttributionProps {
  refreshKey: number;
  project?: ProjectInfo | null;
  persona?: Persona;
  projectCount?: number;
}

const EngineeringAttribution: React.FC<EngineeringAttributionProps> = ({ refreshKey, project, persona, projectCount }) => {
  const isMultiProject = (persona === 'engineering_manager' || persona === 'management') && (projectCount ?? 1) > 1;
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [missingFilter, setMissingFilter] = useState<MissingFilter>(null);
  const [statusConfig, setStatusConfig] = useState<{ done: string[]; blocked: string[] }>({ done: [], blocked: [] });
  const [mappingRules, setMappingRules] = useState<MappingRules>({ tpd_bu: {}, work_stream: {} });
  const [tpdBuOptions, setTpdBuOptions] = useState<string[]>([]);
  const [workStreamOptions, setWorkStreamOptions] = useState<string[]>([]);

  // Load tickets from backend cache (fast, no JIRA call)
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getTickets();
      setTickets(response.data);
    } catch (error) {
      console.error('Failed to fetch tickets', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Full sync: fetch from JIRA, refresh cache, then load
  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      if (isMultiProject) {
        await syncAllProjects();
      } else {
        await triggerSync();
      }
      const response = await getTickets();
      setTickets(response.data);
      setLastSynced(new Date().toLocaleTimeString());
      toast.success(`Synced ${response.data.length} tickets`);
    } catch (error) {
      console.error('Sync failed', error);
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [isMultiProject]);

  // On mount: load from cache and fetch config + field options
  useEffect(() => {
    fetchTickets();
    getConfig().then(res => {
      const cfg = res.data;
      setStatusConfig({ done: cfg.done_statuses ?? [], blocked: cfg.blocked_statuses ?? [] });
      setMappingRules(cfg.mapping_rules ?? { tpd_bu: {}, work_stream: {} });

      // Fetch JIRA field options for TPD BU and Work Stream dropdowns
      const tpdBuFieldId = cfg.field_ids?.tpd_bu;
      const workStreamFieldId = cfg.field_ids?.work_stream;
      if (tpdBuFieldId) {
        getJiraFieldOptions(tpdBuFieldId)
          .then(r => setTpdBuOptions(r.data.map((o: { value: string }) => o.value)))
          .catch(() => {});
      }
      if (workStreamFieldId) {
        getJiraFieldOptions(workStreamFieldId)
          .then(r => setWorkStreamOptions(r.data.map((o: { value: string }) => o.value)))
          .catch(() => {});
      }
    }).catch(() => {});
  }, [fetchTickets]);

  // When config is saved (refreshKey changes): full sync
  useEffect(() => {
    if (refreshKey > 0) {
      handleSync();
    }
  }, [refreshKey, handleSync]);

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">
            {isMultiProject ? 'All Projects — Engineering Attribution' : project?.name ? `${project.name} — Engineering Attribution` : 'Engineering Attribution'}
          </h1>
          {lastSynced && (
            <p className="text-xs text-slate-400 mt-0.5">Last synced at {lastSynced}</p>
          )}
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-md shadow-indigo-500/20 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={syncing ? 'animate-spin' : ''} size={16} />
          <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && tickets.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-64 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-600 border-t-indigo-400"></div>
            <p className="text-sm text-slate-400">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-64 gap-2">
            <p className="text-slate-300 font-medium">No tickets in cache</p>
            <p className="text-sm text-slate-500">Click "Sync Now" to fetch tickets from JIRA, or go to Settings to set up your project.</p>
          </div>
        ) : (
          <>
            <TicketTable tickets={tickets} onUpdate={fetchTickets} missingFilter={missingFilter} onClearFilter={() => setMissingFilter(null)} statusConfig={statusConfig} mappingRules={mappingRules} tpdBuOptions={tpdBuOptions} workStreamOptions={workStreamOptions} />
            <TicketSummary tickets={tickets} activeFilter={missingFilter} onFilterChange={setMissingFilter} statusConfig={statusConfig} />
          </>
        )}
      </div>
    </div>
  );
};

export default EngineeringAttribution;
