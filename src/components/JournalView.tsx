import { saveJournalRisk, restoreFullBackup } from '../utils/storage';
import React, { useState, useMemo } from 'react';
import { TradeRecord, SetupType, TradingAccount } from '../types';
import {
  Trash2,
  ZoomIn,
  Search,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Camera,
  Sparkles,
  Award,
  Edit3,
  Edit2,
  RefreshCw,
  Layers,
  Wallet,
  Target,
  Zap,
  Shield,
  Check,
} from 'lucide-react';
import { NoTradeJournalForm } from './NoTradeJournalForm';
import { EditTradeModal } from './EditTradeModal';
import { EquityCurveChart } from './EquityCurveChart';
import { manualCheckForUpdate, applyPublishedUpdate } from '../utils/pwaUpdate';
import { calculateJournalRisk, normalizeRiskPercent, RISK_PERCENT_OPTIONS } from '../utils/journalRisk';

interface JournalViewProps {
  trades: TradeRecord[];
  onDeleteTrade: (id: number) => Promise<void>;
  onClearAllTrades: () => Promise<void>;
  onOpenLightbox: (imageUrl: string) => void;
  onNavigateToExec: () => void;
  onImportTrades?: (imported: TradeRecord[]) => Promise<void>;
  onCommitTrade?: (trade: TradeRecord) => Promise<void>;
  onUpdateTrade?: (trade: TradeRecord) => Promise<void>;
  isNoTradeFormOpen?: boolean;
  setIsNoTradeFormOpen?: (open: boolean) => void;
  accounts?: TradingAccount[];
  activeAccountId?: string;
  onSelectAccount?: (accountId: string) => void;
  onOpenManageModal?: (editAccountId?: string) => void;
}

export const JournalView: React.FC<JournalViewProps> = ({
  trades,
  onDeleteTrade,
  onClearAllTrades,
  onOpenLightbox,
  onNavigateToExec,
  onImportTrades,
  onCommitTrade,
  onUpdateTrade,
  isNoTradeFormOpen,
  setIsNoTradeFormOpen,
  accounts = [],
  activeAccountId = 'all',
  onSelectAccount,
  onOpenManageModal,
}) => {
  const [localNoTradeOpen, setLocalNoTradeOpen] = useState<boolean>(false);
  const [editingTrade, setEditingTrade] = useState<TradeRecord | null>(null);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState<boolean>(false);
  const [updateFeedback, setUpdateFeedback] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [accountFilter, setAccountFilter] = useState<string>(activeAccountId);
  const [setupFilter, setSetupFilter] = useState<'all' | SetupType>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'win' | 'loss' | 'be'>('all');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [riskByAccount, setRiskByAccount] = useState<Record<string, number>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('fexec_journal_risk_percent_v1') || '{}');
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch { return {}; }
  });
  const riskPercent = normalizeRiskPercent(riskByAccount[accountFilter]);
  const changeRiskPercent = async (value: number) => {
    const next = { ...riskByAccount, [accountFilter]: normalizeRiskPercent(value) };
    setRiskByAccount(next);
    try { await saveJournalRisk(accountFilter, normalizeRiskPercent(value)); } catch { setUpdateFeedback('Risk selection could not be saved on this device.'); }
  };
  React.useEffect(() => {
    const refresh = () => { try { setRiskByAccount(JSON.parse(localStorage.getItem('fexec_journal_risk_percent_v1') || '{}')); } catch {} };
    window.addEventListener('fexec-sync-applied', refresh); window.addEventListener('storage', refresh);
    return () => {window.removeEventListener('fexec-sync-applied',refresh);window.removeEventListener('storage',refresh);};
  }, []);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Sync internal account filter when parent changes active account
  React.useEffect(() => {
    setAccountFilter(activeAccountId);
  }, [activeAccountId]);

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdates(true);
    setUpdateFeedback('Checking for newly published app updates across network...');
    try {
      const result = await manualCheckForUpdate();
      setUpdateFeedback(result.message);
      if (result.hasUpdate) {
        setTimeout(() => {
          applyPublishedUpdate();
        }, 1500);
      } else {
        setTimeout(() => {
          setUpdateFeedback(null);
        }, 4500);
      }
    } catch {
      setUpdateFeedback('Unable to reach network right now.');
      setTimeout(() => setUpdateFeedback(null), 3500);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  // Filter trades by active account before calculating stats
  const accountTrades = useMemo(() => {
    const matchingTrades = accountFilter === 'all'
      ? trades
      : trades.filter((t) => (t.accountId || 'acc-live-main') === accountFilter);
    // Sync snapshots use ascending IDs; always display the newest records first.
    return [...matchingTrades].sort((a, b) => b.id - a.id);
  }, [trades, accountFilter]);

  // Statistics calculation (BE trades DO NOT affect win rate)
  const stats = useMemo(() => {
    if (accountTrades.length === 0) {
      return {
        totalTrades: 0,
        activeTradesCount: 0,
        noTradeDays: 0,
        beCount: 0,
        winsCount: 0,
        lossesCount: 0,
        winRate: 0,
        netPnL: 0,
        rulesFollowedPct: 0,
      };
    }
    const total = accountTrades.length;
    const noTradeDays = accountTrades.filter((t) => t.isNoTradeDay || t.setup === 'no_trade').length;
    
    // BE trades are those explicitly marked as BE, or with PnL === 0 that are not No Trade Days
    const beTrades = accountTrades.filter((t) => !t.isNoTradeDay && t.setup !== 'no_trade' && (t.isBreakEven || t.pnl === 0));
    
    // Active decided trades (excluding No Trade Days AND excluding BE trades so BE does not affect win rate)
    const activeDecidedTrades = accountTrades.filter(
      (t) => !t.isNoTradeDay && t.setup !== 'no_trade' && !t.isBreakEven && t.pnl !== 0
    );
    const wins = activeDecidedTrades.filter((t) => t.pnl > 0).length;
    const losses = activeDecidedTrades.filter((t) => t.pnl < 0).length;
    const net = accountTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
    const rules = accountTrades.filter((t) => t.followedRules).length;

    // Win Rate: Wins / (Wins + Losses). BE trades do NOT penalize or inflate win rate!
    const winRate = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : 100;

    return {
      totalTrades: total,
      activeTradesCount: accountTrades.length - noTradeDays,
      noTradeDays,
      beCount: beTrades.length,
      winsCount: wins,
      lossesCount: losses,
      winRate,
      netPnL: net,
      rulesFollowedPct: Math.round((rules / total) * 100),
    };
  }, [accountTrades]);

  // Active Account and Profit Target / Drawdown stats
  const activeAccount = useMemo(() => {
    if (accountFilter === 'all') return null;
    return accounts.find((a) => a.id === accountFilter) || accounts[0];
  }, [accounts, accountFilter]);

  const profitTarget = useMemo(() => {
    if (accountFilter === 'all') {
      return accounts.reduce((sum, a) => sum + (a.profitTarget ?? 3000), 0);
    }
    return activeAccount?.profitTarget ?? 3000;
  }, [accounts, accountFilter, activeAccount]);

  const maxDrawdown = useMemo(() => {
    if (accountFilter === 'all') {
      return accounts.reduce((sum, a) => sum + (a.maxDrawdown || 2500), 0);
    }
    return activeAccount?.maxDrawdown || 2500;
  }, [accounts, accountFilter, activeAccount]);

  const targetAchieved = Math.max(0, stats.netPnL);
  const targetPct = profitTarget > 0 ? Math.min(100, Math.max(0, (targetAchieved / profitTarget) * 100)) : 0;
  const targetRemaining = Math.max(0, profitTarget - stats.netPnL);
  const isTargetMet = stats.netPnL >= profitTarget && profitTarget > 0;

  const initialBalance = accountFilter === 'all'
    ? accounts.reduce((sum, account) => sum + account.initialBalance, 0)
    : (activeAccount?.initialBalance ?? 50000);
  const projection = calculateJournalRisk(initialBalance, stats.netPnL, profitTarget, riskPercent);
  const typicalRisk = projection.riskAmount;
  const winsNeededAt15R = projection.winsAt15R;
  const winsNeededAt1R = projection.winsAt1R;
  const riskCurrency = activeAccount?.currency || '$';

  // Filtered trades based on account, search, setup, and outcome
  const filteredTrades = useMemo(() => {
    return accountTrades.filter((trade) => {
      // Search term
      const query = searchTerm.toLowerCase();
      const matchSearch =
        query === '' ||
        trade.directionalBias.toLowerCase().includes(query) ||
        trade.htfLogic.toLowerCase().includes(query) ||
        trade.ltfTarget.toLowerCase().includes(query) ||
        trade.entryModelTime.toLowerCase().includes(query) ||
        trade.feelings.toLowerCase().includes(query) ||
        trade.ruleBreaks.toLowerCase().includes(query) ||
        trade.improvements.toLowerCase().includes(query) ||
        (trade.accountName && trade.accountName.toLowerCase().includes(query)) ||
        trade.timestamp.toLowerCase().includes(query);

      // Setup filter
      const matchSetup = setupFilter === 'all' || trade.setup === setupFilter;

      // Outcome filter (support win, loss, and BE)
      const isBE = trade.isBreakEven || (!trade.isNoTradeDay && trade.setup !== 'no_trade' && trade.pnl === 0);
      const matchOutcome =
        outcomeFilter === 'all' ||
        (outcomeFilter === 'win' && !isBE && trade.pnl > 0) ||
        (outcomeFilter === 'loss' && !isBE && trade.pnl < 0) ||
        (outcomeFilter === 'be' && isBE);

      return matchSearch && matchSetup && matchOutcome;
    });
  }, [accountTrades, searchTerm, setupFilter, outcomeFilter]);

  const handleDelete = async (id: number) => {
    if (window.confirm('Delete this trade record from the internal journal?')) {
      setDeletingId(id);
      try {
        await onDeleteTrade(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(trades, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `FExec_Trades_Backup_${Date.now()}.json`);
    dlAnchor.click();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed?.version === 1 && Array.isArray(parsed.accounts) && Array.isArray(parsed.trades)) {
          if (window.confirm('Restore accounts, trades and risk settings from this full backup? The current journal will be saved as a local backup first.')) await restoreFullBackup(parsed);
        } else if (Array.isArray(parsed) && onImportTrades) {
          await onImportTrades(parsed);
        } else {
          alert('Invalid backup file format. Expected a list of trade records.');
        }
      } catch (err) {
        alert('Could not read backup file: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div id="page-journal" className="space-y-6">
      {/* Hidden file input for importing backups */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportFile}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Analytics Banner */}
      <div className="bg-zinc-900/40 border border-white/10 backdrop-blur-xl rounded-2xl md:rounded-3xl p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[10px] font-bold uppercase bg-gradient-to-r from-teal-400 to-purple-600 text-white px-2.5 py-1 rounded-full shadow-[0_0_10px_rgba(45,212,191,0.3)]">
              SYNCHRONIZED DATABASE
            </span>
            <h2 className="font-disp font-bold text-lg sm:text-xl uppercase text-zinc-100 m-0 tracking-wide">
              Trade Execution History
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onCommitTrade && (
              <button
                type="button"
                onClick={() => {
                  if (setIsNoTradeFormOpen) setIsNoTradeFormOpen(true);
                  else setLocalNoTradeOpen(true);
                }}
                className="font-mono text-[11px] font-bold bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 px-3.5 py-2 rounded-xl border border-teal-500/40 flex items-center gap-1.5 cursor-pointer transition-all shadow-[0_0_12px_rgba(45,212,191,0.15)]"
                title="Open form to record a disciplined No Trade Day"
              >
                <ShieldCheck size={14} className="text-teal-400" />
                <span>LOG NO TRADE DAY</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleImportClick}
              className="font-mono text-[11px] font-bold bg-white/5 hover:bg-white/10 text-zinc-300 px-3.5 py-2 rounded-xl border border-white/10 flex items-center gap-1.5 cursor-pointer transition-all"
              title="Import previously saved trades JSON file into this device"
            >
              <Upload size={13} className="text-purple-400" />
              <span>IMPORT BACKUP</span>
            </button>

            {trades.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="font-mono text-[11px] font-bold bg-white/5 hover:bg-white/10 text-zinc-300 px-3.5 py-2 rounded-xl border border-white/10 flex items-center gap-1.5 cursor-pointer transition-all"
                  title="Export your internal journal to a portable JSON file"
                >
                  <Download size={13} className="text-teal-400" />
                  <span>EXPORT BACKUP</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Clear all trade history records? This cannot be undone.')) {
                      onClearAllTrades();
                    }
                  }}
                  className="font-mono text-[11px] font-bold text-rose-400 hover:bg-rose-950/30 px-3 py-2 rounded-xl border border-rose-500/20 flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Trash2 size={13} />
                  <span>CLEAR ALL</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleCheckForUpdates}
              disabled={isCheckingUpdates}
              className="font-mono text-[11px] font-bold bg-white/5 hover:bg-white/10 text-zinc-300 px-3.5 py-2 rounded-xl border border-white/10 flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
              title="Check if a new app version was re-published to sync this device"
            >
              <RefreshCw size={13} className={`text-teal-400 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
              <span>{isCheckingUpdates ? 'CHECKING...' : 'SYNC UPDATES'}</span>
            </button>
          </div>
        </div>

        {updateFeedback && (
          <div className="mb-4 p-3 rounded-xl bg-teal-950/50 border border-teal-500/40 text-teal-300 font-mono text-xs flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className={isCheckingUpdates ? 'animate-spin text-teal-400' : 'text-teal-400'} />
              <span>{updateFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setUpdateFeedback(null)}
              className="text-teal-400 hover:text-teal-200 cursor-pointer text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 bg-zinc-950/40 rounded-2xl border border-white/5 shadow-inner">
            <div className="font-mono text-[10px] font-bold uppercase text-teal-400 flex items-center gap-1.5 tracking-wider">
              <FileText size={12} />
              <span>Total Records</span>
            </div>
            <div className="font-disp text-2xl sm:text-3xl font-bold text-zinc-100 mt-1.5">
              {stats.totalTrades}
            </div>
            <div className="font-mono text-[10px] text-zinc-400 mt-0.5 flex flex-wrap items-center gap-1.5">
              {stats.noTradeDays > 0 && (
                <span className="text-teal-400">{stats.noTradeDays} No Trade</span>
              )}
              {stats.beCount > 0 && (
                <span className="text-cyan-300 font-semibold">• {stats.beCount} BE</span>
              )}
            </div>
          </div>

          <div className="p-4 bg-zinc-950/40 rounded-2xl border border-white/5 shadow-inner">
            <div className="font-mono text-[10px] font-bold uppercase text-teal-400 flex items-center gap-1.5 tracking-wider">
              {stats.netPnL >= 0 ? <TrendingUp size={12} className="text-teal-400" /> : <TrendingDown size={12} className="text-rose-400" />}
              <span>Net PnL</span>
            </div>
            <div
              className={`font-disp text-2xl sm:text-3xl font-bold mt-1.5 ${
                stats.netPnL > 0
                  ? 'text-teal-300 drop-shadow-[0_0_10px_rgba(45,212,191,0.3)]'
                  : stats.netPnL < 0
                  ? 'text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                  : 'text-zinc-200'
              }`}
            >
              {stats.netPnL >= 0 ? '+' : ''}${stats.netPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            {stats.noTradeDays > 0 && (
              <div className="font-mono text-[10px] text-zinc-400 mt-0.5">
                Capital Preserved on Standby
              </div>
            )}
          </div>

          <div className="p-4 bg-zinc-950/40 rounded-2xl border border-white/5 shadow-inner">
            <div className="font-mono text-[10px] font-bold uppercase text-teal-400 flex items-center gap-1.5 tracking-wider">
              <DollarSign size={12} />
              <span>Win Rate</span>
            </div>
            <div className="font-disp text-2xl sm:text-3xl font-bold text-zinc-100 mt-1.5">
              {stats.winRate}%
            </div>
            <div className="font-mono text-[10px] text-zinc-400 mt-0.5 flex flex-wrap items-center gap-1">
              <span className="text-teal-300 font-semibold">{stats.winsCount}W</span>
              <span>-</span>
              <span className="text-rose-400 font-semibold">{stats.lossesCount}L</span>
              {stats.beCount > 0 && (
                <span className="text-cyan-300 font-semibold" title="Break-Even trades do not affect win rate">
                  ({stats.beCount} BE Neutral)
                </span>
              )}
            </div>
          </div>

          <div className="p-4 bg-zinc-950/40 rounded-2xl border border-white/5 shadow-inner">
            <div className="font-mono text-[10px] font-bold uppercase text-teal-400 flex items-center gap-1.5 tracking-wider">
              <ShieldCheck size={12} />
              <span>Rules Followed</span>
            </div>
            <div className="font-disp text-2xl sm:text-3xl font-bold text-zinc-100 mt-1.5">
              {stats.rulesFollowedPct}%
            </div>
            <div className="font-mono text-[10px] text-purple-300 mt-0.5">
              Discipline Score
            </div>
          </div>
        </div>

        {/* PROFIT TARGET & 1:1 – 1.5R DISCIPLINE MILESTONE CARD */}
        {profitTarget > 0 && (
          <div className="mt-5 p-4 sm:p-5 rounded-2xl bg-zinc-950/80 border border-teal-500/35 backdrop-blur-xl shadow-xl space-y-3.5 animate-in fade-in duration-150">
            {/* Header / Status Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500/20 to-purple-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 shadow-xs shrink-0">
                  <Target size={20} className="text-teal-400" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-400 bg-teal-950/80 border border-teal-500/40 px-2 py-0.5 rounded shadow-xs">
                      PROFIT TARGET GOAL
                    </span>
                    <span className="font-mono text-[10px] font-bold text-zinc-300 bg-zinc-900 border border-white/10 px-2 py-0.5 rounded flex items-center gap-1">
                      <Zap size={10} className="text-amber-400" />
                      <span>1:1 – 1.5R MAX PROTOCOL</span>
                    </span>
                  </div>
                  <h3 className="font-disp font-bold text-base sm:text-lg text-zinc-100 uppercase tracking-wide mt-0.5">
                    {accountFilter === 'all'
                      ? 'Combined Portfolio Profit Target'
                      : `${activeAccount?.name || 'Account'} Target Milestone`}
                  </h3>
                </div>
              </div>

              {/* Status Badge & Edit Action */}
              <div className="flex items-center gap-2.5 self-start sm:self-auto font-mono text-xs">
                {isTargetMet ? (
                  <span className="px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400 font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(45,212,191,0.3)]">
                    <CheckCircle2 size={13} className="text-teal-400" />
                    <span>TARGET ACHIEVED!</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-zinc-900 text-zinc-300 border border-white/10 text-[11px] font-bold">
                    {targetPct.toFixed(1)}% COMPLETE
                  </span>
                )}
                {onOpenManageModal && accountFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => onOpenManageModal(activeAccount?.id)}
                    className="font-mono text-[10px] text-teal-300 hover:text-white bg-teal-950/60 hover:bg-teal-900/80 border border-teal-500/40 px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Edit2 size={10} />
                    <span>Edit Target</span>
                  </button>
                )}
              </div>
            </div>

            {/* Target Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-zinc-400">
                  REALIZED NET PNL: <b className="text-teal-300 text-sm font-disp">{stats.netPnL >= 0 ? '+' : ''}${stats.netPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                </span>
                <span className="text-zinc-400">
                  TARGET GOAL: <b className="text-white text-sm font-disp">${profitTarget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                </span>
              </div>

              <div className="w-full h-3 rounded-full bg-zinc-900 border border-white/10 p-0.5 overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-teal-400 via-teal-300 to-purple-500 rounded-full transition-all duration-700 shadow-[0_0_15px_rgba(45,212,191,0.5)]"
                  style={{ width: `${targetPct}%` }}
                />
              </div>

              <div className="flex flex-wrap justify-between items-center text-[10px] font-mono text-zinc-400 gap-2">
                <span>
                  {isTargetMet ? (
                    <b className="text-teal-300 font-bold">Milestone Cleared (+${(stats.netPnL - profitTarget).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} surplus)</b>
                  ) : (
                    <span>Remaining to Goal: <b className="text-zinc-200">${targetRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></span>
                  )}
                </span>
                <span>Max Drawdown Limit: <b className="text-rose-400 font-semibold">${maxDrawdown.toLocaleString()}</b></span>
              </div>
            </div>

            {accountFilter !== 'all' && (
              <div className="p-3 bg-zinc-900/80 border border-teal-500/25 rounded-xl space-y-2 text-xs font-mono">
                <div className="flex flex-wrap items-center gap-3">
                  <label htmlFor="journal-risk-percent" className="text-zinc-300">Risk per trade</label>
                  <select id="journal-risk-percent" value={riskPercent} onChange={(event) => changeRiskPercent(Number(event.target.value))} className="bg-zinc-950 border border-teal-500/40 rounded-lg px-3 py-2 text-teal-300">
                    {RISK_PERCENT_OPTIONS.map((value) => <option key={value} value={value}>{value}%{value === 1 ? ' (default)' : value === 2 ? ' (maximum)' : ''}</option>)}
                  </select>
                  <button type="button" onClick={() => changeRiskPercent(1)} className="text-teal-300 underline">Reset to 1%</button>
                  <span className="text-zinc-400">Current balance: <b className="text-white">{riskCurrency}{projection.currentBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b></span>
                  <span className="text-zinc-400">Risk amount: <b className="text-amber-300">{riskCurrency}{typicalRisk.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></span>
                </div>
                <p className="text-zinc-500">Default 1%; maximum 2%. Risk updates with your current balance. Estimates assume consecutive wins, recalculating risk after each win, with no additional fees or losses.</p>
                {!isTargetMet && projection.requiredR !== null && <p className="text-zinc-400">To reach the remaining target in one trade: <b className="text-zinc-200">{projection.requiredR.toFixed(2)}R</b>. This is a calculation, not a change to the 1.5R maximum rule.</p>}
                {!isTargetMet && typicalRisk <= 0 && <p className="text-amber-300">A positive current balance is needed to calculate risk and wins remaining.</p>}
              </div>
            )}
            {accountFilter === 'all' && <p className="text-xs text-zinc-400">Select an individual account to calculate risk and wins needed for its target.</p>}

            {/* Disciplined 1:1 – 1.5R Projection Strip */}
            <div className="p-3 bg-zinc-900/80 border border-teal-500/25 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b] shrink-0" />
                <span className="text-zinc-300">
                  Trading Rule: <b className="text-amber-300">1:1 to 1.5R Max Model</b> (Never over 1.5R)
                </span>
              </div>

              {accountFilter !== 'all' && !isTargetMet && typicalRisk > 0 && targetRemaining > 0 && (
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
                  <span>
                    At 1.5R Max ({riskCurrency}{(typicalRisk * 1.5).toLocaleString(undefined, { maximumFractionDigits: 0 })} first win): <b className="text-teal-300 font-bold">~{winsNeededAt15R} wins</b>
                  </span>
                  <span className="text-white/20 hidden sm:inline">|</span>
                  <span>
                    At 1.0R ({riskCurrency}{typicalRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })} first win): <b className="text-teal-300 font-bold">~{winsNeededAt1R} wins</b>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dynamic Per-Account Equity Curve Line Graph */}
        <EquityCurveChart
          trades={accountTrades}
          initialBalance={
            accountFilter === 'all'
              ? accounts.reduce((acc, a) => acc + (a.initialBalance || 50000), 0)
              : accounts.find((a) => a.id === accountFilter)?.initialBalance || 50000
          }
          maxDrawdown={
            accountFilter === 'all'
              ? undefined
              : accounts.find((a) => a.id === accountFilter)?.maxDrawdown
          }
          profitTarget={
            accountFilter === 'all'
              ? undefined
              : accounts.find((a) => a.id === accountFilter)?.profitTarget
          }
          accountName={
            accountFilter === 'all'
              ? 'All Accounts (Combined Portfolio)'
              : accounts.find((a) => a.id === accountFilter)?.name || 'Main Live Account'
          }
          accountType={
            accountFilter === 'all'
              ? undefined
              : accounts.find((a) => a.id === accountFilter)?.type
          }
          onEditAccount={
            onOpenManageModal
              ? () => onOpenManageModal(accountFilter !== 'all' ? accountFilter : accounts[0]?.id)
              : undefined
          }
        />
      </div>

      {/* NO TRADE DAY JOURNAL FORM */}
      {onCommitTrade && (
        <NoTradeJournalForm
          isOpen={isNoTradeFormOpen ?? localNoTradeOpen}
          onClose={() => {
            if (setIsNoTradeFormOpen) setIsNoTradeFormOpen(false);
            setLocalNoTradeOpen(false);
          }}
          onCommit={onCommitTrade}
          accountSize={accountTrades[0]?.balanceAfter || accountTrades[0]?.accountSize || 50000}
          accounts={accounts}
          activeAccountId={accountFilter === 'all' ? accounts[0]?.id : accountFilter}
        />
      )}

      {/* EDIT JOURNAL ENTRY MODAL */}
      <EditTradeModal
        isOpen={!!editingTrade}
        trade={editingTrade}
        accounts={accounts}
        onClose={() => setEditingTrade(null)}
        onSave={async (updated) => {
          if (onUpdateTrade) {
            await onUpdateTrade(updated);
          } else if (onCommitTrade) {
            await onCommitTrade(updated);
          }
        }}
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-zinc-900/40 backdrop-blur-xl p-3.5 rounded-2xl border border-white/10 shadow-lg">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by account, bias, notes, feelings, or rule breaks..."
            className="w-full pl-10 pr-3.5 py-2.5 border border-white/10 bg-zinc-950/60 font-body text-xs rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30 transition-all"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Account Filter */}
          {accounts.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={accountFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setAccountFilter(val);
                  if (onSelectAccount) onSelectAccount(val);
                }}
                aria-label="Filter by account"
                className="border border-white/10 bg-zinc-950/60 px-3 py-2 font-mono text-xs rounded-xl text-teal-300 font-bold cursor-pointer focus:outline-hidden focus:border-teal-400"
              >
                <option value="all">ALL ACCOUNTS</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    [{acc.type.toUpperCase()}] {acc.name}
                  </option>
                ))}
              </select>

              {onOpenManageModal && (
                <button
                  type="button"
                  onClick={() => onOpenManageModal(accountFilter !== 'all' ? accountFilter : undefined)}
                  className="border border-teal-500/30 hover:border-teal-400 bg-teal-950/40 hover:bg-teal-900/60 px-2.5 py-2 font-mono text-xs rounded-xl text-teal-300 font-bold cursor-pointer transition-all flex items-center gap-1 shadow-xs"
                  title="Edit account details (name, starting figure, etc.)"
                >
                  <Edit2 size={12} className="text-teal-400" />
                  <span className="hidden sm:inline">{accountFilter !== 'all' ? 'Edit Details' : 'Manage'}</span>
                </button>
              )}
            </div>
          )}

          <select
            value={setupFilter}
            onChange={(e) => setSetupFilter(e.target.value as 'all' | SetupType)}
            aria-label="Filter by setup"
            className="border border-white/10 bg-zinc-950/60 px-3 py-2 font-mono text-xs rounded-xl text-zinc-200 font-bold cursor-pointer focus:outline-hidden focus:border-teal-400"
          >
            <option value="all">ALL SETUPS</option>
            <option value="continuation">CONTINUATION</option>
            <option value="reversal">REVERSAL</option>
            <option value="no_trade">NO TRADE DAYS</option>
          </select>

          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value as 'all' | 'win' | 'loss' | 'be')}
            aria-label="Filter by outcome"
            className="border border-white/10 bg-zinc-950/60 px-3 py-2 font-mono text-xs rounded-xl text-zinc-200 font-bold cursor-pointer focus:outline-hidden focus:border-teal-400"
          >
            <option value="all">ALL OUTCOMES</option>
            <option value="win">WINS ONLY (+)</option>
            <option value="loss">LOSSES ONLY (-)</option>
            <option value="be">BREAK-EVEN (BE)</option>
          </select>
        </div>
      </div>

      {/* Trade Entries List */}
      {filteredTrades.length === 0 ? (
        <div className="bg-zinc-900/40 border border-white/10 backdrop-blur-xl rounded-3xl p-12 text-center shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-teal-400 shadow-[0_0_15px_rgba(45,212,191,0.25)]">
            <FileText size={22} />
          </div>
          <div className="font-mono text-sm font-bold text-zinc-300 mb-2 uppercase tracking-wide">
            {trades.length === 0 ? 'Internal Journal Empty' : 'No records match filter'}
          </div>
          <p className="text-xs text-zinc-400 max-w-md mx-auto mb-6 font-body leading-relaxed">
            {trades.length === 0
              ? 'Complete your trade checklist and commit your execution record in Execution Console. Full typed contents and analysis will be permanently preserved here.'
              : 'Try clearing your search terms or changing your account, setup and outcome filters.'}
          </p>
          {trades.length === 0 && (
            <button
              type="button"
              onClick={onNavigateToExec}
              className="font-mono text-xs font-bold uppercase bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-400 hover:to-purple-500 text-white px-6 py-3 rounded-xl shadow-[0_0_20px_rgba(45,212,191,0.4)] cursor-pointer transition-all border border-teal-300/40"
            >
              Open Execution Console
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredTrades.map((trade) => {
            const isBE = trade.isBreakEven || (!trade.isNoTradeDay && trade.setup !== 'no_trade' && trade.pnl === 0);
            const isWin = !isBE && trade.pnl > 0;
            const isLoss = !isBE && trade.pnl < 0;

            const accType = trade.accountType || 'live';
            const accBadgeClass =
              accType === 'demo'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : accType === 'funded'
                ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                : accType === 'evaluation'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

            return (
              <article
                key={trade.id}
                className="bg-zinc-900/40 border border-white/10 hover:border-teal-400/40 backdrop-blur-xl rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl transition-all duration-300"
              >
                {/* Record Header */}
                <div className="p-4 bg-white/[0.03] text-zinc-100 font-mono text-xs flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-bold tracking-wider text-teal-300">
                      RECORD: {trade.timestamp}
                    </span>

                    {/* Account Badge */}
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${accBadgeClass} flex items-center gap-1`}>
                      <Wallet size={10} />
                      <span>[{accType.toUpperCase()}] {trade.accountName || 'Main Live'}</span>
                    </span>

                    {trade.isNoTradeDay || trade.setup === 'no_trade' ? (
                      <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border bg-teal-500/20 text-teal-300 border-teal-500/40 flex items-center gap-1 shadow-[0_0_10px_rgba(45,212,191,0.2)]">
                        <ShieldCheck size={11} className="text-teal-300" />
                        <span>NO TRADE DAY</span>
                      </span>
                    ) : isBE ? (
                      <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                        BREAK-EVEN (BE)
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                          trade.setup === 'continuation'
                            ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                            : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        }`}
                      >
                        {trade.setup}
                      </span>
                    )}

                    {trade.isNoTradeDay || trade.setup === 'no_trade' ? (
                      <div className="font-disp font-bold text-xs sm:text-sm px-3 py-0.5 rounded-lg border text-teal-300 border-teal-500/40 bg-teal-950/50 shadow-[0_0_12px_rgba(45,212,191,0.25)] flex items-center gap-1.5">
                        <Award size={13} className="text-teal-400" />
                        <span>$0.00 CAPITAL PRESERVED</span>
                      </div>
                    ) : isBE ? (
                      <div className="font-disp font-bold text-xs sm:text-sm px-3 py-0.5 rounded-lg border text-cyan-300 border-cyan-400/40 bg-cyan-950/40 shadow-[0_0_12px_rgba(6,182,212,0.2)] flex items-center gap-1.5">
                        <span>BE: {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    ) : (
                      <div
                        className={`font-disp font-bold text-sm px-3 py-0.5 rounded-lg border ${
                          isWin
                            ? 'text-teal-300 border-teal-500/40 bg-teal-950/40 shadow-[0_0_12px_rgba(45,212,191,0.25)]'
                            : isLoss
                            ? 'text-rose-400 border-rose-500/40 bg-rose-950/40 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                            : 'text-zinc-200 border-white/10 bg-zinc-950/60'
                        }`}
                      >
                        {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Rule indicator tags */}
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1 font-bold border ${
                        trade.followedRules
                          ? 'bg-teal-950/40 text-teal-300 border-teal-500/30'
                          : 'bg-rose-950/40 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {trade.followedRules ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      <span>{trade.isNoTradeDay || trade.setup === 'no_trade' ? 'Discipline' : 'Rules'}</span>
                    </span>

                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1 font-bold border ${
                        trade.emotionsControlled
                          ? 'bg-teal-950/40 text-teal-300 border-teal-500/30'
                          : 'bg-rose-950/40 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {trade.emotionsControlled ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      <span>Emotions</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => setEditingTrade(trade)}
                      className="px-2.5 py-1 font-mono text-[10px] font-bold text-teal-300 hover:bg-teal-950/50 border border-teal-500/40 rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-xs ml-1"
                      title="Edit this journal entry"
                    >
                      <Edit3 size={11} className="text-teal-400" />
                      <span>EDIT</span>
                    </button>

                    <button
                      type="button"
                      disabled={deletingId === trade.id}
                      onClick={() => handleDelete(trade.id)}
                      className="px-2.5 py-1 font-mono text-[10px] font-bold text-rose-400 hover:bg-rose-950/40 border border-rose-500/30 rounded-lg cursor-pointer transition-colors ml-1"
                    >
                      {deletingId === trade.id ? 'DELETING...' : 'DELETE'}
                    </button>
                  </div>
                </div>

                {/* Sub-bar: Directional Bias & Financial Summary */}
                <div className="bg-zinc-950/50 px-5 py-3 border-b border-white/10 flex flex-wrap items-center justify-between text-xs font-mono gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-teal-400 uppercase text-[10px] tracking-wider">
                      {trade.isNoTradeDay || trade.setup === 'no_trade' ? 'REASON / BIAS:' : 'BIAS:'}
                    </span>
                    <span className="font-bold text-zinc-100">
                      {trade.noTradeReason || trade.directionalBias || 'None stated'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-400">
                    {trade.balanceBefore > 0 && (
                      <span>
                        BAL BEFORE: <b className="text-zinc-200">${trade.balanceBefore.toLocaleString()}</b>
                      </span>
                    )}
                    {trade.balanceAfter > 0 && (
                      <span>
                        BAL AFTER: <b className="text-zinc-200">${trade.balanceAfter.toLocaleString()}</b>
                      </span>
                    )}
                    {trade.bufferSurvivalTrades !== undefined && (
                      <span>
                        BUFFER: <b className="text-rose-400">{trade.bufferSurvivalTrades} Losses</b>
                      </span>
                    )}
                  </div>
                </div>

                {/* FULL CONTENTS DISPLAY */}
                <div className="p-5 sm:p-6 space-y-4 text-xs font-body">
                  {/* Section 1: Post-Trade Analysis Full Text */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-white/5 bg-zinc-950/40 p-4 rounded-2xl">
                      <div className="font-mono text-[10px] font-bold uppercase text-teal-400 mb-2 flex items-center justify-between tracking-wider">
                        <span>HTF Bias Logic & Context</span>
                        <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono">
                          FULL CONTENT
                        </span>
                      </div>
                      <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap font-medium">
                        {trade.htfLogic || <span className="text-zinc-600 italic">No HTF bias logic logged.</span>}
                      </p>
                    </div>

                    <div className="border border-white/5 bg-zinc-950/40 p-4 rounded-2xl">
                      <div className="font-mono text-[10px] font-bold uppercase text-teal-400 mb-2 flex items-center justify-between tracking-wider">
                        <span>LTF Target & Liquidity</span>
                        <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono">
                          FULL CONTENT
                        </span>
                      </div>
                      <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap font-medium">
                        {trade.ltfTarget || <span className="text-zinc-600 italic">No LTF target logged.</span>}
                      </p>
                    </div>
                  </div>

                  {/* Entry Model & Execution Time */}
                  {trade.entryModelTime && (
                    <div className="border border-white/5 bg-zinc-950/40 p-3.5 rounded-xl flex items-center gap-2.5 font-mono text-xs">
                      <Clock size={14} className="text-teal-400 shrink-0" />
                      <span className="font-bold text-zinc-400 uppercase text-[10px] tracking-wider">
                        ENTRY MODEL & EXACT TIME:
                      </span>
                      <span className="text-zinc-100 font-semibold">{trade.entryModelTime}</span>
                    </div>
                  )}

                  {/* Section 2: Psychology & Feelings Full Text */}
                  {(trade.morningRoutine || trade.feelings) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {trade.morningRoutine && (
                        <div className="border border-white/5 bg-zinc-950/40 p-4 rounded-2xl">
                          <div className="font-mono text-[10px] font-bold uppercase text-teal-400 mb-1.5 tracking-wider">
                            Morning Routine / Wake Up
                          </div>
                          <p className="text-zinc-200 leading-relaxed font-medium">
                            {trade.morningRoutine}
                          </p>
                        </div>
                      )}

                      {trade.feelings && (
                        <div className="border border-white/5 bg-zinc-950/40 p-4 rounded-2xl">
                          <div className="font-mono text-[10px] font-bold uppercase text-teal-400 mb-1.5 flex items-center justify-between tracking-wider">
                            <span>Feelings (Pre / During / After)</span>
                            <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono">
                              FULL CONTENT
                            </span>
                          </div>
                          <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap font-medium">
                            {trade.feelings}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section 3: Reflection, Rule Breaks & Improvements Full Text */}
                  {(trade.ruleBreaks || trade.improvements) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {trade.ruleBreaks ? (
                        <div className="border border-rose-500/30 bg-rose-950/20 p-4 rounded-2xl">
                          <div className="font-mono text-[10px] font-bold uppercase text-rose-400 mb-1.5 flex items-center gap-1.5 tracking-wider">
                            <AlertTriangle size={13} />
                            <span>Rule Breaks / Errors</span>
                          </div>
                          <p className="text-rose-200 leading-relaxed whitespace-pre-wrap font-medium">
                            {trade.ruleBreaks}
                          </p>
                        </div>
                      ) : (
                        <div className="border border-teal-500/30 bg-teal-950/20 p-4 rounded-2xl flex items-center gap-2.5 text-xs text-teal-300">
                          <CheckCircle2 size={16} className="text-teal-400" />
                          <span className="font-medium">No rule breaks reported. Execution plan followed completely.</span>
                        </div>
                      )}

                      {trade.improvements && (
                        <div className="border border-white/5 bg-zinc-950/40 p-4 rounded-2xl">
                          <div className="font-mono text-[10px] font-bold uppercase text-teal-300 mb-1.5 flex items-center justify-between tracking-wider">
                            <span>Planned Improvements</span>
                            <span className="text-[9px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full font-mono">
                              NEXT SESSION
                            </span>
                          </div>
                          <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap font-medium">
                            {trade.improvements}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section 4: Attached Screenshot Image */}
                  {trade.chartImage && (
                    <div className="mt-5 pt-4 border-t border-white/10">
                      <div className="font-mono text-[10px] font-bold uppercase text-teal-400 mb-2.5 flex items-center justify-between tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <Camera size={13} />
                          <span>Attached Chart Snapshot</span>
                        </span>
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <ZoomIn size={12} /> Click to inspect
                        </span>
                      </div>

                      <div
                        onClick={() => onOpenLightbox(trade.chartImage!)}
                        className="border border-white/10 rounded-2xl overflow-hidden max-h-[380px] bg-black/80 cursor-zoom-in group relative shadow-2xl"
                      >
                        <img
                          src={trade.chartImage}
                          alt="Trade Chart Record"
                          className="w-full h-auto object-contain max-h-[380px] mx-auto group-hover:scale-[1.01] transition-transform duration-300"
                        />
                        <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md text-white font-mono text-[10px] px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5 pointer-events-none">
                          <ZoomIn size={12} className="text-teal-300" /> ENLARGE PHOTO
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Section 5: Visual Card Backup Image if present */}
                  {trade.visualCardImage && !trade.chartImage && (
                    <div className="mt-5 pt-4 border-t border-white/10">
                      <div className="font-mono text-[10px] font-bold uppercase text-teal-400 mb-2.5 flex items-center justify-between tracking-wider">
                        <span>Captured Trade Canvas</span>
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1 cursor-pointer">
                          <ZoomIn size={12} /> Click to inspect
                        </span>
                      </div>
                      <div
                        onClick={() => onOpenLightbox(trade.visualCardImage!)}
                        className="border border-white/10 rounded-2xl overflow-hidden max-h-[280px] bg-zinc-950/80 cursor-zoom-in"
                      >
                        <img
                          src={trade.visualCardImage}
                          alt="Visual Snapshot"
                          className="w-full h-auto object-contain max-h-[280px] mx-auto"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
