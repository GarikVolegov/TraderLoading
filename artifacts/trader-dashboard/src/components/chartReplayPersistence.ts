export interface PersistedReplayTrade {
  id: number;
  direction: "buy" | "sell";
  entryPrice: number;
  entryIndex: number;
  exitPrice?: number;
  exitIndex?: number;
  stopLoss?: number;
  takeProfit?: number;
  result?: "win" | "loss" | "breakeven";
  pips?: number;
  lotSize?: number;
  dollarPL?: number;
}

export interface PersistedReplayState {
  version: 1;
  symbol: string;
  activeInterval: string;
  startDate: string;
  revealedCount: number;
  startIndex: number;
  balance: number;
  lotSize: string;
  trades: PersistedReplayTrade[];
  openTrade: PersistedReplayTrade | null;
  savedAt: string;
}

export interface ReplayStateDraft {
  symbol: string;
  activeInterval: string;
  startDate: string;
  revealedCount: number;
  startIndex: number;
  balance: number;
  lotSize: string;
  trades: PersistedReplayTrade[];
  openTrade: PersistedReplayTrade | null;
}

export function createReplayStorageKey(key: string): string {
  return `traderloading:chart-replay:${key}`;
}

export function createReplaySavedTradeIdsStorageKey(key: string): string {
  return `traderloading:chart-replay:saved-trades:${key}`;
}

export function serializeReplaySavedTradeIds(ids: Set<number>): string {
  const values = [...ids]
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((a, b) => a - b);
  return JSON.stringify({ version: 1, ids: values });
}

export function parseReplaySavedTradeIds(raw: string | null): Set<number> {
  if (!raw) return new Set();
  try {
    const data = JSON.parse(raw) as { version?: unknown; ids?: unknown } | unknown[];
    if (Array.isArray(data)) {
      return new Set(data.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0));
    }
    if (data.version !== 1 || !Array.isArray(data.ids)) return new Set();
    return new Set(
      data.ids.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0),
    );
  } catch {
    return new Set();
  }
}

function isTrade(value: unknown): value is PersistedReplayTrade {
  const trade = value as Partial<PersistedReplayTrade>;
  return Boolean(
    trade &&
    typeof trade.id === "number" &&
    (trade.direction === "buy" || trade.direction === "sell") &&
    typeof trade.entryPrice === "number" &&
    typeof trade.entryIndex === "number",
  );
}

export function serializeReplayState(draft: ReplayStateDraft): string {
  const state: PersistedReplayState = {
    version: 1,
    symbol: draft.symbol,
    activeInterval: draft.activeInterval,
    startDate: draft.startDate,
    revealedCount: Math.max(0, Math.floor(draft.revealedCount)),
    startIndex: Math.max(0, Math.floor(draft.startIndex)),
    balance: Number.isFinite(draft.balance) ? draft.balance : 0,
    lotSize: draft.lotSize,
    trades: draft.trades.filter(isTrade),
    openTrade: draft.openTrade && isTrade(draft.openTrade) ? draft.openTrade : null,
    savedAt: new Date().toISOString(),
  };
  return JSON.stringify(state);
}

export function parsePersistedReplayState(raw: string | null, symbol: string): PersistedReplayState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<PersistedReplayState>;
    if (data.version !== 1) return null;
    if (data.symbol !== symbol) return null;
    if (typeof data.activeInterval !== "string") return null;
    if (typeof data.revealedCount !== "number") return null;
    if (typeof data.startIndex !== "number") return null;
    if (typeof data.balance !== "number") return null;
    if (typeof data.lotSize !== "string") return null;
    if (!Array.isArray(data.trades)) return null;
    return {
      version: 1,
      symbol: data.symbol,
      activeInterval: data.activeInterval,
      startDate: typeof data.startDate === "string" ? data.startDate : "",
      revealedCount: Math.max(0, Math.floor(data.revealedCount)),
      startIndex: Math.max(0, Math.floor(data.startIndex)),
      balance: data.balance,
      lotSize: data.lotSize,
      trades: data.trades.filter(isTrade),
      openTrade: data.openTrade && isTrade(data.openTrade) ? data.openTrade : null,
      savedAt: typeof data.savedAt === "string" ? data.savedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}
