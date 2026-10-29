import type { ClosedTrade } from "./types";

export function createPendingTradesStorageKey(sessionId: number | string): string {
  return `traderloading:backtest-pending-trades:${sessionId}`;
}

export function parsePendingTrades(raw: string | null): Map<string, ClosedTrade> {
  if (!raw) return new Map();
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return new Map();
    const map = new Map<string, ClosedTrade>();
    for (const item of list) {
      if (Array.isArray(item) && typeof item[0] === "string" && item[1] && typeof item[1] === "object") {
        map.set(item[0], item[1] as ClosedTrade);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

export function serializePendingTrades(trades: Map<string, ClosedTrade>): string {
  return JSON.stringify([...trades.entries()]);
}
