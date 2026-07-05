// Pure diff for imported broker trades: decides whether a re-imported deal differs
// from the row already stored, so the sync loop can skip a no-op UPDATE. A closed
// deal is final, so the vast majority of re-imports are identical — rewriting them
// every cycle was the bulk of the broker write load (finding 2.2).
//
// Numeric fields are compared as NUMBERS (format-agnostic: Postgres returns "50.00"
// while the freshly-built value is "50" — same value, no spurious UPDATE). Text
// fields are compared as strings. Conservative by design: any ambiguity counts as
// changed, so we never skip a genuine update to financial data.

export interface ComparableTrade {
  symbol: string | null;
  direction: string | null;
  volume: string | null;
  openTime: string | null;
  closeTime: string | null;
  entryPrice: string | null;
  exitPrice: string | null;
  stopLoss: string | null;
  takeProfit: string | null;
  profit: string | null;
  commission: string | null;
  swap: string | null;
  status: string | null;
  brokerProfileId: string | null;
  brokerAccountId: string | null;
  riskPriceDistance: string | null;
  returnPct: string | null;
}

// returnPct is intentionally NOT compared: it is recomputed each import from the
// LIVE account balance (profit/balance), so it drifts whenever any trade closes or
// funds move. Comparing it would flag every historical trade as "changed" on every
// balance move and rewrite them all — defeating the whole skip. Its stored value
// (return vs the balance at first import) is fine to leave.
const NUMERIC_FIELDS = [
  "volume", "entryPrice", "exitPrice", "stopLoss", "takeProfit",
  "profit", "commission", "swap", "riskPriceDistance",
] as const satisfies ReadonlyArray<keyof ComparableTrade>;

const TEXT_FIELDS = [
  "symbol", "direction", "openTime", "closeTime", "status", "brokerProfileId", "brokerAccountId",
] as const satisfies ReadonlyArray<keyof ComparableTrade>;

function numericEqual(a: string | null, b: string | null): boolean {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  // Number("") and Number(" ") coerce to 0, which would make an empty string equal
  // "0" — a latent staleness trap. Treat blanks as non-numeric and compare exactly.
  if (a.trim() === "" || b.trim() === "") return a === b;
  const na = Number(a);
  const nb = Number(b);
  // Unparseable numeric string (shouldn't happen) → fall back to exact string
  // compare rather than treat NaN === NaN as equal.
  if (Number.isNaN(na) || Number.isNaN(nb)) return a === b;
  return na === nb;
}

/** True when `incoming` differs from `current` on any stored trade field. */
export function accountTradeChanged(current: ComparableTrade, incoming: ComparableTrade): boolean {
  for (const field of NUMERIC_FIELDS) {
    if (!numericEqual(current[field], incoming[field])) return true;
  }
  for (const field of TEXT_FIELDS) {
    if ((current[field] ?? null) !== (incoming[field] ?? null)) return true;
  }
  return false;
}

/** Narrow an arbitrary row/values object to the comparable trade fields. */
export function toComparableTrade(row: Record<string, unknown>): ComparableTrade {
  const pick = (key: string): string | null => {
    const value = row[key];
    return value === null || value === undefined ? null : String(value);
  };
  return {
    symbol: pick("symbol"), direction: pick("direction"), volume: pick("volume"),
    openTime: pick("openTime"), closeTime: pick("closeTime"), entryPrice: pick("entryPrice"),
    exitPrice: pick("exitPrice"), stopLoss: pick("stopLoss"), takeProfit: pick("takeProfit"),
    profit: pick("profit"), commission: pick("commission"), swap: pick("swap"),
    status: pick("status"), brokerProfileId: pick("brokerProfileId"), brokerAccountId: pick("brokerAccountId"),
    riskPriceDistance: pick("riskPriceDistance"), returnPct: pick("returnPct"),
  };
}
