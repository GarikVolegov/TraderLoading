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

const TRADE_FIELD_KEYS: readonly (keyof ManualTradeInput)[] = [
  "symbol", "direction", "entryPrice", "exitPrice", "stopLoss", "takeProfit",
  "volume", "profit", "commission", "swap", "openTime", "closeTime",
];

/**
 * Does this request body actually carry trade fields? The entry PUT re-runs the
 * sync from the raw body, so a plain-text edit (no trade fields) must be a no-op —
 * otherwise editing a note would delete its linked coach trade. Blank/null values
 * don't count as intent (JSON omits `undefined`, so an untouched form sends nothing).
 */
export function hasTradeIntent(rawBody: unknown): boolean {
  if (!rawBody || typeof rawBody !== "object") return false;
  const body = rawBody as Record<string, unknown>;
  return TRADE_FIELD_KEYS.some((key) => {
    const value = body[key];
    return value !== undefined && value !== null && value !== "";
  });
}

export interface ManualTradeCtx {
  userId: string;
  journalEntryId: number;
  /** Journal entry's trade date, used when explicit open/close times are absent. */
  tradeDate: string;
}

export interface ManualTradeRow {
  ticket: string;
  /** Provenance: "manual" for journal entries and CSV imports — both user-provided,
   *  so both are excluded from tornei (see tornei/store.ts). */
  source: string;
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
  return buildTradeRow(input, {
    userId: ctx.userId,
    source: "manual",
    ticket: `manual-${ctx.journalEntryId}`,
    tradeDate: ctx.tradeDate,
  });
}

/** Shared core: build a closed-trade row from loose trade fields under a given
 *  provenance/ticket (journal entry or CSV import), or null when essentials are
 *  missing. Reused by manual-journal and CSV-import paths. */
export function buildTradeRow(
  input: ManualTradeInput,
  opts: { userId: string; source: string; ticket: string; tradeDate: string },
): ManualTradeRow | null {
  const symbol = String(input.symbol ?? "").trim().toUpperCase();
  const entryPrice = toNumString(input.entryPrice);
  const exitPrice = toNumString(input.exitPrice);
  const profit = toNumString(input.profit);
  if (!symbol || entryPrice === null || exitPrice === null || profit === null) return null;

  return {
    ticket: opts.ticket,
    source: opts.source,
    symbol,
    direction: normalizeDirection(input.direction),
    volume: toNumString(input.volume) ?? "0",
    openTime: timeOr(input.openTime, opts.tradeDate),
    closeTime: timeOr(input.closeTime, opts.tradeDate),
    entryPrice,
    exitPrice,
    stopLoss: toNumString(input.stopLoss),
    takeProfit: toNumString(input.takeProfit),
    profit,
    commission: toNumString(input.commission),
    swap: toNumString(input.swap),
    status: "closed",
    userId: opts.userId,
  };
}
