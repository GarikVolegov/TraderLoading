import {
  createReplayCandlesUrl,
  type ReplayCandleRaw,
  type ReplayCandlesRequest,
  type ReplayCandlesResponse,
} from "./replayCandlesApi";

export const REPLAY_DB_NAME = "aureus_replay_cache_v1";
export const STORE_OFFLINE_SESSIONS = "offline_replay_sessions";
export const REPLAY_DB_VERSION = 2;

export interface OfflineReplaySession {
  id: string;
  name: string;
  symbol: string;
  interval: string;
  mode: "replay";
  candles: ReplayCandleRaw[];
  from: number;
  to: number;
  anchorTime?: number;
  warmupBars?: number;
  bufferedAt: number;
  barCount: number;
  sizeBytes: number;
  source: "offline_buffer";
}

// In-memory fallback per ambienti di test (Node.js), SSR o private browsing
const memorySessions = new Map<string, OfflineReplaySession>();

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
    const request = idb.open(REPLAY_DB_NAME, REPLAY_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("candle_queries")) {
        db.createObjectStore("candle_queries", { keyPath: "key" });
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
 * Salva una sessione completa di replay nel buffer offline resiliente.
 */
export async function storeOfflineReplaySession(
  input: Omit<OfflineReplaySession, "bufferedAt" | "barCount" | "sizeBytes" | "source">,
): Promise<OfflineReplaySession> {
  const barCount = input.candles.length;
  // Stima approssimativa dimensione: ~40 byte per candela OHLCV + metadati
  const sizeBytes = barCount * 48 + 256;

  const session: OfflineReplaySession = {
    ...input,
    symbol: input.symbol.replace("/", "").toUpperCase(),
    interval: input.interval.toUpperCase(),
    bufferedAt: Date.now(),
    barCount,
    sizeBytes,
    source: "offline_buffer",
  };

  // 1. Salva in memoria
  memorySessions.set(session.id, session);

  // 2. Salva in IndexedDB se presente
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_OFFLINE_SESSIONS, "readwrite");
      const store = tx.objectStore(STORE_OFFLINE_SESSIONS);
      store.put(session);

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
    // Il salvataggio in memoria garantisce la continuità
  }

  return session;
}

/**
 * Recupera una sessione offline tramite il suo identificativo univoco.
 */
export async function getOfflineReplaySession(id: string): Promise<OfflineReplaySession | null> {
  const mem = memorySessions.get(id);
  if (mem) return mem;

  try {
    const db = await openDatabase();
    return await new Promise<OfflineReplaySession | null>((resolve) => {
      const tx = db.transaction(STORE_OFFLINE_SESSIONS, "readonly");
      const store = tx.objectStore(STORE_OFFLINE_SESSIONS);
      const req = store.get(id);

      req.onsuccess = () => {
        const result = req.result as OfflineReplaySession | undefined;
        if (result) {
          memorySessions.set(result.id, result);
          resolve(result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

/**
 * Elenca tutte le sessioni di replay attualmente archiviate nel buffer offline.
 */
export async function listOfflineReplaySessions(): Promise<OfflineReplaySession[]> {
  const sessionsMap = new Map<string, OfflineReplaySession>(memorySessions);

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_OFFLINE_SESSIONS, "readonly");
      const store = tx.objectStore(STORE_OFFLINE_SESSIONS);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = req.result as OfflineReplaySession[] | undefined;
        if (list) {
          for (const s of list) {
            sessionsMap.set(s.id, s);
          }
        }
        resolve();
      };
      req.onerror = () => resolve();
      tx.oncomplete = () => db.close();
    });
  } catch {
    // Usa le sessioni in memoria
  }

  return Array.from(sessionsMap.values()).sort((a, b) => b.bufferedAt - a.bufferedAt);
}

/**
 * Rimuove una sessione specifica dal buffer offline.
 */
export async function deleteOfflineReplaySession(id: string): Promise<boolean> {
  memorySessions.delete(id);

  try {
    const db = await openDatabase();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_OFFLINE_SESSIONS, "readwrite");
      const store = tx.objectStore(STORE_OFFLINE_SESSIONS);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return true;
  }
}

/**
 * Svuota completamente tutte le sessioni offline.
 */
export async function clearAllOfflineReplaySessions(): Promise<void> {
  memorySessions.clear();

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_OFFLINE_SESSIONS, "readwrite");
      const store = tx.objectStore(STORE_OFFLINE_SESSIONS);
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
    // No-op se IndexedDB non è disponibile
  }
}

/**
 * Cerca una sessione offline compatibile per soddisfare la richiesta di candele quando la rete è offline.
 */
export async function findMatchingOfflineReplayBuffer(
  input: ReplayCandlesRequest,
): Promise<ReplayCandlesResponse | null> {
  const normalizedSymbol = input.symbol.replace("/", "").toUpperCase();
  const normalizedInterval = input.interval.toUpperCase();

  const sessions = await listOfflineReplaySessions();
  const match = sessions.find(
    (s) => s.symbol === normalizedSymbol && s.interval === normalizedInterval,
  );

  if (!match || match.candles.length === 0) {
    return null;
  }

  let candles = match.candles;

  // Filtraggio opzionale per cursore temporale se specificato
  if (input.from != null) {
    candles = candles.filter((c) => c.time >= input.from!);
  }
  if (input.to != null) {
    candles = candles.filter((c) => c.time <= input.to!);
  }
  if (input.limit != null && candles.length > input.limit) {
    candles = candles.slice(0, input.limit);
  }

  const lastCandle = candles[candles.length - 1];
  const firstCandle = candles[0];

  return {
    candles,
    source: "offline_buffer",
    availableTo: lastCandle ? lastCandle.time + 60 : undefined,
    replayTime: input.replayTime ?? input.anchorTime ?? firstCandle?.time,
  };
}

/**
 * Esegue il download a pacchetti (paginato a blocchi da 5.000 candele)
 * per salvare uno storico completo nel buffer offline resiliente IndexedDB.
 */
export async function downloadAndBufferOfflinePack(
  input: {
    symbol: string;
    interval: string;
    from: number;
    to: number;
    name?: string;
  },
  options: {
    baseUrl?: string;
    signal?: AbortSignal;
    onProgress?: (progress: { loadedBars: number; pct: number; currentTs?: number }) => void;
  } = {},
): Promise<OfflineReplaySession> {
  const normSymbol = input.symbol.replace("/", "").toUpperCase();
  const normInterval = input.interval.toUpperCase();
  const allCandles: ReplayCandleRaw[] = [];
  const seenTimes = new Set<number>();
  let cursor = input.from;
  const totalSpan = Math.max(1, input.to - input.from);

  while (cursor < input.to) {
    if (options.signal?.aborted) {
      throw new DOMException("Download offline annullato dall'operatore", "AbortError");
    }

    const url = createReplayCandlesUrl(
      {
        symbol: normSymbol,
        interval: normInterval,
        mode: "replay",
        from: cursor,
        to: input.to,
        limit: 5000,
      },
      { baseUrl: options.baseUrl },
    );

    const resp = await fetch(url, { signal: options.signal });
    if (!resp.ok) {
      throw new Error(`Impossibile scaricare blocco storico per ${normSymbol}: HTTP ${resp.status}`);
    }

    const page = (await resp.json()) as ReplayCandlesResponse;

    if (!page.candles || page.candles.length === 0) {
      break;
    }

    let addedInBatch = 0;
    for (const c of page.candles) {
      if (c.time >= cursor && c.time <= input.to && !seenTimes.has(c.time)) {
        seenTimes.add(c.time);
        allCandles.push(c);
        addedInBatch++;
      }
    }

    const lastCandle = page.candles[page.candles.length - 1];
    const nextCursor = page.nextFrom ?? (lastCandle ? lastCandle.time + 1 : undefined);

    if (nextCursor == null || nextCursor <= cursor || addedInBatch === 0) {
      break;
    }

    cursor = nextCursor;
    const pct = Math.min(99, Math.round(((cursor - input.from) / totalSpan) * 100));
    options.onProgress?.({
      loadedBars: allCandles.length,
      pct,
      currentTs: cursor,
    });
  }

  // Ordina per tempo crescente
  allCandles.sort((a, b) => a.time - b.time);

  const sessionId = `offline_${normSymbol}_${normInterval}_${input.from}_${input.to}_${Date.now()}`;
  const fromIso = new Date(input.from * 1000).toISOString().slice(0, 10);
  const toIso = new Date(input.to * 1000).toISOString().slice(0, 10);
  const sessionName =
    input.name || `${normSymbol} (${normInterval}) ${fromIso} → ${toIso}`;

  const stored = await storeOfflineReplaySession({
    id: sessionId,
    name: sessionName,
    symbol: normSymbol,
    interval: normInterval,
    mode: "replay",
    candles: allCandles,
    from: input.from,
    to: input.to,
  });

  options.onProgress?.({
    loadedBars: allCandles.length,
    pct: 100,
    currentTs: input.to,
  });

  return stored;
}

export interface StorageQuotaEstimate {
  usedBytes: number;
  quotaBytes: number;
  percent: number;
  persisted: boolean;
}

/**
 * Restituisce le statistiche stimate sullo spazio di archiviazione locale
 * del browser (StorageManager / IndexedDB).
 */
export async function getStorageQuotaEstimate(): Promise<StorageQuotaEstimate> {
  let usedBytes = 0;
  let quotaBytes = 0;
  let percent = 0;
  let persisted = false;

  if (typeof navigator !== "undefined" && navigator.storage) {
    try {
      if (navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        usedBytes = est.usage ?? 0;
        quotaBytes = est.quota ?? 0;
        percent = quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0;
      }
      if (navigator.storage.persisted) {
        persisted = await navigator.storage.persisted();
      }
    } catch {
      // Ignora errori browser
    }
  }

  // Se quota storage estimate è 0, calcola la dimensione dai pacchetti in memoria
  if (usedBytes === 0) {
    for (const session of memorySessions.values()) {
      usedBytes += session.sizeBytes;
    }
  }

  return { usedBytes, quotaBytes, percent, persisted };
}

/**
 * Richiede la persistenza dello storage al browser per prevenire lo sfratto
 * automatico della cache da parte del sistema operativo in condizioni di spazio ridotto.
 */
export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.storage?.persist) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Esporta un pacchetto di replay offline in formato JSON scaricabile.
 */
export function exportOfflineSessionJson(session: OfflineReplaySession): string {
  return JSON.stringify(session, null, 2);
}

/**
 * Importa e registra nel buffer offline un pacchetto precedentemente esportato in JSON.
 */
export async function importOfflineSessionJson(jsonStr: string): Promise<OfflineReplaySession> {
  const parsed = JSON.parse(jsonStr) as Partial<OfflineReplaySession>;
  if (!parsed.symbol || !parsed.interval || !Array.isArray(parsed.candles)) {
    throw new Error("Formato pacchetto offline non valido: mancano symbol, interval o candles");
  }
  const candles = parsed.candles;
  const first = candles[0]?.time ?? 0;
  const last = candles[candles.length - 1]?.time ?? 0;

  return storeOfflineReplaySession({
    id: parsed.id || `offline_${parsed.symbol}_${parsed.interval}_${Date.now()}`,
    name: parsed.name || `${parsed.symbol} (${parsed.interval}) [Importato]`,
    symbol: parsed.symbol,
    interval: parsed.interval,
    mode: "replay",
    candles,
    from: parsed.from ?? first,
    to: parsed.to ?? last,
    anchorTime: parsed.anchorTime,
    warmupBars: parsed.warmupBars,
  });
}
