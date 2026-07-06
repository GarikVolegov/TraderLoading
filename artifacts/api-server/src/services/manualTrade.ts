// Manual journaling → coach (audit finding 3.5). The whole coach (edge, discipline,
// guard, quant stats) reads closed accountTrades rows; broker-sync users have them,
// hand-journalers don't — so their overview/edge/equity were empty. When a manual
// journal entry carries structured trade fields, persist an equivalent closed row
// (source="manual") and the existing analytics light up unchanged. Pure builder.

export interface ManualTradeInput {
  symbol?: unknown;
  direction?: unknown;
  entryPrice?: unknown;
  exitPrice?: unknown;
  stopLoss?: unknown;
  takeProfit?: unknown;
  volume?: unknown;
  profit?: unknown;
  commission?: unknown;
  swap?: unknown;
  openTime?: unknown;
  closeTime?: unknown;
}

export interface ManualTradeCtx {
  userId: string;
  journalEntryId: number;
  /** Journal entry's trade date, used when explicit open/close times are absent. */
  tradeDate: string;
}

export interface ManualTradeRow {
  ticket: string;
  source: "manual";
  symbol: string;
  direction: "buy" | "sell";
  volume: string;
  openTime: string;
  closeTime: string | null;
  entryPrice: string;
  exitPrice: string | null;
  stopLoss: string | null;
  takeProfit: string | null;
  profit: string | null;
  commission: string | null;
  swap: string | null;
  status: "closed";
  userId: string;
}

/** Finite number → canonical string ("1.0800" → "1.08"), else null. */
function toNumString(value: unknown): string | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  return Number.isFinite(n) ? String(n) : null;
}

function normalizeDirection(value: unknown): "buy" | "sell" {
  const s = String(value ?? "").trim().toLowerCase();
  return s === "sell" || s === "short" ? "sell" : "buy";
}

function timeOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

/**
 * Build a closed-trade row from a manual journal entry's structured fields, or null
 * when the essentials (symbol + entry + exit + profit) are missing — we never persist
 * a meaningless trade. Ticket is keyed on the journal entry so re-saving updates the
 * same row (via the source+ticket+user unique index) instead of duplicating.
 */
export function buildManualTradeRow(input: ManualTradeInput, ctx: ManualTradeCtx): ManualTradeRow | null {
  const symbol = String(input.symbol ?? "").trim().toUpperCase();
  const entryPrice = toNumString(input.entryPrice);
  const exitPrice = toNumString(input.exitPrice);
  const profit = toNumString(input.profit);
  if (!symbol || entryPrice === null || exitPrice === null || profit === null) return null;

  return {
    ticket: `manual-${ctx.journalEntryId}`,
    source: "manual",
    symbol,
    direction: normalizeDirection(input.direction),
    volume: toNumString(input.volume) ?? "0",
    openTime: timeOr(input.openTime, ctx.tradeDate),
    closeTime: timeOr(input.closeTime, ctx.tradeDate),
    entryPrice,
    exitPrice,
    stopLoss: toNumString(input.stopLoss),
    takeProfit: toNumString(input.takeProfit),
    profit,
    commission: toNumString(input.commission),
    swap: toNumString(input.swap),
    status: "closed",
    userId: ctx.userId,
  };
}
