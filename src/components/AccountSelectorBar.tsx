import React from 'react';
import { TradingAccount, AccountType, TradeRecord } from '../types';
import { Briefcase, ChevronDown, Plus, Layers, Wallet, TrendingUp, TrendingDown, Edit2, Target, Shield } from 'lucide-react';

interface AccountSelectorBarProps {
  accounts: TradingAccount[];
  activeAccountId: string; // or 'all' in journal view
  onSelectAccount: (accountId: string) => void;
  onOpenManageModal: (editAccountId?: string) => void;
  trades: TradeRecord[];
  isJournalView?: boolean;
}

export const AccountSelectorBar: React.FC<AccountSelectorBarProps> = ({
  accounts,
  activeAccountId,
  onSelectAccount,
  onOpenManageModal,
  trades,
  isJournalView = false,
}) => {
  const isAllSelected = activeAccountId === 'all';
  const activeAccount = accounts.find((a) => a.id === activeAccountId) || accounts[0];

  // Calculate stats for active selection
  const relevantTrades = isAllSelected
    ? trades
    : trades.filter((t) => (t.accountId || 'acc-live-main') === activeAccountId);

  const totalPnL = relevantTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);

  const calculatedBalance = isAllSelected
    ? accounts.reduce((acc, a) => acc + a.initialBalance, 0) + totalPnL
    : (activeAccount?.initialBalance || 50000) + totalPnL;

  const getTypeBadge = (accType?: AccountType) => {
    switch (accType) {
      case 'live':
        return {
          label: 'LIVE',
          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        };
      case 'demo':
        return {
          label: 'DEMO',
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        };
      case 'funded':
        return {
          label: 'FUNDED',
          color: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
        };
      case 'evaluation':
        return {
          label: 'EVALUATION',
          color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        };
      default:
        return {
          label: 'COMBINED',
          color: 'bg-teal-500/20 text-teal-300 border-teal-400/40',
        };
    }
  };

  const badge = getTypeBadge(isAllSelected ? undefined : activeAccount?.type);

  return (
    <div className="mb-6 p-3 sm:p-4 rounded-2xl bg-zinc-900/50 border border-white/10 backdrop-blur-xl shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
      {/* Account Info & Switcher */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500/20 to-purple-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 shrink-0">
            <Wallet size={16} className="text-teal-400" />
          </div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            ACCOUNT CONSOLE:
          </span>
        </div>

        {/* Dropdown Selector */}
        <div className="relative inline-block">
          <select
            value={activeAccountId}
            onChange={(e) => onSelectAccount(e.target.value)}
            className="appearance-none bg-zinc-950/80 hover:bg-zinc-950 border border-teal-500/40 focus:border-teal-400 rounded-xl pl-3.5 pr-8 py-1.5 font-disp font-bold text-xs sm:text-sm text-zinc-100 cursor-pointer focus:outline-hidden transition-all shadow-[0_0_12px_rgba(45,212,191,0.15)]"
          >
            {isJournalView && (
              <option value="all">ALL ACCOUNTS (COMBINED VIEW)</option>
            )}
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                [{acc.type.toUpperCase()}] {acc.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
          />
        </div>

        {/* Badge */}
        <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${badge.color}`}>
          {isAllSelected ? 'ALL ACCOUNTS' : badge.label}
        </span>

        {/* Quick Edit Account Button */}
        {!isAllSelected && activeAccount && (
          <button
            type="button"
            onClick={() => onOpenManageModal(activeAccount.id)}
            className="font-mono text-[11px] font-bold uppercase bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 px-3 py-1.5 rounded-xl border border-teal-500/40 hover:border-teal-400 flex items-center gap-1.5 cursor-pointer transition-all shadow-[0_0_12px_rgba(45,212,191,0.15)]"
            title={`Edit details for ${activeAccount.name} (name, starting figure, etc.)`}
          >
            <Edit2 size={12} className="text-teal-400" />
            <span>Edit Account</span>
          </button>
        )}
      </div>

      {/* Financial Status for Selected Account & Action to Manage */}
      <div className="flex flex-wrap items-center justify-between md:justify-end gap-4 text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="text-zinc-400">
            BAL:{' '}
            <b className="text-zinc-100 font-bold">
              ${calculatedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </b>
          </span>
          <span className="text-white/20">|</span>
          <span className="flex items-center gap-1">
            <span className="text-zinc-400">PNL:</span>
            <b
              className={`font-bold flex items-center gap-0.5 ${
                totalPnL > 0
                  ? 'text-teal-300'
                  : totalPnL < 0
                  ? 'text-rose-400'
                  : 'text-zinc-300'
              }`}
            >
              {totalPnL > 0 ? (
                <TrendingUp size={12} className="text-teal-400" />
              ) : totalPnL < 0 ? (
                <TrendingDown size={12} className="text-rose-400" />
              ) : null}
              {totalPnL >= 0 ? '+' : ''}
              ${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </b>
          </span>
          <span className="text-white/20">|</span>
          <span className="text-zinc-400">
            TRADES: <b className="text-teal-300 font-bold">{relevantTrades.length}</b>
          </span>
          {!isAllSelected && activeAccount?.maxDrawdown && (
            <>
              <span className="text-white/20 hidden sm:inline">|</span>
              <span className="text-rose-300 font-semibold flex items-center gap-1 hidden sm:inline-flex">
                <Shield size={11} className="text-rose-400" />
                <span>MAX DD: <b>${activeAccount.maxDrawdown.toLocaleString()}</b></span>
              </span>
            </>
          )}
          {!isAllSelected && activeAccount?.profitTarget && (
            <>
              <span className="text-white/20 hidden lg:inline">|</span>
              <span className="text-teal-300 font-semibold flex items-center gap-1 hidden lg:inline-flex">
                <Target size={11} className="text-teal-400" />
                <span>TARGET: <b>${activeAccount.profitTarget.toLocaleString()}</b></span>
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenManageModal}
          className="font-mono text-[11px] font-bold uppercase bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
        >
          <Layers size={13} className="text-teal-400" />
          <span>Manage Accounts</span>
        </button>
      </div>
    </div>
  );
};
