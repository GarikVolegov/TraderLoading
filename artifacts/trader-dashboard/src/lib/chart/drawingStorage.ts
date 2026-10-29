import type { ReplayDrawing } from "../replay/types";

const STORAGE_PREFIX = "limen_chart_drawings_v1";
export const DRAWINGS_SYNC_EVENT = "limen:drawings-sync";

function normalizeSymbolKey(symbol: string): string {
  if (!symbol) return "XAUUSD";
  const stripped = symbol.includes(":") ? symbol.split(":").pop()! : symbol;
  return stripped.trim().toUpperCase().replace(/[\/\-_\s]/g, "");
}

// In-memory cache to guarantee instantaneous retrieval and zero-latency cross-frame sync
const memoryDrawingCache = new Map<string, ReplayDrawing[]>();

function buildKey(symbol: string, interval: string): string {
  const s = normalizeSymbolKey(symbol);
  const i = interval.trim().toUpperCase();
  return `${STORAGE_PREFIX}_${s}_${i}`;
}

export function loadChartDrawings(symbol: string, interval?: string): ReplayDrawing[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const s = normalizeSymbolKey(symbol);
    const cached = memoryDrawingCache.get(s);
    if (cached) return cached;

    // TradingView / FX Replay behavior: drawings are preserved per symbol across all timeframes
    // and shared between Il Varco and Backtest
    const globalRaw = window.localStorage.getItem(`${STORAGE_PREFIX}_${s}_ALL`);
    if (globalRaw !== null) {
      const parsed = JSON.parse(globalRaw);
      if (Array.isArray(parsed)) {
        memoryDrawingCache.set(s, parsed);
        return parsed;
      }
    }
    if (interval) {
      const raw = window.localStorage.getItem(buildKey(symbol, interval));
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memoryDrawingCache.set(s, parsed);
          return parsed;
        }
      }
    }
    return [];
  } catch (err) {
    console.warn("[Chart Drawing Storage] Error reading drawings from localStorage:", err);
    return [];
  }
}

export function saveChartDrawings(
  symbol: string,
  intervalOrDrawings: string | ReplayDrawing[],
  drawingsMaybe?: ReplayDrawing[],
  source: "varco" | "backtest" = "varco",
): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const s = normalizeSymbolKey(symbol);
    const isOverload = Array.isArray(intervalOrDrawings);
    const interval = isOverload ? "ALL" : intervalOrDrawings;
    const drawings = isOverload ? intervalOrDrawings : (drawingsMaybe ?? []);
    
    // Update memory cache immediately for zero-latency retrieval
    memoryDrawingCache.set(s, drawings);

    const key = buildKey(symbol, interval);
    const serialized = JSON.stringify(drawings);
    window.localStorage.setItem(key, serialized);
    // Salva anche come layer condiviso per il simbolo (collegamento Varco <-> Backtest)
    window.localStorage.setItem(`${STORAGE_PREFIX}_${s}_ALL`, serialized);
    if (typeof window.dispatchEvent === "function") {
      window.dispatchEvent(
        new CustomEvent(DRAWINGS_SYNC_EVENT, {
          detail: { symbol: s, interval, drawings, source },
        }),
      );
    }
  } catch (err) {
    console.warn("[Chart Drawing Storage] Error saving drawings to localStorage:", err);
  }
}

export function clearChartDrawings(symbol: string, interval?: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const s = normalizeSymbolKey(symbol);
    memoryDrawingCache.delete(s);
    const prefix = `${STORAGE_PREFIX}_${s}_`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) keysToRemove.push(k);
    }
    for (const k of keysToRemove) {
      window.localStorage.removeItem(k);
    }
    window.localStorage.setItem(`${STORAGE_PREFIX}_${s}_ALL`, "[]");
    if (typeof window.dispatchEvent === "function") {
      window.dispatchEvent(
        new CustomEvent(DRAWINGS_SYNC_EVENT, {
          detail: { symbol: s, interval: interval ?? "ALL", drawings: [], source: "clear" },
        }),
      );
    }
  } catch (err) {
    console.warn("[Chart Drawing Storage] Error clearing drawings:", err);
  }
}
