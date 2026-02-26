import React from 'react';
import { Settings, BarChart3, Flame, Home, TrendingUp, Users, LogOut } from 'lucide-react';
import type { ProjectInfo } from '../App';

export interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export const TABS: Tab[] = [
  { id: 'home', label: 'Home', icon: <Home size={18} /> },
  { id: 'attribution', label: 'Eng. Attribution', icon: <BarChart3 size={18} /> },
  { id: 'metrics', label: 'Team Metrics', icon: <TrendingUp size={18} /> },
  { id: 'individual', label: 'Individual Metrics', icon: <Users size={18} /> },
  { id: 'config', label: 'Configuration', icon: <Settings size={18} /> },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  project?: ProjectInfo | null;
  email?: string | null;
  onLogout?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, project, email, onLogout }) => {
  return (
    <aside className="w-56 bg-slate-900 border-r border-slate-700/50 flex flex-col flex-shrink-0">
      {/* Logo / Project branding */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-slate-700/50 flex-shrink-0">
        {project?.avatar ? (
          <img src={project.avatar} alt="" className="w-7 h-7 rounded-lg flex-shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0">
            <Flame size={16} className="text-white" />
          </div>
        )}
        <div className="min-w-0">
          <span className="text-sm font-semibold text-slate-100 tracking-tight block truncate">
            {project?.name || 'Uplift Forge'}
          </span>
          {project?.key && (
            <span className="text-[10px] text-slate-500 font-mono">{project.key}</span>
          )}
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                isActive
                  ? 'bg-indigo-500/15 text-indigo-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span className="flex-shrink-0">{tab.icon}</span>
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Project lead */}
      {project?.lead && (
        <div className="px-4 py-3 border-t border-slate-700/50">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Lead</span>
          <p className="text-xs text-slate-400 truncate">{project.lead}</p>
        </div>
      )}

      {/* User email + logout */}
      {email && (
        <div className="px-4 py-3 border-t border-slate-700/50 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Account</span>
            <p className="text-xs text-slate-400 truncate">{email}</p>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
