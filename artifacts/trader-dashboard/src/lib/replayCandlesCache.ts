import type { ReplayCandleRaw, ReplayCandlesRequest, ReplayCandlesResponse } from "./replayCandlesApi";

const DB_NAME = "aureus_replay_cache_v1";
const STORE_NAME = "candle_queries";
const STORE_OFFLINE_SESSIONS = "offline_replay_sessions";
const DB_VERSION = 2;
const MEMORY_CACHE_LIMIT = 100;
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 giorni di ritenzione per candele storiche

export type PackedCandleTuple = [number, number, number, number, number, number];

/**
 * Converte un array di candele grezze in tuple numeriche compatte [time, open, high, low, close, volume].
 * Riduce la cardinalità di chiavi ripetute nel JSON e abbassa l'impronta su IndexedDB del ~65%.
 */
export function packCandleArray(candles: readonly ReplayCandleRaw[]): PackedCandleTuple[] {
  return candles.map((c) => [c.time, c.open, c.high, c.low, c.close, c.volume ?? 0]);
}

/**
 * Ricostruisce l'array di candele ReplayCandleRaw dalle tuple compattate.
 */
export function unpackCandleArray(packed: readonly PackedCandleTuple[]): ReplayCandleRaw[] {
  return packed.map(([time, open, high, low, close, volume]) => ({
    time,
    open,
    high,
    low,
    close,
    volume,
  }));
}

export interface CachedRecord {
  key: string;
  data?: ReplayCandlesResponse;
  packedCandles?: PackedCandleTuple[];
  meta?: Omit<ReplayCandlesResponse, "candles">;
  cachedAt: number;
}

// In-memory fallback per ambienti privi di IndexedDB (SSR, unit test in Node, private browsing restrittivo)
const memoryCache = new Map<string, CachedRecord>();

function getIndexedDB(): IDBFactory | undefined {
  if (typeof globalThis !== "undefined" && globalThis.indexedDB) {
    return globalThis.indexedDB;
  }
  return undefined;
}

function openDatabase(): Promise<IDBDatabase> {
  const idb = getIndexedDB();
  if (!idb) {
    return Promise.reject(new Error("IndexedDB non disponibile in questo ambiente"));
  }

  return new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_OFFLINE_SESSIONS)) {
        const store = db.createObjectStore(STORE_OFFLINE_SESSIONS, { keyPath: "id" });
        store.createIndex("symbol", "symbol", { unique: false });
        store.createIndex("interval", "interval", { unique: false });
        store.createIndex("bufferedAt", "bufferedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Genera una chiave di cache normalizzata e deterministica.
 */
export function buildCandleCacheKey(input: ReplayCandlesRequest): string {
  const symbol = input.symbol.replace("/", "").toUpperCase();
  const interval = input.interval.toUpperCase();
  const mode = input.mode ?? "standard";
  const from = input.from != null ? String(input.from) : "";
  const to = input.to != null ? String(input.to) : "";
  const anchorTime = input.anchorTime != null ? String(input.anchorTime) : "";
  const warmup = input.warmupBars != null ? String(input.warmupBars) : "";
  const replayTime = input.replayTime != null ? String(input.replayTime) : "";
  const limit = input.limit != null ? String(input.limit) : "";
  const start = input.startDate ?? "";

  return `${symbol}:${interval}:${mode}:from=${from}:to=${to}:anchor=${anchorTime}:warm=${warmup}:replay=${replayTime}:lim=${limit}:start=${start}`;
}

/**
 * Determina se la richiesta è idonea alla cache client-side.
 * Le richieste in mode="replay" o con estremi storici fissi rappresentano serie immutabili.
 */
export function isCacheableReplayRequest(input: ReplayCandlesRequest): boolean {
  if (input.mode === "replay") return true;
  if (input.from != null && input.to != null) return true;
  if (input.startDate != null) return true;
  return false;
}

/**
 * Recupera un blocco di candele dalla cache locale (IndexedDB o memoria).
 */
export async function getReplayCandlesFromCache(
  input: ReplayCandlesRequest,
): Promise<ReplayCandlesResponse | null> {
  if (!isCacheableReplayRequest(input)) return null;

  const key = buildCandleCacheKey(input);

  // 1. Prova prima in memory cache
  const memRecord = memoryCache.get(key);
  if (memRecord) {
    if (Date.now() - memRecord.cachedAt < MAX_CACHE_AGE_MS) {
      if (!memRecord.data && memRecord.packedCandles) {
        memRecord.data = {
          ...(memRecord.meta ?? {}),
          candles: unpackCandleArray(memRecord.packedCandles),
        };
      }
      if (memRecord.data) return memRecord.data;
    }
    memoryCache.delete(key);
  }

  // 2. Prova in IndexedDB se supportato
  try {
    const db = await openDatabase();
    return await new Promise<ReplayCandlesResponse | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        const record = req.result as CachedRecord | undefined;
        if (record && Date.now() - record.cachedAt < MAX_CACHE_AGE_MS) {
          // Ricostruisci data se memorizzato in formato compatto packed
          if (!record.data && record.packedCandles) {
            record.data = {
              ...(record.meta ?? {}),
              candles: unpackCandleArray(record.packedCandles),
            };
          }
          if (record.data) {
            // Mantieni una copia recente anche in memoria
            memoryCache.set(key, record);
            resolve(record.data);
            return;
          }
        }
        resolve(null);
      };

      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    });
  } catch {
    // Fallback trasparente: nessun errore bloccante se IndexedDB è inibito
    return null;
  }
}

/**
 * Salva un blocco di candele nella cache locale.
 */
export async function saveReplayCandlesToCache(
  input: ReplayCandlesRequest,
  data: ReplayCandlesResponse,
): Promise<void> {
  if (!isCacheableReplayRequest(input) || !data.candles || data.candles.length === 0) {
    return;
  }

  const key = buildCandleCacheKey(input);
  const { candles, ...meta } = data;
  const packedCandles = packCandleArray(candles);
  const record: CachedRecord = {
    key,
    data,
    packedCandles,
    meta,
    cachedAt: Date.now(),
  };

  // 1. Salva in memoria con limite LRU
  if (memoryCache.size >= MEMORY_CACHE_LIMIT) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, record);

  // 2. Persisti in IndexedDB in formato compatto compresso (senza duplicare chiavi JSON)
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const storageRecord: CachedRecord = {
        key,
        packedCandles,
        meta,
        cachedAt: record.cachedAt,
      };
      store.put(storageRecord);

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // Silenzioso: la cache in memoria resta comunque operativa
  }
}

/**
 * Pulisce l'intera cache delle candele di replay (IndexedDB e memoria).
 */
export async function clearReplayCandleCache(): Promise<void> {
  memoryCache.clear();

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.clear();

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // IndexedDB non presente o già pulito
  }
}
