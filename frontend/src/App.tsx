import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import TicketTable from './components/TicketTable';
import TicketSummary from './components/TicketSummary';
import ConfigPanel from './components/ConfigPanel';
import { getTickets, triggerSync } from './api';

export type MissingFilter = 'tpd_bu' | 'eng_hours' | 'work_stream' | null;

function App() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [missingFilter, setMissingFilter] = useState<MissingFilter>(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await getTickets();
      setTickets(response.data);
    } catch (error) {
      console.error('Failed to fetch tickets', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    try {
      await triggerSync();
      await fetchTickets();
      setLastSynced(new Date().toLocaleTimeString());
      toast.success(`Synced ${tickets.length} tickets`);
    } catch (error) {
      console.error('Sync failed', error);
      toast.error('Sync failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Always sync from JIRA on dashboard load
    const initialSync = async () => {
      setLoading(true);
      try {
        await triggerSync();
        const response = await getTickets();
        setTickets(response.data);
        setLastSynced(new Date().toLocaleTimeString());
      } catch (error) {
        console.error('Initial sync failed', error);
      } finally {
        setLoading(false);
      }
    };
    initialSync();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Toast bar */}
      <div className="sticky top-0 z-50 pt-3">
        <Toaster
          position="top-center"
          containerStyle={{ position: 'relative', top: 0, inset: 'unset' }}
          toastOptions={{
            duration: 3000,
            style: { borderRadius: '10px', fontSize: '13px', fontWeight: 500 },
            success: { style: { background: '#065f46', color: '#d1fae5', border: '1px solid #047857' } },
            error: { style: { background: '#7f1d1d', color: '#fecaca', border: '1px solid #991b1b' } },
          }}
        />
      </div>

      {/* Header */}
      <header className="bg-slate-800/60 backdrop-blur-sm border-b border-slate-700/50 sticky top-0">
        <div className="px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-slate-100 tracking-tight">
              Uplift Forge
            </h1>
            {lastSynced && (
              <p className="text-xs text-slate-400 mt-0.5">Last synced at {lastSynced}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ConfigPanel onConfigChange={fetchTickets} />
            <button
              onClick={handleSync}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-md shadow-indigo-500/20 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
              <span>Sync Now</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {loading && tickets.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-64 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-600 border-t-indigo-400"></div>
            <p className="text-sm text-slate-400">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-64 gap-2">
            <p className="text-slate-300 font-medium">No tickets found</p>
            <p className="text-sm text-slate-500">Click "Sync Now" to fetch tickets from JIRA</p>
          </div>
        ) : (
          <>
            <TicketTable tickets={tickets} onUpdate={fetchTickets} missingFilter={missingFilter} onClearFilter={() => setMissingFilter(null)} />
            <TicketSummary tickets={tickets} activeFilter={missingFilter} onFilterChange={setMissingFilter} />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
