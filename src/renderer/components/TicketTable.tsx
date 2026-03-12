import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, 
  ExternalLink, 
  Save, 
  RefreshCw, 
  Filter, 
  Download, 
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  User,
  Zap,
  Tag,
  Clock,
  History,
  Info,
  BarChart2,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { updateTicket, syncOneTicket } from '../api';
import type { ProcessedTicket } from '../../shared/types';

interface TicketTableProps {
  tickets: ProcessedTicket[];
  loading: boolean;
  onRefresh: () => void;
  activeFilter: string | null;
}

const TicketTable: React.FC<TicketTableProps> = ({ tickets, loading, onRefresh, activeFilter }) => {
  const [searchTerm, setSearchSetTerm] = useState('');
  const [sortField, setSortField] = useState<keyof ProcessedTicket>('updated');
  const [sortOrder, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [missingFilter, setMissingFilter] = useState<string | null>(activeFilter);

  useEffect(() => {
    setMissingFilter(activeFilter);
  }, [activeFilter]);

  const handleSort = (field: keyof ProcessedTicket) => {
    if (sortField === field) {
      setSortDirection(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesSearch = 
        t.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.assignee.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      if (missingFilter === 'story_points') return t.story_points == null;
      
      return true;
    }).sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null) return sortOrder === 'asc' ? -1 : 1;
      if (bVal == null) return sortOrder === 'asc' ? 1 : -1;
      
      const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [tickets, searchTerm, sortField, sortOrder, missingFilter]);

  const handleSyncOne = async (key: string) => {
    try {
      await syncOneTicket(key);
      onRefresh();
      toast.success(`${key} synced from JIRA`);
    } catch (err) {
      toast.error(`Sync failed for ${key}`);
    }
  };

  const exportCsv = () => {
    const headers = ['Key', 'Summary', 'Assignee', 'Status', 'Story Points'];
    const rows = filteredTickets.map(t => [
      t.key,
      `"${t.summary.replace(/"/g, '""')}"`,
      t.assignee,
      t.status,
      t.story_points || ''
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `tickets-${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const renderSortIcon = (field: keyof ProcessedTicket) => {
    if (sortField !== field) return <MoreHorizontal size={14} className="opacity-0 group-hover:opacity-50" />;
    return sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search key, summary, or engineer..."
            value={searchTerm}
            onChange={(e) => setSearchSetTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
            <button 
              onClick={() => setMissingFilter(null)}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${!missingFilter ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              All
            </button>
            <button 
              onClick={() => setMissingFilter('story_points')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${missingFilter === 'story_points' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Missing SP
            </button>
          </div>

          <div className="h-8 w-px bg-slate-700 mx-1 hidden md:block"></div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg transition-all text-sm font-medium disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
            {loading ? 'Syncing...' : 'Sync Cloud'}
          </button>

          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg transition-all text-sm font-medium cursor-pointer"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl flex flex-col">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="sticky top-0 z-20 bg-slate-800 border-b border-slate-700 shadow-sm">
              <tr>
                <th onClick={() => handleSort('key')} className="w-32 px-4 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer group hover:text-indigo-400 transition-colors">
                  <div className="flex items-center gap-2">Key {renderSortIcon('key')}</div>
                </th>
                <th onClick={() => handleSort('summary')} className="w-full px-4 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer group hover:text-indigo-400 transition-colors">
                  <div className="flex items-center gap-2">Summary {renderSortIcon('summary')}</div>
                </th>
                <th onClick={() => handleSort('assignee')} className="w-48 px-4 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer group hover:text-indigo-400 transition-colors">
                  <div className="flex items-center gap-2">Assignee {renderSortIcon('assignee')}</div>
                </th>
                <th onClick={() => handleSort('story_points')} className="w-24 px-4 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer group hover:text-indigo-400 transition-colors text-center">
                  <div className="flex items-center justify-center gap-2">SP {renderSortIcon('story_points')}</div>
                </th>
                <th className="w-24 px-4 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-600">
                        <Filter size={32} />
                      </div>
                      <div className="text-slate-400 font-medium">No tickets found matching your criteria</div>
                      <button onClick={() => { setSearchSetTerm(''); setMissingFilter(null); }} className="text-indigo-400 hover:underline text-sm cursor-pointer">Clear all filters</button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => {
                  return (
                    <tr 
                      key={ticket.key} 
                      className="group hover:bg-slate-700/30 transition-colors border-l-2 border-transparent"
                    >
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-400 group-hover:text-indigo-300 transition-colors">{ticket.key}</span>
                          <button
                            onClick={() => window.api.openExternal(`${ticket.base_url}/browse/${ticket.key}`)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300 transition-all cursor-pointer"
                            title="Open in JIRA"
                          >
                            <ExternalLink size={12} />
                          </button>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter ${
                            ticket.priority === 'Highest' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                            ticket.priority === 'High' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                            'bg-slate-700/50 text-slate-400'
                          }`}>
                            {ticket.priority}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 uppercase font-bold tracking-tighter">
                            {ticket.issue_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="text-sm font-medium text-slate-200 line-clamp-2 leading-relaxed" title={ticket.summary}>
                          {ticket.summary}
                        </div>
                        {ticket.parent_key && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                            <Tag size={10} className="text-slate-600" />
                            <span className="text-slate-600">Epic:</span>
                            <span className="text-indigo-400/70 hover:underline cursor-pointer" onClick={() => window.api.openExternal(`${ticket.base_url}/browse/${ticket.parent_key}`)}>
                              {ticket.parent_key}
                            </span>
                            <span className="truncate max-w-[200px]"> — {ticket.parent_summary}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0 overflow-hidden">
                            <User size={12} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm text-slate-300 truncate font-medium">{ticket.assignee}</div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                              <History size={10} />
                              {ticket.resolved ? new Date(ticket.resolved).toLocaleDateString() : 'Unresolved'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-center">
                        <span className={`text-sm font-bold ${ticket.story_points ? 'text-slate-300' : 'text-slate-600'}`}>
                          {ticket.story_points ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-center">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => handleSyncOne(ticket.key)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all cursor-pointer"
                            title="Re-sync from JIRA"
                          >
                            <RefreshCw size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        <div className="bg-slate-800/80 border-t border-slate-700 px-6 py-3 flex items-center justify-between text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <BarChart2 size={14} />
              Showing {filteredTickets.length} of {tickets.length} tickets
            </span>
            {missingFilter && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                <Filter size={10} />
                Filtering: {missingFilter.replace('_', ' ').toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Info size={14} />
            Only resolved tickets are shown
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketTable;
