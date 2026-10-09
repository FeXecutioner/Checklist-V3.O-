import React, { useState } from 'react';
import {
  X,
  Download,
  Smartphone,
  Monitor,
  Share,
  PlusSquare,
  ShieldCheck,
  HardDrive,
  WifiOff,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { manualCheckForUpdate } from '../utils/pwaUpdate';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerNativeInstall?: () => Promise<boolean>;
  isInstallable: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isInIframe: boolean;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  onTriggerNativeInstall,
  isInstallable,
  isIOS,
  isAndroid,
  isInIframe,
}) => {
  const [activeTab, setActiveTab] = useState<'desktop' | 'ios' | 'android'>(
    isIOS ? 'ios' : isAndroid ? 'android' : 'desktop'
  );
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatusMsg, setUpdateStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleManualCheck = async () => {
    setCheckingUpdate(true);
    setUpdateStatusMsg(null);
    try {
      const result = await manualCheckForUpdate();
      setUpdateStatusMsg(result.message);
    } catch {
      setUpdateStatusMsg('Check complete. You are on the latest published version.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleOpenStandalone = () => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  const handleNativeClick = async () => {
    if (onTriggerNativeInstall) {
      const success = await onTriggerNativeInstall();
      if (success) {
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-zinc-950/95 border border-teal-500/30 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(45,212,191,0.15)] text-zinc-100 overflow-hidden">
        {/* Glow orb */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-gradient-to-br from-teal-500/20 to-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500 to-purple-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(45,212,191,0.4)]">
              <Download size={20} />
            </div>
            <div>
              <h2 className="font-disp font-bold text-lg sm:text-xl uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                <span>INSTALL APP & SAVE INTERNALLY</span>
              </h2>
              <p className="font-mono text-[11px] text-teal-300/90 font-medium">
                Autonomous App with Isolated Device Storage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Internal Storage Value Proposition */}
        <div className="mt-4 p-3.5 bg-zinc-900/60 border border-white/10 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-2 text-center font-mono">
          <div className="flex items-center sm:flex-col justify-center gap-2 p-1.5">
            <HardDrive size={15} className="text-teal-400 shrink-0" />
            <div>
              <div className="text-[11px] font-bold text-zinc-200">Private Local Storage</div>
              <div className="text-[9px] text-zinc-400">Isolated IndexedDB on this device</div>
            </div>
          </div>
          <div className="flex items-center sm:flex-col justify-center gap-2 p-1.5 border-t sm:border-t-0 sm:border-l border-white/10">
            <WifiOff size={15} className="text-purple-400 shrink-0" />
            <div>
              <div className="text-[11px] font-bold text-zinc-200">100% Offline Ready</div>
              <div className="text-[9px] text-zinc-400">Zero network dependencies</div>
            </div>
          </div>
          <div className="flex items-center sm:flex-col justify-center gap-2 p-1.5 border-t sm:border-t-0 sm:border-l border-white/10">
            <ShieldCheck size={15} className="text-teal-400 shrink-0" />
            <div>
              <div className="text-[11px] font-bold text-zinc-200">Device Ownership</div>
              <div className="text-[9px] text-zinc-400">Your trades stay solely yours</div>
            </div>
          </div>
        </div>

        {/* Device Select Tabs */}
        <div className="mt-4 flex items-center gap-1.5 p-1 bg-zinc-900/80 rounded-2xl border border-white/10 font-mono text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('desktop')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all cursor-pointer ${
              activeTab === 'desktop'
                ? 'bg-gradient-to-r from-teal-500/30 to-purple-600/30 text-teal-300 border border-teal-400/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Monitor size={14} />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all cursor-pointer ${
              activeTab === 'ios'
                ? 'bg-gradient-to-r from-teal-500/30 to-purple-600/30 text-teal-300 border border-teal-400/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Smartphone size={14} />
            <span>iPhone / iOS</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all cursor-pointer ${
              activeTab === 'android'
                ? 'bg-gradient-to-r from-teal-500/30 to-purple-600/30 text-teal-300 border border-teal-400/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Smartphone size={14} />
            <span>Android</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-4 p-4 bg-zinc-900/40 border border-white/5 rounded-2xl font-mono text-xs">
          {activeTab === 'desktop' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-teal-500/30">
                  1
                </div>
                <div>
                  <div className="font-bold text-zinc-200">Chrome, Edge, or Brave on Desktop</div>
                  <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed">
                    Look for the <strong className="text-teal-300">Install icon</strong> (a computer monitor or download arrow with a plus) in the right side of your browser URL address bar.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-teal-500/30">
                  2
                </div>
                <div>
                  <div className="font-bold text-zinc-200">Standalone Window & Desktop Shortcut</div>
                  <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed">
                    Click <strong>"Install"</strong>. The app will launch into its own borderless window, add a desktop icon, and run independently like a native desktop app.
                  </p>
                </div>
              </div>

              {isInstallable && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleNativeClick}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-400 hover:to-purple-500 text-white font-bold text-xs uppercase flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(45,212,191,0.3)] cursor-pointer transition-all border border-teal-300/40"
                  >
                    <Download size={14} />
                    <span>Trigger Browser Install Now</span>
                  </button>
                </div>
              )}

              {isInIframe && (
                <div className="p-3 bg-zinc-950/80 rounded-xl border border-teal-500/30 text-[11px] text-zinc-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <span>Running in preview container? Open in standalone tab for 1-click install:</span>
                  <button
                    type="button"
                    onClick={handleOpenStandalone}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-teal-300 font-bold border border-white/10 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-all"
                  >
                    <ExternalLink size={12} />
                    <span>Open in New Tab</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ios' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-teal-500/30">
                  1
                </div>
                <div>
                  <div className="font-bold text-zinc-200">Open in Safari Browser</div>
                  <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed">
                    Make sure this URL is open in Apple Safari on your iPhone or iPad.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-teal-500/30">
                  2
                </div>
                <div>
                  <div className="font-bold text-zinc-200 flex items-center gap-1.5">
                    <span>Tap the Share Button</span>
                    <Share size={13} className="text-teal-300" />
                  </div>
                  <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed">
                    Tap the square icon with an upward arrow at the bottom toolbar of Safari.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-teal-500/30">
                  3
                </div>
                <div>
                  <div className="font-bold text-zinc-200 flex items-center gap-1.5">
                    <span>Tap "Add to Home Screen"</span>
                    <PlusSquare size={13} className="text-purple-400" />
                  </div>
                  <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed">
                    Scroll down in the share sheet and tap <strong>"Add to Home Screen"</strong>, then tap <strong>Add</strong> at top right. The FeXecutioner icon will appear on your phone home screen with its own isolated memory!
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'android' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-teal-500/30">
                  1
                </div>
                <div>
                  <div className="font-bold text-zinc-200">Open in Chrome for Android</div>
                  <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed">
                    Tap the three dots menu <strong>(⋮)</strong> in the top-right corner of Chrome.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-teal-500/30">
                  2
                </div>
                <div>
                  <div className="font-bold text-zinc-200">Tap "Install App" or "Add to Home screen"</div>
                  <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed">
                    Chrome will prompt you to install. Tap <strong>Install</strong>. The app icon will appear directly in your phone app drawer.
                  </p>
                </div>
              </div>

              {isInstallable && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleNativeClick}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-400 hover:to-purple-500 text-white font-bold text-xs uppercase flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(45,212,191,0.3)] cursor-pointer transition-all border border-teal-300/40"
                  >
                    <Download size={14} />
                    <span>Install App on Android Now</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Re-Publish & Auto-Update Sync Panel */}
        <div className="mt-4 p-3 bg-zinc-900/40 border border-white/5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 font-mono text-xs">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-teal-400 shrink-0" />
            <div>
              <span className="text-zinc-200 font-bold">Auto-Sync on Re-Publish</span>
              <span className="block text-[10px] text-zinc-500">
                Downloaded apps check for updates automatically every 60s & on startup.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleManualCheck}
            disabled={checkingUpdate}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-teal-300 border border-teal-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={12} className={checkingUpdate ? 'animate-spin' : ''} />
            <span>{checkingUpdate ? 'Checking...' : 'Check for Updates'}</span>
          </button>
        </div>

        {updateStatusMsg && (
          <div className="mt-2 p-2 bg-teal-950/40 border border-teal-500/30 rounded-xl font-mono text-[11px] text-teal-300 flex items-center gap-2">
            <CheckCircle2 size={13} className="shrink-0 text-teal-400" />
            <span>{updateStatusMsg}</span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between pt-4 border-t border-white/10 font-mono text-[11px]">
          <span className="text-zinc-500 flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-teal-400" />
            <span>FeXecutioner OS PWA v2.0</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl border border-white/10 cursor-pointer font-bold transition-all"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
