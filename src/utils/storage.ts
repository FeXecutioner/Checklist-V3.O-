import { validateSnapshot, snapshotJSON, textHash } from './syncLogic';
import { withDataLock } from './dataLock';
import type { TradeRecord, TradingAccount, AccountType } from '../types';

const DB_NAME = 'FExecDBv2';
const DB_VERSION = 3;
const STORE_NAME = 'trades';
const ACCOUNTS_STORE_NAME = 'accounts';
const LOCAL_STORAGE_KEY = 'fexec_trades_v2';
const LOCAL_ACCOUNTS_KEY = 'fexec_accounts_v2';
const ACTIVE_ACCOUNT_KEY = 'fexec_active_account_id';

export const DEFAULT_ACCOUNTS: TradingAccount[] = [
  {
    id: 'acc-live-main',
    name: 'Main Live Account',
    type: 'live',
    initialBalance: 50000,
    maxDrawdown: 2500,
    profitTarget: 3000,
    currency: '$',
    notes: 'Primary Live Trading Account',
    createdAt: new Date('2026-01-01').toISOString(),
    isDefault: true,
  },
  {
    id: 'acc-demo-main',
    name: 'Demo Account',
    type: 'demo',
    initialBalance: 50000,
    maxDrawdown: 2500,
    profitTarget: 3000,
    currency: '$',
    notes: 'Paper trading & Model Validation',
    createdAt: new Date('2026-01-01').toISOString(),
    isDefault: false,
  },
];

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('privateSyncMeta')) db.createObjectStore('privateSyncMeta');
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ACCOUNTS_STORE_NAME)) {
        db.createObjectStore(ACCOUNTS_STORE_NAME, { keyPath: 'id' });
      }
    };

    req.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      db.onversionchange = () => db.close();
      resolve(db);
    };

    req.onerror = () => { reject(req.error); };
    req.onblocked = () => reject(new Error('Close older app tabs, then reopen to finish the storage upgrade.'));
  });
}

// ---------------- ACCOUNTS ----------------
export async function getAccounts(): Promise<TradingAccount[]> {
  try {
    const db = await openDB();
    const idbAccounts: TradingAccount[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(ACCOUNTS_STORE_NAME, 'readonly');
      const store = tx.objectStore(ACCOUNTS_STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result as TradingAccount[]);
      req.onerror = () => reject(req.error);
    });

    if (idbAccounts && idbAccounts.length > 0) {
      return idbAccounts;
    }
  } catch (err) {
    console.warn('IndexedDB accounts read failed, trying LocalStorage:', err);
  }

  const local = getLocalAccounts();
  if (local && local.length > 0) {
    return local;
  }

  // Seed default accounts if empty
  await saveAccountsListInternal(DEFAULT_ACCOUNTS);
  return DEFAULT_ACCOUNTS;
}

async function saveAccountInternal(account: TradingAccount): Promise<void> {
  const existing = await getAccounts();
  const exists = existing.some((a) => a.id === account.id);
  const updated = exists
    ? existing.map((a) => (a.id === account.id ? account : a))
    : [...existing, account];

  await saveAccountsListInternal(updated);
}

async function saveAccountsListInternal(accounts: TradingAccount[]): Promise<void> {
  try {
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.warn('LocalStorage accounts save failed:', err);
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ACCOUNTS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(ACCOUNTS_STORE_NAME);
      store.clear();
      for (const acc of accounts) {
        store.put(acc);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB accounts put failed:', err);
  }
}

async function syncTradesAccountMetadataInternal(
  accountId: string,
  newAccountName: string,
  newAccountType?: AccountType
): Promise<TradeRecord[]> {
  const currentTrades = await getTrades();
  let changed = false;
  const updated = currentTrades.map((t) => {
    if (t.accountId === accountId) {
      const nameChanged = t.accountName !== newAccountName;
      const typeChanged = newAccountType && t.accountType !== newAccountType;
      if (nameChanged || typeChanged) {
        changed = true;
        return {
          ...t,
          accountName: newAccountName,
          ...(newAccountType ? { accountType: newAccountType } : {}),
        };
      }
    }
    return t;
  });

  if (changed) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage trades update failed:', e);
    }
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        for (const tr of updated) {
          store.put(tr);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('IndexedDB trades update failed:', e);
    }
  }
  return updated;
}

async function deleteAccountInternal(id: string): Promise<void> {
  try {
    const existing = await getAccounts();
    const updated = existing.filter((a) => a.id !== id);
    // Always guarantee at least 1 account
    if (updated.length === 0) {
      updated.push(DEFAULT_ACCOUNTS[0]);
    }
    await saveAccountsListInternal(updated);

    const db = await openDB();
    const tx = db.transaction(ACCOUNTS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(ACCOUNTS_STORE_NAME);
    store.delete(id);
  } catch (err) {
    console.warn('Delete account failed:', err);
  }
}

export function getActiveAccountId(): string {
  try {
    const stored = localStorage.getItem(ACTIVE_ACCOUNT_KEY);
    return stored || 'acc-live-main';
  } catch {
    return 'acc-live-main';
  }
}

export function setActiveAccountId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
  } catch {
    // ignore
  }
}

function getLocalAccounts(): TradingAccount[] {
  try {
    const data = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// ---------------- TRADES ----------------
async function saveTradeInternal(trade: TradeRecord): Promise<void> {
  // Ensure trade has accountId fallback
  if (!trade.accountId) {
    trade.accountId = 'acc-live-main';
    trade.accountName = trade.accountName || 'Main Live Account';
    trade.accountType = trade.accountType || 'live';
  }

  // 1. Sync to LocalStorage
  try {
    const existing = getLocalTrades();
    const exists = existing.some((t) => t.id === trade.id);
    const updated = exists
      ? existing.map((t) => (t.id === trade.id ? trade : t))
      : [trade, ...existing];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('LocalStorage save failed:', err);
  }

  // 2. Save to IndexedDB
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(trade);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB save failed, fallback to localStorage only:', err);
  }
}

export async function getTrades(): Promise<TradeRecord[]> {
  let trades: TradeRecord[] = [];
  try {
    const db = await openDB();
    const idbTrades: TradeRecord[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result as TradeRecord[]);
      req.onerror = () => reject(req.error);
    });

    if (idbTrades && idbTrades.length > 0) {
      trades = idbTrades;
    }
  } catch (err) {
    console.warn('IndexedDB read failed, falling back to LocalStorage:', err);
  }

  if (trades.length === 0) {
    trades = getLocalTrades();
  }

  // Backwards compatibility migration: ensure all trades have account info
  const migrated = trades.map((t) => {
    if (!t.accountId) {
      return {
        ...t,
        accountId: 'acc-live-main',
        accountName: t.accountName || 'Main Live Account',
        accountType: t.accountType || 'live',
      };
    }
    return t;
  });

  return migrated.sort((a, b) => b.id - a.id);
}

async function deleteTradeInternal(id: number): Promise<void> {
  // Update LocalStorage
  try {
    const existing = getLocalTrades();
    const updated = existing.filter((t) => t.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('LocalStorage delete failed:', err);
  }

  // Update IndexedDB
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB delete failed:', err);
  }
}

async function clearAllTradesInternal(): Promise<void> {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (err) {
    console.warn('LocalStorage clear failed:', err);
  }

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB clear failed:', err);
  }
}

function getLocalTrades(): TradeRecord[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveTrade(...args: Parameters<typeof saveTradeInternal>) {
  const action = async () => { const result = await saveTradeInternal(...args); window.dispatchEvent(new Event('fexec-local-change')); return result; };
  return navigator.locks ? withDataLock(action) : action();
}
export async function deleteTrade(...args: Parameters<typeof deleteTradeInternal>) {
  const action = async () => { const result = await deleteTradeInternal(...args); window.dispatchEvent(new Event('fexec-local-change')); return result; };
  return navigator.locks ? withDataLock(action) : action();
}
export async function clearAllTrades(...args: Parameters<typeof clearAllTradesInternal>) {
  const action = async () => { const result = await clearAllTradesInternal(...args); window.dispatchEvent(new Event('fexec-local-change')); return result; };
  return navigator.locks ? withDataLock(action) : action();
}
export async function saveAccount(...args: Parameters<typeof saveAccountInternal>) {
  const action = async () => { const result = await saveAccountInternal(...args); window.dispatchEvent(new Event('fexec-local-change')); return result; };
  return navigator.locks ? withDataLock(action) : action();
}
export async function saveAccountsList(...args: Parameters<typeof saveAccountsListInternal>) {
  const action = async () => { const result = await saveAccountsListInternal(...args); window.dispatchEvent(new Event('fexec-local-change')); return result; };
  return navigator.locks ? withDataLock(action) : action();
}
export async function deleteAccount(...args: Parameters<typeof deleteAccountInternal>) {
  const action = async () => { const result = await deleteAccountInternal(...args); window.dispatchEvent(new Event('fexec-local-change')); return result; };
  return navigator.locks ? withDataLock(action) : action();
}
export async function syncTradesAccountMetadata(...args: Parameters<typeof syncTradesAccountMetadataInternal>) {
  const action = async () => { const result = await syncTradesAccountMetadataInternal(...args); window.dispatchEvent(new Event('fexec-local-change')); return result; };
  return navigator.locks ? withDataLock(action) : action();
}

export interface JournalSnapshot {
  version: 1;
  accounts: TradingAccount[];
  trades: TradeRecord[];
  riskByAccount: Record<string, number>;
}
export interface SyncBaseline { uid: string; revision: string | null; hash: string }
export async function readJournalSnapshot(): Promise<JournalSnapshot> {
  let riskByAccount = {};
  try { riskByAccount = JSON.parse(localStorage.getItem('fexec_journal_risk_percent_v1') || '{}'); } catch {}
  return { version: 1, accounts: await getAccounts(), trades: await getTrades(), riskByAccount };
}
export async function readSyncBaseline(): Promise<SyncBaseline | null> {
  const db = await openDB();
  try { return await new Promise((resolve,reject) => {
    const req = db.transaction('privateSyncMeta','readonly').objectStore('privateSyncMeta').get('baseline');
    req.onsuccess = () => resolve(req.result || null); req.onerror = () => reject(req.error);
  }); } finally { db.close(); }
}
export async function writeSyncBaseline(value: SyncBaseline): Promise<void> {
  const db = await openDB();
  try { await new Promise<void>((resolve,reject) => {
    const tx = db.transaction('privateSyncMeta','readwrite');
    tx.objectStore('privateSyncMeta').put(value,'baseline');
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  }); } finally { db.close(); }
}
// Called only while holding the same lock as local writes. One IDB transaction
// installs both collections and the revision, retaining the previous local data.
export async function replaceSyncedSnapshot(snapshot: JournalSnapshot, baseline: SyncBaseline): Promise<void> {
  const previous = await readJournalSnapshot();
  const db = await openDB();
  try { await new Promise<void>((resolve,reject) => {
    const tx = db.transaction(['trades','accounts','privateSyncMeta'],'readwrite');
    const tradeStore=tx.objectStore('trades'); const accountStore=tx.objectStore('accounts');
    tradeStore.clear(); accountStore.clear();
    snapshot.trades.forEach(trade => tradeStore.put(trade));
    snapshot.accounts.forEach(account => accountStore.put(account));
    tx.objectStore('privateSyncMeta').put(previous,'backup-before-download');
    tx.objectStore('privateSyncMeta').put(baseline,'baseline');
    tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error);
  }); } finally { db.close(); }
  // The complete data lives in IDB; these keys preserve the app's existing fallback.
  try { localStorage.setItem('fexec_trades_v2',JSON.stringify(snapshot.trades)); } catch { localStorage.removeItem('fexec_trades_v2'); }
  try { localStorage.setItem('fexec_accounts_v2',JSON.stringify(snapshot.accounts)); } catch { localStorage.removeItem('fexec_accounts_v2'); }
  localStorage.setItem('fexec_journal_risk_percent_v1',JSON.stringify(snapshot.riskByAccount));
  window.dispatchEvent(new CustomEvent('fexec-sync-applied',{detail:snapshot}));
}
export async function readPreSyncBackup(): Promise<JournalSnapshot | null> {
  const db=await openDB();
  try {return await new Promise((resolve,reject)=>{
    const req=db.transaction('privateSyncMeta','readonly').objectStore('privateSyncMeta').get('backup-before-download');
    req.onsuccess=()=>resolve(req.result || null); req.onerror=()=>reject(req.error);
  });} finally {db.close();}
}
export async function saveJournalRisk(accountId: string, percent: number): Promise<void> {
  const save=async()=>{
    const snapshot=await readJournalSnapshot();
    snapshot.riskByAccount[accountId]=percent;
    localStorage.setItem('fexec_journal_risk_percent_v1',JSON.stringify(snapshot.riskByAccount));
    window.dispatchEvent(new Event('fexec-local-change'));
  };
  return navigator.locks ? withDataLock(save) : save();
}

export async function restoreFullBackup(snapshot: JournalSnapshot): Promise<void> {
  validateSnapshot(snapshot);
  await withDataLock(async()=>{
    const baseline=await readSyncBaseline() || {uid:'',revision:null,hash:await textHash(snapshotJSON(await readJournalSnapshot()))};
    await replaceSyncedSnapshot(snapshot,baseline);
  });
  window.dispatchEvent(new Event('fexec-local-change'));
}
