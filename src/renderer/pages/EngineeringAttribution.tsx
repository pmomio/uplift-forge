import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import TicketTable from '../components/TicketTable';
import TicketSummary from '../components/TicketSummary';
import { getTickets, triggerSync } from '../api';
import type { ProjectInfo } from '../App';

export type MissingFilter = 'tpd_bu' | 'eng_hours' | 'work_stream' | null;

interface EngineeringAttributionProps {
  refreshKey: number;
  project?: ProjectInfo | null;
}

const EngineeringAttribution: React.FC<EngineeringAttributionProps> = ({ refreshKey, project }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [missingFilter, setMissingFilter] = useState<MissingFilter>(null);

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
      await triggerSync();
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
  }, []);

  // On mount: load from cache only (no JIRA call)
  useEffect(() => {
    fetchTickets();
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
            {project?.name ? `${project.name} — Engineering Attribution` : 'Engineering Attribution'}
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
            <TicketTable tickets={tickets} onUpdate={fetchTickets} missingFilter={missingFilter} onClearFilter={() => setMissingFilter(null)} />
            <TicketSummary tickets={tickets} activeFilter={missingFilter} onFilterChange={setMissingFilter} />
          </>
        )}
      </div>
    </div>
  );
};

export default EngineeringAttribution;
