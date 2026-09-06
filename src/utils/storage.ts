import { TradeRecord } from '../types';

const DB_NAME = 'FExecDBv2';
const DB_VERSION = 1;
const STORE_NAME = 'trades';
const LOCAL_STORAGE_KEY = 'fexec_trades_v2';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    req.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    req.onerror = () => {
      reject(req.error);
    };
  });
}

export async function saveTrade(trade: TradeRecord): Promise<void> {
  // 1. Sync to LocalStorage
  try {
    const existing = getLocalTrades();
    const updated = [trade, ...existing.filter((t) => t.id !== trade.id)];
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
      // Sort newest first
      return idbTrades.sort((a, b) => b.id - a.id);
    }
  } catch (err) {
    console.warn('IndexedDB read failed, falling back to LocalStorage:', err);
  }

  // Fallback to localStorage
  const local = getLocalTrades();
  return local.sort((a, b) => b.id - a.id);
}

export async function deleteTrade(id: number): Promise<void> {
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

export async function clearAllTrades(): Promise<void> {
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
