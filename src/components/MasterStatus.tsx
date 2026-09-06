import React from 'react';
import { GateStatus } from '../types';
import { ShieldAlert, ShieldCheck, Shield } from 'lucide-react';

interface MasterStatusProps {
  status: GateStatus;
}

export const MasterStatus: React.FC<MasterStatusProps> = ({ status }) => {
  let message = 'Complete sections S1 through S4 to arm the execution gate.';
  let statusColorClass = 'text-zinc-300';
  let badgeColor = 'bg-white/10 text-zinc-300 border border-white/10';
  let statusIcon = <Shield className="w-5 h-5 text-zinc-400" />;

  if (status === 'STANDBY') {
    message = 'Sections S1–S4 satisfied. Gate armed. Confirm all final gate checkboxes below.';
    statusColorClass = 'text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]';
    badgeColor = 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]';
    statusIcon = <ShieldAlert className="w-5 h-5 text-amber-400 animate-pulse" />;
  } else if (status === 'GO') {
    message = 'ALL CRITERIA VERIFIED. EXECUTION GATE UNLOCKED. PROCEED WITH RIGID DISCIPLINE.';
    statusColorClass = 'text-teal-300 drop-shadow-[0_0_25px_rgba(45,212,191,0.5)]';
    badgeColor = 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-[0_0_15px_rgba(45,212,191,0.3)]';
    statusIcon = <ShieldCheck className="w-5 h-5 text-teal-300" />;
  }

  return (
    <section
      id="master-status-card"
      className="relative bg-zinc-900/40 border border-white/10 backdrop-blur-xl p-6 rounded-2xl md:rounded-3xl mb-6 shadow-2xl transition-all duration-300 overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div
            id="mstatus"
            className={`font-disp text-4xl sm:text-6xl font-bold tracking-tight leading-none ${statusColorClass} transition-colors duration-300`}
          >
            {status}
          </div>
          <span className={`text-[10px] font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1.5 ${badgeColor}`}>
            {statusIcon}
            <span>GATE SYSTEM</span>
          </span>
        </div>
      </div>

      <div id="mmsg" className="font-mono text-xs text-zinc-400 font-medium tracking-wide flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 inline-block shrink-0 shadow-[0_0_6px_#2dd4bf]" />
        <span>{message}</span>
      </div>
    </section>
  );
};
