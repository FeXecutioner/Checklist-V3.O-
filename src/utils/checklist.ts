import type { ChecklistState } from '../types';

// Keep legacy field names and journal summaries readable; duplicate gate
// answers no longer form a second confirmation step.
export function checklistProgress(checklist: ChecklistState) {
  const s1Complete = checklist.premarketAction && checklist.htfFvg && checklist.gateSessionWindow;
  const s2Complete = checklist.m5m15Gap && checklist.manipulation;
  const s3Complete = checklist.inversionFound && checklist.highestTfGap;
  const s4Complete = checklist.rrRatio && checklist.clearLiquidity && checklist.inversionSpeed && checklist.gatePlannedTrade;
  return {
    s1Complete, s2Complete, s3Complete, s4Complete,
    allSectionsComplete: s1Complete && s2Complete && s3Complete && s4Complete,
  };
}
