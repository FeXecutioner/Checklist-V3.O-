import React, { useState, useRef } from 'react';
import { TradeRecord, TradingAccount } from '../types';
import { ShieldCheck, CheckCircle2, Camera, X, Save, ArrowLeft, Award, Sparkles, Layers } from 'lucide-react';

interface NoTradeJournalFormProps {
  isOpen: boolean;
  onClose: () => void;
  onCommit: (record: TradeRecord) => Promise<void>;
  accountSize?: number;
  accounts?: TradingAccount[];
  activeAccountId?: string;
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

export const NoTradeJournalForm: React.FC<NoTradeJournalFormProps> = ({
  isOpen,
  onClose,
  onCommit,
  accountSize,
  accounts = [],
  activeAccountId,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>(COMMON_NO_TRADE_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>(activeAccountId || 'acc-live-main');
  const [htfLogic, setHtfLogic] = useState<string>('');
  const [feelings, setFeelings] = useState<string>('Maintained complete patience. Avoided chasing low-probability price action and strictly protected capital.');
  const [morningRoutine, setMorningRoutine] = useState<string>('');
  const [chartImage, setChartImage] = useState<string | null>(null);
  const [followedRules, setFollowedRules] = useState<boolean>(true);
  const [emotionsControlled, setEmotionsControlled] = useState<boolean>(true);
  const [keyTakeaway, setKeyTakeaway] = useState<string>('Capital preservation is an edge. Waiting for A+ setup.');
  const [balance, setBalance] = useState<string>(accountSize ? String(accountSize) : '50000');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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
    setIsSubmitting(true);

    try {
      const finalReason = customReason.trim() ? customReason.trim() : selectedReason;
      const balNum = parseFloat(balance) || 50000;
      const acc = accounts.find((a) => a.id === selectedAccount);

      const record: TradeRecord = {
        id: Date.now(),
        timestamp: new Date().toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        setup: 'no_trade',
        directionalBias: `No Trade Taken (${finalReason})`,
        accountId: selectedAccount,
        accountName: acc?.name || 'Main Live Account',
        accountType: acc?.type || 'live',
        isBreakEven: false,
        accountSize: balNum,
        balanceBefore: balNum,
        balanceAfter: balNum,
        pnl: 0,
        htfLogic: htfLogic.trim() || `No Trade Day observed. Reason: ${finalReason}. Market structure did not meet entry thresholds.`,
        ltfTarget: 'None (Zero Risk Taken - Capital Preserved)',
        entryModelTime: 'N/A (Disciplined Standby)',
        morningRoutine: morningRoutine.trim(),
        feelings: feelings.trim(),
        chartImage,
        followedRules,
        emotionsControlled,
        ruleBreaks: 'None - Successfully abstained from non-model setups.',
        improvements: keyTakeaway.trim(),
        isNoTradeDay: true,
        noTradeReason: finalReason,
        checklistSummary: {
          s1Done: true,
          s2Done: false,
          s3Done: false,
          s4Done: false,
          gatePassed: false,
        },
      };

      await onCommit(record);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to save No Trade Day record: ' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mb-8 p-5 sm:p-7 bg-zinc-950/90 border-2 border-teal-500/40 rounded-3xl backdrop-blur-2xl shadow-[0_0_40px_rgba(45,212,191,0.2)] animate-in fade-in slide-in-from-top-4 duration-300">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-400 to-purple-600 flex items-center justify-center text-zinc-950 shadow-[0_0_20px_rgba(45,212,191,0.4)] shrink-0">
            <ShieldCheck size={26} className="text-zinc-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-teal-950 text-teal-300 border border-teal-500/40 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                <Sparkles size={11} /> DISCIPLINE RECORD
              </span>
              <span className="font-mono text-xs text-purple-300 font-bold bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded-md">
                $0.00 PnL (Capital Preserved)
              </span>
            </div>
            <h2 className="font-disp text-lg sm:text-xl font-bold text-zinc-100 uppercase tracking-wide mt-1">
              Journal No Trade Day
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Sitting on hands when no A+ model presents is a trader's greatest superpower. Record your discipline.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200 border border-white/10 hover:bg-white/5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer self-end sm:self-auto"
        >
          <X size={14} />
          <span>Close Form</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Account Selector */}
        {accounts.length > 0 && (
          <div className="p-3.5 bg-zinc-900/60 border border-white/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-teal-400 shrink-0" />
              <span className="font-mono text-[11px] font-bold uppercase text-teal-300 tracking-wider">
                Log Discipline To Account:
              </span>
            </div>
            <select
              value={selectedAccount}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedAccount(val);
                const found = accounts.find((a) => a.id === val);
                if (found) setBalance(String(found.initialBalance));
              }}
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

        {/* Reason Selector */}
        <div>
          <label className="block font-mono text-[11px] font-bold uppercase text-teal-400 tracking-wider mb-2.5">
            Primary Reason For Sitting Out Today
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {COMMON_NO_TRADE_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setSelectedReason(r);
                  setCustomReason('');
                }}
                className={`py-1.5 px-3 rounded-xl font-mono text-xs transition-all cursor-pointer border ${
                  selectedReason === r && !customReason
                    ? 'bg-teal-500/20 text-teal-300 border-teal-400 shadow-[0_0_12px_rgba(45,212,191,0.25)] font-bold'
                    : 'bg-zinc-900/60 text-zinc-400 border-white/10 hover:border-white/20 hover:text-zinc-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="mt-2">
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Or type a custom reason (e.g. FOMC speech at 2pm, choppy holiday liquidity)..."
              className="w-full border border-white/10 bg-zinc-900/80 p-3 font-mono text-xs rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-teal-400 transition-all"
            />
          </div>
        </div>

        {/* Financial Context & Balance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-zinc-900/50 border border-white/10 rounded-2xl">
          <div>
            <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-1.5">
              Account Balance $ (Unchanged)
            </label>
            <input
              type="number"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="50000"
              className="w-full border border-white/10 bg-zinc-950/70 p-2.5 font-mono text-xs rounded-xl text-zinc-100 focus:outline-hidden focus:border-teal-400"
            />
          </div>
          <div className="flex flex-col justify-center">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-400 tracking-wider mb-1.5">
              Session Net Impact
            </span>
            <div className="p-2.5 bg-teal-950/40 border border-teal-500/40 rounded-xl font-disp text-base font-bold text-teal-300 flex items-center gap-2">
              <Award size={18} className="text-teal-400" />
              <span>$0.00 PnL — 100% CAPITAL PROTECTED</span>
            </div>
          </div>
        </div>

        {/* Market Context & Narrative */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-2">
              Market Context & Why Setup Did Not Form
            </label>
            <textarea
              rows={4}
              value={htfLogic}
              onChange={(e) => setHtfLogic(e.target.value)}
              placeholder="HTF draw on liquidity was unclear, price action consolidated inside previous day's range, or displacement failed to confirm inversion..."
              className="w-full border border-white/10 bg-zinc-900/80 p-3 font-body text-xs rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30 transition-all"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-2">
              Psychology & Mental Discipline Review
            </label>
            <textarea
              rows={4}
              value={feelings}
              onChange={(e) => setFeelings(e.target.value)}
              placeholder="Did you feel tempted to click buttons or revenge trade? How did you keep yourself calm and grounded?"
              className="w-full border border-white/10 bg-zinc-900/80 p-3 font-body text-xs rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30 transition-all"
            />
          </div>
        </div>

        {/* Key Takeaway & Routine */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-2">
              Morning Routine / Preparation Notes
            </label>
            <input
              type="text"
              value={morningRoutine}
              onChange={(e) => setMorningRoutine(e.target.value)}
              placeholder="e.g. 6:30 AM wake up, reviewed economic calendar, planned to wait for NY session open..."
              className="w-full border border-white/10 bg-zinc-900/80 p-3 font-body text-xs rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-teal-400"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] font-bold uppercase text-purple-400 tracking-wider mb-2">
              Discipline Takeaway For Next Session
            </label>
            <input
              type="text"
              value={keyTakeaway}
              onChange={(e) => setKeyTakeaway(e.target.value)}
              placeholder="e.g. Proud I followed rule #1: No setup, no trade. Live to trade another day."
              className="w-full border border-white/10 bg-zinc-900/80 p-3 font-body text-xs rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-purple-400"
            />
          </div>
        </div>

        {/* Accountability Checkboxes */}
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
            <span className="text-purple-300">Emotions Controlled (No Forced Trades)</span>
          </label>
        </div>

        {/* Optional Chart Upload */}
        <div className="p-4 bg-zinc-900/40 border border-white/10 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <label className="font-mono text-[10px] font-bold uppercase text-zinc-300 tracking-wider">
              Optional Chart Context (e.g. Daily Range / Chop Overview)
            </label>
            {chartImage && (
              <button
                type="button"
                onClick={() => setChartImage(null)}
                className="text-[10px] font-mono text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <X size={12} /> Remove
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
                  alt="No Trade Day Chart"
                  className="max-h-40 object-contain rounded-lg border border-white/10"
                />
                <span className="font-mono text-[10px] text-zinc-400 mt-2">Click to replace screenshot</span>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-zinc-400 py-1">
                <Camera size={18} className="text-teal-400" />
                <span className="text-xs font-mono">Attach screenshot of daily market structure (optional)</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-400 hover:to-purple-500 text-white font-mono font-bold text-xs uppercase flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(45,212,191,0.35)] cursor-pointer transition-all border border-teal-300/40 disabled:opacity-50"
          >
            <Save size={16} />
            <span>{isSubmitting ? 'Saving to Internal Journal...' : 'Commit No Trade Day to Internal Journal'}</span>
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
  );
};
