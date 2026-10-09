export const DEFAULT_RISK_PERCENT = 1;
export const RISK_PERCENT_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function normalizeRiskPercent(value: number): number {
  return RISK_PERCENT_OPTIONS.includes(value) ? value : DEFAULT_RISK_PERCENT;
}

export function calculateJournalRisk(initialBalance: number, netPnL: number, profitTarget: number, riskPercent: number) {
  const currentBalance = initialBalance + netPnL;
  const remaining = Math.max(0, profitTarget - netPnL);
  const fraction = normalizeRiskPercent(riskPercent) / 100;
  const riskAmount = Math.max(0, currentBalance) * fraction;
  const winsAt = (rr: number): number | null => {
    if (remaining === 0) return 0;
    if (currentBalance <= 0) return null;
    // Risk is recalculated from the balance after each hypothetical win.
    return Math.ceil(Math.log1p(remaining / currentBalance) / Math.log1p(fraction * rr) - 1e-10);
  };
  return { currentBalance, remaining, riskAmount, winsAt1R: winsAt(1), winsAt15R: winsAt(1.5), requiredR: riskAmount > 0 ? remaining / riskAmount : null };
}
