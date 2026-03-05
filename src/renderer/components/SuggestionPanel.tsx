import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, AlertCircle, RefreshCw, Brain } from 'lucide-react';
import { getAiSuggestions, getConfig } from '../api';
import type { AiSuggestRequest, AiSuggestResponse, AiProvider, Persona } from '../../shared/types';

const PERSONA_PANEL_TITLES: Record<Persona, string> = {
  engineering_manager: 'AI Suggestions',
  individual: 'Growth Suggestions',
  delivery_manager: 'Risk Mitigation',
  management: 'Strategic Insights',
};

interface SuggestionPanelProps {
  open: boolean;
  onClose: () => void;
  request: AiSuggestRequest | null;
  aiProvider: AiProvider;
}

// --- Animated loading indicator ---
const AiThinkingLoader = ({ provider }: { provider: string }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const phrases = [
    'Analyzing metric data',
    'Evaluating trend patterns',
    'Generating insights',
    'Crafting suggestions',
  ];
  const phraseIdx = Math.floor(elapsed / 3) % phrases.length;

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Orbiting sparkles ring */}
      <div className="relative w-20 h-20">
        {/* Outer glow ring */}
        <div className="absolute inset-0 rounded-full animate-ai-glow" />
        {/* Center brain icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/25 flex items-center justify-center">
            <Brain size={22} className="text-violet-400" />
          </div>
        </div>
        {/* Orbiting sparkle 1 */}
        <div className="absolute inset-0 animate-ai-orbit">
          <Sparkles size={12} className="text-violet-400 absolute -top-1 left-1/2 -translate-x-1/2" />
        </div>
        {/* Orbiting sparkle 2 — offset 120deg */}
        <div className="absolute inset-0 animate-ai-orbit" style={{ animationDelay: '-0.66s' }}>
          <Sparkles size={10} className="text-violet-300/70 absolute -top-0.5 left-1/2 -translate-x-1/2" />
        </div>
        {/* Orbiting sparkle 3 — offset 240deg */}
        <div className="absolute inset-0 animate-ai-orbit" style={{ animationDelay: '-1.33s' }}>
          <Sparkles size={8} className="text-violet-300/50 absolute top-0 left-1/2 -translate-x-1/2" />
        </div>
      </div>

      {/* Status text with animated dots */}
      <div className="text-center">
        <p className="text-sm text-slate-300 font-medium">{phrases[phraseIdx]}</p>
        <div className="flex items-center justify-center gap-1 mt-2">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ai-dot"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
        <p className="text-[10px] text-slate-600 mt-3">{provider} is thinking&hellip;</p>
      </div>

      {/* Shimmer bars */}
      <div className="w-full space-y-3 mt-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-lg bg-slate-800/60 border border-slate-700/30 p-4">
            <div className="space-y-2">
              <div
                className="h-2.5 rounded-full animate-ai-shimmer"
                style={{
                  width: `${85 - i * 12}%`,
                  background: 'linear-gradient(90deg, rgba(100,116,139,0.15) 25%, rgba(139,92,246,0.12) 50%, rgba(100,116,139,0.15) 75%)',
                  backgroundSize: '200% 100%',
                  animationDelay: `${i * 0.3}s`,
                }}
              />
              <div
                className="h-2.5 rounded-full animate-ai-shimmer"
                style={{
                  width: `${65 - i * 8}%`,
                  background: 'linear-gradient(90deg, rgba(100,116,139,0.15) 25%, rgba(139,92,246,0.08) 50%, rgba(100,116,139,0.15) 75%)',
                  backgroundSize: '200% 100%',
                  animationDelay: `${i * 0.3 + 0.15}s`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SuggestionPanel: React.FC<SuggestionPanelProps> = ({ open, onClose, request, aiProvider }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiSuggestResponse | null>(null);
  const [persona, setPersona] = useState<Persona | undefined>(undefined);

  useEffect(() => {
    if (open) {
      getConfig().then(res => {
        const cfg = res.data as { persona?: Persona };
        setPersona(cfg.persona);
      }).catch(() => {});
    }
  }, [open]);

  const fetchSuggestions = async () => {
    if (!request) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await getAiSuggestions(request);
      setResult(res.data as AiSuggestResponse);
    } catch {
      setResult({ suggestions: [], error: 'Failed to connect to AI provider.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && request) {
      fetchSuggestions();
    }
    if (!open) {
      setResult(null);
    }
  }, [open, request]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [open, onClose]);

  if (!open) return null;

  const providerLabel = aiProvider === 'openai' ? 'OpenAI' : 'Claude';

  const trendText = request?.trendDirection
    ? `${request.trendDirection}${request.trendPct != null ? ` ${Math.abs(request.trendPct)}%` : ''}`
    : null;

  return createPortal(
    <div className="fixed inset-0 z-[9998]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute top-0 right-0 h-full w-96 bg-slate-900 border-l border-slate-700/60 shadow-2xl shadow-black/40 flex flex-col animate-slide-in-right">
        {/* Header — icon glows while loading */}
        <div className="px-5 py-4 border-b border-slate-700/50 flex items-center gap-3 flex-shrink-0">
          <div className={`w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center ${loading ? 'animate-ai-glow' : ''}`}>
            <Sparkles size={16} className={`text-violet-400 ${loading ? 'animate-spin' : ''}`} style={loading ? { animationDuration: '3s' } : undefined} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-slate-100">{persona ? PERSONA_PANEL_TITLES[persona] : 'AI Suggestions'}</h2>
            <p className="text-[11px] text-slate-500 truncate">{request?.metricLabel || 'Metric'}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-1 rounded-md hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Context section */}
        {request && (
          <div className="px-5 py-3 border-b border-slate-700/30 bg-slate-800/30 flex-shrink-0">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500">Current</span>
                <span className="block text-slate-200 font-semibold">{request.currentValue ?? 'N/A'}</span>
              </div>
              {trendText && (
                <div>
                  <span className="text-slate-500">Trend</span>
                  <span className={`block font-semibold ${
                    request.trendDirection === 'up' ? 'text-emerald-400' :
                    request.trendDirection === 'down' ? 'text-rose-400' : 'text-slate-400'
                  }`}>{trendText}</span>
                </div>
              )}
              {request.previousValue != null && (
                <div>
                  <span className="text-slate-500">Previous</span>
                  <span className="block text-slate-300">{request.previousValue}</span>
                </div>
              )}
              {request.teamAverageValue != null && (
                <div>
                  <span className="text-slate-500">Team Avg</span>
                  <span className="block text-slate-300">{request.teamAverageValue}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <AiThinkingLoader provider={providerLabel} />
          )}

          {!loading && result?.error && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-4 animate-fade-in">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-rose-300 font-medium">Unable to get suggestions</p>
                  <p className="text-xs text-rose-400/70 mt-1">{result.error}</p>
                  <button
                    onClick={fetchSuggestions}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-3 py-1.5 rounded-md transition-colors"
                  >
                    <RefreshCw size={12} />
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {!loading && result && !result.error && result.suggestions.length > 0 && (
            <div className="space-y-3">
              {result.suggestions.map((suggestion, i) => (
                <div
                  key={i}
                  className="bg-slate-800/60 border border-slate-700/40 rounded-lg p-4 hover:border-violet-500/30 hover:bg-slate-800/80 transition-all animate-suggestion-in"
                  style={{ animationDelay: `${i * 0.12}s` }}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-[11px] font-bold text-violet-400">
                      {i + 1}
                    </span>
                    <p className="text-sm text-slate-300 leading-relaxed">{suggestion}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-700/30 flex-shrink-0">
          <p className="text-[10px] text-slate-600 text-center">
            Powered by {providerLabel} &middot; Suggestions are AI-generated and should be reviewed
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SuggestionPanel;
