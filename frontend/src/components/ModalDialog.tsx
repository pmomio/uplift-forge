import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface BaseProps {
  open: boolean;
  onClose: () => void;
  title: string;
}

interface ConfirmDialogProps extends BaseProps {
  mode: 'confirm';
  message: string;
  confirmLabel?: string;
  confirmColor?: 'rose' | 'indigo';
  onConfirm: () => void;
}

interface PromptDialogProps extends BaseProps {
  mode: 'prompt';
  message?: string;
  placeholder?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
  validate?: (value: string) => string | null;
}

export type ModalDialogProps = ConfirmDialogProps | PromptDialogProps;

const ModalDialog: React.FC<ModalDialogProps> = (props) => {
  const { open, onClose, title, mode } = props;
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInputValue('');
      setError(null);
      // Focus input after portal renders
      if (mode === 'prompt') {
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }
  }, [open, mode]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleConfirm = () => {
    if (mode === 'confirm') {
      props.onConfirm();
      onClose();
    } else {
      const trimmed = inputValue.trim();
      if (props.validate) {
        const err = props.validate(trimmed);
        if (err) {
          setError(err);
          return;
        }
      }
      props.onSubmit(trimmed);
      onClose();
    }
  };

  const confirmColor = mode === 'confirm' ? (props.confirmColor || 'rose') : 'indigo';
  const confirmBg = confirmColor === 'rose'
    ? 'bg-rose-500 hover:bg-rose-400 active:bg-rose-600 shadow-rose-500/20'
    : 'bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 shadow-indigo-500/20';

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-800 rounded-xl shadow-2xl shadow-black/40 border border-slate-700/50 w-full max-w-sm">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-700/50 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-0.5 rounded-md hover:bg-slate-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {mode === 'confirm' && (
            <p className="text-sm text-slate-300">{props.message}</p>
          )}
          {mode === 'prompt' && (
            <>
              {props.message && (
                <p className="text-sm text-slate-300 mb-3">{props.message}</p>
              )}
              <input
                ref={inputRef}
                type="text"
                className="bg-slate-700/60 border border-slate-600/60 text-slate-100 text-sm rounded-md w-full px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400/50 placeholder:text-slate-500"
                placeholder={props.placeholder || ''}
                value={inputValue}
                onChange={(e) => { setInputValue(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
              />
              {error && (
                <p className="text-xs text-rose-400 mt-1.5">{error}</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-700/50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-sm font-medium text-slate-300 bg-slate-700/50 border border-slate-600/50 rounded-md hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className={`px-3.5 py-1.5 text-sm font-medium text-white rounded-md shadow-sm transition-all ${confirmBg}`}
          >
            {mode === 'confirm' ? (props.confirmLabel || 'Confirm') : (props.confirmLabel || 'OK')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ModalDialog;
