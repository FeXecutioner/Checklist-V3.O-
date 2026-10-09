import React, { useState, useEffect, useRef } from 'react';
import { TradingAccount, AccountType, TradeRecord } from '../types';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Check,
  Briefcase,
  AlertCircle,
  Sparkles,
  DollarSign,
  Shield,
  ShieldAlert,
  Target,
  Layers,
  Save,
  RotateCcw,
} from 'lucide-react';

interface AccountManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: TradingAccount[];
  activeAccountId: string;
  onSelectAccount: (accountId: string) => void;
  onSaveAccount: (account: TradingAccount) => Promise<void>;
  onDeleteAccount: (accountId: string) => Promise<void>;
  trades: TradeRecord[];
  initialEditAccountId?: string | null;
}

const PRESET_BALANCES = [10000, 25000, 50000, 100000, 150000, 200000, 300000];
const PRESET_DRAWDOWNS = [1500, 2000, 2500, 3000, 5000, 10000];
const PRESET_TARGETS = [1500, 3000, 5000, 6000, 9000, 10000];

export const AccountManagerModal: React.FC<AccountManagerModalProps> = ({
  isOpen,
  onClose,
  accounts,
  activeAccountId,
  onSelectAccount,
  onSaveAccount,
  onDeleteAccount,
  trades,
  initialEditAccountId,
}) => {
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<AccountType>('demo');
  const [initialBalance, setInitialBalance] = useState<string>('50000');
  const [maxDrawdown, setMaxDrawdown] = useState<string>('2500');
  const [profitTarget, setProfitTarget] = useState<string>('3000');
  const [currency, setCurrency] = useState<string>('$');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const editInputRef = useRef<HTMLInputElement>(null);

  // When opened with an initialEditAccountId, immediately open edit mode for that account
  useEffect(() => {
    if (isOpen && initialEditAccountId) {
      const target = accounts.find((a) => a.id === initialEditAccountId);
      if (target) {
        handleStartEdit(target);
      }
    } else if (isOpen && !editingAccountId && !isAdding) {
      // Keep state clean
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, initialEditAccountId]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingAccountId || isAdding) {
      setTimeout(() => {
        editInputRef.current?.focus();
      }, 100);
    }
  }, [editingAccountId, isAdding]);

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setType('demo');
    setInitialBalance('50000');
    setMaxDrawdown('2500');
    setProfitTarget('3000');
    setCurrency('$');
    setNotes('');
    setIsAdding(false);
    setEditingAccountId(null);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleStartAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleStartEdit = (acc: TradingAccount) => {
    setName(acc.name);
    setType(acc.type);
    setInitialBalance(String(acc.initialBalance));
    setMaxDrawdown(acc.maxDrawdown ? String(acc.maxDrawdown) : '2500');
    setProfitTarget(acc.profitTarget ? String(acc.profitTarget) : '3000');
    setCurrency(acc.currency || '$');
    setNotes(acc.notes || '');
    setEditingAccountId(acc.id);
    setIsAdding(false);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // Clean numerical input (handles commas like "50,000" or dollar signs "$50,000")
  const parseBalanceNumber = (raw: string): number => {
    if (!raw) return NaN;
    const sanitized = raw.replace(/[^0-9.-]/g, '');
    return parseFloat(sanitized);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Account name is required.');
      return;
    }

    const balanceNum = parseBalanceNumber(initialBalance);
    if (isNaN(balanceNum) || balanceNum < 0) {
      setErrorMsg('Please enter a valid starting figure / initial balance (e.g. 50000 or 50,000).');
      return;
    }

    const maxDDNum = parseBalanceNumber(maxDrawdown);
    const profitTargetNum = parseBalanceNumber(profitTarget);

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (editingAccountId) {
        const existing = accounts.find((a) => a.id === editingAccountId);
        if (existing) {
          const updated: TradingAccount = {
            ...existing,
            name: name.trim(),
            type,
            initialBalance: balanceNum,
            maxDrawdown: !isNaN(maxDDNum) && maxDDNum > 0 ? maxDDNum : 2500,
            profitTarget: !isNaN(profitTargetNum) && profitTargetNum > 0 ? profitTargetNum : 3000,
            currency: currency.trim() || '$',
            notes: notes.trim(),
          };
          await onSaveAccount(updated);
          setSuccessMsg(`Account "${updated.name}" updated successfully!`);
        }
      } else {
        const newAcc: TradingAccount = {
          id: `acc-${Date.now()}`,
          name: name.trim(),
          type,
          initialBalance: balanceNum,
          maxDrawdown: !isNaN(maxDDNum) && maxDDNum > 0 ? maxDDNum : 2500,
          profitTarget: !isNaN(profitTargetNum) && profitTargetNum > 0 ? profitTargetNum : 3000,
          currency: currency.trim() || '$',
          notes: notes.trim(),
          createdAt: new Date().toISOString(),
          isDefault: accounts.length === 0,
        };
        await onSaveAccount(newAcc);
        onSelectAccount(newAcc.id);
        setSuccessMsg(`Account "${newAcc.name}" created and set active!`);
      }
      resetForm();
    } catch (err) {
      setErrorMsg('Failed to save account: ' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (accId: string, accName: string) => {
    if (accounts.length <= 1) {
      alert('You must keep at least one trading account.');
      return;
    }
    const count = trades.filter((t) => t.accountId === accId).length;
    const confirmText =
      count > 0
        ? `Delete "${accName}"? This account has ${count} recorded trades. Existing trades will be preserved and reassigned to your primary account.`
        : `Delete "${accName}"?`;

    if (window.confirm(confirmText)) {
      await onDeleteAccount(accId);
      if (activeAccountId === accId) {
        const remaining = accounts.filter((a) => a.id !== accId);
        if (remaining.length > 0) {
          onSelectAccount(remaining[0].id);
        }
      }
      if (editingAccountId === accId) {
        resetForm();
      }
    }
  };

  const getAccountStats = (accId: string, initialBal: number) => {
    const accTrades = trades.filter((t) => (t.accountId || 'acc-live-main') === accId);
    const netPnL = accTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const currentBalance = initialBal + netPnL;
    return {
      count: accTrades.length,
      netPnL,
      currentBalance,
    };
  };

  const getTypeBadge = (accType: AccountType) => {
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
          label: 'ACCOUNT',
          color: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        };
    }
  };

  // Reusable Account Form (for either inline edit or add new)
  const renderAccountForm = (isEditing: boolean) => (
    <form
      onSubmit={handleSubmit}
      className="p-5 bg-zinc-900/95 border-2 border-teal-400/60 rounded-2xl space-y-4 shadow-[0_0_35px_rgba(45,212,191,0.25)] animate-in fade-in duration-150"
    >
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <span className="font-mono text-xs font-bold uppercase text-teal-300 flex items-center gap-2">
          {isEditing ? <Edit2 size={15} className="text-teal-400" /> : <Plus size={15} className="text-teal-400" />}
          <span className="text-sm font-disp">
            {isEditing ? 'Edit Specific Account Details' : 'Create New Account'}
          </span>
        </span>
        <button
          type="button"
          onClick={resetForm}
          className="text-zinc-400 hover:text-zinc-200 text-xs font-mono px-2.5 py-1 rounded-lg hover:bg-white/5 cursor-pointer flex items-center gap-1"
        >
          <X size={14} />
          <span>Cancel</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-300 font-mono text-xs flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Account Name */}
      <div>
        <label className="block font-mono text-[11px] font-bold uppercase text-teal-300 tracking-wider mb-1.5 flex items-center justify-between">
          <span>1. Account Name *</span>
          <span className="text-[10px] text-zinc-400 font-normal">What you want to call this account</span>
        </label>
        <input
          ref={editInputRef}
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Apex 50k Demo, Topstep Funded, Live Brokerage, Personal Evaluation..."
          className="w-full p-3 bg-zinc-950 border border-teal-500/40 focus:border-teal-400 rounded-xl font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:ring-2 focus:ring-teal-500/30 shadow-inner"
        />
      </div>

      {/* Account Classification */}
      <div>
        <label className="block font-mono text-[11px] font-bold uppercase text-teal-300 tracking-wider mb-1.5">
          2. Account Classification / Type
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['demo', 'live', 'funded', 'evaluation'] as AccountType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`py-2 px-3 rounded-xl font-mono text-xs font-bold uppercase border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                type === t
                  ? 'bg-teal-500/25 text-teal-300 border-teal-400 shadow-[0_0_15px_rgba(45,212,191,0.25)] font-bold'
                  : 'bg-zinc-950/60 text-zinc-400 border-white/10 hover:border-white/20'
              }`}
            >
              {type === t && <Check size={13} className="text-teal-400" />}
              <span>{t}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Starting Figure / Initial Balance */}
      <div className="space-y-2">
        <label className="block font-mono text-[11px] font-bold uppercase text-teal-300 tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1">
            <DollarSign size={13} className="text-teal-400" />
            <span>3. Starting Figure / Initial Balance *</span>
          </span>
          <span className="text-[10px] text-zinc-400 font-normal">Baseline capital for equity curve & fixed balance</span>
        </label>

        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-teal-400 text-sm">
            {currency}
          </span>
          <input
            type="text"
            required
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            placeholder="50000 or 50,000"
            className="w-full pl-8 pr-4 py-3 bg-zinc-950 border border-teal-500/40 focus:border-teal-400 rounded-xl font-mono text-sm font-bold text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:ring-2 focus:ring-teal-500/30 shadow-inner"
          />
        </div>

        {/* Quick Balance Presets */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mr-1">
            Quick Sizes:
          </span>
          {PRESET_BALANCES.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setInitialBalance(String(preset))}
              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold border transition-all cursor-pointer ${
                parseBalanceNumber(initialBalance) === preset
                  ? 'bg-teal-400/20 text-teal-300 border-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.2)]'
                  : 'bg-zinc-950/70 text-zinc-400 border-white/10 hover:border-white/30 hover:text-white'
              }`}
            >
              ${(preset / 1000).toFixed(0)}k
            </button>
          ))}
        </div>
      </div>

      {/* NEW: 4. Max Drawdown & Profit Target (Reflected into S4 Risk Buffer Zone) */}
      <div className="p-4 bg-zinc-950/80 border border-teal-500/40 rounded-xl space-y-4 shadow-inner">
        <div className="flex items-center gap-2 pb-2 border-b border-white/10">
          <ShieldAlert size={16} className="text-teal-400" />
          <span className="font-disp font-bold text-xs uppercase tracking-wide text-zinc-200">
            4. Risk Buffer Zone Parameters (Drawdown & Target)
          </span>
          <span className="text-[10px] font-mono text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-500/30 ml-auto">
            REFLECTED IN S4
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Max Drawdown Limit */}
          <div className="space-y-1.5">
            <label className="block font-mono text-[11px] font-bold uppercase text-rose-300 tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Shield size={12} className="text-rose-400" />
                <span>Max Drawdown Limit $</span>
              </span>
              <span className="text-[10px] text-zinc-500">Max loss before breach</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-rose-400 text-xs">
                {currency}
              </span>
              <input
                type="text"
                value={maxDrawdown}
                onChange={(e) => setMaxDrawdown(e.target.value)}
                placeholder="2500"
                className="w-full pl-7 pr-3 py-2.5 bg-zinc-950 border border-rose-500/40 focus:border-rose-400 rounded-xl font-mono text-xs font-bold text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:ring-1 focus:ring-rose-500/30"
              />
            </div>
            {/* Drawdown Presets */}
            <div className="flex flex-wrap gap-1 pt-0.5">
              {PRESET_DRAWDOWNS.map((ddPreset) => (
                <button
                  key={ddPreset}
                  type="button"
                  onClick={() => setMaxDrawdown(String(ddPreset))}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                    parseBalanceNumber(maxDrawdown) === ddPreset
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold'
                      : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                  }`}
                >
                  ${ddPreset >= 1000 ? `${(ddPreset / 1000).toFixed(1).replace('.0', '')}k` : ddPreset}
                </button>
              ))}
            </div>
          </div>

          {/* Profit Target */}
          <div className="space-y-1.5">
            <label className="block font-mono text-[11px] font-bold uppercase text-teal-300 tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Target size={12} className="text-teal-400" />
                <span>Profit Target $</span>
              </span>
              <span className="text-[10px] text-zinc-500">Goal / Pass Milestone</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-teal-400 text-xs">
                {currency}
              </span>
              <input
                type="text"
                value={profitTarget}
                onChange={(e) => setProfitTarget(e.target.value)}
                placeholder="3000"
                className="w-full pl-7 pr-3 py-2.5 bg-zinc-950 border border-teal-500/40 focus:border-teal-400 rounded-xl font-mono text-xs font-bold text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:ring-1 focus:ring-teal-500/30"
              />
            </div>
            {/* Target Presets */}
            <div className="flex flex-wrap gap-1 pt-0.5">
              {PRESET_TARGETS.map((targetPreset) => (
                <button
                  key={targetPreset}
                  type="button"
                  onClick={() => setProfitTarget(String(targetPreset))}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                    parseBalanceNumber(profitTarget) === targetPreset
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 font-bold'
                      : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                  }`}
                >
                  ${targetPreset >= 1000 ? `${(targetPreset / 1000).toFixed(1).replace('.0', '')}k` : targetPreset}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[10px] font-mono text-zinc-400 leading-relaxed">
          These fixed figures lock into the <b>S4 Risk Buffer Zone</b> in the execution console, automatically calculating your consecutive loss survival buffer and target milestone progress as account profit grows.
        </p>
      </div>

      {/* Notes / Strategy Guidelines */}
      <div>
        <label className="block font-mono text-[11px] font-bold uppercase text-teal-300 tracking-wider mb-1.5">
          5. Objectives & Rules Notes (Optional)
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. 2 contracts NQ max, risk 1R ($400), don't trade NFP..."
          className="w-full p-3 bg-zinc-950 border border-white/10 focus:border-teal-400 rounded-xl font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden"
        />
      </div>

      {/* Submit / Cancel Buttons */}
      <div className="flex gap-3 justify-end pt-3 border-t border-white/10">
        <button
          type="button"
          onClick={resetForm}
          className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl font-mono text-xs font-bold uppercase cursor-pointer transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-400 hover:to-purple-500 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl shadow-[0_0_20px_rgba(45,212,191,0.35)] border border-teal-300/30 cursor-pointer disabled:opacity-50 flex items-center gap-2 transition-all"
        >
          <Save size={14} />
          <span>{isSubmitting ? 'Saving...' : isEditing ? 'Save Account Details' : 'Create & Activate Account'}</span>
        </button>
      </div>
    </form>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl my-auto bg-zinc-950 border border-teal-500/40 rounded-3xl shadow-[0_0_50px_rgba(45,212,191,0.25)] overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-zinc-900/70 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-400 to-purple-600 flex items-center justify-center text-zinc-950 shadow-[0_0_15px_rgba(45,212,191,0.3)] shrink-0">
              <Layers size={20} className="text-zinc-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold text-teal-300 bg-teal-950 border border-teal-500/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Sparkles size={11} /> MULTI-ACCOUNT MANAGEMENT
                </span>
                <span className="font-mono text-[11px] text-zinc-400">
                  {accounts.length} {accounts.length === 1 ? 'Account' : 'Accounts'}
                </span>
              </div>
              <h2 className="font-disp font-bold text-lg sm:text-xl text-zinc-100 uppercase tracking-wide mt-0.5">
                Trading Accounts, Drawdown & Profit Targets
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Notifications */}
          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-teal-950/70 border border-teal-500/50 text-teal-300 font-mono text-xs flex items-center justify-between gap-2 shadow-[0_0_20px_rgba(45,212,191,0.2)]">
              <div className="flex items-center gap-2">
                <Check size={16} className="text-teal-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                className="text-teal-400 hover:text-teal-200 text-xs px-2 py-0.5 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Top banner: Add Account Button or Add Form */}
          {!isAdding && !editingAccountId && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-zinc-900/40 border border-white/10 rounded-2xl">
              <div>
                <h3 className="font-disp font-bold text-sm text-zinc-100 uppercase">
                  Add Demo, Live or Prop Accounts
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Configure names, starting capital, max drawdown limits, and profit targets.
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartAdd}
                className="shrink-0 font-mono text-xs font-bold uppercase bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-400 hover:to-purple-500 text-white px-4 py-2.5 rounded-xl shadow-[0_0_15px_rgba(45,212,191,0.3)] cursor-pointer transition-all border border-teal-300/30 flex items-center justify-center gap-1.5"
              >
                <Plus size={15} />
                <span>Add New Account</span>
              </button>
            </div>
          )}

          {/* New Account Form (when adding) */}
          {isAdding && renderAccountForm(false)}

          {/* Accounts List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between font-mono text-[11px] font-bold uppercase text-zinc-400 tracking-wider px-1">
              <span>Configured Accounts ({accounts.length})</span>
              <span className="text-[10px] text-teal-400 font-normal">Click &ldquo;Edit Details&rdquo; on any account to adjust drawdown or target</span>
            </div>

            {accounts.map((acc) => {
              const isCurrentlyEditing = editingAccountId === acc.id;

              // If this account is being edited, render the inline editor in place!
              if (isCurrentlyEditing) {
                return (
                  <div key={acc.id} id={`edit-account-${acc.id}`} className="scroll-mt-4">
                    {renderAccountForm(true)}
                  </div>
                );
              }

              const stats = getAccountStats(acc.id, acc.initialBalance);
              const badge = getTypeBadge(acc.type);
              const isActive = acc.id === activeAccountId;
              const maxDD = acc.maxDrawdown || 2500;
              const target = acc.profitTarget || 3000;
              const targetPct = target > 0 ? (stats.netPnL / target) * 100 : 0;

              return (
                <div
                  key={acc.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isActive
                      ? 'bg-teal-950/25 border-teal-500/60 shadow-[0_0_20px_rgba(45,212,191,0.15)]'
                      : 'bg-zinc-900/40 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectAccount(acc.id)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                        isActive
                          ? 'bg-teal-400 text-zinc-950 shadow-[0_0_15px_rgba(45,212,191,0.5)]'
                          : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/10'
                      }`}
                      title={isActive ? 'Active Account' : 'Click to set as active account'}
                    >
                      {isActive ? <Check size={18} className="font-bold stroke-[3]" /> : <Briefcase size={16} />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-disp font-bold text-base sm:text-lg text-zinc-100">
                          {acc.name}
                        </span>
                        <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${badge.color}`}>
                          {badge.label}
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-400/20 text-teal-300 border border-teal-400/40">
                            CURRENT ACTIVE
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono text-zinc-400 mt-2">
                        <span className="bg-zinc-950/70 px-2.5 py-1 rounded-lg border border-white/5">
                          STARTING BASE:{' '}
                          <b className="text-zinc-200 font-bold">
                            ${acc.initialBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </b>
                        </span>

                        <span className="bg-zinc-950/70 px-2.5 py-1 rounded-lg border border-white/5">
                          LIVE BAL:{' '}
                          <b
                            className={
                              stats.netPnL > 0
                                ? 'text-teal-300 font-bold'
                                : stats.netPnL < 0
                                ? 'text-rose-400 font-bold'
                                : 'text-zinc-200'
                            }
                          >
                            ${stats.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </b>
                          {stats.netPnL !== 0 && (
                            <span className="text-[10px] ml-1 opacity-80">
                              ({stats.netPnL >= 0 ? '+' : ''}${stats.netPnL.toFixed(0)})
                            </span>
                          )}
                        </span>

                        <span className="bg-zinc-950/70 px-2.5 py-1 rounded-lg border border-rose-500/20 text-rose-300">
                          MAX DD: <b className="font-bold">${maxDD.toLocaleString()}</b>
                        </span>

                        <span className="bg-zinc-950/70 px-2.5 py-1 rounded-lg border border-teal-500/20 text-teal-300 flex items-center gap-1">
                          <Target size={11} />
                          <span>TARGET: <b className="font-bold">${target.toLocaleString()}</b></span>
                          {stats.netPnL > 0 && (
                            <span className="text-[10px] text-teal-400 font-bold">
                              ({targetPct.toFixed(0)}%)
                            </span>
                          )}
                        </span>
                      </div>

                      {acc.notes && (
                        <p className="text-[11px] text-zinc-500 mt-1.5 italic font-mono truncate">
                          {acc.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions for this account */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => onSelectAccount(acc.id)}
                        className="font-mono text-xs font-bold px-3 py-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 transition-all cursor-pointer"
                        title="Switch active account to this one"
                      >
                        Set Active
                      </button>
                    )}

                    {/* Dedicated Edit Details Button */}
                    <button
                      type="button"
                      onClick={() => handleStartEdit(acc)}
                      className="font-mono text-xs font-bold px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-teal-500/20 text-zinc-200 hover:text-teal-300 border border-white/10 hover:border-teal-500/40 cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
                      title="Edit this account's name, starting balance, max drawdown, and profit target"
                    >
                      <Edit2 size={13} className="text-teal-400" />
                      <span>Edit Details</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(acc.id, acc.name)}
                      disabled={accounts.length <= 1}
                      className="p-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-500/20 cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title={accounts.length <= 1 ? 'Cannot delete the only account' : 'Delete account'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-900/60 border-t border-white/10 flex items-center justify-between">
          <div className="text-[11px] font-mono text-zinc-400">
            Drawdown limits & profit targets automatically govern the <b>S4 Risk Buffer Zone</b>.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-mono text-xs uppercase cursor-pointer font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
