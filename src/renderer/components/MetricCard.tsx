import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { HelpCircle, Sparkles, TrendingUp, TrendingDown, Minus, BookOpen } from 'lucide-react';

export interface MetricTooltip {
  description: string;
  target: string;
  trendUp?: string;
  trendDown?: string;
  derivation?: string;
}

export interface TrendInfo {
  change: number;
  lowerIsBetter?: boolean;
}

// --- Explain Modal (lightweight info modal for metric derivation) ---

export const ExplainModal: React.FC<{
  title: string;
  derivation: string;
  onClose: () => void;
}> = ({ title, derivation, onClose }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-800/95 border border-slate-600/50 rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6" role="dialog" aria-label={`Explain: ${title}`}>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={16} className="text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{derivation}</p>
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-slate-700/60 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-600/50 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// --- KPI Card with tooltip + AI + trend ---

interface MetricCardProps {
  icon: React.ReactNode;
  label?: string;
  title?: string;
  value: string | number;
  unit?: string;
  color?: string;
  subtitle?: string;
  tooltip?: MetricTooltip;
  trend?: TrendInfo;
  onAiSuggest?: () => void;
  aiConfigured?: boolean;
  dynamicDerivation?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon, label, title, value, unit, color = 'indigo', subtitle, tooltip, trend, onAiSuggest, aiConfigured, dynamicDerivation,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const displayLabel = title || label || '';
  const displaySubtitle = unit ? `${unit}` : subtitle;

  useEffect(() => {
    if (!showTooltip) return;
    const handler = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTooltip]);

  const COLOR_MAP: Record<string, { card: string; icon: string }> = {
    indigo:  { card: 'bg-indigo-500/10 border-indigo-500/20', icon: 'text-indigo-400' },
    cyan:    { card: 'bg-cyan-500/10 border-cyan-500/20', icon: 'text-cyan-400' },
    amber:   { card: 'bg-amber-500/10 border-amber-500/20', icon: 'text-amber-400' },
    emerald: { card: 'bg-emerald-500/10 border-emerald-500/20', icon: 'text-emerald-400' },
    rose:    { card: 'bg-rose-500/10 border-rose-500/20', icon: 'text-rose-400' },
    violet:  { card: 'bg-violet-500/10 border-violet-500/20', icon: 'text-violet-400' },
  };

  const colors = COLOR_MAP[color] ?? COLOR_MAP.indigo;
  const derivationText = dynamicDerivation ?? tooltip?.derivation;

  return (
    <div className={`glass-card p-4 border ${colors.card}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className={colors.icon}>{icon}</span>
        <span className="text-xs text-slate-400 font-medium flex-1">{displayLabel}</span>
        {tooltip && (
          <TooltipPopover
            ref={tooltipRef}
            show={showTooltip}
            onToggle={() => setShowTooltip(!showTooltip)}
            tooltip={tooltip}
            ariaLabel={`Help: ${displayLabel}`}
            position="right"
          />
        )}
        {derivationText && (
          <button
            onClick={() => setShowExplain(true)}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            aria-label={`Explain: ${displayLabel}`}
          >
            <BookOpen size={13} />
          </button>
        )}
        {aiConfigured && onAiSuggest && (
          <button
            onClick={onAiSuggest}
            className="text-violet-400/60 hover:text-violet-400 transition-colors"
            aria-label={`AI suggestions for ${displayLabel}`}
          >
            <Sparkles size={13} />
          </button>
        )}
      </div>
      {showExplain && derivationText && (
        <ExplainModal title={displayLabel} derivation={derivationText} onClose={() => setShowExplain(false)} />
      )}
      <div className="flex items-end gap-2">
        <p className="text-xl font-bold text-slate-100">{value}</p>
        {trend != null && <TrendArrow change={trend.change} lowerIsBetter={trend.lowerIsBetter} />}
      </div>
      {displaySubtitle && <span className="text-[10px] text-slate-500">{displaySubtitle}</span>}
    </div>
  );
};

// --- Trend arrow ---

const TrendArrow: React.FC<{ change: number; lowerIsBetter?: boolean }> = ({ change, lowerIsBetter }) => {
  if (!isFinite(change)) return null;
  const abs = Math.abs(change);
  if (abs < 1) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 mb-0.5">
        <Minus size={10} />stable
      </span>
    );
  }
  const isUp = change > 0;
  const isGood = lowerIsBetter ? !isUp : isUp;
  const colorClass = isGood ? 'text-emerald-400' : 'text-rose-400';
  const Icon = isUp ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${colorClass} mb-0.5`}>
      <Icon size={10} />{abs.toFixed(2)}%
    </span>
  );
};

// --- Section header with tooltip + optional AI ---

export const SectionTitle: React.FC<{
  title: string;
  icon?: React.ReactNode;
  tooltip?: MetricTooltip;
  onAiSuggest?: () => void;
  aiConfigured?: boolean;
  dynamicDerivation?: string;
}> = ({ title, icon, tooltip, onAiSuggest, aiConfigured, dynamicDerivation }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const derivationText = dynamicDerivation ?? tooltip?.derivation;

  useEffect(() => {
    if (!showTooltip) return;
    const handler = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTooltip]);

  return (
    <>
      <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
        {icon}
        {title}
        {tooltip && (
          <TooltipPopover
            ref={tooltipRef}
            show={showTooltip}
            onToggle={() => setShowTooltip(!showTooltip)}
            tooltip={tooltip}
            ariaLabel={`Help: ${title}`}
            position="left"
          />
        )}
        {derivationText && (
          <button
            onClick={() => setShowExplain(true)}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            aria-label={`Explain: ${title}`}
          >
            <BookOpen size={13} />
          </button>
        )}
        {aiConfigured && onAiSuggest && (
          <button
            onClick={onAiSuggest}
            className="text-violet-400/60 hover:text-violet-400 transition-colors ml-auto"
            aria-label={`AI suggestions for ${title}`}
          >
            <Sparkles size={13} />
          </button>
        )}
      </h3>
      {showExplain && derivationText && (
        <ExplainModal title={title} derivation={derivationText} onClose={() => setShowExplain(false)} />
      )}
    </>
  );
};

// --- Shared tooltip popover ---

const TooltipPopover = React.forwardRef<HTMLDivElement, {
  show: boolean;
  onToggle: () => void;
  tooltip: MetricTooltip;
  ariaLabel: string;
  position?: 'left' | 'right';
}>(({ show, onToggle, tooltip, ariaLabel, position = 'right' }, ref) => {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [flipUp, setFlipUp] = useState(false);

  useEffect(() => {
    if (!show || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setFlipUp(spaceBelow < 200);
  }, [show]);

  // Merge forwarded ref and internal ref
  const setRefs = (node: HTMLDivElement | null) => {
    (triggerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  return (
    <div
      className="relative"
      ref={setRefs}
      onMouseEnter={onToggle}
      onMouseLeave={onToggle}
    >
      <button
        className="text-slate-500 hover:text-slate-300 transition-colors"
        aria-label={ariaLabel}
      >
        <HelpCircle size={13} />
      </button>
      {show && (
        <div className={`absolute z-50 w-72 bg-slate-800/95 backdrop-blur-md border border-slate-600/50 rounded-lg shadow-2xl p-3 text-left animate-fade-in ${
          flipUp ? 'bottom-full mb-2' : 'top-full mt-2'
        } ${
          position === 'right' ? 'right-0' : 'left-0'
        }`}>
          <p className="text-xs text-slate-200 leading-relaxed">{tooltip.description}</p>
          <div className="border-t border-slate-700/50 pt-2 mt-2">
            <span className="text-[10px] text-emerald-300 font-semibold uppercase tracking-wider">High-Performing Target</span>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{tooltip.target}</p>
          </div>
          {(tooltip.trendUp || tooltip.trendDown) && (
            <div className="border-t border-slate-700/50 pt-2 mt-2 space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Trend Guide</span>
              {tooltip.trendUp && (
                <div className="flex items-start gap-1.5">
                  <TrendingUp size={11} className="text-slate-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-slate-300 leading-relaxed">{tooltip.trendUp}</p>
                </div>
              )}
              {tooltip.trendDown && (
                <div className="flex items-start gap-1.5">
                  <TrendingDown size={11} className="text-slate-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-slate-300 leading-relaxed">{tooltip.trendDown}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

TooltipPopover.displayName = 'TooltipPopover';

export default MetricCard;
