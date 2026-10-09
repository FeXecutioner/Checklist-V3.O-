import React, { useState } from 'react';
import { Download, CheckCircle2, Smartphone, Monitor } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';
import { PWAInstallModal } from './PWAInstallModal';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isInIframe, install } = usePWAInstall();
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = async () => {
    if (isInstallable) {
      const installed = await install();
      if (!installed) {
        setModalOpen(true);
      }
    } else {
      setModalOpen(true);
    }
  };

  return (
    <>
      {isInstalled ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 font-mono text-xs font-bold shadow-xs">
          <CheckCircle2 size={13} className="text-teal-400" />
          <span className="hidden sm:inline">APP INSTALLED</span>
          <span className="sm:hidden">INSTALLED</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="font-mono text-xs font-bold uppercase bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-400 hover:to-purple-500 text-white px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl shadow-[0_0_15px_rgba(45,212,191,0.35)] flex items-center gap-2 cursor-pointer transition-all border border-teal-300/40 hover:scale-[1.02] active:scale-[0.98]"
          title="Download app to your desktop or phone with private internal saving"
        >
          <Download size={14} className="animate-bounce" />
          <span>DOWNLOAD APP</span>
        </button>
      )}

      <PWAInstallModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onTriggerNativeInstall={install}
        isInstallable={isInstallable}
        isIOS={isIOS}
        isAndroid={isAndroid}
        isInIframe={isInIframe}
      />
    </>
  );
};
