import React from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  BarChart2, 
  Zap
} from 'lucide-react';
import type { ProcessedTicket } from '../../shared/types';

interface TicketSummaryProps {
  tickets: ProcessedTicket[];
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
}

const TicketSummary: React.FC<TicketSummaryProps> = ({ tickets, activeFilter, onFilterChange }) => {
  const total = tickets.length;
  
  const stats = React.useMemo(() => {
    if (total === 0) return {
      avgSP: 0,
      totalSP: 0,
      missingSP: 0
    };

    const withSP = tickets.filter(t => t.story_points != null);
    const avgSP = withSP.length > 0 
      ? withSP.reduce((sum, t) => sum + (t.story_points || 0), 0) / withSP.length 
      : 0;
    const totalSP = withSP.reduce((sum, t) => sum + (t.story_points || 0), 0);

    const missingSP = tickets.filter(t => t.story_points == null).length;
    
    return {
      avgSP,
      totalSP,
      missingSP
    };
  }, [tickets, total]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {/* Overview Card */}
      <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex items-center gap-4 shadow-sm">
        <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
          <BarChart2 size={24} />
        </div>
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Tickets</div>
          <div className="text-2xl font-bold text-slate-100">{total}</div>
        </div>
      </div>

      {/* Story Points Card */}
      <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex items-center gap-4 shadow-sm">
        <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
          <Zap size={24} />
        </div>
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Story Points</div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold text-slate-100">{stats.totalSP}</div>
            <div className="text-xs text-slate-500">avg {stats.avgSP.toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* Missing Data Card */}
      <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl shadow-sm">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
          <AlertCircle size={12} />
          Missing Data
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => onFilterChange(activeFilter === 'story_points' ? null : 'story_points')}
            className={`flex-1 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'story_points' 
                ? 'bg-rose-500 text-white shadow-sm' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {`Missing SP (${stats.missingSP})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketSummary;
