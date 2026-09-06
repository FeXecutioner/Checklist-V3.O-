export type SetupType = 'continuation' | 'reversal';
export type GateStatus = 'NO-GO' | 'STANDBY' | 'GO';

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
  accountSize?: number;
  maxDrawdown?: number;
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
  checklistSummary: {
    s1Done: boolean;
    s2Done: boolean;
    s3Done: boolean;
    s4Done: boolean;
    gatePassed: boolean;
  };
}
