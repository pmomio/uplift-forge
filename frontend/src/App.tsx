import { useState, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import EngineeringAttribution from './pages/EngineeringAttribution';
import ConfigPanel from './components/ConfigPanel';

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleConfigSaved = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

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
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'home' && <HomePage />}
        {activeTab === 'attribution' && <EngineeringAttribution refreshKey={refreshKey} />}
        {activeTab === 'config' && <ConfigPanel onConfigSaved={handleConfigSaved} />}
      </main>
    </div>
  );
}

export default App;
