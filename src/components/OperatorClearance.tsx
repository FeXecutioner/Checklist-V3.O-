import React from 'react';
import { ShieldCheck, Lock } from 'lucide-react';
import { CLEARANCE_CHECKS, type ClearanceAnswers } from '../utils/operatorClearance';

interface Props {
  answers: ClearanceAnswers;
  allowed: boolean;
  reason?: string;
  ready: boolean;
  error: string;
  journalStatus: string;
  onAnswer: (index: number, answer: boolean) => void;
  onStop: () => void;
  onRetry: () => void;
  onResetDay?: () => void;
}

export function OperatorClearance({ answers, allowed, reason, ready, error, journalStatus, onAnswer, onStop, onRetry, onResetDay }: Props) {
  return (
    <section aria-label="Operator Clearance" className="mb-6 p-4 sm:p-6 rounded-2xl bg-zinc-900/50 border border-teal-500/30 backdrop-blur-xl shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="font-disp font-bold text-base uppercase tracking-wide flex items-center gap-3 text-teal-300">
          {allowed ? <ShieldCheck size={22} /> : <Lock size={22} />} Pre-Engagement / Operator Clearance
        </h2>
        <span className="font-mono text-[10px] text-zinc-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
          RESETS DAILY: 06:00 AM SAST (00:00 NY)
        </span>
      </div>
      <p className="text-xs text-zinc-400 mt-2">
        All five checks must pass before S1–S4 opens. Any NO locks execution for the rest of today (New York time), across all accounts.
      </p>
      <p role="status" className="font-mono text-xs font-bold mt-4 text-teal-300">
        {!ready
          ? 'CHECKING SAVED NO-TRADE STATUS…'
          : reason
          ? `NO TRADE DAY — EXECUTION LOCKED: ${reason}`
          : allowed
          ? '5/5 — EXECUTION CHECKLIST AVAILABLE'
          : `${answers.filter((a) => a === true).length}/5 — EXECUTION LOCKED`}
      </p>
      {!reason && (
        <fieldset disabled={!ready || !!error} className="mt-4 space-y-3">
          {CLEARANCE_CHECKS.map((label, index) => (
            <div
              key={label}
              role="group"
              aria-label={label}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-zinc-950/60 border border-white/10 rounded-xl"
            >
              <span className="text-sm text-zinc-200">{label}</span>
              <div className="flex gap-2 shrink-0">
                {[true, false].map((answer) => (
                  <button
                    key={String(answer)}
                    type="button"
                    aria-pressed={answers[index] === answer}
                    onClick={() => onAnswer(index, answer)}
                    className={`px-4 py-2 rounded-lg border font-mono text-xs font-bold disabled:opacity-40 transition-all cursor-pointer ${
                      answers[index] === answer
                        ? 'bg-teal-500/20 border-teal-400 text-teal-300 shadow-[0_0_10px_rgba(45,212,191,0.2)]'
                        : 'border-white/10 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    {answer ? 'YES' : 'NO'}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={onStop}
            className="px-4 py-2 rounded-xl border border-teal-500/40 text-teal-300 font-mono text-xs font-bold hover:bg-teal-500/10 cursor-pointer transition-all"
          >
            DECLARE NO-TRADE DAY
          </button>
        </fieldset>
      )}
      {reason && (
        <div className="mt-3 text-sm text-zinc-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p>
            Capital preserved — $0.00 for this no-trade outcome. {journalStatus} Fresh clearance opens automatically at 06:00 AM SAST (00:00 NY).
          </p>
          {onResetDay && (
            <button
              type="button"
              onClick={onResetDay}
              className="shrink-0 px-3 py-1.5 rounded-xl border border-teal-500/40 text-teal-300 font-mono text-xs font-bold hover:bg-teal-500/10 cursor-pointer transition-all"
            >
              RESTART TODAY&apos;S CLEARANCE
            </button>
          )}
        </div>
      )}
      {error && (
        <div role="alert" className="mt-3 text-sm text-rose-300">
          {error}{' '}
          <button type="button" onClick={onRetry} className="underline cursor-pointer">
            Retry saving / checking
          </button>
        </div>
      )}
    </section>
  );
}
