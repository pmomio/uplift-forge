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
  Calculator,
  User,
  Zap,
  Tag,
  Clock,
  History,
  Info,
  BarChart2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { updateTicket, syncOneTicket, calcTicketFields } from '../api';
import type { ProcessedTicket, MappingRules } from '../../shared/types';
import ModalDialog from './ModalDialog';

interface TicketTableProps {
  tickets: ProcessedTicket[];
  loading: boolean;
  onRefresh: () => void;
  activeFilter: string | null;
}

const COLUMN_LABELS: Record<string, string> = {
  key: 'Key',
  summary: 'Summary',
  assignee: 'Assignee',
  status: 'Status',
  tpd_bu: 'Business Unit',
  work_stream: 'Work Stream',
  story_points: 'SP',
};

const TicketTable: React.FC<TicketTableProps> = ({ tickets, loading, onRefresh, activeFilter }) => {
  const [searchTerm, setSearchSetTerm] = useState('');
  const [sortField, setSortField] = useState<keyof ProcessedTicket>('updated');
  const [sortOrder, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<ProcessedTicket>>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [calculatingKeys, setCalculatingKeys] = useState<Set<string>>(new Set());
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

      if (missingFilter === 'tpd_bu') return !t.tpd_bu;
      if (missingFilter === 'work_stream') return !t.work_stream;
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

  const handleFieldChange = (key: string, field: string, value: any) => {
    setPendingChanges(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }));
  };

  const handleSave = async (key: string) => {
    const changes = pendingChanges[key];
    if (!changes) {
      setEditingKey(null);
      return;
    }

    setSavingKeys(prev => new Set(prev).add(key));
    try {
      const ticket = tickets.find(t => t.key === key);
      const merged = { ...ticket, ...changes };
      
      // Map to JIRA payload
      const payload: any = {};
      if ('tpd_bu' in changes) payload.tpd_bu = changes.tpd_bu;
      if ('work_stream' in changes) payload.work_stream = changes.work_stream;
      
      await updateTicket(key, payload);
      
      // Update local state by refreshing
      onRefresh();
      
      const nextChanges = { ...pendingChanges };
      delete nextChanges[key];
      setPendingChanges(nextChanges);
      setEditingKey(null);
      toast.success(`${key} updated`);
    } catch (err) {
      console.error('Failed to save ticket', err);
      toast.error(`Failed to update ${key}`);
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleSyncOne = async (key: string) => {
    setCalculatingKeys(prev => new Set(prev).add(key));
    try {
      await syncOneTicket(key);
      onRefresh();
      toast.success(`${key} synced from JIRA`);
    } catch (err) {
      toast.error(`Sync failed for ${key}`);
    } finally {
      setCalculatingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleCalcFields = async (key: string) => {
    setCalculatingKeys(prev => new Set(prev).add(key));
    try {
      const res = await calcTicketFields(key);
      if (res.data.tpd_bu) handleFieldChange(key, 'tpd_bu', res.data.tpd_bu);
      if (res.data.work_stream) handleFieldChange(key, 'work_stream', res.data.work_stream);
      toast.success(`Inferred fields for ${key}`);
    } catch (err) {
      toast.error(`Calculation failed for ${key}`);
    } finally {
      setCalculatingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const cancelEdit = (key: string) => {
    const nextChanges = { ...pendingChanges };
    delete nextChanges[key];
    setPendingChanges(nextChanges);
    setEditingKey(null);
  };

  const exportCsv = () => {
    const headers = ['Key', 'Summary', 'Assignee', 'Status', 'Business Unit', 'Work Stream', 'Story Points'];
    const rows = filteredTickets.map(t => [
      t.key,
      `"${t.summary.replace(/"/g, '""')}"`,
      t.assignee,
      t.status,
      t.tpd_bu || '',
      t.work_stream || '',
      t.story_points || ''
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `engineering-attribution-${new Date().toISOString().split('T')[0]}.csv`);
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
              onClick={() => setMissingFilter('tpd_bu')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${missingFilter === 'tpd_bu' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Missing BU
            </button>
            <button 
              onClick={() => setMissingFilter('work_stream')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${missingFilter === 'work_stream' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Missing WS
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
                <th onClick={() => handleSort('summary')} className="w-96 px-4 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer group hover:text-indigo-400 transition-colors">
                  <div className="flex items-center gap-2">Summary {renderSortIcon('summary')}</div>
                </th>
                <th onClick={() => handleSort('assignee')} className="w-48 px-4 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer group hover:text-indigo-400 transition-colors">
                  <div className="flex items-center gap-2">Assignee {renderSortIcon('assignee')}</div>
                </th>
                <th onClick={() => handleSort('tpd_bu')} className="w-48 px-4 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer group hover:text-indigo-400 transition-colors">
                  <div className="flex items-center gap-2">Business Unit {renderSortIcon('tpd_bu')}</div>
                </th>
                <th onClick={() => handleSort('work_stream')} className="w-48 px-4 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer group hover:text-indigo-400 transition-colors">
                  <div className="flex items-center gap-2">Work Stream {renderSortIcon('work_stream')}</div>
                </th>
                <th onClick={() => handleSort('story_points')} className="w-20 px-4 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer group hover:text-indigo-400 transition-colors text-center">
                  <div className="flex items-center justify-center gap-2">SP {renderSortIcon('story_points')}</div>
                </th>
                <th className="w-24 px-4 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
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
                  const isEditing = editingKey === ticket.key;
                  const isSaving = savingKeys.has(ticket.key);
                  const isCalculating = calculatingKeys.has(ticket.key);
                  const currentValues = { ...ticket, ...(pendingChanges[ticket.key] || {}) };
                  const hasChanges = !!pendingChanges[ticket.key];

                  return (
                    <tr 
                      key={ticket.key} 
                      className={`group hover:bg-slate-700/30 transition-colors border-l-2 ${isEditing ? 'bg-indigo-500/5 border-indigo-500' : 'border-transparent'}`}
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
                            <span className="truncate max-w-[200px]">— {ticket.parent_summary}</span>
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
                      <td className="px-4 py-4 align-top">
                        {isEditing ? (
                          <input
                            type="text"
                            value={currentValues.tpd_bu || ''}
                            onChange={(e) => handleFieldChange(ticket.key, 'tpd_bu', e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                            placeholder="e.g. B2C"
                            autoFocus
                          />
                        ) : (
                          <div className={`text-sm ${ticket.tpd_bu ? 'text-slate-300' : 'text-rose-400/70 italic flex items-center gap-1.5'}`}>
                            {!ticket.tpd_bu && <AlertCircle size={12} />}
                            {ticket.tpd_bu || 'Unassigned BU'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top">
                        {isEditing ? (
                          <input
                            type="text"
                            value={currentValues.work_stream || ''}
                            onChange={(e) => handleFieldChange(ticket.key, 'work_stream', e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                            placeholder="e.g. Product"
                          />
                        ) : (
                          <div className={`text-sm ${ticket.work_stream ? 'text-slate-300' : 'text-rose-400/70 italic flex items-center gap-1.5'}`}>
                            {!ticket.work_stream && <AlertCircle size={12} />}
                            {ticket.work_stream || 'Unassigned WS'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top text-center">
                        <span className={`text-sm font-bold ${ticket.story_points ? 'text-slate-300' : 'text-slate-600'}`}>
                          {ticket.story_points ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSave(ticket.key)}
                                disabled={isSaving}
                                className="p-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg transition-all cursor-pointer shadow-sm"
                                title="Save changes"
                              >
                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                              </button>
                              <button
                                onClick={() => cancelEdit(ticket.key)}
                                className="p-1.5 bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white rounded-lg transition-all cursor-pointer"
                                title="Cancel"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button
                                onClick={() => setEditingKey(ticket.key)}
                                className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all cursor-pointer"
                                title="Edit attribution"
                              >
                                <MoreHorizontal size={16} />
                              </button>
                              <button
                                onClick={() => handleCalcFields(ticket.key)}
                                disabled={isCalculating}
                                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all cursor-pointer"
                                title="Run inference rules"
                              >
                                {isCalculating ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
                              </button>
                              <button
                                onClick={() => handleSyncOne(ticket.key)}
                                disabled={isCalculating}
                                className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all cursor-pointer"
                                title="Re-sync from JIRA"
                              >
                                <RefreshCw size={16} />
                              </button>
                            </div>
                          )}
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
            Only tickets in "Done" category are shown for attribution
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketTable;
