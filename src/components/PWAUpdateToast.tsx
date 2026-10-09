import React, { useEffect, useState } from 'react';
import { subscribeToAppUpdates, applyPublishedUpdate } from '../utils/pwaUpdate';
import { Sparkles, RefreshCw, X } from 'lucide-react';

export const PWAUpdateToast: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAppUpdates((updateAvailable) => {
      if (updateAvailable) {
        setHasUpdate(true);
        setDismissed(false);
      }
    });

    return unsubscribe;
  }, []);

  if (!hasUpdate || dismissed) return null;

  const handleUpdate = () => {
    setIsUpdating(true);
    applyPublishedUpdate();
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md w-[calc(100vw-2rem)] sm:w-auto bg-zinc-950/95 border border-teal-400/50 p-4 rounded-2xl shadow-[0_0_35px_rgba(45,212,191,0.35)] backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-400 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-[0_0_15px_rgba(45,212,191,0.4)]">
          <Sparkles size={18} />
        </div>
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-300 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-500/30">
              New Version Published
            </span>
          </div>
          <p className="font-disp font-semibold text-xs sm:text-sm text-zinc-100 mt-1">
            FeXecutioner OS has been updated!
          </p>
          <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
            A new release was published. Reload to immediately sync your downloaded app with the latest features.
          </p>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-400 to-purple-600 hover:from-teal-300 hover:to-purple-500 text-zinc-950 font-mono font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={isUpdating ? 'animate-spin' : ''} />
              <span>{isUpdating ? 'Applying...' : 'Reload & Apply Now'}</span>
            </button>

            <button
              onClick={() => setDismissed(true)}
              className="px-2.5 py-1.5 text-zinc-400 hover:text-white font-mono text-xs rounded-lg transition-colors cursor-pointer"
            >
              Later
            </button>
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
