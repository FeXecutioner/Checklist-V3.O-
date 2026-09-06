import React, { useState, useEffect } from 'react';
import { Terminal } from 'lucide-react';

export const Header: React.FC = () => {
  const [clock, setClock] = useState<string>('00:00:00');
  const [isInWindow, setIsInWindow] = useState<boolean>(false);
  const [localRange, setLocalRange] = useState<string>('LOCAL: --:--');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-GB', { hour12: false }));

      // Calculate NY AM Session: 9:30 AM to 11:00 AM NY time
      const nyStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
      const nyDate = new Date(nyStr);
      const nyMins = nyDate.getHours() * 60 + nyDate.getMinutes();
      const inWindow = nyMins >= (9 * 60 + 30) && nyMins <= (11 * 60);
      setIsInWindow(inWindow);

      // Local time equivalent of 9:30 AM - 11:00 AM NY
      const diff = now.getTime() - nyDate.getTime();
      const nyStart = new Date(nyDate);
      nyStart.setHours(9, 30, 0, 0);
      const nyEnd = new Date(nyDate);
      nyEnd.setHours(11, 0, 0, 0);

      const localStart = new Date(nyStart.getTime() + diff);
      const localEnd = new Date(nyEnd.getTime() + diff);

      const startFmt = localStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      const endFmt = localEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

      setLocalRange(`LOCAL: ${startFmt} - ${endFmt}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      id="header"
      className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-zinc-900/40 border border-white/10 backdrop-blur-xl p-5 sm:p-6 rounded-2xl md:rounded-3xl mb-6 shadow-2xl gap-4 relative overflow-hidden"
    >
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 bg-gradient-to-tr from-teal-400 to-purple-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(45,212,191,0.45)] border border-teal-300/40 shrink-0">
          <Terminal className="w-6 h-6 text-white" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-disp text-2xl sm:text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-100 to-zinc-400 uppercase leading-none m-0">
              FEXECUTIONER
            </h1>
            <span className="text-[10px] font-mono font-bold text-teal-300 border border-teal-500/30 bg-teal-950/40 px-2 py-0.5 rounded-full tracking-wider">
              v5.0 OS
            </span>
          </div>
          <p className="text-[10px] text-teal-400 font-mono tracking-widest uppercase mt-1">
            Institutional Telemetry & Execution Gate
          </p>
        </div>
      </div>

      <div className="telemetry text-left sm:text-right font-mono flex flex-col sm:items-end w-full sm:w-auto">
        <div id="clock" className="clock text-3xl sm:text-4xl font-bold tracking-wider text-zinc-100 drop-shadow-sm">
          {clock}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          <div
            id="session-status"
            className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono font-semibold transition-all duration-300 ${
              isInWindow
                ? 'bg-teal-950/40 text-teal-300 border-teal-500/40 shadow-[0_0_12px_rgba(45,212,191,0.3)]'
                : 'bg-white/5 text-zinc-400 border-white/10'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isInWindow
                  ? 'bg-teal-400 animate-pulse shadow-[0_0_8px_#2dd4bf]'
                  : 'bg-zinc-600'
              }`}
            />
            <span>{isInWindow ? 'IN WINDOW (NY AM)' : 'OUTSIDE WINDOW'}</span>
          </div>

          <div
            id="local-range"
            className={`text-[11px] font-mono font-medium px-2.5 py-1 rounded-lg bg-black/40 border border-white/5 ${
              isInWindow ? 'text-zinc-200' : 'text-zinc-500'
            }`}
          >
            {localRange}
          </div>
        </div>
      </div>
    </header>
  );
};
