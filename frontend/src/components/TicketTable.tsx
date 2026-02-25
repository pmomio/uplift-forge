import React, { useState } from 'react';
import { Save, ExternalLink, RefreshCw, Calculator } from 'lucide-react';
import toast from 'react-hot-toast';
import { updateTicket, syncSingleTicket, calculateHours, calculateFields } from '../api';

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
}

const statusColors: Record<string, string> = {
  'Done': 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  'Closed': 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  'Resolved': 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  'Rejected': 'bg-rose-500/15 text-rose-300 ring-rose-400/30',
  'Cancelled': 'bg-rose-500/15 text-rose-300 ring-rose-400/30',
};
const defaultStatusColor = 'bg-sky-500/15 text-sky-300 ring-sky-400/30';

const TicketTable: React.FC<TicketTableProps> = ({ tickets, onUpdate }) => {
  const [editing, setEditing] = useState<Record<string, Partial<Ticket>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [syncingRow, setSyncingRow] = useState<string | null>(null);
  const [calculating, setCalculating] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const totalPages = Math.ceil(tickets.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTickets = tickets.slice(startIndex, startIndex + pageSize);

  const handleFieldChange = (key: string, field: string, value: any) => {
    setEditing(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [field]: value }
    }));
  };

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      const ticket = tickets.find(t => t.key === key);
      const merged = { ...ticket, ...(editing[key] || {}) };
      const edits = editing[key] || {};
      const payload: Record<string, any> = {};
      if ('tpd_bu' in edits) payload.tpd_bu = edits.tpd_bu;
      if ('eng_hours' in edits) payload.eng_hours = edits.eng_hours;
      if ('work_stream' in edits) payload.work_stream = edits.work_stream;
      if (!('tpd_bu' in edits) && merged.tpd_bu) payload.tpd_bu = merged.tpd_bu;
      if (!('eng_hours' in edits) && merged.eng_hours != null) payload.eng_hours = merged.eng_hours;
      if (!('work_stream' in edits) && merged.work_stream) payload.work_stream = merged.work_stream;
      await updateTicket(key, payload);
      toast.success(`Saved ${key} to JIRA`);
      const newEditing = { ...editing };
      delete newEditing[key];
      setEditing(newEditing);
      onUpdate();
    } catch (error: any) {
      console.error('Failed to save ticket', error);
      const detail = error?.response?.data?.detail || error.message || 'Unknown error';
      toast.error(`Failed to save ticket: ${detail}`);
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
        toast.error('Could not calculate hours (no matching status transitions found)');
      }
    } catch (error) {
      console.error('Failed to calculate hours', error);
      toast.error('Failed to calculate hours');
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
        toast.error(`Could not compute ${field === 'tpd_bu' ? 'TPD BU' : 'Work Stream'} (no parent mapping found)`);
      }
    } catch (error) {
      console.error(`Failed to calculate ${field}`, error);
      toast.error(`Failed to calculate ${field === 'tpd_bu' ? 'TPD BU' : 'Work Stream'}`);
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
      toast.error('Sync failed for ticket ' + key);
    } finally {
      setSyncingRow(null);
    }
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
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-auto">
          <thead>
            <tr className="border-b border-slate-700/60 bg-slate-800/80">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Key</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Summary</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Assignee</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">TPD BU</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Eng Hours</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Work Stream</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
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
                      <a
                        href={`${ticket.base_url}/browse/${ticket.key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-indigo-400 transition-colors flex-shrink-0"
                      >
                        <ExternalLink size={12} />
                      </a>
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
          Showing <span className="font-medium text-slate-300">{startIndex + 1}</span> to{' '}
          <span className="font-medium text-slate-300">{Math.min(startIndex + pageSize, tickets.length)}</span> of{' '}
          <span className="font-medium text-slate-300">{tickets.length}</span> tickets
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
