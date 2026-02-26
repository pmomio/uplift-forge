import { useState } from 'react';
import { LogIn, Loader2, ExternalLink } from 'lucide-react';
import { login } from '../api';
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

  const handleLogin = async () => {
    if (!baseUrl.trim() || !email.trim() || !apiToken.trim()) {
      setError('All fields are required.');
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) handleLogin();
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 animate-fade-in">
      <div className="w-full max-w-sm mx-auto text-center animate-slide-up">
        {/* Logo */}
        <img src={logoSrc} alt="Uplift Forge" className="w-16 h-16 rounded-2xl mx-auto mb-8 shadow-lg shadow-indigo-500/20 animate-glow-pulse" />

        <h1 className="text-3xl font-bold text-slate-100 mb-2 tracking-tight">Uplift Forge</h1>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          Connect to JIRA with your API token to get started.
        </p>

        <div className="space-y-4 text-left" onKeyDown={handleKeyDown}>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">JIRA Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://your-org.atlassian.net"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">API Token</label>
            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Your Atlassian API token"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-slate-800"
            />
          </div>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-medium transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30 hover:scale-[1.01] active:scale-[0.99]"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <LogIn size={18} />
              Sign In
            </>
          )}
        </button>

        <p className="mt-4 text-xs text-slate-500">
          Generate an API token at{' '}
          <button
            onClick={() => window.api?.openExternal?.('https://id.atlassian.com/manage-profile/security/api-tokens')}
            className="text-indigo-400 hover:text-indigo-300 underline inline-flex items-center gap-0.5"
          >
            id.atlassian.com
            <ExternalLink size={10} />
          </button>
        </p>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-900/30 border border-red-800/50">
            <p className="text-xs text-red-300">{error}</p>
            <button
              onClick={handleLogin}
              className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
