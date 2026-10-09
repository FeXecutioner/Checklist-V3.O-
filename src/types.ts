export type SetupType = 'continuation' | 'reversal' | 'no_trade';
export type GateStatus = 'NO-GO' | 'STANDBY' | 'GO';
export type AccountType = 'live' | 'demo' | 'funded' | 'evaluation';

export interface TradingAccount {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  maxDrawdown?: number;
  profitTarget?: number;
  currency: string;
  notes?: string;
  createdAt: string;
  isDefault?: boolean;
}

export interface ChecklistState {
  // S1
  biasInput: string;
  premarketAction: boolean;
  htfFvg: boolean;
  
  // S2
  m5m15Gap: boolean;
  manipulation: boolean;
  
  // S3
  inversionFound: boolean;
  highestTfGap: boolean;
  
  // S4
  acctSize: string;
  maxDD: string;
  riskPerTrade: string;
  profitTarget?: string;
  rrRatio: boolean;
  clearLiquidity: boolean;
  inversionSpeed: boolean;
  
  // Gate
  gateSessionWindow: boolean;
  gateHtfGap: boolean;
  gateM5M15Manip: boolean;
  gateInversionHighest: boolean;
  gatePlannedTrade: boolean;
}

export interface ExecutionJournalInputs {
  balBefore: string;
  balAfter: string;
  manualPnL: string;
  isBreakEven: boolean;
  htfLogic: string;
  ltfTarget: string;
  entryModelTime: string;
  morningRoutine: string;
  feelings: string;
  chartImage: string | null;
  followedRules: boolean;
  emotionsControlled: boolean;
  ruleBreaks: string;
  improvements: string;
}

export interface TradeRecord {
  id: number;
  timestamp: string;
  setup: SetupType;
  directionalBias: string;
  accountId?: string;
  accountName?: string;
  accountType?: AccountType;
  isBreakEven?: boolean;
  accountSize?: number;
  maxDrawdown?: number;
  profitTarget?: number;
  riskPerTrade?: number;
  bufferSurvivalTrades?: number;
  balanceBefore: number;
  balanceAfter: number;
  pnl: number;
  htfLogic: string;
  ltfTarget: string;
  entryModelTime: string;
  morningRoutine: string;
  feelings: string;
  chartImage?: string | null;
  visualCardImage?: string | null;
  followedRules: boolean;
  emotionsControlled: boolean;
  ruleBreaks: string;
  improvements: string;
  isNoTradeDay?: boolean;
  noTradeReason?: string;
  checklistSummary: {
    s1Done: boolean;
    s2Done: boolean;
    s3Done: boolean;
    s4Done: boolean;
    gatePassed: boolean;
  };
}
