import React, { useEffect, useState } from 'react';
import { WifiOff, HardDrive } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-2xl bg-zinc-950/95 border border-purple-500/40 px-4 py-2.5 text-xs font-mono font-medium text-zinc-200 shadow-2xl backdrop-blur-md">
      <WifiOff size={14} className="text-purple-400 shrink-0" />
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
        <span>Offline Mode — All trades save internally to your device.</span>
      </div>
      <HardDrive size={13} className="text-teal-400 ml-1" />
    </div>
  );
};
