import React, { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { SetupType, GateStatus, ChecklistState, ExecutionJournalInputs, TradeRecord } from '../types';
import { CheckCircle2, RefreshCw, Camera, Save, X, Radio } from 'lucide-react';

interface ExecutionViewProps {
  setup: SetupType;
  setSetup: (type: SetupType) => void;
  status: GateStatus;
  setStatus: (status: GateStatus) => void;
  onCommitTrade: (trade: TradeRecord) => Promise<void>;
  onReset: () => void;
  checklist: ChecklistState;
  setChecklist: React.Dispatch<React.SetStateAction<ChecklistState>>;
  journalInputs: ExecutionJournalInputs;
  setJournalInputs: React.Dispatch<React.SetStateAction<ExecutionJournalInputs>>;
}

export const ExecutionView: React.FC<ExecutionViewProps> = ({
  setup,
  setSetup,
  status,
  setStatus,
  onCommitTrade,
  onReset,
  checklist,
  setChecklist,
  journalInputs,
  setJournalInputs,
}) => {
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureZoneRef = useRef<HTMLDivElement>(null);

  // Calculation for Risk Buffer
  const dd = parseFloat(checklist.maxDD) || 0;
  const rpt = parseFloat(checklist.riskPerTrade) || 0;
  const bufferCount = dd > 0 && rpt > 0 ? Math.floor(dd / rpt) : null;

  // Calculation for PnL
  const beforeVal = parseFloat(journalInputs.balBefore) || 0;
  const afterVal = parseFloat(journalInputs.balAfter) || 0;
  const pnlDiff = journalInputs.balBefore !== '' && journalInputs.balAfter !== '' ? afterVal - beforeVal : 0;

  // Track checklist completion to update Gate Status
  const s1Complete = checklist.premarketAction && checklist.htfFvg;
  const s2Complete = checklist.m5m15Gap && checklist.manipulation;
  const s3Complete = checklist.inversionFound && checklist.highestTfGap;
  const s4Complete = checklist.rrRatio && checklist.clearLiquidity && checklist.inversionSpeed;

  const allSectionsComplete = s1Complete && s2Complete && s3Complete && s4Complete;

  const gateComplete =
    checklist.gateSessionWindow &&
    checklist.gateHtfGap &&
    checklist.gateM5M15Manip &&
    checklist.gateInversionHighest &&
    checklist.gatePlannedTrade;

  useEffect(() => {
    if (allSectionsComplete && gateComplete) {
      if (status !== 'GO') setStatus('GO');
    } else if (allSectionsComplete) {
      if (status !== 'STANDBY') setStatus('STANDBY');
    } else {
      if (status !== 'NO-GO') setStatus('NO-GO');
    }
  }, [allSectionsComplete, gateComplete, status, setStatus]);

  // Handle image upload & preview
  const handleImageFile = (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setJournalInputs((prev) => ({
        ...prev,
        chartImage: e.target?.result as string,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  // Commit to Internal Journal
  const handleCommit = async () => {
    setIsCapturing(true);
    setSaveSuccessMsg(null);

    try {
      let visualCardUrl: string | null = null;
      if (captureZoneRef.current) {
        try {
          const canvas = await html2canvas(captureZoneRef.current, {
            backgroundColor: '#09090b',
            scale: 1.5,
            useCORS: true,
            logging: false,
          });
          visualCardUrl = canvas.toDataURL('image/jpeg', 0.85);
        } catch (err) {
          console.warn('Canvas visual capture skipped:', err);
        }
      }

      const calculatedPnl =
        journalInputs.manualPnL !== ''
          ? parseFloat(journalInputs.manualPnL) || pnlDiff
          : pnlDiff;

      const record: TradeRecord = {
        id: Date.now(),
        timestamp: new Date().toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        setup,
        directionalBias: checklist.biasInput.trim() || 'No explicit bias entered',
        accountSize: checklist.acctSize ? parseFloat(checklist.acctSize) : undefined,
        maxDrawdown: dd > 0 ? dd : undefined,
        riskPerTrade: rpt > 0 ? rpt : undefined,
        bufferSurvivalTrades: bufferCount ?? undefined,
        balanceBefore: beforeVal,
        balanceAfter: afterVal,
        pnl: calculatedPnl,
        htfLogic: journalInputs.htfLogic.trim(),
        ltfTarget: journalInputs.ltfTarget.trim(),
        entryModelTime: journalInputs.entryModelTime.trim(),
        morningRoutine: journalInputs.morningRoutine.trim(),
        feelings: journalInputs.feelings.trim(),
        chartImage: journalInputs.chartImage,
        visualCardImage: visualCardUrl,
        followedRules: journalInputs.followedRules,
        emotionsControlled: journalInputs.emotionsControlled,
        ruleBreaks: journalInputs.ruleBreaks.trim(),
        improvements: journalInputs.improvements.trim(),
        checklistSummary: {
          s1Done: s1Complete,
          s2Done: s2Complete,
          s3Done: s3Complete,
          s4Done: s4Complete,
          gatePassed: gateComplete,
        },
      };

      await onCommitTrade(record);
      setSaveSuccessMsg('SUCCESS: Full trade record committed to Internal Journal.');
      setTimeout(() => setSaveSuccessMsg(null), 6000);
    } catch (err) {
      console.error(err);
      alert('Failed to save record: ' + String(err));
    } finally {
      setIsCapturing(false);
    }
  };

  // Download high-resolution PNG
  const handleDownloadPng = async () => {
    if (!captureZoneRef.current) return;
    try {
      setIsCapturing(true);
      const canvas = await html2canvas(captureZoneRef.current, {
        backgroundColor: '#09090b',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `FeX_Journal_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      alert('PNG generation failed: ' + String(e));
    } finally {
      setIsCapturing(false);
    }
  };

  const isGateArmed = allSectionsComplete;
  const isExecutionOpen = status === 'GO';

  return (
    <div className="relative">
      {/* Overlay during capture */}
      {isCapturing && (
        <div className="fixed inset-0 bg-[#09090b]/90 z-[9999] flex flex-col items-center justify-center font-mono text-white p-6 backdrop-blur-xl">
          <div className="text-xl sm:text-2xl font-bold tracking-widest mb-2 text-center bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
            SYNCING VISUAL DATABASE...
          </div>
          <div className="text-sm text-teal-300 font-semibold text-center flex items-center gap-2">
            <Radio className="w-4 h-4 animate-spin text-teal-400" />
            <span>Recording full execution telemetry & generating high-res record.</span>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {saveSuccessMsg && (
        <div className="mb-6 bg-zinc-900/90 text-teal-300 border border-teal-500/40 p-4 rounded-2xl font-mono text-xs flex items-center justify-between shadow-[0_0_25px_rgba(45,212,191,0.25)] backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-teal-300" />
            <span className="text-zinc-200 font-medium">{saveSuccessMsg}</span>
          </div>
          <button
            onClick={() => setSaveSuccessMsg(null)}
            className="text-zinc-400 hover:text-white font-mono text-xs px-2.5 py-1 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
          >
            DISMISS
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* S1 */}
        <div className="bg-zinc-900/40 border border-white/10 backdrop-blur-xl rounded-2xl md:rounded-3xl overflow-hidden shadow-xl">
          <div className="flex items-center justify-between p-4 bg-white/[0.03] border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="bg-gradient-to-tr from-teal-400 to-purple-600 text-white font-mono text-[10px] px-2 py-0.5 rounded-lg font-bold shadow-[0_0_10px_rgba(45,212,191,0.3)]">
                S1
              </span>
              <span className="font-disp font-bold text-sm uppercase text-zinc-100 tracking-wide">
                Bias & HTF Gap
              </span>
            </div>
            {s1Complete && <CheckCircle2 size={16} className="text-teal-400" />}
          </div>

          <div className="flex gap-2 p-3 bg-zinc-950/30 border-b border-white/10">
            <button
              type="button"
              id="btn-continuation"
              onClick={() => setSetup('continuation')}
              className={`flex-1 py-2 px-3 font-mono text-[11px] font-bold uppercase rounded-xl border transition-all cursor-pointer ${
                setup === 'continuation'
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-[0_0_12px_rgba(45,212,191,0.25)]'
                  : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
              }`}
            >
              Continuation
            </button>
            <button
              type="button"
              id="btn-reversal"
              onClick={() => setSetup('reversal')}
              className={`flex-1 py-2 px-3 font-mono text-[11px] font-bold uppercase rounded-xl border transition-all cursor-pointer ${
                setup === 'reversal'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                  : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
              }`}
            >
              Reversal
            </button>
          </div>

          <div className="p-4 border-b border-white/5">
            <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-2">
              Directional Bias
            </label>
            <input
              type="text"
              id="bias-input"
              value={checklist.biasInput}
              onChange={(e) => setChecklist((prev) => ({ ...prev, biasInput: e.target.value }))}
              placeholder="HTF Bias and narrative reasoning..."
              className="w-full border border-white/10 bg-zinc-950/60 p-3 font-body text-xs rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30 transition-all"
            />
          </div>

          <div className="divide-y divide-white/5">
            <label className="flex gap-3.5 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors items-start">
              <input
                type="checkbox"
                id="check-premarket"
                checked={checklist.premarketAction}
                onChange={(e) => setChecklist((prev) => ({ ...prev, premarketAction: e.target.checked }))}
                className="w-5 h-5 accent-teal-400 mt-0.5 cursor-pointer shrink-0 rounded"
              />
              <div className="text-xs leading-relaxed font-medium text-zinc-200">
                Checked <b className="text-white">Premarket price action</b>
                <span className="block text-[11px] text-zinc-400 font-mono mt-1">
                  Reviewed overnight highs/lows and premarket VWAP levels.
                </span>
              </div>
            </label>

            <label className="flex gap-3.5 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors items-start">
              <input
                type="checkbox"
                id="check-htf-fvg"
                checked={checklist.htfFvg}
                onChange={(e) => setChecklist((prev) => ({ ...prev, htfFvg: e.target.checked }))}
                className="w-5 h-5 accent-teal-400 mt-0.5 cursor-pointer shrink-0 rounded"
              />
              <div className="text-xs leading-relaxed font-medium text-zinc-200">
                Found the most recent <b className="text-white">1H / 4H FVG</b>
                <span className="block text-[11px] text-zinc-400 font-mono mt-1">
                  The higher timeframe fair value gap price is currently reacting to.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* S2 */}
        <div className="bg-zinc-900/40 border border-white/10 backdrop-blur-xl rounded-2xl md:rounded-3xl overflow-hidden shadow-xl">
          <div className="flex items-center justify-between p-4 bg-white/[0.03] border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="bg-gradient-to-tr from-teal-400 to-purple-600 text-white font-mono text-[10px] px-2 py-0.5 rounded-lg font-bold shadow-[0_0_10px_rgba(45,212,191,0.3)]">
                S2
              </span>
              <span className="font-disp font-bold text-sm uppercase text-zinc-100 tracking-wide">
                Scale to 5m / 15m
              </span>
            </div>
            {s2Complete && <CheckCircle2 size={16} className="text-teal-400" />}
          </div>

          <div className="divide-y divide-white/5">
            <label className="flex gap-3.5 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors items-start">
              <input
                type="checkbox"
                id="check-m5m15-gap"
                checked={checklist.m5m15Gap}
                onChange={(e) => setChecklist((prev) => ({ ...prev, m5m15Gap: e.target.checked }))}
                className="w-5 h-5 accent-teal-400 mt-0.5 cursor-pointer shrink-0 rounded"
              />
              <div className="text-xs leading-relaxed font-medium text-zinc-200">
                Marked the <b className="text-white">5m / 15m Gap</b>
                {setup === 'continuation' ? (
                  <span className="block text-[11px] text-teal-300 font-mono font-semibold mt-1">
                    CONTINUATION: This is the specific gap you will actually trade off of.
                  </span>
                ) : (
                  <span className="block text-[11px] text-purple-300 font-mono font-semibold mt-1">
                    REVERSAL: Watching for 1H/4H structure to hold before dropping down.
                  </span>
                )}
              </div>
            </label>

            <label className="flex gap-3.5 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors items-start">
              <input
                type="checkbox"
                id="check-manipulation"
                checked={checklist.manipulation}
                onChange={(e) => setChecklist((prev) => ({ ...prev, manipulation: e.target.checked }))}
                className="w-5 h-5 accent-teal-400 mt-0.5 cursor-pointer shrink-0 rounded"
              />
              <div className="text-xs leading-relaxed font-medium text-zinc-200">
                Confirmed <b className="text-white">Manipulation</b>
                <span className="block text-[11px] text-zinc-400 font-mono mt-1">
                  Price ran into the 5m/15m gap and swept internal/session liquidity.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* S3 */}
        <div className="bg-zinc-900/40 border border-white/10 backdrop-blur-xl rounded-2xl md:rounded-3xl overflow-hidden shadow-xl">
          <div className="flex items-center justify-between p-4 bg-white/[0.03] border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="bg-gradient-to-tr from-teal-400 to-purple-600 text-white font-mono text-[10px] px-2 py-0.5 rounded-lg font-bold shadow-[0_0_10px_rgba(45,212,191,0.3)]">
                S3
              </span>
              <span className="font-disp font-bold text-sm uppercase text-zinc-100 tracking-wide">
                Inversion (1m–5m)
              </span>
            </div>
            {s3Complete && <CheckCircle2 size={16} className="text-teal-400" />}
          </div>

          <div className="divide-y divide-white/5">
            <label className="flex gap-3.5 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors items-start">
              <input
                type="checkbox"
                id="check-inversion-found"
                checked={checklist.inversionFound}
                onChange={(e) => setChecklist((prev) => ({ ...prev, inversionFound: e.target.checked }))}
                className="w-5 h-5 accent-teal-400 mt-0.5 cursor-pointer shrink-0 rounded"
              />
              <div className="text-xs leading-relaxed font-medium text-zinc-200">
                Found the <b className="text-white">Inversion</b> on the 1–5 min chart
                <span className="block text-[11px] text-zinc-400 font-mono mt-1">
                  30-sec only if nothing shows up here — 1m is preferred.
                </span>
              </div>
            </label>

            <label className="flex gap-3.5 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors items-start">
              <input
                type="checkbox"
                id="check-highest-gap"
                checked={checklist.highestTfGap}
                onChange={(e) => setChecklist((prev) => ({ ...prev, highestTfGap: e.target.checked }))}
                className="w-5 h-5 accent-teal-400 mt-0.5 cursor-pointer shrink-0 rounded"
              />
              <div className="text-xs leading-relaxed font-medium text-zinc-200">
                It&apos;s the <b className="text-white">Highest-TF Gap</b> in that leg
                <span className="block text-[11px] text-zinc-400 font-mono mt-1">
                  Must be the primary gap made during that specific manipulation leg.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* S4 */}
        <div className="bg-zinc-900/40 border border-white/10 backdrop-blur-xl rounded-2xl md:rounded-3xl overflow-hidden shadow-xl">
          <div className="flex items-center justify-between p-4 bg-white/[0.03] border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="bg-gradient-to-tr from-teal-400 to-purple-600 text-white font-mono text-[10px] px-2 py-0.5 rounded-lg font-bold shadow-[0_0_10px_rgba(45,212,191,0.3)]">
                S4
              </span>
              <span className="font-disp font-bold text-sm uppercase text-zinc-100 tracking-wide">
                Risk & Buffer
              </span>
            </div>
            {s4Complete && <CheckCircle2 size={16} className="text-teal-400" />}
          </div>

          <div className="grid grid-cols-2 divide-x divide-white/10 border-b border-white/10">
            <div className="p-3.5">
              <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-1">
                Account Size $
              </label>
              <input
                type="number"
                id="input-acct-size"
                value={checklist.acctSize}
                onChange={(e) => setChecklist((prev) => ({ ...prev, acctSize: e.target.value }))}
                placeholder="50000"
                className="w-full border border-white/10 bg-zinc-950/60 p-2.5 font-mono text-xs rounded-xl text-zinc-100 focus:outline-hidden focus:border-teal-400"
              />
            </div>
            <div className="p-3.5">
              <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-1">
                Total Drawdown $
              </label>
              <input
                type="number"
                id="input-max-dd"
                value={checklist.maxDD}
                onChange={(e) => setChecklist((prev) => ({ ...prev, maxDD: e.target.value }))}
                placeholder="2000"
                className="w-full border border-white/10 bg-zinc-950/60 p-2.5 font-mono text-xs rounded-xl text-zinc-100 focus:outline-hidden focus:border-teal-400"
              />
            </div>
          </div>

          <div className="p-3.5 border-b border-white/10">
            <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-1">
              Risk Per Trade $
            </label>
            <input
              type="number"
              id="input-risk-trade"
              value={checklist.riskPerTrade}
              onChange={(e) => setChecklist((prev) => ({ ...prev, riskPerTrade: e.target.value }))}
              placeholder="400"
              className="w-full border border-white/10 bg-zinc-950/60 p-2.5 font-mono text-xs rounded-xl text-zinc-100 focus:outline-hidden focus:border-teal-400"
            />
          </div>

          <div id="buffer-display" className="p-3.5 bg-zinc-950/40 font-mono text-xs border-b border-white/10 text-zinc-300">
            {bufferCount !== null ? (
              <span>
                Buffer survives <b className="text-rose-400 font-bold text-sm underline decoration-rose-500/50">{bufferCount}</b> consecutive losses.
              </span>
            ) : (
              <span className="text-zinc-500">Enter drawdown & risk to calculate buffer.</span>
            )}
          </div>

          <div className="divide-y divide-white/5">
            <label className="flex gap-3.5 p-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors items-start">
              <input
                type="checkbox"
                id="check-rr-ratio"
                checked={checklist.rrRatio}
                onChange={(e) => setChecklist((prev) => ({ ...prev, rrRatio: e.target.checked }))}
                className="w-5 h-5 accent-teal-400 mt-0.5 cursor-pointer shrink-0 rounded"
              />
              <div className="text-xs leading-relaxed font-medium text-zinc-200">
                Positive <b className="text-white">R:R Ratio</b> confirmed
              </div>
            </label>

            <label className="flex gap-3.5 p-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors items-start">
              <input
                type="checkbox"
                id="check-clear-liquidity"
                checked={checklist.clearLiquidity}
                onChange={(e) => setChecklist((prev) => ({ ...prev, clearLiquidity: e.target.checked }))}
                className="w-5 h-5 accent-teal-400 mt-0.5 cursor-pointer shrink-0 rounded"
              />
              <div className="text-xs leading-relaxed font-medium text-zinc-200">
                Targeting <b className="text-white">Clear Liquidity</b> pool
              </div>
            </label>

            <label className="flex gap-3.5 p-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors items-start">
              <input
                type="checkbox"
                id="check-inversion-speed"
                checked={checklist.inversionSpeed}
                onChange={(e) => setChecklist((prev) => ({ ...prev, inversionSpeed: e.target.checked }))}
                className="w-5 h-5 accent-teal-400 mt-0.5 cursor-pointer shrink-0 rounded"
              />
              <div className="text-xs leading-relaxed font-medium text-zinc-200">
                Inversion within <b className="text-white">3 candles or less</b>
              </div>
            </label>
          </div>
        </div>

        {/* THE GATE (Full Width) */}
        <div
          id="gate-panel"
          className={`col-span-1 md:col-span-2 relative bg-zinc-900/40 border backdrop-blur-xl rounded-2xl md:rounded-3xl overflow-hidden transition-all duration-500 ${
            isGateArmed
              ? 'border-teal-400/60 shadow-[0_0_30px_rgba(45,212,191,0.25)]'
              : 'border-white/10 shadow-xl'
          }`}
        >
          {isGateArmed && (
            <div className="absolute top-0 left-[-100%] w-full h-full bg-linear-to-r from-transparent via-[rgba(45,212,191,0.25)] to-transparent pointer-events-none animate-scan" />
          )}

          <div className="flex items-center justify-between p-4 bg-white/[0.03] border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono text-[10px] px-2.5 py-0.5 rounded-lg font-bold">
                GATE
              </span>
              <span className="font-disp font-bold text-sm uppercase text-zinc-100 tracking-wide">
                Final Go / No-Go Gate
              </span>
            </div>
            <div className="font-mono text-[11px] font-bold">
              {isGateArmed ? (
                <span className="text-teal-300 bg-teal-950/60 border border-teal-500/40 px-3 py-1 rounded-full shadow-[0_0_10px_rgba(45,212,191,0.25)]">
                  ARMED & SCANNING
                </span>
              ) : (
                <span className="text-zinc-500 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                  LOCKED (Complete S1–S4)
                </span>
              )}
            </div>
          </div>

          <div className="divide-y divide-white/5">
            <label
              className={`flex gap-3.5 p-4 transition-colors items-start ${
                !isGateArmed ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-white/[0.02]'
              }`}
            >
              <input
                type="checkbox"
                id="gate-check-session"
                disabled={!isGateArmed}
                checked={checklist.gateSessionWindow}
                onChange={(e) => setChecklist((prev) => ({ ...prev, gateSessionWindow: e.target.checked }))}
                className="w-5 h-5 accent-teal-400 mt-0.5 cursor-pointer shrink-0 disabled:cursor-not-allowed rounded"
              />
              <div className="text-xs leading-relaxed font-medium text-zinc-200">
                Inside my <b className="text-white">Session Window</b>?
              </div>
            </label>

            <label
              className={`flex gap-3.5 p-4 transition-colors items-start ${
                !isGateArmed ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-white/[0.02]'
              }`}
            >
              <input
                type="checkbox"
                id="gate-check-htf"
                disabled={!isGateArmed}
                checked={checklist.gateHtfGap}
                onChange={(e) => setChecklist((prev) => ({ ...prev, gateHtfGap: e.target.checked }))}
                className="w-5 h-5 accent-teal-400 mt-0.5 cursor-pointer shrink-0 disabled:cursor-not-allowed rounded"
              />
              <div className="text-xs leading-relaxed font-medium text-zinc-200">
                Setup confirmed from <b className="text-white">HTF Gap</b>?
              </div>
            </label>

            <label
              className={`flex gap-3.5 p-4 transition-colors items-start ${
                !isGateArmed ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-white/[0.02]'
              }`}
            >
              <input
                type="checkbox"
                id="gate-check-m5m15"
                disabled={!isGateArmed}
                checked={checklist.gateM5M15Manip}
                onChange={(e) => setChecklist((prev) => ({ ...prev, gateM5M15Manip: e.target.checked }))}
                className="w-5 h-5 accent-teal-400 mt-0.5 cursor-pointer shrink-0 disabled:cursor-not-allowed rounded"
              />
              <div className="text-xs leading-relaxed font-medium text-zinc-200">
                5m/15m gap <b className="text-white">manipulated + swept</b>?
              </div>
            </label>

            <label
              className={`flex gap-3.5 p-4 transition-colors items-start ${
                !isGateArmed ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-white/[0.02]'
              }`}
            >
              <input
                type="checkbox"
                id="gate-check-inversion"
                disabled={!isGateArmed}
                checked={checklist.gateInversionHighest}
                onChange={(e) => setChecklist((prev) => ({ ...prev, gateInversionHighest: e.target.checked }))}
                className="w-5 h-5 accent-teal-400 mt-0.5 cursor-pointer shrink-0 disabled:cursor-not-allowed rounded"
              />
              <div className="text-xs leading-relaxed font-medium text-zinc-200">
                <b className="text-white">Inversion confirmed</b> off highest-TF gap?
              </div>
            </label>

            <label
              className={`flex gap-3.5 p-4 transition-colors items-start ${
                !isGateArmed ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-white/[0.02]'
              }`}
            >
              <input
                type="checkbox"
                id="gate-check-planned"
                disabled={!isGateArmed}
                checked={checklist.gatePlannedTrade}
                onChange={(e) => setChecklist((prev) => ({ ...prev, gatePlannedTrade: e.target.checked }))}
                className="w-5 h-5 accent-teal-400 mt-0.5 cursor-pointer shrink-0 disabled:cursor-not-allowed rounded"
              />
              <div className="text-xs leading-relaxed font-medium text-zinc-200">
                This is the trade I <b className="text-white">planned for</b>?
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Manual Open / Close Flow Toggle helper */}
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={() => setStatus(status === 'GO' ? 'STANDBY' : 'GO')}
          className="text-xs font-mono text-zinc-500 hover:text-teal-400 underline transition-colors cursor-pointer"
        >
          {status === 'GO' ? 'Hide Execution Log Form' : 'Show Execution Log Form Early'}
        </button>
      </div>

      {/* BOTTOM EXECUTION FLOW (DYNAMIC) */}
      {isExecutionOpen && (
        <section id="bottom-flow" className="mt-8 pt-8 border-t border-white/10">
          <div
            id="exec-alert"
            className="bg-gradient-to-r from-teal-950 via-zinc-900 to-purple-950 border border-teal-400/40 text-teal-200 p-4 text-center font-mono font-bold mb-6 tracking-[3px] text-xs sm:text-sm rounded-2xl shadow-[0_0_30px_rgba(45,212,191,0.3)] animate-alert-blink"
          >
            IT IS EXECUTION TIME. FOLLOW YOUR RULES.
          </div>

          <div
            id="journal-capture-zone"
            ref={captureZoneRef}
            className="p-5 sm:p-7 bg-zinc-900/50 border border-white/10 rounded-3xl backdrop-blur-xl shadow-2xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* FIN: Daily Financials */}
              <div className="col-span-1 md:col-span-2 bg-zinc-900/60 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
                <div className="flex items-center gap-2.5 p-4 bg-white/[0.03] border-b border-white/10">
                  <span className="bg-gradient-to-tr from-teal-400 to-purple-600 text-white font-mono text-[10px] px-2 py-0.5 rounded-lg font-bold shadow-[0_0_10px_rgba(45,212,191,0.3)]">
                    FIN
                  </span>
                  <span className="font-disp font-bold text-sm uppercase text-zinc-100 tracking-wide">
                    Daily Financials
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/10 border-b border-white/10">
                  <div className="p-4">
                    <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-1.5">
                      Balance Before $
                    </label>
                    <input
                      type="number"
                      id="bal-before"
                      value={journalInputs.balBefore}
                      onChange={(e) => setJournalInputs((prev) => ({ ...prev, balBefore: e.target.value }))}
                      placeholder="50000"
                      className="w-full border border-white/10 bg-zinc-950/60 p-3 font-mono text-xs rounded-xl text-zinc-100 focus:outline-hidden focus:border-teal-400"
                    />
                  </div>

                  <div className="p-4">
                    <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-1.5">
                      Balance After $
                    </label>
                    <input
                      type="number"
                      id="bal-after"
                      value={journalInputs.balAfter}
                      onChange={(e) => setJournalInputs((prev) => ({ ...prev, balAfter: e.target.value }))}
                      placeholder="50800"
                      className="w-full border border-white/10 bg-zinc-950/60 p-3 font-mono text-xs rounded-xl text-zinc-100 focus:outline-hidden focus:border-teal-400"
                    />
                  </div>

                  <div className="p-4">
                    <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-1.5">
                      PnL Amount $ (Override)
                    </label>
                    <input
                      type="number"
                      id="manual-pnl"
                      value={journalInputs.manualPnL}
                      onChange={(e) => setJournalInputs((prev) => ({ ...prev, manualPnL: e.target.value }))}
                      placeholder={pnlDiff !== 0 ? pnlDiff.toFixed(2) : 'Auto-calculated'}
                      className="w-full border border-white/10 bg-zinc-950/60 p-3 font-mono text-xs rounded-xl text-zinc-100 focus:outline-hidden focus:border-teal-400"
                    />
                  </div>
                </div>

                <div className="p-5 bg-zinc-950/40">
                  <div
                    id="pnl-result"
                    className={`p-5 text-center font-disp text-2xl sm:text-4xl font-bold rounded-2xl transition-all duration-300 border ${
                      pnlDiff > 0
                        ? 'bg-teal-950/40 text-teal-300 border-teal-500/50 shadow-[0_0_25px_rgba(45,212,191,0.3)]'
                        : pnlDiff < 0
                        ? 'bg-rose-950/30 text-rose-400 border-rose-500/50 shadow-[0_0_25px_rgba(244,63,94,0.3)]'
                        : 'bg-white/5 text-zinc-300 border-white/10'
                    }`}
                  >
                    NET RESULT: {pnlDiff >= 0 ? '+' : ''}
                    ${Math.abs(pnlDiff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* ANL: Post-Trade Analysis */}
              <div className="col-span-1 md:col-span-2 bg-zinc-900/60 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
                <div className="flex items-center gap-2.5 p-4 bg-white/[0.03] border-b border-white/10">
                  <span className="bg-gradient-to-tr from-teal-400 to-purple-600 text-white font-mono text-[10px] px-2 py-0.5 rounded-lg font-bold shadow-[0_0_10px_rgba(45,212,191,0.3)]">
                    ANL
                  </span>
                  <span className="font-disp font-bold text-sm uppercase text-zinc-100 tracking-wide">
                    Post-Trade Analysis
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10 border-b border-white/10">
                  <div className="p-4">
                    <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-2">
                      HTF Bias Logic & Context
                    </label>
                    <textarea
                      id="j-htf"
                      rows={4}
                      value={journalInputs.htfLogic}
                      onChange={(e) => setJournalInputs((prev) => ({ ...prev, htfLogic: e.target.value }))}
                      placeholder="Detailed narrative on HTF draw on liquidity, key 1H/4H FVG reactions, daily order flow..."
                      className="w-full border border-white/10 bg-zinc-950/60 p-3 font-body text-xs rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30"
                    />
                  </div>

                  <div className="p-4">
                    <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-2">
                      LTF Target & Liquidity Pool
                    </label>
                    <textarea
                      id="j-ltf"
                      rows={4}
                      value={journalInputs.ltfTarget}
                      onChange={(e) => setJournalInputs((prev) => ({ ...prev, ltfTarget: e.target.value }))}
                      placeholder="5m manipulation sweep, specific internal buy-side or sell-side target, session high/low..."
                      className="w-full border border-white/10 bg-zinc-950/60 p-3 font-body text-xs rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30"
                    />
                  </div>
                </div>

                <div className="p-4">
                  <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-2">
                    Entry Model & Exact Execution Time
                  </label>
                  <input
                    type="text"
                    id="j-entry"
                    value={journalInputs.entryModelTime}
                    onChange={(e) => setJournalInputs((prev) => ({ ...prev, entryModelTime: e.target.value }))}
                    placeholder="e.g. 09:47 AM EST — 1m Inversion FVG retest with displacement"
                    className="w-full border border-white/10 bg-zinc-950/60 p-3 font-body text-xs rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-teal-400"
                  />
                </div>
              </div>

              {/* PSY: Psychology Review */}
              <div className="bg-zinc-900/60 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
                <div className="flex items-center gap-2.5 p-4 bg-white/[0.03] border-b border-white/10">
                  <span className="bg-gradient-to-tr from-teal-400 to-purple-600 text-white font-mono text-[10px] px-2 py-0.5 rounded-lg font-bold shadow-[0_0_10px_rgba(45,212,191,0.3)]">
                    PSY
                  </span>
                  <span className="font-disp font-bold text-sm uppercase text-zinc-100 tracking-wide">
                    Psychology Review
                  </span>
                </div>

                <div className="p-4 border-b border-white/10">
                  <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-2">
                    Morning Routine / Wake Up
                  </label>
                  <input
                    type="text"
                    id="j-wake"
                    value={journalInputs.morningRoutine}
                    onChange={(e) => setJournalInputs((prev) => ({ ...prev, morningRoutine: e.target.value }))}
                    placeholder="e.g. 6:30 AM wake up, cold shower, 15 min meditation, no phone..."
                    className="w-full border border-white/10 bg-zinc-950/60 p-3 font-body text-xs rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-teal-400"
                  />
                </div>

                <div className="p-4">
                  <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-2">
                    Feelings (Pre / During / After Trade)
                  </label>
                  <textarea
                    id="j-feelings"
                    rows={5}
                    value={journalInputs.feelings}
                    onChange={(e) => setJournalInputs((prev) => ({ ...prev, feelings: e.target.value }))}
                    placeholder="Did you feel calm, rushed, or anxious? Did you watch every tick or trust your invalidation level?"
                    className="w-full border border-white/10 bg-zinc-950/60 p-3 font-body text-xs rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30"
                  />
                </div>
              </div>

              {/* IMG: Chart Snapshot */}
              <div className="bg-zinc-900/60 border border-white/10 rounded-2xl overflow-hidden shadow-lg flex flex-col">
                <div className="flex items-center justify-between p-4 bg-white/[0.03] border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <span className="bg-gradient-to-tr from-teal-400 to-purple-600 text-white font-mono text-[10px] px-2 py-0.5 rounded-lg font-bold shadow-[0_0_10px_rgba(45,212,191,0.3)]">
                      IMG
                    </span>
                    <span className="font-disp font-bold text-sm uppercase text-zinc-100 tracking-wide">
                      Chart Snapshot
                    </span>
                  </div>
                  {journalInputs.chartImage && (
                    <button
                      type="button"
                      onClick={() => setJournalInputs((prev) => ({ ...prev, chartImage: null }))}
                      className="font-mono text-[10px] text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <X size={12} /> REMOVE
                    </button>
                  )}
                </div>

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 m-4 min-h-[220px] border-2 border-dashed border-white/15 bg-zinc-950/50 rounded-2xl flex flex-col items-center justify-center cursor-pointer p-4 text-center hover:bg-zinc-950/80 hover:border-teal-400/50 transition-all relative overflow-hidden"
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

                  {journalInputs.chartImage ? (
                    <div className="relative w-full h-full flex flex-col items-center">
                      <img
                        src={journalInputs.chartImage}
                        alt="Trade Chart Preview"
                        className="max-h-[200px] w-auto object-contain rounded-xl shadow-lg border border-white/10"
                      />
                      <span className="font-mono text-[10px] text-zinc-400 mt-2">
                        Click or drag new image to replace
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-zinc-400">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-teal-500/30 flex items-center justify-center mb-3 text-teal-300 shadow-[0_0_15px_rgba(45,212,191,0.25)]">
                        <Camera size={24} />
                      </div>
                      <span className="font-mono text-xs font-bold text-zinc-200 uppercase tracking-wider">
                        Upload Chart Screenshot
                      </span>
                      <span className="text-[11px] text-zinc-500 mt-1">
                        Click to browse or drop PNG / JPEG here
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* REF: Reflection */}
              <div className="col-span-1 md:col-span-2 bg-zinc-900/60 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
                <div className="flex items-center gap-2.5 p-4 bg-white/[0.03] border-b border-white/10">
                  <span className="bg-gradient-to-tr from-teal-400 to-purple-600 text-white font-mono text-[10px] px-2 py-0.5 rounded-lg font-bold shadow-[0_0_10px_rgba(45,212,191,0.3)]">
                    REF
                  </span>
                  <span className="font-disp font-bold text-sm uppercase text-zinc-100 tracking-wide">
                    Reflection & Accountability
                  </span>
                </div>

                <div className="flex flex-wrap gap-5 p-4 border-b border-white/10 bg-zinc-950/40">
                  <label className="flex items-center gap-3 cursor-pointer font-mono text-xs font-bold uppercase text-zinc-200">
                    <input
                      type="checkbox"
                      id="j-rules"
                      checked={journalInputs.followedRules}
                      onChange={(e) => setJournalInputs((prev) => ({ ...prev, followedRules: e.target.checked }))}
                      className="w-5 h-5 accent-teal-400 cursor-pointer rounded"
                    />
                    <span>Followed Rules</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer font-mono text-xs font-bold uppercase text-zinc-200">
                    <input
                      type="checkbox"
                      id="j-emotions"
                      checked={journalInputs.emotionsControlled}
                      onChange={(e) => setJournalInputs((prev) => ({ ...prev, emotionsControlled: e.target.checked }))}
                      className="w-5 h-5 accent-teal-400 cursor-pointer rounded"
                    />
                    <span>Emotions Controlled</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10">
                  <div className="p-4">
                    <label className="block font-mono text-[10px] font-bold uppercase text-rose-400 tracking-wider mb-2">
                      Rule Breaks (If any)
                    </label>
                    <textarea
                      id="j-broken"
                      rows={3}
                      value={journalInputs.ruleBreaks}
                      onChange={(e) => setJournalInputs((prev) => ({ ...prev, ruleBreaks: e.target.value }))}
                      placeholder="Entered too early, moved stop loss, oversized, traded outside session..."
                      className="w-full border border-white/10 bg-zinc-950/60 p-3 font-body text-xs rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-rose-500/50"
                    />
                  </div>

                  <div className="p-4">
                    <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-2">
                      Improvements For Next Session
                    </label>
                    <textarea
                      id="j-better"
                      rows={3}
                      value={journalInputs.improvements}
                      onChange={(e) => setJournalInputs((prev) => ({ ...prev, improvements: e.target.value }))}
                      placeholder="One concrete adjustment to execute with superior discipline tomorrow..."
                      className="w-full border border-white/10 bg-zinc-950/60 p-3 font-body text-xs rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-teal-500/50"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <footer className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              type="button"
              id="btn-commit"
              onClick={handleCommit}
              className="flex-1 py-4 px-6 bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-400 hover:to-purple-500 text-white font-mono font-bold text-xs uppercase cursor-pointer rounded-xl shadow-[0_0_25px_rgba(45,212,191,0.4)] border border-teal-300/40 transition-all flex items-center justify-center gap-2"
            >
              <Save size={16} />
              <span>Commit to Internal Journal</span>
            </button>

            <button
              type="button"
              id="btn-save-png"
              onClick={handleDownloadPng}
              className="flex-1 py-4 px-6 bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 rounded-xl font-mono font-bold text-xs uppercase cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <Camera size={16} />
              <span>Download Journal Photo</span>
            </button>

            <button
              type="button"
              id="btn-reset"
              onClick={onReset}
              className="sm:w-auto py-4 px-6 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border border-rose-500/30 rounded-xl font-mono font-bold text-xs uppercase cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} />
              <span>Reset Console</span>
            </button>
          </footer>
        </section>
      )}
    </div>
  );
};
