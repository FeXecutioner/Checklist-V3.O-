import React, { useState, useEffect, useRef } from 'react';
import { TradeRecord, SetupType, TradingAccount } from '../types';
import {
  X,
  Save,
  Camera,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  DollarSign,
  Award,
  Sparkles,
  Calendar,
  Layers,
} from 'lucide-react';

interface EditTradeModalProps {
  isOpen: boolean;
  trade: TradeRecord | null;
  onClose: () => void;
  onSave: (updated: TradeRecord) => Promise<void>;
  accounts?: TradingAccount[];
}

const COMMON_NO_TRADE_REASONS = [
  'No Clean Liquidity Sweep',
  'Choppy / Low Volume Consolidation',
  'High-Impact Red Folder News',
  'Outside Session Hours / Time Window',
  'HTF Bias Invalidation / Lack of Clarity',
  'Premarket Setup Missed (Avoided FOMO)',
  'Strict Execution Rules Discipline',
];

export const EditTradeModal: React.FC<EditTradeModalProps> = ({
  isOpen,
  trade,
  onClose,
  onSave,
  accounts = [],
}) => {
  const [setup, setSetup] = useState<SetupType>('continuation');
  const [timestamp, setTimestamp] = useState<string>('');
  const [directionalBias, setDirectionalBias] = useState<string>('');
  const [noTradeReason, setNoTradeReason] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('acc-live-main');
  const [isBreakEven, setIsBreakEven] = useState<boolean>(false);
  const [balanceBefore, setBalanceBefore] = useState<string>('50000');
  const [balanceAfter, setBalanceAfter] = useState<string>('50000');
  const [pnl, setPnl] = useState<string>('0');
  const [htfLogic, setHtfLogic] = useState<string>('');
  const [ltfTarget, setLtfTarget] = useState<string>('');
  const [entryModelTime, setEntryModelTime] = useState<string>('');
  const [morningRoutine, setMorningRoutine] = useState<string>('');
  const [feelings, setFeelings] = useState<string>('');
  const [ruleBreaks, setRuleBreaks] = useState<string>('');
  const [improvements, setImprovements] = useState<string>('');
  const [followedRules, setFollowedRules] = useState<boolean>(true);
  const [emotionsControlled, setEmotionsControlled] = useState<boolean>(true);
  const [chartImage, setChartImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever trade changes
  useEffect(() => {
    if (trade) {
      setSetup(trade.setup);
      setTimestamp(trade.timestamp || '');
      setDirectionalBias(trade.directionalBias || '');
      setNoTradeReason(trade.noTradeReason || '');
      setSelectedAccountId(trade.accountId || accounts[0]?.id || 'acc-live-main');
      setIsBreakEven(trade.isBreakEven ?? false);
      setBalanceBefore(String(trade.balanceBefore ?? 50000));
      setBalanceAfter(String(trade.balanceAfter ?? 50000));
      setPnl(String(trade.pnl ?? 0));
      setHtfLogic(trade.htfLogic || '');
      setLtfTarget(trade.ltfTarget || '');
      setEntryModelTime(trade.entryModelTime || '');
      setMorningRoutine(trade.morningRoutine || '');
      setFeelings(trade.feelings || '');
      setRuleBreaks(trade.ruleBreaks || '');
      setImprovements(trade.improvements || '');
      setFollowedRules(trade.followedRules ?? true);
      setEmotionsControlled(trade.emotionsControlled ?? true);
      setChartImage(trade.chartImage || null);
    }
  }, [trade, accounts]);

  if (!isOpen || !trade) return null;

  const handleBalBeforeChange = (val: string) => {
    setBalanceBefore(val);
    const before = parseFloat(val);
    const pnlVal = parseFloat(pnl);
    if (!isNaN(before) && !isNaN(pnlVal) && setup !== 'no_trade') {
      setBalanceAfter(String(before + pnlVal));
    }
  };

  const handleBalAfterChange = (val: string) => {
    setBalanceAfter(val);
    const after = parseFloat(val);
    const before = parseFloat(balanceBefore);
    if (!isNaN(after) && !isNaN(before) && setup !== 'no_trade') {
      setPnl(String(after - before));
    }
  };

  const handlePnlChange = (val: string) => {
    setPnl(val);
    const pnlVal = parseFloat(val);
    const before = parseFloat(balanceBefore);
    if (!isNaN(pnlVal) && !isNaN(before) && setup !== 'no_trade') {
      setBalanceAfter(String(before + pnlVal));
    }
  };

  const handleImageFile = (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setChartImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const isNoTrade = setup === 'no_trade';
      const balBeforeNum = parseFloat(balanceBefore) || 0;
      const pnlNum = isNoTrade ? 0 : parseFloat(pnl) || 0;
      const balAfterNum = isNoTrade ? balBeforeNum : parseFloat(balanceAfter) || balBeforeNum + pnlNum;

      const targetAccount = accounts.find((a) => a.id === selectedAccountId);

      const updatedRecord: TradeRecord = {
        ...trade,
        timestamp: timestamp.trim() || trade.timestamp,
        setup,
        isNoTradeDay: isNoTrade,
        noTradeReason: isNoTrade ? (noTradeReason.trim() || 'Disciplined Standby') : undefined,
        directionalBias: isNoTrade
          ? `No Trade Day (${noTradeReason.trim() || 'Disciplined Standby'})`
          : directionalBias.trim(),
        accountId: selectedAccountId,
        accountName: targetAccount?.name || trade.accountName || 'Main Live Account',
        accountType: targetAccount?.type || trade.accountType || 'live',
        isBreakEven: isNoTrade ? false : isBreakEven,
        balanceBefore: balBeforeNum,
        balanceAfter: balAfterNum,
        pnl: pnlNum,
        htfLogic: htfLogic.trim(),
        ltfTarget: ltfTarget.trim(),
        entryModelTime: entryModelTime.trim(),
        morningRoutine: morningRoutine.trim(),
        feelings: feelings.trim(),
        ruleBreaks: ruleBreaks.trim(),
        improvements: improvements.trim(),
        followedRules,
        emotionsControlled,
        chartImage,
      };

      await onSave(updatedRecord);
      onClose();
    } catch (err) {
      console.error('Failed to update trade entry:', err);
      alert('Failed to save trade changes: ' + String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const isNoTrade = setup === 'no_trade';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl my-auto bg-zinc-950 border border-teal-500/30 rounded-3xl shadow-[0_0_50px_rgba(45,212,191,0.25)] overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-zinc-900/60 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-400 to-purple-600 flex items-center justify-center text-zinc-950 shadow-[0_0_15px_rgba(45,212,191,0.3)] shrink-0">
              <Save size={20} className="text-zinc-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold text-teal-300 bg-teal-950 border border-teal-500/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Sparkles size={11} /> EDIT ENTRY
                </span>
                <span className="font-mono text-[11px] text-zinc-400">ID #{trade.id}</span>
              </div>
              <h2 className="font-disp font-bold text-lg sm:text-xl text-zinc-100 uppercase tracking-wide mt-0.5">
                Edit Journal Entry
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

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Account Assignment Bar */}
          {accounts.length > 0 && (
            <div className="p-3.5 bg-zinc-900/40 border border-white/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-teal-400 shrink-0" />
                <span className="font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider">
                  Assigned Trading Account:
                </span>
              </div>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="bg-zinc-950 border border-teal-500/40 rounded-xl px-3 py-1.5 font-mono text-xs text-zinc-100 font-bold focus:outline-hidden focus:border-teal-400 cursor-pointer"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    [{acc.type.toUpperCase()}] {acc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Setup Type & Timestamp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-2">
                Execution Model / Setup
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSetup('continuation');
                  }}
                  className={`flex-1 py-2 px-3 font-mono text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    setup === 'continuation'
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-[0_0_10px_rgba(45,212,191,0.2)]'
                      : 'bg-zinc-900/60 text-zinc-400 border-white/10 hover:border-white/20'
                  }`}
                >
                  Continuation
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSetup('reversal');
                  }}
                  className={`flex-1 py-2 px-3 font-mono text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    setup === 'reversal'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                      : 'bg-zinc-900/60 text-zinc-400 border-white/10 hover:border-white/20'
                  }`}
                >
                  Reversal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSetup('no_trade');
                    setPnl('0');
                    setIsBreakEven(false);
                  }}
                  className={`flex-1 py-2 px-3 font-mono text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    setup === 'no_trade'
                      ? 'bg-teal-950 text-teal-300 border-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.2)]'
                      : 'bg-zinc-900/60 text-zinc-400 border-white/10 hover:border-white/20'
                  }`}
                >
                  No Trade
                </button>
              </div>
            </div>

            <div>
              <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-2">
                Record Timestamp
              </label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-3 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  placeholder="e.g. Sep 10, 2026, 9:45 AM"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-900/80 border border-white/10 rounded-xl font-mono text-xs text-zinc-100 focus:outline-hidden focus:border-teal-400"
                />
              </div>
            </div>
          </div>

          {/* Directional Bias / No Trade Reason */}
          <div>
            {isNoTrade ? (
              <div>
                <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-2">
                  No Trade Reason / Discipline Standby
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMMON_NO_TRADE_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNoTradeReason(r)}
                      className={`text-[11px] font-mono py-1 px-2.5 rounded-lg border transition-all cursor-pointer ${
                        noTradeReason === r
                          ? 'bg-teal-500/20 text-teal-300 border-teal-400'
                          : 'bg-zinc-900 text-zinc-400 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={noTradeReason}
                  onChange={(e) => setNoTradeReason(e.target.value)}
                  placeholder="Specific reason for sitting out..."
                  className="w-full p-2.5 bg-zinc-900/80 border border-white/10 rounded-xl font-mono text-xs text-zinc-100 focus:outline-hidden focus:border-teal-400"
                />
              </div>
            ) : (
              <div>
                <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-2">
                  Directional Bias & Inversion Thesis
                </label>
                <input
                  type="text"
                  value={directionalBias}
                  onChange={(e) => setDirectionalBias(e.target.value)}
                  placeholder="e.g. Bullish continuation above Premarket High after liquidity sweep..."
                  className="w-full p-2.5 bg-zinc-900/80 border border-white/10 rounded-xl font-mono text-xs text-zinc-100 focus:outline-hidden focus:border-teal-400"
                />
              </div>
            )}
          </div>

          {/* Financials & PnL with BE Tick Box */}
          <div className="p-4 bg-zinc-900/40 border border-white/10 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] font-bold uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                <DollarSign size={13} className="text-teal-400" />
                <span>Financials & Account Impact</span>
              </div>

              {!isNoTrade && (
                <label className="flex items-center gap-2 cursor-pointer bg-teal-950/40 hover:bg-teal-950/70 border border-teal-500/40 px-3 py-1 rounded-xl transition-all">
                  <input
                    type="checkbox"
                    checked={isBreakEven}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsBreakEven(checked);
                      if (checked) {
                        setPnl('0');
                        setBalanceAfter(balanceBefore);
                      }
                    }}
                    className="w-4 h-4 accent-teal-400 cursor-pointer rounded"
                  />
                  <span className="font-mono text-xs font-bold text-teal-300">
                    BE (Break-Even) Trade
                  </span>
                </label>
              )}
            </div>

            {isBreakEven && !isNoTrade && (
              <div className="p-2.5 bg-teal-950/60 border border-teal-500/40 rounded-xl font-mono text-[11px] text-teal-300 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-teal-400 shrink-0" />
                <span>
                  BREAK-EVEN TICKED: This trade will <b>not affect the win rate</b>. It is counted neutrally in journal analytics.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-mono text-[10px] text-zinc-400 uppercase mb-1">
                  Balance Before ($)
                </label>
                <input
                  type="number"
                  step="any"
                  value={balanceBefore}
                  onChange={(e) => handleBalBeforeChange(e.target.value)}
                  className="w-full p-2.5 bg-zinc-950/80 border border-white/10 rounded-xl font-mono text-xs text-zinc-100 focus:outline-hidden focus:border-teal-400"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] text-zinc-400 uppercase mb-1">
                  Balance After ($)
                </label>
                <input
                  type="number"
                  step="any"
                  disabled={isNoTrade}
                  value={isNoTrade ? balanceBefore : balanceAfter}
                  onChange={(e) => handleBalAfterChange(e.target.value)}
                  className="w-full p-2.5 bg-zinc-950/80 border border-white/10 rounded-xl font-mono text-xs text-zinc-100 focus:outline-hidden focus:border-teal-400 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] text-zinc-400 uppercase mb-1">
                  Net PnL ($)
                </label>
                <input
                  type="number"
                  step="any"
                  disabled={isNoTrade}
                  value={isNoTrade ? '0' : pnl}
                  onChange={(e) => handlePnlChange(e.target.value)}
                  className={`w-full p-2.5 bg-zinc-950/80 border rounded-xl font-mono text-xs font-bold focus:outline-hidden ${
                    isNoTrade
                      ? 'border-teal-500/40 text-teal-300'
                      : isBreakEven
                      ? 'border-teal-400 text-teal-200'
                      : parseFloat(pnl) > 0
                      ? 'border-teal-500/50 text-teal-300'
                      : parseFloat(pnl) < 0
                      ? 'border-rose-500/50 text-rose-400'
                      : 'border-white/10 text-zinc-200'
                  }`}
                />
              </div>
            </div>

            {isNoTrade && (
              <div className="p-2 bg-teal-950/40 border border-teal-500/30 rounded-xl font-mono text-[11px] text-teal-300 flex items-center gap-2">
                <Award size={14} className="text-teal-400 shrink-0" />
                <span>No Trade Day: PnL is locked at $0.00 — Account balance preserved intact.</span>
              </div>
            )}
          </div>

          {/* Analysis & Context */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-2">
                HTF Logic & Narrative Context
              </label>
              <textarea
                rows={3}
                value={htfLogic}
                onChange={(e) => setHtfLogic(e.target.value)}
                placeholder="HTF draw on liquidity, 4H/Daily order flow..."
                className="w-full p-2.5 bg-zinc-900/80 border border-white/10 rounded-xl font-body text-xs text-zinc-100 focus:outline-hidden focus:border-teal-400"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-2">
                LTF Execution / Target Objective
              </label>
              <textarea
                rows={3}
                value={ltfTarget}
                onChange={(e) => setLtfTarget(e.target.value)}
                placeholder="1m/5m displacement, FVG inversion target..."
                className="w-full p-2.5 bg-zinc-900/80 border border-white/10 rounded-xl font-body text-xs text-zinc-100 focus:outline-hidden focus:border-teal-400"
              />
            </div>
          </div>

          {/* Timing & Routine */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-2">
                Entry Model Time (EST / NY)
              </label>
              <input
                type="text"
                value={entryModelTime}
                onChange={(e) => setEntryModelTime(e.target.value)}
                placeholder="e.g. 09:42 AM NY / N/A"
                className="w-full p-2.5 bg-zinc-900/80 border border-white/10 rounded-xl font-mono text-xs text-zinc-100 focus:outline-hidden focus:border-teal-400"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-2">
                Morning Routine / Prep Notes
              </label>
              <input
                type="text"
                value={morningRoutine}
                onChange={(e) => setMorningRoutine(e.target.value)}
                placeholder="e.g. Reviewed calendar, meditation, session prep..."
                className="w-full p-2.5 bg-zinc-900/80 border border-white/10 rounded-xl font-body text-xs text-zinc-100 focus:outline-hidden focus:border-teal-400"
              />
            </div>
          </div>

          {/* Psychology & Review */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-2">
                Psychology & Feelings
              </label>
              <textarea
                rows={3}
                value={feelings}
                onChange={(e) => setFeelings(e.target.value)}
                placeholder="Emotional state during trade/session..."
                className="w-full p-2.5 bg-zinc-900/80 border border-white/10 rounded-xl font-body text-xs text-zinc-100 focus:outline-hidden focus:border-teal-400"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] font-bold uppercase text-rose-400 tracking-wider mb-2">
                Rule Breaks (If Any)
              </label>
              <textarea
                rows={3}
                value={ruleBreaks}
                onChange={(e) => setRuleBreaks(e.target.value)}
                placeholder="None, or entered early before confirmation..."
                className="w-full p-2.5 bg-zinc-900/80 border border-white/10 rounded-xl font-body text-xs text-zinc-100 focus:outline-hidden focus:border-rose-400"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] font-bold uppercase text-purple-400 tracking-wider mb-2">
                Improvements & Lessons
              </label>
              <textarea
                rows={3}
                value={improvements}
                onChange={(e) => setImprovements(e.target.value)}
                placeholder="Key takeaways for upcoming sessions..."
                className="w-full p-2.5 bg-zinc-900/80 border border-white/10 rounded-xl font-body text-xs text-zinc-100 focus:outline-hidden focus:border-purple-400"
              />
            </div>
          </div>

          {/* Discipline Checkboxes */}
          <div className="p-4 bg-zinc-900/60 border border-white/10 rounded-2xl flex flex-wrap gap-6 items-center">
            <label className="flex items-center gap-3 cursor-pointer font-mono text-xs font-bold uppercase text-zinc-200">
              <input
                type="checkbox"
                checked={followedRules}
                onChange={(e) => setFollowedRules(e.target.checked)}
                className="w-5 h-5 accent-teal-400 cursor-pointer rounded"
              />
              <span className="text-teal-300">Followed Rules (Discipline Maintained)</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer font-mono text-xs font-bold uppercase text-zinc-200">
              <input
                type="checkbox"
                checked={emotionsControlled}
                onChange={(e) => setEmotionsControlled(e.target.checked)}
                className="w-5 h-5 accent-teal-400 cursor-pointer rounded"
              />
              <span className="text-purple-300">Emotions Controlled</span>
            </label>
          </div>

          {/* Chart Screenshot Section */}
          <div className="p-4 bg-zinc-900/40 border border-white/10 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <label className="font-mono text-[10px] font-bold uppercase text-zinc-300 tracking-wider">
                Chart Screenshot
              </label>
              {chartImage && (
                <button
                  type="button"
                  onClick={() => setChartImage(null)}
                  className="text-[10px] font-mono text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={12} /> Remove Image
                </button>
              )}
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 bg-zinc-950/40 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:border-teal-400/50 transition-all"
            >
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleImageFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {chartImage ? (
                <div className="flex flex-col items-center">
                  <img
                    src={chartImage}
                    alt="Trade Chart Screenshot"
                    className="max-h-48 object-contain rounded-lg border border-white/10"
                  />
                  <span className="font-mono text-[10px] text-zinc-400 mt-2">
                    Click to replace screenshot
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-zinc-400 py-2">
                  <Camera size={20} className="text-teal-400" />
                  <span className="text-xs font-mono">
                    Drag and drop or click to attach/replace chart screenshot
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-400 hover:to-purple-500 text-white font-mono font-bold text-xs uppercase flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(45,212,191,0.35)] cursor-pointer transition-all border border-teal-300/40 disabled:opacity-50"
            >
              <Save size={16} />
              <span>{isSaving ? 'Saving Changes...' : 'Save Changes to Journal'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="sm:w-auto py-3.5 px-6 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl font-mono font-bold text-xs uppercase cursor-pointer transition-all border border-white/10"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
