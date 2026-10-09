import type { JournalSnapshot, SyncBaseline } from './storage';

export function stableJSON(value: unknown): string {
  const normalize = (item: any): any => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === 'object') return Object.fromEntries(Object.keys(item).sort().map(key => [key, normalize(item[key])]));
    return item;
  };
  return JSON.stringify(normalize(value));
}
export function snapshotJSON(snapshot: JournalSnapshot): string {
  return stableJSON({ ...snapshot, accounts: [...snapshot.accounts].sort((a,b)=>a.id.localeCompare(b.id)), trades: [...snapshot.trades].sort((a,b)=>a.id-b.id) });
}
export async function textHash(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), byte=>byte.toString(16).padStart(2,'0')).join('');
}
export function decideSync(baseline: SyncBaseline | null, uid: string, hash: string, remote: { revision: string; hash: string } | null) {
  if (!baseline || baseline.uid !== uid) return 'link';
  if (remote?.hash === hash) return 'same';
  const dirty = baseline.hash !== hash;
  const changed = (remote?.revision ?? null) !== baseline.revision;
  if (dirty && changed) return 'conflict';
  if (changed) return remote ? 'download' : 'conflict';
  return dirty ? 'upload' : 'same';
}
export function validateSnapshot(value: any): asserts value is JournalSnapshot {
  if (value?.version !== 1 || !Array.isArray(value.accounts) || !value.accounts.length || !Array.isArray(value.trades) || !value.riskByAccount || typeof value.riskByAccount !== 'object' || Array.isArray(value.riskByAccount)) throw new Error('Invalid synced journal format.');
  const accountIds = new Set<string>(); const tradeIds = new Set<number>();
  for (const account of value.accounts) {
    if (typeof account.id !== 'string' || !account.id || accountIds.has(account.id) || typeof account.name !== 'string' || !Number.isFinite(account.initialBalance) || !['live','demo','funded','evaluation'].includes(account.type)) throw new Error('Invalid or duplicate synced account.');
    accountIds.add(account.id);
  }
  for (const trade of value.trades) {
    if (!Number.isSafeInteger(trade.id) || tradeIds.has(trade.id) || !Number.isFinite(trade.pnl) || typeof trade.directionalBias !== 'string' || !['continuation','reversal','no_trade'].includes(trade.setup)) throw new Error('Invalid or duplicate synced trade.');
    tradeIds.add(trade.id);
  }
  for(const percent of Object.values(value.riskByAccount)) if(typeof percent !== 'number' || percent <= 0 || percent > 2) throw new Error('Invalid synced risk percentage.');
}
