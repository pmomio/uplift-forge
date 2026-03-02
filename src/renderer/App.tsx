import { useState, useCallback, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import EngineeringAttribution from './pages/EngineeringAttribution';
import TeamMetrics from './pages/TeamMetrics';
import IndividualMetrics from './pages/IndividualMetrics';
import EpicTracker from './pages/EpicTracker';
import ConfigPanel from './components/ConfigPanel';
import UpdateBanner from './components/UpdateBanner';
import LoginPage from './pages/LoginPage';
import OnboardingWizard from './components/OnboardingWizard';
import { getJiraProject, getAuthState, getConfig, resetApp } from './api';
import { Loader2 } from 'lucide-react';
import type { Persona } from '../shared/types';

export interface ProjectInfo {
  key: string;
  name: string;
  lead: string | null;
  avatar: string | null;
}

function App() {
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [refreshKey, setRefreshKey] = useState(0);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [persona, setPersona] = useState<Persona | undefined>(undefined);
  const [personaLoaded, setPersonaLoaded] = useState(false);

  // Check auth state on mount
  useEffect(() => {
    getAuthState()
      .then((res) => {
        const state = res.data as { status: string; email?: string };
        setAuthStatus(state.status as 'authenticated' | 'unauthenticated');
        setAuthEmail(state.email ?? null);
      })
      .catch(() => setAuthStatus('unauthenticated'));

    // Listen for auth state changes (e.g. token expiry)
    if (window.api?.onAuthStateChanged) {
      const unsubscribe = window.api.onAuthStateChanged((state: unknown) => {
        const s = state as { status: string; email?: string };
        setAuthStatus(s.status as 'authenticated' | 'unauthenticated');
        setAuthEmail(s.email ?? null);
      });
      return unsubscribe;
    }
  }, []);

  // Load persona from config
  const fetchPersona = useCallback(async () => {
    try {
      const res = await getConfig();
      const cfg = res.data as { persona?: Persona };
      setPersona(cfg.persona);
    } catch {
      // Non-critical
    } finally {
      setPersonaLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') fetchPersona();
  }, [authStatus, fetchPersona]);

  const fetchProject = useCallback(async () => {
    try {
      const res = await getJiraProject();
      if (!res.data.error) setProject(res.data);
    } catch {
      // Project info is non-critical — silently ignore
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') fetchProject();
  }, [authStatus, fetchProject]);

  const handleConfigSaved = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
    fetchProject();
    fetchPersona();
  }, [fetchProject, fetchPersona]);

  const handleLoginSuccess = useCallback(() => {
    setAuthStatus('authenticated');
    getAuthState().then((res) => {
      const state = res.data as { email?: string };
      setAuthEmail(state.email ?? null);
    }).catch(() => {});
  }, []);

  const handleLogout = useCallback(async () => {
    await window.api.logout();
    setAuthStatus('unauthenticated');
    setAuthEmail(null);
    setProject(null);
  }, []);

  const handleReset = useCallback(async () => {
    await resetApp();
    setAuthStatus('unauthenticated');
    setAuthEmail(null);
    setProject(null);
  }, []);

  // Global toaster — must render in all views for toasts to be visible
  const toaster = (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 3000,
        style: { borderRadius: '10px', fontSize: '13px', fontWeight: 500, backdropFilter: 'blur(12px)' },
        success: { style: { background: 'rgba(6, 95, 70, 0.9)', color: '#d1fae5', border: '1px solid #047857', backdropFilter: 'blur(12px)' } },
        error: { style: { background: 'rgba(127, 29, 29, 0.9)', color: '#fecaca', border: '1px solid #991b1b', backdropFilter: 'blur(12px)' } },
      }}
    />
  );

  // Loading state
  if (authStatus === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {toaster}
        <Loader2 size={32} className="text-indigo-400 animate-spin" />
      </div>
    );
  }

  // Unauthenticated — show login
  if (authStatus === 'unauthenticated') {
    return <>
      {toaster}
      <LoginPage onLoginSuccess={handleLoginSuccess} />
    </>;
  }

  // Waiting for persona check
  if (!personaLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {toaster}
        <Loader2 size={32} className="text-indigo-400 animate-spin" />
      </div>
    );
  }

  // Authenticated but no persona — show onboarding wizard
  if (!persona) {
    return <>
      {toaster}
      <OnboardingWizard onComplete={() => {
        fetchPersona();
        fetchProject();
      }} />
    </>;
  }

  return (
    <div className="h-screen flex bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {toaster}

      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        project={project}
        email={authEmail}
        onLogout={handleLogout}
        onReset={handleReset}
        persona={persona}
      />

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <UpdateBanner />
        <main className="flex-1 overflow-hidden pt-10 animate-fade-in">
          {activeTab === 'home' && <HomePage project={project} persona={persona} />}
          {activeTab === 'attribution' && <EngineeringAttribution refreshKey={refreshKey} project={project} />}
          {activeTab === 'metrics' && <TeamMetrics refreshKey={refreshKey} project={project} persona={persona} />}
          {activeTab === 'individual' && <IndividualMetrics refreshKey={refreshKey} project={project} persona={persona} />}
          {activeTab === 'epics' && <EpicTracker refreshKey={refreshKey} project={project} />}
          {activeTab === 'config' && <ConfigPanel onConfigSaved={handleConfigSaved} />}
        </main>
      </div>
    </div>
  );
}

export default App;
