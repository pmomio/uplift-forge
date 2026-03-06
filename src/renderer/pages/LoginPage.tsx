import { useState } from 'react';
import { LogIn, Loader2, ExternalLink, Check, ShieldAlert, Sparkles } from 'lucide-react';
import { login, demoLogin } from '../api';
import logoSrc from '../../../assets/logo.png';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [baseUrl, setBaseUrl] = useState('');
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState<'privacy' | 'terms' | null>(null);

  const handleLogin = async () => {
    if (!baseUrl.trim() || !email.trim() || !apiToken.trim()) {
      setError('All fields are required.');
      return;
    }

    if (!consentGiven) {
      setError('You must agree to the data processing terms to continue.');
      return;
    }

    // Normalize base URL: remove trailing slash
    const normalizedUrl = baseUrl.trim().replace(/\/+$/, '');

    setLoading(true);
    setError(null);
    try {
      await login(normalizedUrl, email.trim(), apiToken.trim());
      onLoginSuccess();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      await demoLogin();
      onLoginSuccess();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && consentGiven) handleLogin();
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 animate-fade-in relative overflow-hidden">
      <div className="w-full max-w-md mx-auto text-center animate-slide-up z-10 p-6">
        {/* Logo */}
        <img src={logoSrc} alt="Uplift Forge" className="w-16 h-16 rounded-2xl mx-auto mb-6 shadow-lg shadow-indigo-500/20 animate-glow-pulse" />

        <h1 className="text-3xl font-bold text-slate-100 mb-2 tracking-tight">Uplift Forge</h1>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed px-4">
          Connect to JIRA with your API token to get started. All data is processed and stored locally on your machine.
        </p>

        <div className="space-y-4 text-left" onKeyDown={handleKeyDown}>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">JIRA Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://your-org.atlassian.net"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-slate-800 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-slate-800 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">API Token</label>
            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Your Atlassian API token"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-slate-800 transition-all"
            />
            <p className="mt-1.5 text-[10px] text-slate-500 text-right">
              Generate at <button onClick={() => window.api?.openExternal?.('https://id.atlassian.com/manage-profile/security/api-tokens')} className="text-indigo-400 hover:underline">id.atlassian.com</button>
            </p>
          </div>

          {/* GDPR Consent Checkbox */}
          <div className="mt-6 p-3.5 rounded-lg bg-slate-800/40 border border-slate-700/50 flex items-start gap-3">
            <button
              type="button"
              onClick={() => {
                setConsentGiven(!consentGiven);
                if (error && error.includes('agree')) setError(null);
              }}
              className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                consentGiven 
                  ? 'bg-indigo-500 border-indigo-500 text-white' 
                  : 'bg-slate-800 border-slate-600 text-transparent hover:border-indigo-400'
              }`}
            >
              <Check size={14} />
            </button>
            <div className="text-[11px] text-slate-400 leading-relaxed select-none">
              I consent to the local processing and storage of my JIRA credentials and team data as described in the{' '}
              <button type="button" onClick={() => setShowPolicyModal('privacy')} className="text-indigo-400 hover:text-indigo-300 hover:underline font-medium">Privacy Policy</button>
              {' '}and agree to the{' '}
              <button type="button" onClick={() => setShowPolicyModal('terms')} className="text-indigo-400 hover:text-indigo-300 hover:underline font-medium">Terms of Service</button>.
            </div>
          </div>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading || !consentGiven}
          className={`w-full mt-6 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all shadow-lg ${
            consentGiven && !loading
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed shadow-none'
          }`}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Authenticating...
            </>
          ) : (
            <>
              <LogIn size={18} />
              Connect & Continue
            </>
          )}
        </button>

        <div className="mt-4 flex items-center justify-center gap-4">
          <div className="h-px bg-slate-700 flex-1"></div>
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">OR</span>
          <div className="h-px bg-slate-700 flex-1"></div>
        </div>

        <button
          onClick={handleDemo}
          disabled={loading}
          className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-600 shadow-lg cursor-pointer"
        >
          <Sparkles size={18} className="text-amber-400" />
          Try Demo Mode
        </button>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-900/20 border border-red-800/30 flex items-start gap-2 text-left animate-shake">
            <ShieldAlert size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 leading-snug">{error}</p>
          </div>
        )}
      </div>

      {/* Policy Modals */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-slide-up">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">
                {showPolicyModal === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
              </h2>
              <button 
                onClick={() => setShowPolicyModal(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 text-sm text-slate-300 space-y-4 leading-relaxed prose prose-invert max-w-none">
              {showPolicyModal === 'privacy' ? (
                <>
                  <h3 className="text-slate-100 font-semibold text-base mt-0">1. Data Collection & Local Storage</h3>
                  <p>Uplift Forge is a local-first application. All data collected (including JIRA URLs, emails, API tokens, and JIRA issue metadata) is stored entirely locally on your device. We do not operate centralized servers for data collection.</p>
                  
                  <h3 className="text-slate-100 font-semibold text-base">2. Encryption</h3>
                  <p>Your authentication credentials (Email and API Token) are encrypted using your operating system's native secure storage mechanism (e.g., macOS Keychain, Windows Credential Manager).</p>
                  
                  <h3 className="text-slate-100 font-semibold text-base">3. Third-Party Services</h3>
                  <p>The Application communicates directly with Atlassian APIs. It also queries GitHub periodically to check for software updates, which may expose your IP address to GitHub.</p>
                  
                  <h3 className="text-slate-100 font-semibold text-base">4. Your Rights</h3>
                  <p>Because all data is stored locally, you have complete control. You can exercise your right to erasure by utilizing the "Reset App" feature, which permanently deletes all locally stored data and credentials.</p>
                </>
              ) : (
                <>
                  <h3 className="text-slate-100 font-semibold text-base mt-0">1. Acceptance</h3>
                  <p>By using Uplift Forge, you agree to these terms. You represent that you have the necessary authorization from your organization to access and process the connected JIRA data.</p>
                  
                  <h3 className="text-slate-100 font-semibold text-base">2. Security Responsibility</h3>
                  <p>While the app encrypts credentials locally, you remain responsible for the physical and digital security of your device where the data resides.</p>
                  
                  <h3 className="text-slate-100 font-semibold text-base">3. Disclaimer of Warranties</h3>
                  <p>The Application is provided "AS IS" without warranties of any kind. We do not guarantee uninterrupted or error-free operation.</p>
                  
                  <h3 className="text-slate-100 font-semibold text-base">4. Limitation of Liability</h3>
                  <p>In no event shall the developer be liable for any indirect, incidental, or consequential damages resulting from your use of the application.</p>
                </>
              )}
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end rounded-b-xl">
              <button 
                onClick={() => setShowPolicyModal(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Close & Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
