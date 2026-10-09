import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { SetupType, GateStatus, ChecklistState, ExecutionJournalInputs, TradeRecord, TradingAccount } from '../types';
import { OperatorClearance } from './OperatorClearance';
import {
  CLEARANCE_CHECKS,
  loadOperatorClearance,
  saveOperatorClearance,
  getNyTradingDate,
  createEmptyClearanceAnswers,
  type ClearanceStoredRecord,
} from '../utils/operatorClearance';
import {
  CheckCircle2,
  RefreshCw,
  Camera,
  Save,
  X,
  Radio,
  ShieldCheck,
  ArrowRight,
  Layers,
  Wallet,
  Edit2,
  Lock,
  Unlock,
  Target,
  Shield,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';

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
  onTriggerNoTradeDay?: () => void;
  activeAccount?: TradingAccount;
  accounts?: TradingAccount[];
  trades?: TradeRecord[];
  onSelectAccount?: (accountId: string) => void;
  onOpenManageModal?: (editAccountId?: string) => void;
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
  onTriggerNoTradeDay,
  activeAccount,
  accounts = [],
  trades = [],
  onSelectAccount,
  onOpenManageModal,
}) => {
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isNoTradeChecked, setIsNoTradeChecked] = useState<boolean>(setup === 'no_trade');
  const [allowManualOverride, setAllowManualOverride] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureZoneRef = useRef<HTMLDivElement>(null);

  // Operator Clearance State (Must pass 5/5 before S1-S4 opens and Gate can arm)
  const [clearanceRecord, setClearanceRecord] = useState<ClearanceStoredRecord>({
    date: getNyTradingDate(),
    answers: createEmptyClearanceAnswers(),
    allowed: false,
    reason: undefined,
    journalStatus: '',
    updatedAt: Date.now(),
  });
  const [clearanceReady, setClearanceReady] = useState<boolean>(false);
  const [clearanceError, setClearanceError] = useState<string>('');

  const loadClearance = useCallback(async () => {
    try {
      setClearanceError('');
      const rec = await loadOperatorClearance(trades);
      setClearanceRecord(rec);
      setClearanceReady(true);
    } catch {
      setClearanceError('Unable to load operator clearance status.');
      setClearanceReady(true);
    }
  }, [trades]);

  useEffect(() => {
    void loadClearance();
    const handleClearanceChange = (e: Event) => {
      const detail = (e as CustomEvent<ClearanceStoredRecord>).detail;
      if (detail) {
        setClearanceRecord(detail);
        setClearanceReady(true);
      }
    };
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'fexec_operator_clearance_v1' || e.key === 'fexec_trades_v2') {
        void loadClearance();
      }
    };
    window.addEventListener('fexec-operator-clearance-change', handleClearanceChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('fexec-operator-clearance-change', handleClearanceChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadClearance]);

  // Active Account Closed Trades & Dynamic Profit Growth
  const activeAccountTrades = useMemo(() => {
    if (!activeAccount) return [];
    return trades.filter((t) => (t.accountId || 'acc-live-main') === activeAccount.id);
  }, [trades, activeAccount]);

  const activeAccountNetPnL = useMemo(() => {
    return activeAccountTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  }, [activeAccountTrades]);

  // Fixed Account Size that dynamically updates as profit grows!
  const baseStartingBalance = activeAccount?.initialBalance || 50000;
  const fixedLiveAccountSize = baseStartingBalance + activeAccountNetPnL;

  // Fixed Account Drawdown & Profit Target from account settings
  const fixedAccountMaxDD = activeAccount?.maxDrawdown || 2500;
  const accountProfitTarget = activeAccount?.profitTarget || 3000;

  // Keep checklist values in sync with the fixed account size and max drawdown
  useEffect(() => {
    if (!allowManualOverride) {
      setChecklist((prev) => {
        const nextAcct = String(fixedLiveAccountSize);
        const nextDD = String(fixedAccountMaxDD);
        const nextTarget = String(accountProfitTarget);
        if (prev.acctSize !== nextAcct || prev.maxDD !== nextDD || prev.profitTarget !== nextTarget) {
          return {
            ...prev,
            acctSize: nextAcct,
            maxDD: nextDD,
            profitTarget: nextTarget,
          };
        }
        return prev;
      });

      // Default balBefore to current live account size if untouched
      setJournalInputs((prev) => {
        if (!prev.balBefore || prev.balBefore === '50000' || prev.balBefore === String(baseStartingBalance)) {
          return {
            ...prev,
            balBefore: String(fixedLiveAccountSize),
          };
        }
        return prev;
      });
    }
  }, [fixedLiveAccountSize, fixedAccountMaxDD, accountProfitTarget, allowManualOverride, baseStartingBalance, setChecklist, setJournalInputs]);

  // Calculation for Risk Buffer Zone
  const effectiveAcctSize = allowManualOverride ? (parseFloat(checklist.acctSize) || fixedLiveAccountSize) : fixedLiveAccountSize;
  const effectiveDD = allowManualOverride ? (parseFloat(checklist.maxDD) || fixedAccountMaxDD) : fixedAccountMaxDD;
  const rpt = parseFloat(checklist.riskPerTrade) || 0;
  const bufferCount = effectiveDD > 0 && rpt > 0 ? Math.floor(effectiveDD / rpt) : null;
  const riskPct = effectiveAcctSize > 0 && rpt > 0 ? (rpt / effectiveAcctSize) * 100 : 0;

  // Profit Target telemetry calculations (Strict 1:1 to 1.5R Max rule)
  const targetGoal = accountProfitTarget || 0;
  const targetAchieved = activeAccountNetPnL > 0 ? activeAccountNetPnL : 0;
  const targetRemaining = Math.max(0, targetGoal - targetAchieved);
  const targetPct = targetGoal > 0 ? Math.min(100, Math.max(0, (targetAchieved / targetGoal) * 100)) : 0;
  const winsAt15RNeeded = rpt > 0 && targetRemaining > 0 ? Math.ceil(targetRemaining / (rpt * 1.5)) : 0;
  const winsAt1RNeeded = rpt > 0 && targetRemaining > 0 ? Math.ceil(targetRemaining / (rpt * 1.0)) : 0;

  // Drawdown remaining cushion (breach floor = starting balance - max drawdown)
  const breachFloor = baseStartingBalance - effectiveDD;
  const currentDrawdownCushion = Math.max(0, effectiveAcctSize - breachFloor);

  // Pre-Engagement / Operator Clearance Handlers
  const handleClearanceAnswer = async (index: number, answer: boolean) => {
    const todayNy = getNyTradingDate();
    const nextAnswers = [...clearanceRecord.answers];
    nextAnswers[index] = answer;

    if (answer === false) {
      // Any NO locks execution for the rest of today (New York time), across all accounts
      const failedCheck = CLEARANCE_CHECKS[index];
      const lockReason = `Clearance check #${index + 1} answered NO: "${failedCheck}"`;

      // Record disciplined No Trade Day in internal journal
      try {
        const noTradeRecord: TradeRecord = {
          id: Date.now(),
          timestamp: new Date().toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
          setup: 'no_trade',
          directionalBias: `Pre-Engagement Clearance Check #${index + 1} Failed`,
          accountId: activeAccount?.id || 'acc-live-main',
          accountName: activeAccount?.name || 'Main Live Account',
          accountType: activeAccount?.type || 'live',
          isBreakEven: false,
          accountSize: effectiveAcctSize,
          balanceBefore: effectiveAcctSize,
          balanceAfter: effectiveAcctSize,
          pnl: 0,
          htfLogic: `Execution locked: Pre-Engagement check #${index + 1} ("${failedCheck}") answered NO. Capital strictly preserved ($0.00).`,
          ltfTarget: 'None (Pre-Engagement Standby)',
          entryModelTime: 'N/A',
          morningRoutine: '',
          feelings: 'Respected operator clearance protocol. Prevented trading when conditions or mental discipline did not meet 100% threshold.',
          chartImage: null,
          followedRules: true,
          emotionsControlled: true,
          ruleBreaks: 'None — Protected capital by halting before execution.',
          improvements: 'Fresh clearance required next trading day.',
          isNoTradeDay: true,
          noTradeReason: lockReason,
          checklistSummary: {
            s1Done: false,
            s2Done: false,
            s3Done: false,
            s4Done: false,
            gatePassed: false,
          },
        };
        await onCommitTrade(noTradeRecord);
      } catch (err) {
        console.warn('Could not auto-journal clearance lockout:', err);
      }

      const nextRecord: ClearanceStoredRecord = {
        date: todayNy,
        answers: nextAnswers,
        allowed: false,
        reason: lockReason,
        journalStatus: 'Discipline logged to internal journal.',
        updatedAt: Date.now(),
      };

      try {
        await saveOperatorClearance(nextRecord);
        setClearanceRecord(nextRecord);
        setStatus('NO-GO');
      } catch {
        setClearanceError('Failed to save lockout status.');
      }
    } else {
      // User clicked YES
      const allPassed =
        nextAnswers.length === CLEARANCE_CHECKS.length &&
        nextAnswers.every((a) => a === true);

      const nextRecord: ClearanceStoredRecord = {
        date: todayNy,
        answers: nextAnswers,
        allowed: allPassed,
        reason: undefined,
        journalStatus: '',
        updatedAt: Date.now(),
      };

      try {
        await saveOperatorClearance(nextRecord);
        setClearanceRecord(nextRecord);
      } catch {
        setClearanceError('Failed to persist clearance answer.');
      }
    }
  };

  const handleClearanceStop = async () => {
    const todayNy = getNyTradingDate();
    const lockReason = 'Operator consciously declared No-Trade Day during Pre-Engagement clearance.';

    try {
      const noTradeRecord: TradeRecord = {
        id: Date.now(),
        timestamp: new Date().toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        setup: 'no_trade',
        directionalBias: 'Declared No Trade Day during Pre-Engagement Clearance',
        accountId: activeAccount?.id || 'acc-live-main',
        accountName: activeAccount?.name || 'Main Live Account',
        accountType: activeAccount?.type || 'live',
        isBreakEven: false,
        accountSize: effectiveAcctSize,
        balanceBefore: effectiveAcctSize,
        balanceAfter: effectiveAcctSize,
        pnl: 0,
        htfLogic: 'Operator consciously declared No Trade Day during Pre-Engagement clearance. Capital preserved ($0.00).',
        ltfTarget: 'None (Pre-Engagement Declared Standby)',
        entryModelTime: 'N/A',
        morningRoutine: '',
        feelings: 'Discretionary Standby. Protected capital by choosing not to engage the market today.',
        chartImage: null,
        followedRules: true,
        emotionsControlled: true,
        ruleBreaks: 'None — Capital fully protected.',
        improvements: 'Fresh clearance required next trading day.',
        isNoTradeDay: true,
        noTradeReason: lockReason,
        checklistSummary: {
          s1Done: false,
          s2Done: false,
          s3Done: false,
          s4Done: false,
          gatePassed: false,
        },
      };
      await onCommitTrade(noTradeRecord);
    } catch (err) {
      console.warn('Error recording trade for clearance stop:', err);
    }

    const nextRecord: ClearanceStoredRecord = {
      date: todayNy,
      answers: clearanceRecord.answers,
      allowed: false,
      reason: lockReason,
      journalStatus: 'Discipline logged to internal journal.',
      updatedAt: Date.now(),
    };

    try {
      await saveOperatorClearance(nextRecord);
      setClearanceRecord(nextRecord);
      setStatus('NO-GO');
    } catch {
      setClearanceError('Failed to save declared no-trade day.');
    }
  };

  const handleClearanceRetry = () => {
    void loadClearance();
  };

  const handleClearanceResetDay = async () => {
    const todayNy = getNyTradingDate();
    const freshRecord: ClearanceStoredRecord = {
      date: todayNy,
      answers: createEmptyClearanceAnswers(),
      allowed: false,
      reason: undefined,
      journalStatus: '',
      updatedAt: Date.now(),
    };
    try {
      await saveOperatorClearance(freshRecord);
      setClearanceRecord(freshRecord);
      setStatus('NO-GO');
    } catch {
      setClearanceError('Failed to reset clearance.');
    }
  };

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
    if (!clearanceRecord.allowed) {
      if (status !== 'NO-GO') setStatus('NO-GO');
      return;
    }
    if (allSectionsComplete && gateComplete) {
      if (status !== 'GO') setStatus('GO');
    } else if (allSectionsComplete) {
      if (status !== 'STANDBY') setStatus('STANDBY');
    } else {
      if (status !== 'NO-GO') setStatus('NO-GO');
    }
  }, [clearanceRecord.allowed, allSectionsComplete, gateComplete, status, setStatus]);

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
        journalInputs.isBreakEven
          ? (journalInputs.manualPnL !== '' ? parseFloat(journalInputs.manualPnL) || 0 : 0)
          : (journalInputs.manualPnL !== ''
              ? parseFloat(journalInputs.manualPnL) || pnlDiff
              : pnlDiff);

      const record: TradeRecord = {
        id: Date.now(),
        timestamp: new Date().toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        setup,
        directionalBias: checklist.biasInput.trim() || 'No explicit bias entered',
        accountId: activeAccount?.id || 'acc-live-main',
        accountName: activeAccount?.name || 'Main Live Account',
        accountType: activeAccount?.type || 'live',
        isBreakEven: journalInputs.isBreakEven,
        accountSize: effectiveAcctSize,
        maxDrawdown: effectiveDD > 0 ? effectiveDD : undefined,
        profitTarget: targetGoal > 0 ? targetGoal : undefined,
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
        isNoTradeDay: isNoTradeChecked || setup === 'no_trade',
        noTradeReason:
          isNoTradeChecked || setup === 'no_trade'
            ? checklist.biasInput.trim() || 'Disciplined Standby / Capital Preserved'
            : undefined,
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

  const isGateArmed = clearanceRecord.allowed && allSectionsComplete;
  const isExecutionOpen = clearanceRecord.allowed && status === 'GO';

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

      {/* PRE-ENGAGEMENT / OPERATOR CLEARANCE */}
      <OperatorClearance
        answers={clearanceRecord.answers}
        allowed={clearanceRecord.allowed}
        reason={clearanceRecord.reason}
        ready={clearanceReady}
        error={clearanceError}
        journalStatus={clearanceRecord.journalStatus}
        onAnswer={handleClearanceAnswer}
        onStop={handleClearanceStop}
        onRetry={handleClearanceRetry}
        onResetDay={handleClearanceResetDay}
      />

      {/* NO TRADE DAY PROTOCOL CARD */}
      <div className="mb-6 p-4 sm:p-5 rounded-2xl md:rounded-3xl bg-zinc-900/50 border border-teal-500/30 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:border-teal-400/50">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-500/20 to-purple-600/20 border border-teal-500/40 flex items-center justify-center text-teal-300 shrink-0 shadow-[0_0_15px_rgba(45,212,191,0.25)]">
            <ShieldCheck size={22} className="text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-400 bg-teal-950/70 border border-teal-500/40 px-2 py-0.5 rounded-md">
                DISCIPLINE PROTOCOL
              </span>
              <span className="font-mono text-[11px] text-purple-300 font-bold bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded-md">
                $0.00 PnL (Capital Preserved)
              </span>
            </div>
            <h3 className="font-disp font-bold text-sm sm:text-base text-zinc-100 uppercase tracking-wide mt-1">
              No Trade Day
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
              No A+ setup formed or outside session window? Tick the box to automatically open the journal section and document today's discipline.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0">
          <label className="flex items-center gap-3 p-3 px-4 rounded-xl bg-zinc-950/80 border border-teal-400/40 hover:border-teal-400 cursor-pointer transition-all shadow-inner group">
            <input
              type="checkbox"
              id="no-trade-day-checkbox"
              checked={isNoTradeChecked || setup === 'no_trade'}
              onChange={(e) => {
                const checked = e.target.checked;
                setIsNoTradeChecked(checked);
                if (checked) {
                  setSetup('no_trade');
                  if (onTriggerNoTradeDay) {
                    onTriggerNoTradeDay();
                  }
                } else {
                  setSetup('continuation');
                }
              }}
              className="w-5 h-5 accent-teal-400 cursor-pointer rounded"
            />
            <span className="font-mono text-xs font-bold text-teal-300 group-hover:text-teal-200 uppercase tracking-wider">
              Log No Trade Day
            </span>
          </label>

          {onTriggerNoTradeDay && (
            <button
              type="button"
              onClick={() => {
                setIsNoTradeChecked(true);
                setSetup('no_trade');
                onTriggerNoTradeDay();
              }}
              className="sm:hidden px-3 py-2.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-xl text-xs font-mono font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Journal</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* S1–S4 EXECUTION SECTIONS & GATE (Gated by Operator Clearance) */}
      <fieldset disabled={!clearanceRecord.allowed} className="border-0 p-0 m-0">
        {!clearanceRecord.allowed && (
          <div className="mb-5 p-3.5 bg-zinc-900/90 border border-teal-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 font-mono text-xs text-zinc-300 shadow-md">
            <span className="flex items-center gap-2">
              <Lock size={15} className="text-teal-400 shrink-0" />
              <span>
                {clearanceRecord.reason
                  ? `EXECUTION LOCKED: ${clearanceRecord.reason}`
                  : 'S1–S4 Checklist & Execution Gate locked — Pass all 5 Pre-Engagement Clearance checks to unlock.'}
              </span>
            </span>
            <span className="text-[11px] text-teal-300 font-bold bg-teal-950/80 px-2.5 py-1 rounded-lg border border-teal-500/30 shrink-0">
              {clearanceRecord.answers.filter((a) => a === true).length}/5 CHECKS CLEARED
            </span>
          </div>
        )}

        <div className={`grid grid-cols-1 md:grid-cols-2 gap-5 transition-opacity duration-300 ${!clearanceRecord.allowed ? 'opacity-40 select-none' : ''}`}>
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
              onClick={() => {
                setSetup('continuation');
                setIsNoTradeChecked(false);
              }}
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
              onClick={() => {
                setSetup('reversal');
                setIsNoTradeChecked(false);
              }}
              className={`flex-1 py-2 px-3 font-mono text-[11px] font-bold uppercase rounded-xl border transition-all cursor-pointer ${
                setup === 'reversal'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                  : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
              }`}
            >
              Reversal
            </button>
            <button
              type="button"
              id="btn-no-trade-s1"
              onClick={() => {
                setSetup('no_trade');
                setIsNoTradeChecked(true);
                if (onTriggerNoTradeDay) onTriggerNoTradeDay();
              }}
              className={`flex-1 py-2 px-3 font-mono text-[11px] font-bold uppercase rounded-xl border transition-all cursor-pointer ${
                setup === 'no_trade'
                  ? 'bg-zinc-800 text-teal-300 border-teal-400 shadow-[0_0_12px_rgba(45,212,191,0.25)]'
                  : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
              }`}
            >
              No Trade
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
                Done <b className="text-white">surface level analysis of current PA</b>
                <span className="block text-[11px] text-zinc-400 font-mono mt-1">
                  Reviewed current price action.
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
                Found the most recent <b className="text-white">HTF gap</b> we have bounced off or are inside currently.
                <span className="block text-[11px] text-zinc-400 font-mono mt-1">
                  The higher timeframe fair value gap (1H / 4H).
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
                  Price ran into the 5m/15m gap and swept internal/session liquidity. Do we have strong structure or do we require a re-sweep?
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

          {/* Fixed Account Size (Updates with Profit) & Fixed Max Drawdown (From Account Details) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/10 border-b border-white/10 bg-zinc-950/40">
            {/* Fixed Account Size that updates as profit grows */}
            <div className="p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider flex items-center gap-1.5">
                  <Lock size={11} className="text-teal-400" />
                  <span>Fixed Account Size $</span>
                </label>
                <span className="text-[9px] font-mono text-teal-300 bg-teal-950/80 border border-teal-500/30 px-1.5 py-0.5 rounded shadow-xs">
                  UPDATES WITH PROFIT
                </span>
              </div>

              {allowManualOverride ? (
                <input
                  type="number"
                  id="input-acct-size"
                  value={checklist.acctSize}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, acctSize: e.target.value }))}
                  placeholder="50000"
                  className="w-full border border-teal-400/50 bg-zinc-950 p-2.5 font-mono text-xs rounded-xl text-zinc-100 focus:outline-hidden focus:border-teal-400 shadow-inner"
                />
              ) : (
                <div className="p-2.5 bg-zinc-900/80 border border-white/10 rounded-xl font-mono text-xs flex items-center justify-between shadow-xs">
                  <span className="font-bold text-sm text-zinc-100 font-disp">
                    ${effectiveAcctSize.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className={`text-[10px] font-bold ${activeAccountNetPnL >= 0 ? 'text-teal-300' : 'text-rose-400'}`}>
                    {activeAccountNetPnL >= 0 ? '+' : ''}${activeAccountNetPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span>Base: ${baseStartingBalance.toLocaleString()}</span>
                <button
                  type="button"
                  onClick={() => setAllowManualOverride(!allowManualOverride)}
                  className="text-zinc-500 hover:text-teal-300 underline underline-offset-2 transition-colors cursor-pointer"
                >
                  {allowManualOverride ? 'Lock to Live Balance' : 'Manual Override'}
                </button>
              </div>
            </div>

            {/* Total Max Drawdown Limit (Fixed from Account Details) */}
            <div className="p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block font-mono text-[10px] font-bold uppercase text-rose-300 tracking-wider flex items-center gap-1.5">
                  <Shield size={11} className="text-rose-400" />
                  <span>Max Drawdown Limit $</span>
                </label>
                <span className="text-[9px] font-mono text-rose-300 bg-rose-950/80 border border-rose-500/30 px-1.5 py-0.5 rounded shadow-xs">
                  ACCOUNT FIXED
                </span>
              </div>

              {allowManualOverride ? (
                <input
                  type="number"
                  id="input-max-dd"
                  value={checklist.maxDD}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, maxDD: e.target.value }))}
                  placeholder="2500"
                  className="w-full border border-rose-400/50 bg-zinc-950 p-2.5 font-mono text-xs rounded-xl text-zinc-100 focus:outline-hidden focus:border-rose-400 shadow-inner"
                />
              ) : (
                <div className="p-2.5 bg-zinc-900/80 border border-white/10 rounded-xl font-mono text-xs flex items-center justify-between shadow-xs">
                  <span className="font-bold text-sm text-rose-300 font-disp">
                    ${effectiveDD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Floor: ${breachFloor.toLocaleString()}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span>Cushion: <b className="text-zinc-200 font-bold">${currentDrawdownCushion.toLocaleString()}</b></span>
                {onOpenManageModal && (
                  <button
                    type="button"
                    onClick={() => onOpenManageModal(activeAccount?.id)}
                    className="text-teal-400 hover:text-teal-200 underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    Edit Account DD
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Risk Per Trade (Can be actively edited + quick % presets) */}
          <div className="p-3.5 border-b border-white/10 space-y-2 bg-zinc-900/30">
            <div className="flex items-center justify-between">
              <label className="block font-mono text-[10px] font-bold uppercase text-teal-300 tracking-wider flex items-center gap-1.5">
                <Edit2 size={11} className="text-teal-400" />
                <span>Risk Per Trade $ (Editable)</span>
              </label>
              {rpt > 0 && effectiveAcctSize > 0 && (
                <span className="font-mono text-[11px] font-bold text-zinc-200 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                  {riskPct.toFixed(2)}% of Account Size
                </span>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-teal-400 text-sm">
                $
              </span>
              <input
                type="number"
                id="input-risk-trade"
                value={checklist.riskPerTrade}
                onChange={(e) => setChecklist((prev) => ({ ...prev, riskPerTrade: e.target.value }))}
                placeholder="400"
                className="w-full pl-8 pr-4 py-2.5 border border-teal-500/40 focus:border-teal-400 bg-zinc-950 font-mono text-sm font-bold rounded-xl text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-teal-400 shadow-inner"
              />
            </div>

            {/* Quick Risk % Presets based on Fixed Live Account Size */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mr-1">
                Risk Presets:
              </span>
              {[0.25, 0.5, 0.75, 1.0, 1.5, 2.0].map((pct) => {
                const dollarRisk = Math.round((effectiveAcctSize * pct) / 100);
                const isSelected = Math.round(rpt) === dollarRisk;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setChecklist((prev) => ({ ...prev, riskPerTrade: String(dollarRisk) }))}
                    className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-teal-500/25 text-teal-300 border-teal-400 shadow-xs'
                        : 'bg-zinc-950/70 text-zinc-400 border-white/10 hover:border-teal-500/40 hover:text-white'
                    }`}
                    title={`Set risk to ${pct}% ($${dollarRisk})`}
                  >
                    {pct}% (${dollarRisk})
                  </button>
                );
              })}
            </div>
          </div>

          {/* DEDICATED RISK BUFFER ZONE & PROFIT TARGET TELEMETRY DISPLAY */}
          <div id="buffer-display" className="p-4 bg-zinc-950/70 font-mono text-xs border-b border-white/10 space-y-3">
            {/* Top Buffer Survival Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-zinc-900/90 border border-teal-500/30 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                  bufferCount !== null && bufferCount >= 6
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                    : bufferCount !== null && bufferCount >= 4
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  <Shield size={16} />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                    Risk Buffer Survival
                  </div>
                  {bufferCount !== null ? (
                    <div className="text-sm font-bold text-zinc-100">
                      Buffer survives <b className="text-teal-300 font-disp text-base">{bufferCount}</b> consecutive full losses.
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-500">
                      Enter risk per trade to calculate loss streak capacity.
                    </div>
                  )}
                </div>
              </div>

              {bufferCount !== null && (
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border self-start sm:self-auto ${
                  bufferCount >= 6
                    ? 'bg-teal-950 text-teal-300 border-teal-500/40'
                    : bufferCount >= 4
                    ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                    : 'bg-rose-950 text-rose-300 border-rose-500/40 animate-pulse'
                }`}>
                  {bufferCount >= 6 ? 'SAFE BUFFER' : bufferCount >= 4 ? 'MODERATE' : 'TIGHT RISK'}
                </span>
              )}
            </div>

            {/* Profit Target Telemetry (Reflected directly into the Risk Buffer Zone!) */}
            {targetGoal > 0 && (
              <div className="p-3 rounded-xl bg-zinc-900/90 border border-white/10 space-y-2 shadow-xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-zinc-300 font-bold uppercase text-[11px]">
                    <Target size={13} className="text-teal-400" />
                    <span>Profit Target Milestone:</span>
                    <b className="text-teal-300">${targetGoal.toLocaleString()}</b>
                  </span>
                  <span className="font-bold text-zinc-200 text-[11px]">
                    {targetPct.toFixed(1)}% Achieved
                  </span>
                </div>

                {/* Animated Progress Bar */}
                <div className="w-full h-2 rounded-full bg-zinc-950 overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-purple-500 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(45,212,191,0.5)]"
                    style={{ width: `${targetPct}%` }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-400 pt-0.5">
                  <span>
                    Current Profit: <b className="text-teal-300">{activeAccountNetPnL >= 0 ? '+' : ''}${activeAccountNetPnL.toLocaleString()}</b>
                  </span>
                  <span>
                    Remaining: <b className="text-zinc-200">${targetRemaining.toLocaleString()}</b>
                  </span>
                  {rpt > 0 && targetRemaining > 0 && (
                    <span className="text-teal-300 font-semibold flex items-center gap-1.5">
                      <span>Path:</span>
                      <b className="text-white">~{winsAt15RNeeded} wins</b> at 1.5R max (${(rpt * 1.5).toFixed(0)}) |
                      <b className="text-white">~{winsAt1RNeeded} wins</b> at 1.0R (${rpt.toFixed(0)})
                    </span>
                  )}
                </div>
              </div>
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
                Confirmed <b className="text-white">1:1 to 1.5R Max R:R</b> (Never Over 1.5R)
                <span className="block text-[11px] text-teal-400 font-mono mt-0.5">
                  Disciplined model: strictly between 1:1 and 1.5R take-profit.
                </span>
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
                <b className="text-white">Inversion confirmed</b> off highest-TF gap? Is the IFVG in 3 candles or less?
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
      </fieldset>

      {/* Manual Open / Close Flow Toggle helper */}
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          disabled={!clearanceRecord.allowed}
          onClick={() => setStatus(status === 'GO' ? 'STANDBY' : 'GO')}
          className={`text-xs font-mono underline transition-colors cursor-pointer ${
            !clearanceRecord.allowed
              ? 'text-zinc-600 cursor-not-allowed opacity-40'
              : 'text-zinc-500 hover:text-teal-400'
          }`}
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
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white/[0.03] border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <span className="bg-gradient-to-tr from-teal-400 to-purple-600 text-white font-mono text-[10px] px-2 py-0.5 rounded-lg font-bold shadow-[0_0_10px_rgba(45,212,191,0.3)]">
                      FIN
                    </span>
                    <span className="font-disp font-bold text-sm uppercase text-zinc-100 tracking-wide">
                      Daily Financials
                    </span>
                    {activeAccount && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-300 border border-teal-500/30 flex items-center gap-1">
                          <Wallet size={11} />
                          <span>ACCOUNT: [{activeAccount.type.toUpperCase()}] {activeAccount.name} (${activeAccount.initialBalance.toLocaleString()})</span>
                        </span>
                        {onOpenManageModal && (
                          <button
                            type="button"
                            onClick={() => onOpenManageModal(activeAccount.id)}
                            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-teal-500/20 text-zinc-300 hover:text-teal-300 border border-white/10 hover:border-teal-500/40 cursor-pointer transition-all flex items-center gap-1"
                            title="Edit account details (name, starting figure, etc.)"
                          >
                            <Edit2 size={10} className="text-teal-400" />
                            <span>Edit Account</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* BE Tick Box in Journal Section */}
                  <label className="flex items-center gap-2.5 cursor-pointer bg-teal-950/40 hover:bg-teal-950/70 border border-teal-500/40 px-3.5 py-1.5 rounded-xl transition-all shadow-xs">
                    <input
                      type="checkbox"
                      id="check-break-even-exec"
                      checked={journalInputs.isBreakEven}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setJournalInputs((prev) => ({
                          ...prev,
                          isBreakEven: checked,
                          ...(checked && prev.balBefore ? { balAfter: prev.balBefore, manualPnL: '0' } : {}),
                        }));
                      }}
                      className="w-4 h-4 accent-teal-400 cursor-pointer rounded"
                    />
                    <span className="font-mono text-xs font-bold text-teal-300">
                      BE (Break-Even) Trade
                    </span>
                  </label>
                </div>

                {journalInputs.isBreakEven && (
                  <div className="p-3 bg-teal-950/60 border-b border-teal-500/30 text-teal-300 font-mono text-[11px] flex items-center gap-2 px-4">
                    <CheckCircle2 size={15} className="text-teal-400 shrink-0" />
                    <span>
                      <b>BREAK-EVEN TICKED</b>: This trade will <b>not affect your win rate</b>. It will be recorded as neutral in journal analytics.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/10 border-b border-white/10">
                  <div className="p-4">
                    <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-1.5">
                      Balance Before $
                    </label>
                    <input
                      type="number"
                      id="bal-before"
                      value={journalInputs.balBefore}
                      onChange={(e) => {
                        const val = e.target.value;
                        setJournalInputs((prev) => ({
                          ...prev,
                          balBefore: val,
                          ...(prev.isBreakEven ? { balAfter: val, manualPnL: '0' } : {}),
                        }));
                      }}
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
                      value={journalInputs.isBreakEven ? journalInputs.balBefore : journalInputs.balAfter}
                      onChange={(e) => setJournalInputs((prev) => ({ ...prev, balAfter: e.target.value }))}
                      placeholder="50800"
                      disabled={journalInputs.isBreakEven}
                      className="w-full border border-white/10 bg-zinc-950/60 p-3 font-mono text-xs rounded-xl text-zinc-100 focus:outline-hidden focus:border-teal-400 disabled:opacity-60"
                    />
                  </div>

                  <div className="p-4">
                    <label className="block font-mono text-[10px] font-bold uppercase text-teal-400 tracking-wider mb-1.5">
                      PnL Amount $ (Override)
                    </label>
                    <input
                      type="number"
                      id="manual-pnl"
                      value={journalInputs.isBreakEven ? (journalInputs.manualPnL || '0') : journalInputs.manualPnL}
                      onChange={(e) => setJournalInputs((prev) => ({ ...prev, manualPnL: e.target.value }))}
                      placeholder={journalInputs.isBreakEven ? '0.00' : pnlDiff !== 0 ? pnlDiff.toFixed(2) : 'Auto-calculated'}
                      className="w-full border border-white/10 bg-zinc-950/60 p-3 font-mono text-xs rounded-xl text-zinc-100 focus:outline-hidden focus:border-teal-400"
                    />
                  </div>
                </div>

                <div className="p-5 bg-zinc-950/40">
                  <div
                    id="pnl-result"
                    className={`p-5 text-center font-disp text-2xl sm:text-4xl font-bold rounded-2xl transition-all duration-300 border ${
                      journalInputs.isBreakEven
                        ? 'bg-teal-950/30 text-teal-200 border-teal-400/50 shadow-[0_0_20px_rgba(45,212,191,0.2)]'
                        : pnlDiff > 0
                        ? 'bg-teal-950/40 text-teal-300 border-teal-500/50 shadow-[0_0_25px_rgba(45,212,191,0.3)]'
                        : pnlDiff < 0
                        ? 'bg-rose-950/30 text-rose-400 border-rose-500/50 shadow-[0_0_25px_rgba(244,63,94,0.3)]'
                        : 'bg-white/5 text-zinc-300 border-white/10'
                    }`}
                  >
                    {journalInputs.isBreakEven ? (
                      <span>BREAK-EVEN RESULT: $0.00 (DOES NOT AFFECT WIN RATE)</span>
                    ) : (
                      <span>
                        NET RESULT: {pnlDiff >= 0 ? '+' : ''}
                        ${Math.abs(pnlDiff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
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
