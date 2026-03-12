import { useState, useCallback, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import EmTeamDashboard from './pages/EmTeamDashboard';
import EmIndividualDashboard from './pages/EmIndividualDashboard';
import DmFlowDashboard from './pages/DmFlowDashboard';
import IcPersonalDashboard from './pages/IcPersonalDashboard';
import CtoOrgDashboard from './pages/CtoOrgDashboard';
import EpicTracker from './pages/EpicTracker';
import ConfigPanel from './components/ConfigPanel';
import LoginPage from './pages/LoginPage';
import OnboardingWizard from './components/OnboardingWizard';
import { getAuthState, logout, getConfig, getJiraProject, listProjects } from './api';
import type { AuthState, Persona, ProjectInfo } from '../shared/types';
import { Loader2 } from 'lucide-react';

function App() {
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' });
  const [persona, setPersona] = useState<Persona | undefined>(undefined);
  const [activeTab, setActiveTab] = useState('home');
  const [refreshKey, setRefreshKey] = useState(0);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [projectCount, setProjectCount] = useState(0);

  const fetchAuthAndConfig = useCallback(async () => {
    try {
      const [authRes, configRes] = await Promise.all([
        getAuthState(),
        getConfig()
      ]);
      
      setAuthState(authRes.data);
      const cfg = configRes.data;
      setPersona(cfg.persona);

      // If project key set, fetch project metadata
      if (cfg.project_key) {
        const projRes = await getJiraProject();
        if (!projRes.data.error) {
          setProject(projRes.data);
        }
      }

      // Fetch project count for multi-project indicator
      const listRes = await listProjects();
      setProjectCount(listRes.data.length);

    } catch (error) {
      console.error('Failed to fetch initial state', error);
      setAuthState({ status: 'unauthenticated' });
    }
  }, []);

  useEffect(() => {
    fetchAuthAndConfig();
  }, [fetchAuthAndConfig]);

  const handleLoginSuccess = () => {
    fetchAuthAndConfig();
  };

  const handleLogout = async () => {
    await logout();
    setAuthState({ status: 'unauthenticated' });
    setPersona(undefined);
    setActiveTab('home');
  };

  const handleConfigSaved = () => {
    setRefreshKey(prev => prev + 1);
    fetchAuthAndConfig();
  };

  const handleResetApp = async () => {
    try {
      await resetApp();
      // App will relaunch automatically from main process
    } catch (error) {
      console.error('Failed to reset app', error);
      setAuthState({ status: 'unauthenticated' });
      setPersona(undefined);
      setActiveTab('home');
    }
  };

  if (authState.status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <Loader2 size={32} className="text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (authState.status === 'unauthenticated') {
    return (
      <>
        <Toaster position="top-right" toastOptions={{ duration: 3000, style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' } }} />
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  // Gate app with onboarding if persona not set
  if (!persona) {
    return (
      <>
        <Toaster position="top-right" toastOptions={{ duration: 3000, style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' } }} />
        <OnboardingWizard onComplete={handleLoginSuccess} />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      <Toaster position="top-right" toastOptions={{ duration: 3000, style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' } }} />
      
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        project={project}
        email={authState.email}
        onLogout={handleLogout}
        onReset={handleResetApp}
        persona={persona}
        projectCount={projectCount}
      />

      <div className="flex-1 flex flex-col min-w-0 relative">
        <main className="flex-1 overflow-hidden relative">
          {activeTab === 'home' && <HomePage persona={persona} onNavigate={setActiveTab} />}
          
          {activeTab === 'metrics' && persona === 'engineering_manager' && <EmTeamDashboard refreshKey={refreshKey} project={project} projectCount={projectCount} />}
          {activeTab === 'metrics' && persona === 'delivery_manager' && <DmFlowDashboard refreshKey={refreshKey} project={project} projectCount={projectCount} />}
          {activeTab === 'metrics' && persona === 'management' && <CtoOrgDashboard refreshKey={refreshKey} project={project} projectCount={projectCount} />}
          
          {activeTab === 'individual' && persona === 'engineering_manager' && <EmIndividualDashboard refreshKey={refreshKey} project={project} projectCount={projectCount} />}
          {activeTab === 'individual' && persona === 'individual' && <IcPersonalDashboard refreshKey={refreshKey} />}
          
          {activeTab === 'epics' && <EpicTracker refreshKey={refreshKey} project={project} persona={persona} projectCount={projectCount} />}
          {activeTab === 'config' && <ConfigPanel onConfigSaved={handleConfigSaved} />}
        </main>
      </div>
    </div>
  );
}

export default App;
