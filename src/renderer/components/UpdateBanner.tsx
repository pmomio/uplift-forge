import { useState, useEffect } from 'react';
import { Download, ExternalLink, X } from 'lucide-react';
import { checkForUpdates, downloadUpdate } from '../api';
import type { UpdateInfo } from '../../shared/types';

export default function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkForUpdates()
      .then((res) => setInfo(res.data as UpdateInfo))
      .catch(() => {});

    if (window.api?.onUpdateStatus) {
      const unsubscribe = window.api.onUpdateStatus((data: unknown) => {
        setInfo(data as UpdateInfo);
        setDismissed(false);
      });
      return unsubscribe;
    }
  }, []);

  if (!info?.updateAvailable || dismissed) return null;

  const handleDownload = async () => {
    try {
      await downloadUpdate();
    } catch {
      // fallback: open release page
      if (info.releaseUrl) window.api.openExternal(info.releaseUrl);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-indigo-500/10 border-b border-indigo-500/20 text-sm animate-fade-in">
      <span className="text-indigo-300">
        Version <strong>{info.latestVersion}</strong> is available
        <span className="text-slate-400 ml-1">(current: {info.currentVersion})</span>
      </span>
      <div className="flex items-center gap-2 ml-auto">
        {info.releaseUrl && (
          <button
            onClick={() => window.api.openExternal(info.releaseUrl!)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 transition-colors"
          >
            <ExternalLink size={12} /> Release notes
          </button>
        )}
        <button
          onClick={handleDownload}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
        >
          <Download size={12} /> Download
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Dismiss update banner"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
