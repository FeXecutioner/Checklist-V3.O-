import { TradeRecord } from '../types';

export const CLEARANCE_CHECKS: readonly string[] = [
  'Physical & mental state calm, rested, and free from emotional distraction or revenge impulse?',
  'Trading workspace distraction-free with reliable execution connectivity?',
  'Economic calendar checked: no imminent high-impact red folder news events during trade?',
  'Current market conditions within designated New York session window with clear HTF bias?',
  'Strict risk parameters acknowledged: maximum 1–2% account risk and ready to accept a stop-out?',
] as const;

export type ClearanceAnswer = boolean | null;
export type ClearanceAnswers = (boolean | null)[];

export interface ClearanceStoredRecord {
  date: string; // YYYY-MM-DD in New York timezone
  answers: ClearanceAnswers;
  allowed: boolean;
  reason?: string;
  journalStatus: string;
  updatedAt: number;
}

const STORAGE_KEY = 'fexec_operator_clearance_v1';

/**
 * Returns today's calendar date in America/New_York (YYYY-MM-DD).
 */
export function getNyTradingDate(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    // Fallback to local date if Intl timeZone fails
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Converts a Unix epoch timestamp (ms) to YYYY-MM-DD in America/New_York.
 */
export function getNyDateFromTimestamp(timestampMs: number): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date(timestampMs));
  } catch {
    return new Date(timestampMs).toISOString().slice(0, 10);
  }
}

/**
 * Creates empty answers for a fresh trading day.
 */
export function createEmptyClearanceAnswers(): ClearanceAnswers {
  return new Array(CLEARANCE_CHECKS.length).fill(null);
}

/**
 * Reads the clearance record for today's NY session.
 * If trades contain a No Trade Day for today, locks execution accordingly.
 */
export async function loadOperatorClearance(trades: TradeRecord[] = []): Promise<ClearanceStoredRecord> {
  const todayNy = getNyTradingDate();

  // Check if today was already recorded as a No-Trade Day in the trade journal
  const todayNoTrade = trades.find((t) => {
    if (!t.isNoTradeDay && t.setup !== 'no_trade') return false;
    const tradeNyDate = getNyDateFromTimestamp(t.id || Date.now());
    return tradeNyDate === todayNy;
  });

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: ClearanceStoredRecord = JSON.parse(raw);
      if (parsed && parsed.date === todayNy && !todayNoTrade) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed reading operator clearance state:', err);
  }

  // If no stored record today but journal has a No-Trade Day for today
  if (todayNoTrade) {
    const lockedRecord: ClearanceStoredRecord = {
      date: todayNy,
      answers: createEmptyClearanceAnswers(),
      allowed: false,
      reason: todayNoTrade.noTradeReason || 'No-Trade Day logged in internal journal for today.',
      journalStatus: 'Discipline logged in internal journal.',
      updatedAt: Date.now(),
    };
    await saveOperatorClearance(lockedRecord);
    return lockedRecord;
  }

  // Fresh day initialized
  const fresh: ClearanceStoredRecord = {
    date: todayNy,
    answers: createEmptyClearanceAnswers(),
    allowed: false,
    reason: undefined,
    journalStatus: '',
    updatedAt: Date.now(),
  };
  return fresh;
}

/**
 * Persists operator clearance record to localStorage and broadcasts the update.
 */
export async function saveOperatorClearance(record: ClearanceStoredRecord): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    window.dispatchEvent(new CustomEvent('fexec-operator-clearance-change', { detail: record }));
  } catch (err) {
    console.error('Failed saving operator clearance:', err);
    throw new Error('Unable to persist operator clearance status.');
  }
}
