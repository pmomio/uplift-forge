import React, { useMemo } from 'react';
import type { MissingFilter } from '../App';

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

interface TicketSummaryProps {
  tickets: Ticket[];
  activeFilter: MissingFilter;
  onFilterChange: (filter: MissingFilter) => void;
}

const statusDotColors: Record<string, string> = {
  'Done': 'bg-emerald-400',
  'Closed': 'bg-emerald-400',
  'Resolved': 'bg-emerald-400',
  'Rejected': 'bg-rose-400',
  'Cancelled': 'bg-rose-400',
};

const TicketSummary: React.FC<TicketSummaryProps> = ({ tickets, activeFilter, onFilterChange }) => {
  const stats = useMemo(() => {
    const total = tickets.length;

    const byStatus: Record<string, number> = {};
    tickets.forEach(t => {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    });

    const withHours = tickets.filter(t => t.eng_hours != null);
    const avgHours = withHours.length > 0
      ? withHours.reduce((sum, t) => sum + (t.eng_hours || 0), 0) / withHours.length
      : null;
    const totalHours = withHours.reduce((sum, t) => sum + (t.eng_hours || 0), 0);

    const missingTpd = tickets.filter(t => !t.tpd_bu).length;
    const missingHours = tickets.filter(t => t.eng_hours == null).length;
    const missingWs = tickets.filter(t => !t.work_stream).length;
    const complete = tickets.filter(t => t.tpd_bu && t.eng_hours != null && t.work_stream).length;

    return { total, byStatus, avgHours, totalHours, missingTpd, missingHours, missingWs, complete };
  }, [tickets]);

  const completePct = stats.total > 0 ? Math.round((stats.complete / stats.total) * 100) : 0;

  return (
    <div className="mt-3 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 shadow-xl shadow-black/20 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3 text-xs">

        {/* Total */}
        <div className="bg-slate-700/40 border border-slate-600/30 rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="text-slate-400">Tickets</span>
          <span className="text-slate-100 font-semibold text-sm tabular-nums">{stats.total}</span>
        </div>

        {/* Status breakdown */}
        <div className="bg-slate-700/40 border border-slate-600/30 rounded-lg px-3 py-2 flex items-center gap-4">
          {Object.entries(stats.byStatus)
            .sort(([, a], [, b]) => b - a)
            .map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${statusDotColors[status] || 'bg-sky-400'}`} />
                <span className="text-slate-400">{status}</span>
                <span className="text-slate-200 font-semibold tabular-nums">{count}</span>
              </div>
            ))}
        </div>

        {/* Eng Hours */}
        <div className="bg-slate-700/40 border border-slate-600/30 rounded-lg px-3 py-2 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Avg Hours</span>
            <span className="text-slate-100 font-semibold tabular-nums">
              {stats.avgHours != null ? stats.avgHours.toFixed(1) : '--'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Total</span>
            <span className="text-slate-200 font-semibold tabular-nums">{stats.totalHours.toFixed(1)}h</span>
          </div>
        </div>

        {/* Field coverage */}
        <div className="bg-slate-700/40 border border-slate-600/30 rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="text-slate-400">Fields Complete</span>
          <span className={`font-semibold tabular-nums ${completePct === 100 ? 'text-emerald-400' : 'text-slate-100'}`}>
            {completePct}%
          </span>
          <span className="text-slate-500 tabular-nums">({stats.complete}/{stats.total})</span>
        </div>

        {/* Missing fields */}
        {(stats.missingTpd > 0 || stats.missingHours > 0 || stats.missingWs > 0) && (
          <div className="bg-rose-500/8 border border-rose-500/20 rounded-lg px-3 py-2 flex items-center gap-1">
            <span className="text-rose-300 mr-2">Missing</span>
            {stats.missingTpd > 0 && (
              <button
                onClick={() => onFilterChange(activeFilter === 'tpd_bu' ? null : 'tpd_bu')}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-colors ${
                  activeFilter === 'tpd_bu'
                    ? 'bg-rose-500/25 ring-1 ring-rose-400/40'
                    : 'hover:bg-rose-500/15'
                }`}
              >
                <span className="text-slate-300">TPD BU</span>
                <span className="text-rose-400 font-semibold tabular-nums">{stats.missingTpd}</span>
              </button>
            )}
            {stats.missingHours > 0 && (
              <button
                onClick={() => onFilterChange(activeFilter === 'eng_hours' ? null : 'eng_hours')}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-colors ${
                  activeFilter === 'eng_hours'
                    ? 'bg-rose-500/25 ring-1 ring-rose-400/40'
                    : 'hover:bg-rose-500/15'
                }`}
              >
                <span className="text-slate-300">Hours</span>
                <span className="text-rose-400 font-semibold tabular-nums">{stats.missingHours}</span>
              </button>
            )}
            {stats.missingWs > 0 && (
              <button
                onClick={() => onFilterChange(activeFilter === 'work_stream' ? null : 'work_stream')}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-colors ${
                  activeFilter === 'work_stream'
                    ? 'bg-rose-500/25 ring-1 ring-rose-400/40'
                    : 'hover:bg-rose-500/15'
                }`}
              >
                <span className="text-slate-300">Work Stream</span>
                <span className="text-rose-400 font-semibold tabular-nums">{stats.missingWs}</span>
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default TicketSummary;
