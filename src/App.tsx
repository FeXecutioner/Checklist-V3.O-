import React, { useState, useEffect } from 'react';
import { SetupType, GateStatus, ChecklistState, ExecutionJournalInputs, TradeRecord } from './types';
import { getTrades, saveTrade, deleteTrade, clearAllTrades } from './utils/storage';
import { Header } from './components/Header';
import { MasterStatus } from './components/MasterStatus';
import { ExecutionView } from './components/ExecutionView';
import { JournalView } from './components/JournalView';
import { Lightbox } from './components/Lightbox';
import { Activity, BookOpen, CheckCircle, Shield, Database, Cpu } from 'lucide-react';

const initialChecklist: ChecklistState = {
  biasInput: '',
  premarketAction: false,
  htfFvg: false,
  m5m15Gap: false,
  manipulation: false,
  inversionFound: false,
  highestTfGap: false,
  acctSize: '50000',
  maxDD: '2000',
  riskPerTrade: '400',
  rrRatio: false,
  clearLiquidity: false,
  inversionSpeed: false,
  gateSessionWindow: false,
  gateHtfGap: false,
  gateM5M15Manip: false,
  gateInversionHighest: false,
  gatePlannedTrade: false,
};

const initialJournalInputs: ExecutionJournalInputs = {
  balBefore: '',
  balAfter: '',
  manualPnL: '',
  htfLogic: '',
  ltfTarget: '',
  entryModelTime: '',
  morningRoutine: '',
  feelings: '',
  chartImage: null,
  followedRules: true,
  emotionsControlled: true,
  ruleBreaks: '',
  improvements: '',
};

export default function App() {
  const [activePage, setActivePage] = useState<'exec' | 'journal'>('exec');
  const [setup, setSetup] = useState<SetupType>('continuation');
  const [status, setStatus] = useState<GateStatus>('NO-GO');
  const [checklist, setChecklist] = useState<ChecklistState>(initialChecklist);
  const [journalInputs, setJournalInputs] = useState<ExecutionJournalInputs>(initialJournalInputs);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; actionText?: string; onAction?: () => void } | null>(null);

  // Load persistent trade records on mount
  useEffect(() => {
    getTrades().then((loadedTrades) => {
      setTrades(loadedTrades);
    });
  }, []);

  // Keyboard shortcut: ESC to close lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxImage) {
        setLightboxImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage]);

  // Commit Trade (updates dynamically without page reload)
  const handleCommitTrade = async (trade: TradeRecord) => {
    await saveTrade(trade);
    setTrades((prev) => [trade, ...prev.filter((t) => t.id !== trade.id)]);
    
    setToastMessage({
      text: 'Trade successfully saved to internal journal with all typed contents!',
      actionText: 'VIEW IN JOURNAL',
      onAction: () => {
        setActivePage('journal');
        setToastMessage(null);
      },
    });

    setTimeout(() => {
      setToastMessage((cur) => (cur?.actionText === 'VIEW IN JOURNAL' ? null : cur));
    }, 7000);
  };

  // Delete Trade (updates dynamically without page reload)
  const handleDeleteTrade = async (id: number) => {
    await deleteTrade(id);
    setTrades((prev) => prev.filter((t) => t.id !== id));
    setToastMessage({ text: 'Record deleted from journal.' });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Clear all trades
  const handleClearAllTrades = async () => {
    await clearAllTrades();
    setTrades([]);
    setToastMessage({ text: 'Internal journal cleared.' });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Reset Console in state without page reload
  const handleResetConsole = () => {
    if (window.confirm('Reset the execution console? Current unsaved checklist inputs will be cleared.')) {
      setChecklist(initialChecklist);
      setJournalInputs(initialJournalInputs);
      setStatus('NO-GO');
      setToastMessage({ text: 'Console reset. Ready for next session.' });
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans relative selection:bg-teal-500/30 selection:text-white pb-16 overflow-x-hidden">
      {/* Immersive UI Ambient Glowing Backdrop Orbs (Turquoise & Purple) */}
      <div className="fixed top-[-120px] left-[-100px] w-[500px] h-[500px] bg-teal-500/20 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-120px] right-[-100px] w-[500px] h-[500px] bg-purple-900/30 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed top-1/2 left-1/4 w-[350px] h-[350px] bg-teal-950/15 rounded-full blur-[160px] pointer-events-none -z-10" />

      <div className="max-w-[1040px] mx-auto p-4 sm:p-6 lg:p-8 relative z-10">
        {/* Immersive Glass Navigation Tabs */}
        <nav className="flex gap-2 bg-zinc-900/60 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl mb-6 shadow-2xl">
          <button
            type="button"
            id="nav-exec-btn"
            onClick={() => setActivePage('exec')}
            className={`flex-1 py-3 px-5 font-mono font-bold text-xs uppercase cursor-pointer transition-all duration-300 rounded-xl flex items-center justify-center gap-2.5 ${
              activePage === 'exec'
                ? 'bg-gradient-to-r from-teal-500 to-purple-600 text-white shadow-[0_0_25px_rgba(45,212,191,0.35)] border border-teal-300/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Activity size={16} className={activePage === 'exec' ? 'text-white' : 'text-zinc-400'} />
            <span>Execution Console</span>
          </button>

          <button
            type="button"
            id="nav-journal-btn"
            onClick={() => setActivePage('journal')}
            className={`flex-1 py-3 px-5 font-mono font-bold text-xs uppercase cursor-pointer transition-all duration-300 rounded-xl flex items-center justify-center gap-2.5 ${
              activePage === 'journal'
                ? 'bg-gradient-to-r from-teal-500 to-purple-600 text-white shadow-[0_0_25px_rgba(45,212,191,0.35)] border border-teal-300/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <BookOpen size={16} className={activePage === 'journal' ? 'text-white' : 'text-zinc-400'} />
            <span>Internal Journal</span>
            {trades.length > 0 && (
              <span
                className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold transition-all ${
                  activePage === 'journal'
                    ? 'bg-white text-teal-950 shadow-sm'
                    : 'bg-white/10 text-zinc-300 border border-white/10'
                }`}
              >
                {trades.length}
              </span>
            )}
          </button>
        </nav>

        {/* Global Floating Toast Notification */}
        {toastMessage && (
          <div className="mb-6 bg-zinc-900/90 border border-teal-500/40 text-white p-4 rounded-2xl font-mono text-xs flex flex-wrap items-center justify-between gap-3 shadow-[0_0_30px_rgba(45,212,191,0.25)] backdrop-blur-xl animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center shrink-0">
                <CheckCircle size={15} className="text-teal-300" />
              </div>
              <span className="text-zinc-200 font-medium">{toastMessage.text}</span>
            </div>
            {toastMessage.actionText && toastMessage.onAction && (
              <button
                type="button"
                onClick={toastMessage.onAction}
                className="bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-400 hover:to-purple-500 text-white font-bold px-4 py-2 rounded-xl text-xs tracking-wider shadow-[0_0_15px_rgba(45,212,191,0.4)] cursor-pointer transition-all border border-teal-300/30"
              >
                {toastMessage.actionText}
              </button>
            )}
          </div>
        )}

        {/* Immersive Telemetry Header */}
        <Header />

        {/* Master Console Status Display */}
        {activePage === 'exec' && <MasterStatus status={status} />}

        {/* Views */}
        {activePage === 'exec' ? (
          <ExecutionView
            setup={setup}
            setSetup={setSetup}
            status={status}
            setStatus={setStatus}
            onCommitTrade={handleCommitTrade}
            onReset={handleResetConsole}
            checklist={checklist}
            setChecklist={setChecklist}
            journalInputs={journalInputs}
            setJournalInputs={setJournalInputs}
          />
        ) : (
          <JournalView
            trades={trades}
            onDeleteTrade={handleDeleteTrade}
            onClearAllTrades={handleClearAllTrades}
            onOpenLightbox={(img) => setLightboxImage(img)}
            onNavigateToExec={() => setActivePage('exec')}
          />
        )}

        {/* Immersive Status Footer */}
        <footer className="mt-12 px-6 py-4 rounded-2xl bg-zinc-950/80 border border-white/5 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-zinc-500 font-mono text-[11px]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Database size={13} className="text-teal-400" />
              <span>STORAGE: IDB ACTIVE</span>
            </span>
            <span className="text-white/20">|</span>
            <span className="text-zinc-400">RECORDS: {trades.length}</span>
            <span className="text-white/20">|</span>
            <span className="text-zinc-400">OS: v5.0 IMMERSIVE</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold tracking-wider">
              <Shield size={13} />
              <span>ENCRYPTION: LOCAL DISK</span>
            </span>
          </div>
        </footer>

        {/* Lightbox for Zoomed Images */}
        <Lightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />
      </div>
    </div>
  );
}
