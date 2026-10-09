import { PrivateSyncPanel } from './components/PrivateSyncPanel';
import { readJournalSnapshot, type JournalSnapshot } from './utils/storage';
import React, { useState, useEffect } from 'react';
import { SetupType, GateStatus, ChecklistState, ExecutionJournalInputs, TradeRecord, TradingAccount } from './types';
import {
  getTrades,
  saveTrade,
  deleteTrade,
  clearAllTrades,
  getAccounts,
  saveAccount,
  deleteAccount,
  getActiveAccountId,
  setActiveAccountId,
  DEFAULT_ACCOUNTS,
  syncTradesAccountMetadata,
} from './utils/storage';
import { Header } from './components/Header';
import { MasterStatus } from './components/MasterStatus';
import { ExecutionView } from './components/ExecutionView';
import { JournalView } from './components/JournalView';
import { Lightbox } from './components/Lightbox';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAUpdateToast } from './components/PWAUpdateToast';
import { AccountSelectorBar } from './components/AccountSelectorBar';
import { AccountManagerModal } from './components/AccountManagerModal';
import { Activity, BookOpen, CheckCircle, Shield, Database, Cpu, Download } from 'lucide-react';

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
  isBreakEven: false,
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
  const [accounts, setAccounts] = useState<TradingAccount[]>(DEFAULT_ACCOUNTS);
  const [activeAccountId, setActiveAccountIdState] = useState<string>('acc-live-main');
  const [isAccountManagerOpen, setIsAccountManagerOpen] = useState<boolean>(false);
  const [initialEditAccountId, setInitialEditAccountId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; actionText?: string; onAction?: () => void } | null>(null);
  const [isNoTradeFormOpen, setIsNoTradeFormOpen] = useState<boolean>(false);

  // Open Account Manager, optionally targeting a specific account for editing
  const handleOpenAccountManager = (editAccountId?: string) => {
    setInitialEditAccountId(editAccountId || null);
    setIsAccountManagerOpen(true);
  };

  // Trigger No Trade Day from Execution View
  const handleTriggerNoTradeDay = () => {
    setActivePage('journal');
    setIsNoTradeFormOpen(true);
    setToastMessage({
      text: 'No Trade Day activated: Capital preserved ($0.00). Complete your discipline log below.',
    });
    setTimeout(() => {
      setToastMessage((cur) => (cur?.text.includes('No Trade Day activated') ? null : cur));
    }, 6000);
  };

  // Load persistent accounts and trade records on mount
  useEffect(() => {
    getAccounts().then((loadedAccounts) => {
      if (loadedAccounts && loadedAccounts.length > 0) {
        setAccounts(loadedAccounts);
        const storedActive = getActiveAccountId();
        const exists = loadedAccounts.some((a) => a.id === storedActive);
        const currentActive = exists ? storedActive : loadedAccounts[0].id;
        setActiveAccountIdState(currentActive);
        
        // Sync checklist acctSize if set to default
        const activeAcc = loadedAccounts.find((a) => a.id === currentActive);
        if (activeAcc && activeAcc.initialBalance) {
          setChecklist((prev) => ({
            ...prev,
            acctSize: String(activeAcc.initialBalance),
          }));
        }
      }
    });

    getTrades().then((loadedTrades) => {
      setTrades(loadedTrades);
    });
  }, []);

  useEffect(() => {
    const apply = (snapshot: JournalSnapshot) => {
      setAccounts(snapshot.accounts); setTrades(snapshot.trades);
      setActiveAccountIdState(current => current === 'all' || snapshot.accounts.some(account => account.id === current) ? current : snapshot.accounts[0].id);
    };
    const received = (event: Event) => apply((event as CustomEvent<JournalSnapshot>).detail);
    const otherTab = (event: StorageEvent) => { if (event.key === 'fexec_accounts_v2' || event.key === 'fexec_trades_v2') void readJournalSnapshot().then(apply); };
    window.addEventListener('fexec-sync-applied', received); window.addEventListener('storage',otherTab);
    return () => {window.removeEventListener('fexec-sync-applied',received);window.removeEventListener('storage',otherTab);};
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

  // Switch active account
  const handleSelectAccount = (accId: string) => {
    setActiveAccountIdState(accId);
    if (accId !== 'all') {
      setActiveAccountId(accId);
      const acc = accounts.find((a) => a.id === accId);
      if (acc) {
        const accTrades = trades.filter((t) => (t.accountId || 'acc-live-main') === acc.id);
        const accPnL = accTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const liveBal = acc.initialBalance + accPnL;
        setChecklist((prev) => ({
          ...prev,
          acctSize: String(liveBal),
          maxDD: String(acc.maxDrawdown || 2500),
          profitTarget: String(acc.profitTarget || 3000),
        }));
        setToastMessage({
          text: `Switched active account to: [${acc.type.toUpperCase()}] ${acc.name}`,
        });
        setTimeout(() => setToastMessage(null), 3000);
      }
    }
  };

  // Save account (edit existing or create new)
  const handleSaveAccount = async (account: TradingAccount) => {
    await saveAccount(account);
    const reloaded = await getAccounts();
    setAccounts(reloaded);

    // If edited account is the currently active account, sync checklist acctSize, maxDD, and profitTarget
    if (activeAccountId === account.id) {
      const accTrades = trades.filter((t) => (t.accountId || 'acc-live-main') === account.id);
      const accPnL = accTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const liveBal = account.initialBalance + accPnL;
      setChecklist((prev) => ({
        ...prev,
        acctSize: String(liveBal),
        maxDD: String(account.maxDrawdown || 2500),
        profitTarget: String(account.profitTarget || 3000),
      }));
    }

    // Sync accountName and accountType across existing trades in state and storage
    const updatedTrades = await syncTradesAccountMetadata(account.id, account.name, account.type);
    setTrades(updatedTrades);

    setToastMessage({
      text: `Account "${account.name}" updated successfully (Starting: $${account.initialBalance.toLocaleString()} | Max DD: $${(account.maxDrawdown || 2500).toLocaleString()})!`,
    });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Delete account
  const handleDeleteAccount = async (accId: string) => {
    await deleteAccount(accId);
    const reloaded = await getAccounts();
    setAccounts(reloaded);
    if (activeAccountId === accId && reloaded.length > 0) {
      handleSelectAccount(reloaded[0].id);
    }
    setToastMessage({
      text: 'Account removed.',
    });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Commit Trade (updates dynamically without page reload)
  const handleCommitTrade = async (trade: TradeRecord) => {
    await saveTrade(trade);
    setTrades((prev) => [trade, ...prev.filter((t) => t.id !== trade.id)]);
    
    if (trade.isNoTradeDay || trade.setup === 'no_trade') {
      setToastMessage({
        text: 'DISCIPLINE RECORDED: No Trade Day successfully saved to your internal journal ($0.00 PnL)!',
        actionText: 'VIEW IN JOURNAL',
        onAction: () => {
          setActivePage('journal');
          setToastMessage(null);
        },
      });
    } else if (trade.isBreakEven) {
      setToastMessage({
        text: 'BREAK-EVEN LOGGED: Trade saved as BE (preserves win rate %)!',
        actionText: 'VIEW IN JOURNAL',
        onAction: () => {
          setActivePage('journal');
          setToastMessage(null);
        },
      });
    } else {
      setToastMessage({
        text: `Trade successfully saved to ${trade.accountName || 'Internal Journal'}!`,
        actionText: 'VIEW IN JOURNAL',
        onAction: () => {
          setActivePage('journal');
          setToastMessage(null);
        },
      });
    }

    setTimeout(() => {
      setToastMessage((cur) => (cur?.actionText === 'VIEW IN JOURNAL' ? null : cur));
    }, 7000);
  };

  // Update existing trade entry (in-place update, updates live without page reload)
  const handleUpdateTrade = async (updatedTrade: TradeRecord) => {
    await saveTrade(updatedTrade);
    setTrades((prev) => prev.map((t) => (t.id === updatedTrade.id ? updatedTrade : t)));
    setToastMessage({
      text: 'Journal entry updated successfully in internal storage!',
      actionText: 'VIEW IN JOURNAL',
      onAction: () => {
        setActivePage('journal');
        setToastMessage(null);
      },
    });
    setTimeout(() => {
      setToastMessage((cur) => (cur?.text.includes('Journal entry updated') ? null : cur));
    }, 4500);
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

  // Restore/Import Trades from JSON Backup file
  const handleImportTrades = async (importedList: TradeRecord[]) => {
    try {
      for (const t of importedList) {
        if (t && t.id) {
          await saveTrade(t);
        }
      }
      const reloaded = await getTrades();
      setTrades(reloaded);
      setToastMessage({
        text: `Restored ${importedList.length} records into this device's internal database!`,
      });
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Import failed:', err);
      setToastMessage({ text: 'Import failed. Check file format.' });
      setTimeout(() => setToastMessage(null), 4000);
    }
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

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || accounts[0];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans relative selection:bg-teal-500/30 selection:text-white pb-16 overflow-x-hidden">
      {/* Immersive UI Ambient Glowing Backdrop Orbs (Turquoise & Purple) */}
      <div className="fixed top-[-120px] left-[-100px] w-[500px] h-[500px] bg-teal-500/20 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-120px] right-[-100px] w-[500px] h-[500px] bg-purple-900/30 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed top-1/2 left-1/4 w-[350px] h-[350px] bg-teal-950/15 rounded-full blur-[160px] pointer-events-none -z-10" />

      <div className="max-w-[1040px] mx-auto p-4 sm:p-6 lg:p-8 relative z-10">
        {/* Immersive Glass Navigation & PWA Download Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          <nav className="flex-1 flex gap-2 bg-zinc-900/60 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shadow-2xl">
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

          <div className="shrink-0 flex items-center justify-end">
            <PWAInstallButton />
          </div>
        </div>

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

        <PrivateSyncPanel />

        {/* Multi-Account Selector & Switcher Bar */}
        <AccountSelectorBar
          accounts={accounts}
          activeAccountId={activeAccountId}
          onSelectAccount={handleSelectAccount}
          onOpenManageModal={handleOpenAccountManager}
          trades={trades}
          isJournalView={activePage === 'journal'}
        />

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
            onTriggerNoTradeDay={handleTriggerNoTradeDay}
            activeAccount={activeAccount}
            accounts={accounts}
            trades={trades}
            onSelectAccount={handleSelectAccount}
            onOpenManageModal={handleOpenAccountManager}
          />
        ) : (
          <JournalView
            trades={trades}
            onDeleteTrade={handleDeleteTrade}
            onClearAllTrades={handleClearAllTrades}
            onOpenLightbox={(img) => setLightboxImage(img)}
            onNavigateToExec={() => setActivePage('exec')}
            onImportTrades={handleImportTrades}
            onCommitTrade={handleCommitTrade}
            onUpdateTrade={handleUpdateTrade}
            isNoTradeFormOpen={isNoTradeFormOpen}
            setIsNoTradeFormOpen={setIsNoTradeFormOpen}
            accounts={accounts}
            activeAccountId={activeAccountId}
            onSelectAccount={handleSelectAccount}
            onOpenManageModal={handleOpenAccountManager}
          />
        )}

        {/* Account Manager Modal */}
        <AccountManagerModal
          isOpen={isAccountManagerOpen}
          onClose={() => {
            setIsAccountManagerOpen(false);
            setInitialEditAccountId(null);
          }}
          accounts={accounts}
          activeAccountId={activeAccountId}
          onSelectAccount={handleSelectAccount}
          onSaveAccount={handleSaveAccount}
          onDeleteAccount={handleDeleteAccount}
          trades={trades}
          initialEditAccountId={initialEditAccountId}
        />

        {/* Immersive Status Footer */}
        <footer className="mt-12 px-6 py-4 rounded-2xl bg-zinc-950/80 border border-white/5 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-zinc-500 font-mono text-[11px]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Database size={13} className="text-teal-400" />
              <span>STORAGE: MULTI-ACCOUNT ISOLATED IDB</span>
            </span>
            <span className="text-white/20">|</span>
            <span className="text-zinc-400">ACCOUNTS: {accounts.length}</span>
            <span className="text-white/20">|</span>
            <span className="text-zinc-400">RECORDS: {trades.length}</span>
            <span className="text-white/20">|</span>
            <span className="text-teal-400/90 font-medium">PWA: STANDALONE READY</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-teal-300 font-semibold tracking-wider">
              <Shield size={13} className="text-teal-400" />
              <span>PRIVATE LOCAL DISK SAVING</span>
            </span>
          </div>
        </footer>

        {/* Lightbox for Zoomed Images */}
        <Lightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />

        {/* Dynamic Offline Connectivity Indicator & Live PWA Update Notification */}
        <OfflineIndicator />
        <PWAUpdateToast />
      </div>
    </div>
  );
}
