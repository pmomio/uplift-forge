import { useState } from 'react';
import { Flame, LogIn, Loader2 } from 'lucide-react';
import { login } from '../api';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await login();
      onLoginSuccess();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-sm mx-auto text-center">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-indigo-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20">
          <Flame size={32} className="text-white" />
        </div>

        <h1 className="text-2xl font-bold text-slate-100 mb-2">Uplift Forge</h1>
        <p className="text-sm text-slate-400 mb-8">
          Engineering team performance platform.
          <br />
          Connect your Atlassian account to get started.
        </p>

        {/* Login button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-medium transition-colors"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <LogIn size={18} />
              Connect to Atlassian
            </>
          )}
        </button>

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
