import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Save, ExternalLink, RefreshCw, Calculator, ArrowUp, ArrowDown, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { updateTicket, syncSingleTicket, calculateHours, calculateFields } from '../api';
import type { MissingFilter } from '../pages/EngineeringAttribution';

type SortDirection = 'asc' | 'desc';
interface SortState {
  column: string | null;
  direction: SortDirection;
}

interface Ticket {
  key: string;
  summary: string;
  status: string;
  assignee: string;
  eng_hours: number | null;
  tpd_bu: string | null;
  work_stream: string | null;
  has_computed_values: boolean;
  base_url: string;
}

interface TicketTableProps {
  tickets: Ticket[];
  onUpdate: () => void;
  missingFilter: MissingFilter;
  onClearFilter: () => void;
}

const statusColors: Record<string, string> = {
  'Done': 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  'Closed': 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  'Resolved': 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  'Rejected': 'bg-rose-500/15 text-rose-300 ring-rose-400/30',
  'Cancelled': 'bg-rose-500/15 text-rose-300 ring-rose-400/30',
};
const defaultStatusColor = 'bg-sky-500/15 text-sky-300 ring-sky-400/30';

const filterLabels: Record<string, string> = {
  tpd_bu: 'TPD BU',
  eng_hours: 'Eng Hours',
  work_stream: 'Work Stream',
};

const TicketTable: React.FC<TicketTableProps> = ({ tickets, onUpdate, missingFilter, onClearFilter }) => {
  const [editing, setEditing] = useState<Record<string, Partial<Ticket>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [syncingRow, setSyncingRow] = useState<string | null>(null);
  const [calculating, setCalculating] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const SORT_STORAGE_KEY = 'uplift-forge-sort';

  const [sort, setSort] = useState<SortState>(() => {
    try {
      const stored = localStorage.getItem(SORT_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return { column: null, direction: 'asc' };
  });

  useEffect(() => {
    try {
      localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sort));
    } catch {}
  }, [sort]);

  const handleSort = useCallback((column: string) => {
    setSort(prev => {
      if (prev.column === column) {
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column, direction: 'asc' };
    });
    setCurrentPage(1);
  }, []);

  const resetSort = useCallback(() => {
    setSort({ column: null, direction: 'asc' });
    setCurrentPage(1);
  }, []);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [missingFilter]);

  const filteredTickets = useMemo(() => {
    if (!missingFilter) return tickets;
    return tickets.filter(t => {
      if (missingFilter === 'tpd_bu') return !t.tpd_bu;
      if (missingFilter === 'eng_hours') return t.eng_hours == null;
      if (missingFilter === 'work_stream') return !t.work_stream;
      return true;
    });
  }, [tickets, missingFilter]);

  const sortedTickets = useMemo(() => {
    if (!sort.column) return filteredTickets;
    return [...filteredTickets].sort((a, b) => {
      const col = sort.column as keyof Ticket;
      let aVal = a[col];
      let bVal = b[col];
      // Nulls/empty always sort last
      if (aVal == null || aVal === '') return 1;
      if (bVal == null || bVal === '') return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const cmp = aStr.localeCompare(bStr);
      return sort.direction === 'asc' ? cmp : -cmp;
    });
  }, [filteredTickets, sort]);

  const totalPages = Math.ceil(sortedTickets.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTickets = sortedTickets.slice(startIndex, startIndex + pageSize);

  const handleFieldChange = (key: string, field: string, value: any) => {
    setEditing(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [field]: value }
    }));
  };

  const handleSave = async (key: string) => {
    if (saving) return;
    setSaving(key);
    try {
      const ticket = tickets.find(t => t.key === key);
      const merged = { ...ticket, ...(editing[key] || {}) };
      const payload: Record<string, any> = {};
      if (merged.tpd_bu) payload.tpd_bu = merged.tpd_bu;
      if (merged.eng_hours != null) payload.eng_hours = merged.eng_hours;
      if (merged.work_stream) payload.work_stream = merged.work_stream;
      await updateTicket(key, payload);
      toast.success(`Saved ${key} to JIRA`, { id: `save-${key}` });
      const newEditing = { ...editing };
      delete newEditing[key];
      setEditing(newEditing);
      onUpdate();
    } catch (error: any) {
      console.error('Failed to save ticket', error);
      const detail = error?.response?.data?.detail || error.message || 'Unknown error';
      toast.error(`Failed to save ticket: ${detail}`, { id: `save-err-${key}` });
    } finally {
      setSaving(null);
    }
  };

  const handleCalculateHours = async (key: string) => {
    setCalculating(prev => ({ ...prev, [`${key}:hours`]: true }));
    try {
      const res = await calculateHours(key);
      if (res.data.hours !== null) {
        handleFieldChange(key, 'eng_hours', res.data.hours);
      } else {
        toast.error('Could not calculate hours (no matching status transitions found)', { id: `calc-hours-${key}` });
      }
    } catch (error) {
      console.error('Failed to calculate hours', error);
      toast.error('Failed to calculate hours', { id: `calc-hours-err-${key}` });
    } finally {
      setCalculating(prev => ({ ...prev, [`${key}:hours`]: false }));
    }
  };

  const handleCalculateFields = async (key: string, field: 'tpd_bu' | 'work_stream') => {
    setCalculating(prev => ({ ...prev, [`${key}:${field}`]: true }));
    try {
      const res = await calculateFields(key);
      const value = res.data[field];
      if (value) {
        handleFieldChange(key, field, value);
      } else {
        toast.error(`Could not compute ${field === 'tpd_bu' ? 'TPD BU' : 'Work Stream'} (no parent mapping found)`, { id: `calc-${field}-${key}` });
      }
    } catch (error) {
      console.error(`Failed to calculate ${field}`, error);
      toast.error(`Failed to calculate ${field === 'tpd_bu' ? 'TPD BU' : 'Work Stream'}`, { id: `calc-${field}-err-${key}` });
    } finally {
      setCalculating(prev => ({ ...prev, [`${key}:${field}`]: false }));
    }
  };

  const handleSyncSingle = async (key: string) => {
    setSyncingRow(key);
    try {
      await syncSingleTicket(key);
      onUpdate();
    } catch (error) {
      console.error('Failed to sync ticket', error);
      toast.error('Sync failed for ticket ' + key, { id: `sync-err-${key}` });
    } finally {
      setSyncingRow(null);
    }
  };

  const [calcAllRunning, setCalcAllRunning] = useState(false);
  const [calcAllProgress, setCalcAllProgress] = useState({ done: 0, total: 0 });

  const handleCalculateAll = async () => {
    const targets = paginatedTickets;
    if (targets.length === 0) return;
    setCalcAllRunning(true);
    setCalcAllProgress({ done: 0, total: targets.length });

    for (let i = 0; i < targets.length; i++) {
      const ticket = targets[i];
      const key = ticket.key;
      try {
        const [hoursRes, fieldsRes] = await Promise.all([
          calculateHours(key).catch(() => null),
          calculateFields(key).catch(() => null),
        ]);
        if (hoursRes?.data?.hours != null) {
          handleFieldChange(key, 'eng_hours', hoursRes.data.hours);
        }
        if (fieldsRes?.data?.tpd_bu) {
          handleFieldChange(key, 'tpd_bu', fieldsRes.data.tpd_bu);
        }
        if (fieldsRes?.data?.work_stream) {
          handleFieldChange(key, 'work_stream', fieldsRes.data.work_stream);
        }
      } catch {
        // Silently keep previous values
      }
      setCalcAllProgress({ done: i + 1, total: targets.length });
    }

    setCalcAllRunning(false);
    toast.success(`Calculated ${targets.length} tickets`, { id: 'calc-all' });
  };

  const [saveAllRunning, setSaveAllRunning] = useState(false);
  const [saveAllProgress, setSaveAllProgress] = useState({ done: 0, total: 0 });

  const dirtyKeys = paginatedTickets.filter(t => editing[t.key] || t.has_computed_values).map(t => t.key);

  const handleSaveAll = async () => {
    if (dirtyKeys.length === 0) return;
    const keysToSave = [...dirtyKeys];
    setSaveAllRunning(true);
    setSaveAllProgress({ done: 0, total: keysToSave.length });
    let saved = 0;
    let failed = 0;
    const savedKeys: string[] = [];

    for (let i = 0; i < keysToSave.length; i++) {
      const key = keysToSave[i];
      try {
        const ticket = tickets.find(t => t.key === key);
        const merged = { ...ticket, ...(editing[key] || {}) };
        const payload: Record<string, any> = {};
        if (merged.tpd_bu) payload.tpd_bu = merged.tpd_bu;
        if (merged.eng_hours != null) payload.eng_hours = merged.eng_hours;
        if (merged.work_stream) payload.work_stream = merged.work_stream;
        await updateTicket(key, payload);
        savedKeys.push(key);
        saved++;
      } catch {
        failed++;
      }
      setSaveAllProgress({ done: i + 1, total: keysToSave.length });
    }

    // Batch-clear all saved keys from editing state
    setEditing(prev => {
      const next = { ...prev };
      for (const key of savedKeys) delete next[key];
      return next;
    });

    setSaveAllRunning(false);
    if (failed === 0) {
      toast.success(`Saved ${saved} tickets to JIRA`, { id: 'save-all' });
    } else {
      toast.error(`Saved ${saved}, failed ${failed}`, { id: 'save-all' });
    }
    onUpdate();
  };

  const CalcButton = ({ onClick, loading, title }: { onClick: () => void; loading: boolean; title: string }) => (
    <button
      onClick={onClick}
      disabled={loading}
      className="text-slate-500 hover:text-amber-400 hover:bg-amber-400/10 p-1 rounded-md transition-colors flex-shrink-0"
      title={title}
    >
      <Calculator size={14} className={loading ? 'animate-pulse' : ''} />
    </button>
  );

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden shadow-xl shadow-black/20">
      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-slate-700/40 flex items-center justify-between bg-slate-800/60">
        <span className="text-xs text-slate-500">
          {sortedTickets.length} ticket{sortedTickets.length !== 1 ? 's' : ''}
          {missingFilter && ` (filtered from ${tickets.length})`}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCalculateAll}
            disabled={calcAllRunning || saveAllRunning || paginatedTickets.length === 0}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-3 py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Calculate eng hours, TPD BU, and work stream for all tickets on this page"
          >
            <Calculator size={13} className={calcAllRunning ? 'animate-pulse' : ''} />
            {calcAllRunning
              ? `Calculating ${calcAllProgress.done}/${calcAllProgress.total}...`
              : 'Calculate All'}
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saveAllRunning || calcAllRunning || dirtyKeys.length === 0}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              dirtyKeys.length > 0
                ? 'text-indigo-300 hover:text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20'
                : 'text-slate-500 bg-slate-700/20 border border-slate-700/30'
            }`}
            title="Save all modified tickets to JIRA"
          >
            <Save size={13} className={saveAllRunning ? 'animate-pulse' : ''} />
            {saveAllRunning
              ? `Saving ${saveAllProgress.done}/${saveAllProgress.total}...`
              : `Save All${dirtyKeys.length > 0 ? ` (${dirtyKeys.length})` : ''}`}
          </button>
        </div>
      </div>
      {missingFilter && (
        <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between">
          <span className="text-xs text-rose-300">
            Showing tickets with missing <span className="font-semibold">{filterLabels[missingFilter]}</span>
            <span className="text-rose-400/60 ml-1.5">({sortedTickets.length} ticket{sortedTickets.length !== 1 ? 's' : ''})</span>
          </span>
          <button
            onClick={onClearFilter}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 hover:bg-slate-700/50 px-2 py-0.5 rounded transition-colors"
          >
            <X size={12} />
            Clear filter
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-auto">
          <thead>
            <tr className="border-b border-slate-700/60 bg-slate-800/80">
              {([
                { key: 'key', label: 'Key' },
                { key: 'summary', label: 'Summary' },
                { key: 'status', label: 'Status' },
                { key: 'assignee', label: 'Assignee' },
                { key: 'tpd_bu', label: 'TPD BU' },
                { key: 'eng_hours', label: 'Eng Hours' },
                { key: 'work_stream', label: 'Work Stream' },
              ] as const).map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-200 transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sort.column === col.key && (
                      sort.direction === 'asc'
                        ? <ArrowUp size={12} className="text-indigo-400" />
                        : <ArrowDown size={12} className="text-indigo-400" />
                    )}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <span className="inline-flex items-center gap-1.5">
                  Actions
                  {sort.column && (
                    <button
                      onClick={resetSort}
                      className="text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 p-0.5 rounded transition-colors"
                      title="Reset sorting"
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {paginatedTickets.map((ticket, index) => {
              const isDirty = !!editing[ticket.key];
              const currentValues = { ...ticket, ...(editing[ticket.key] || {}) };
              const rowBg = isDirty
                ? 'bg-amber-500/8'
                : index % 2 === 0
                  ? 'bg-transparent'
                  : 'bg-slate-700/15';

              return (
                <tr key={ticket.key} className={`${rowBg} hover:bg-indigo-500/8 transition-colors`}>
                  {/* Key */}
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-medium text-indigo-300">{ticket.key}</span>
                      <button
                        onClick={() => window.api?.openExternal?.(`${ticket.base_url}/browse/${ticket.key}`)}
                        className="text-slate-500 hover:text-indigo-400 transition-colors flex-shrink-0"
                        title="Open in browser"
                      >
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </td>

                  {/* Summary */}
                  <td className="px-4 py-2.5 max-w-[180px] lg:max-w-xs xl:max-w-md">
                    <span className="text-slate-200 truncate block" title={ticket.summary}>
                      {ticket.summary}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ring-1 ring-inset ${statusColors[ticket.status] || defaultStatusColor}`}>
                      {ticket.status}
                    </span>
                  </td>

                  {/* Assignee */}
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-300">{ticket.assignee}</td>

                  {/* TPD BU */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <select
                        className="bg-slate-700/60 border border-slate-600/60 text-slate-200 text-sm rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400/50 transition-shadow cursor-pointer min-w-[110px]"
                        value={currentValues.tpd_bu || ''}
                        onChange={(e) => handleFieldChange(ticket.key, 'tpd_bu', e.target.value)}
                      >
                        <option value="">Not set</option>
                        <option value="B2C">B2C</option>
                        <option value="B2B">B2B</option>
                        <option value="Global Expansion">Global Expansion</option>
                        <option value="O4B">O4B</option>
                        <option value="Rome2Rio">Rome2Rio</option>
                        <option value="Omio.AI">Omio.AI</option>
                      </select>
                      <CalcButton
                        onClick={() => handleCalculateFields(ticket.key, 'tpd_bu')}
                        loading={calculating[`${ticket.key}:tpd_bu`]}
                        title="Recalculate from parent mapping"
                      />
                    </div>
                  </td>

                  {/* Eng Hours */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        className="bg-slate-700/60 border border-slate-600/60 text-slate-200 text-sm rounded-md w-16 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400/50 transition-shadow tabular-nums placeholder-slate-500"
                        value={currentValues.eng_hours === null ? '' : currentValues.eng_hours}
                        placeholder="--"
                        onChange={(e) => handleFieldChange(ticket.key, 'eng_hours', parseFloat(e.target.value))}
                      />
                      <CalcButton
                        onClick={() => handleCalculateHours(ticket.key)}
                        loading={calculating[`${ticket.key}:hours`]}
                        title="Recalculate from status transitions"
                      />
                    </div>
                  </td>

                  {/* Work Stream */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <select
                        className="bg-slate-700/60 border border-slate-600/60 text-slate-200 text-sm rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400/50 transition-shadow cursor-pointer min-w-[110px]"
                        value={currentValues.work_stream || ''}
                        onChange={(e) => handleFieldChange(ticket.key, 'work_stream', e.target.value)}
                      >
                        <option value="">Not set</option>
                        <option value="Operational">Operational</option>
                        <option value="Product">Product</option>
                        <option value="Tech Meta Backlog">Tech Meta Backlog</option>
                      </select>
                      <CalcButton
                        onClick={() => handleCalculateFields(ticket.key, 'work_stream')}
                        loading={calculating[`${ticket.key}:work_stream`]}
                        title="Recalculate from parent mapping"
                      />
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleSyncSingle(ticket.key)}
                        disabled={syncingRow === ticket.key}
                        className="text-slate-500 hover:text-sky-400 hover:bg-sky-400/10 p-1.5 rounded-md transition-colors"
                        title="Sync from JIRA"
                      >
                        <RefreshCw size={14} className={syncingRow === ticket.key ? 'animate-spin' : ''} />
                      </button>
                      <button
                        onClick={() => handleSave(ticket.key)}
                        disabled={(!isDirty && !ticket.has_computed_values) || saving === ticket.key}
                        className={`inline-flex items-center gap-1 rounded-md text-xs font-medium px-2.5 py-1.5 transition-all ${
                          isDirty || ticket.has_computed_values
                            ? 'text-white bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 shadow-sm shadow-indigo-500/25'
                            : 'text-slate-500 bg-slate-700/40 cursor-not-allowed'
                        }`}
                      >
                        {saving === ticket.key ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <Save size={12} />
                        )}
                        <span>Save</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center px-4 py-3 border-t border-slate-700/50 bg-slate-800/40">
        <p className="text-sm text-slate-400">
          Showing <span className="font-medium text-slate-300">{sortedTickets.length > 0 ? startIndex + 1 : 0}</span> to{' '}
          <span className="font-medium text-slate-300">{Math.min(startIndex + pageSize, sortedTickets.length)}</span> of{' '}
          <span className="font-medium text-slate-300">{sortedTickets.length}</span> tickets
          {missingFilter && <span className="text-slate-500 ml-1">(filtered from {tickets.length})</span>}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm font-medium text-slate-300 bg-slate-700/50 border border-slate-600/50 rounded-md hover:bg-slate-700 active:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="px-2 text-sm font-medium text-slate-400">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm font-medium text-slate-300 bg-slate-700/50 border border-slate-600/50 rounded-md hover:bg-slate-700 active:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketTable;
