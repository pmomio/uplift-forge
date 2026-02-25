import React from 'react';
import { Settings, BarChart3, Flame, Home } from 'lucide-react';

export interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export const TABS: Tab[] = [
  { id: 'home', label: 'Home', icon: <Home size={18} /> },
  { id: 'attribution', label: 'Attribution', icon: <BarChart3 size={18} /> },
  { id: 'config', label: 'Configuration', icon: <Settings size={18} /> },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  return (
    <aside className="w-48 bg-slate-900 border-r border-slate-700/50 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-slate-700/50 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0">
          <Flame size={16} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-slate-100 tracking-tight">Uplift Forge</span>
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
    </aside>
  );
};

export default Sidebar;
