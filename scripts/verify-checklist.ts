import assert from 'node:assert/strict';
import { checklistProgress } from '../src/utils/checklist';
import { loadOperatorClearance, getNyTradingDate, saveOperatorClearance } from '../src/utils/operatorClearance';
import type { ChecklistState, TradeRecord } from '../src/types';

const required = ['premarketAction', 'htfFvg', 'gateSessionWindow', 'm5m15Gap', 'manipulation', 'inversionFound', 'highestTfGap', 'rrRatio', 'clearLiquidity', 'inversionSpeed', 'gatePlannedTrade'] as const;
const complete = Object.fromEntries(required.map(key => [key, true])) as unknown as ChecklistState;
assert.equal(checklistProgress(complete).allSectionsComplete, true);
for (const key of required) {
  assert.equal(checklistProgress({ ...complete, [key]: false }).allSectionsComplete, false, key);
}
assert.equal(checklistProgress({ ...complete, gateHtfGap: false, gateM5M15Manip: false, gateInversionHighest: false }).allSectionsComplete, true);

const memory = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) },
  window: new EventTarget(),
});
await saveOperatorClearance({ date: getNyTradingDate(), answers: [true, true, true, true, true], allowed: true, journalStatus: '', updatedAt: Date.now() });
assert.equal((await loadOperatorClearance()).allowed, true);
const noTrade = { id: Date.now(), setup: 'no_trade', accountId: 'another-account', isNoTradeDay: true } as TradeRecord;
assert.equal((await loadOperatorClearance([noTrade])).allowed, false, 'No Trade on any account overrides saved clearance');
assert.equal((await loadOperatorClearance()).allowed, false, 'Lock persists on reload');
console.log('PASS: all 11 unique criteria, redundant answers removed, cross-account No Trade lock and persistence.');
