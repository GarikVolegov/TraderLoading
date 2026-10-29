/**
 * AUREUS PROTOCOL — Offline-First Sync Storage per Il Libro della Verità (Journal)
 *
 * Consente la registrazione, modifica note e categorizzazione dei trade anche
 * in assenza temporanea di rete (modalità aereo, tunnel o failover server).
 *
 * Utilizza IndexedDB con database 'aureus_journal_sync_v1' e fallback in memoria
 * per ambienti server o test.
 */

import { apiJSON } from "./apiFetch";
import type { JournalEntry } from "@workspace/api-client-react";

export const DB_NAME = "aureus_journal_sync_v1";
export const DB_VERSION = 1;
export const STORE_MUTATIONS = "offline_mutations";
export const STORE_ENTRIES = "offline_entries";

export interface OfflineJournalMutation {
  id: string;
  type: "create_entry" | "update_note" | "update_tags";
  entryId?: number;
  payload: any;
  createdAt: number;
  status: "pending" | "syncing" | "failed";
  retryCount: number;
  lastError?: string;
}

// In-memory fallback per SSR, ambienti Node o test
const memoryMutations = new Map<string, OfflineJournalMutation>();
const memoryEntries = new Map<number, JournalEntry>();

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
      if (!db.objectStoreNames.contains(STORE_MUTATIONS)) {
        const store = db.createObjectStore(STORE_MUTATIONS, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("type", "type", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
        const entryStore = db.createObjectStore(STORE_ENTRIES, { keyPath: "id" });
        entryStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Accoda una mutazione offline da sincronizzare al rientro della connettività.
 */
export async function queueOfflineMutation(
  input: Omit<OfflineJournalMutation, "id" | "createdAt" | "status" | "retryCount">,
): Promise<string> {
  const id = `mut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const record: OfflineJournalMutation = {
    ...input,
    id,
    createdAt: Date.now(),
    status: "pending",
    retryCount: 0,
  };

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_MUTATIONS, "readwrite");
      const store = tx.objectStore(STORE_MUTATIONS);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback in-memory
    memoryMutations.set(id, record);
  }

  return id;
}

/**
 * Recupera l'elenco di tutte le mutazioni in attesa di sincronizzazione.
 */
export async function getPendingMutations(): Promise<OfflineJournalMutation[]> {
  try {
    const db = await openDatabase();
    return await new Promise<OfflineJournalMutation[]>((resolve, reject) => {
      const tx = db.transaction(STORE_MUTATIONS, "readonly");
      const store = tx.objectStore(STORE_MUTATIONS);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result as OfflineJournalMutation[]) || [];
        list.sort((a, b) => a.createdAt - b.createdAt);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    const list = Array.from(memoryMutations.values());
    list.sort((a, b) => a.createdAt - b.createdAt);
    return list;
  }
}

/**
 * Rimuove una mutazione una volta sincronizzata con successo.
 */
export async function removeOfflineMutation(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_MUTATIONS, "readwrite");
      const store = tx.objectStore(STORE_MUTATIONS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryMutations.delete(id);
  }
}

/**
 * Aggiorna lo stato di una mutazione (es. retryCount, status, lastError).
 */
export async function updateOfflineMutation(mutation: OfflineJournalMutation): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_MUTATIONS, "readwrite");
      const store = tx.objectStore(STORE_MUTATIONS);
      const req = store.put(mutation);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryMutations.set(mutation.id, mutation);
  }
}

/**
 * Salva le voci del diario nella cache locale per consultazione istantanea offline.
 */
export async function cacheJournalEntries(entries: JournalEntry[]): Promise<void> {
  if (!entries || entries.length === 0) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_ENTRIES, "readwrite");
      const store = tx.objectStore(STORE_ENTRIES);
      for (const entry of entries) {
        store.put(entry);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    for (const entry of entries) {
      memoryEntries.set(entry.id, entry);
    }
  }
}

/**
 * Recupera le voci del diario salvate nella cache locale offline.
 */
export async function getCachedJournalEntries(): Promise<JournalEntry[]> {
  try {
    const db = await openDatabase();
    return await new Promise<JournalEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_ENTRIES, "readonly");
      const store = tx.objectStore(STORE_ENTRIES);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as JournalEntry[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return Array.from(memoryEntries.values());
  }
}

/**
 * Verifica se il client è online in modo sicuro.
 */
export function isOnline(): boolean {
  if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
    return navigator.onLine;
  }
  return true;
}

/**
 * Esegue la sincronizzazione sequenziale di tutte le mutazioni accodate offline.
 */
export async function syncOfflineJournalMutations(
  onProgress?: (synced: number, total: number) => void,
): Promise<{ synced: number; failed: number }> {
  if (!isOnline()) {
    return { synced: 0, failed: 0 };
  }

  const mutations = await getPendingMutations();
  if (mutations.length === 0) {
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  for (const mut of mutations) {
    try {
      mut.status = "syncing";
      await updateOfflineMutation(mut);

      if (mut.type === "create_entry") {
        await apiJSON<JournalEntry>("journal/entries", {
          method: "POST",
          body: JSON.stringify(mut.payload.data || mut.payload),
        });
      } else if (mut.type === "update_note" || mut.type === "update_tags") {
        if (!mut.entryId) {
          throw new Error("entryId mancante per la mutazione di aggiornamento");
        }
        await apiJSON<JournalEntry>(`journal/entries/${mut.entryId}`, {
          method: "PUT",
          body: JSON.stringify(mut.payload),
        });
      }

      await removeOfflineMutation(mut.id);
      synced += 1;
      onProgress?.(synced, mutations.length);
    } catch (err: any) {
      failed += 1;
      mut.status = "failed";
      mut.retryCount += 1;
      mut.lastError = err?.message || String(err);
      await updateOfflineMutation(mut);
    }
  }

  return { synced, failed };
}

/**
 * Sottoscrive gli eventi di rete per lanciare la sincronizzazione automatica al ripristino del segnale.
 */
export function initJournalOfflineSync(
  onSyncComplete?: (result: { synced: number; failed: number }) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  let isSyncing = false;

  const triggerSync = async () => {
    if (isSyncing || !isOnline()) return;
    isSyncing = true;
    try {
      const res = await syncOfflineJournalMutations();
      if (res.synced > 0) {
        onSyncComplete?.(res);
      }
    } finally {
      isSyncing = false;
    }
  };

  const handleOnline = () => {
    void triggerSync();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      void triggerSync();
    }
  };

  window.addEventListener("online", handleOnline);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Trigger iniziale non-blocking
  void triggerSync();

  return () => {
    window.removeEventListener("online", handleOnline);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}

/**
 * Utility di pulizia per testing.
 */
export function resetJournalOfflineSyncForTesting(): void {
  memoryMutations.clear();
  memoryEntries.clear();
}
