import { useState, useCallback, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import EngineeringAttribution from './pages/EngineeringAttribution';
import TeamMetrics from './pages/TeamMetrics';
import IndividualMetrics from './pages/IndividualMetrics';
import ConfigPanel from './components/ConfigPanel';
import { getJiraProject } from './api';

export interface ProjectInfo {
  key: string;
  name: string;
  lead: string | null;
  avatar: string | null;
}

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [refreshKey, setRefreshKey] = useState(0);
  const [project, setProject] = useState<ProjectInfo | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      const res = await getJiraProject();
      if (!res.data.error) setProject(res.data);
    } catch {
      // Project info is non-critical — silently ignore
    }
  }, []);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const handleConfigSaved = useCallback(() => {
    setRefreshKey(prev => prev + 1);
    fetchProject(); // re-fetch in case project key changed
  }, [fetchProject]);

  return (
    <div className="h-screen flex bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Toast */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: { borderRadius: '10px', fontSize: '13px', fontWeight: 500 },
          success: { style: { background: '#065f46', color: '#d1fae5', border: '1px solid #047857' } },
          error: { style: { background: '#7f1d1d', color: '#fecaca', border: '1px solid #991b1b' } },
        }}
      />

      {/* Sidebar */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} project={project} />

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'home' && <HomePage project={project} />}
        {activeTab === 'attribution' && <EngineeringAttribution refreshKey={refreshKey} project={project} />}
        {activeTab === 'metrics' && <TeamMetrics refreshKey={refreshKey} project={project} />}
        {activeTab === 'individual' && <IndividualMetrics refreshKey={refreshKey} project={project} />}
        {activeTab === 'config' && <ConfigPanel onConfigSaved={handleConfigSaved} />}
      </main>
    </div>
  );
}

export default App;
