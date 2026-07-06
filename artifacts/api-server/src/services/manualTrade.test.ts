import assert from "node:assert/strict";
import { buildManualTradeRow } from "./manualTrade.js";

const ctx = { userId: "u1", journalEntryId: 42, tradeDate: "2026-07-01" };

// Finding 3.5: a manual journal entry with structured trade fields becomes a
// closed accountTrades row (source="manual") so the coach/edge/equity pick it up.
const row = buildManualTradeRow(
  { symbol: " eurusd ", direction: "Buy", entryPrice: "1.0800", exitPrice: 1.085, stopLoss: 1.078, volume: 0.1, profit: 50, commission: -2, swap: 0 },
  ctx,
)!;
assert.equal(row.source, "manual");
assert.equal(row.status, "closed");
assert.equal(row.userId, "u1");
assert.equal(row.ticket, "manual-42", "ticket keyed on the journal entry so re-saves update, not duplicate");
assert.equal(row.symbol, "EURUSD");
assert.equal(row.direction, "buy");
assert.equal(row.entryPrice, "1.08");
assert.equal(row.exitPrice, "1.085");
assert.equal(row.stopLoss, "1.078");
assert.equal(row.volume, "0.1");
assert.equal(row.profit, "50");
assert.equal(row.commission, "-2");
assert.equal(row.openTime, "2026-07-01", "falls back to the trade date");
assert.equal(row.closeTime, "2026-07-01");

// "sell"/"short" normalize; explicit times win over tradeDate.
const sell = buildManualTradeRow(
  { symbol: "GBPUSD", direction: "short", entryPrice: 1.27, exitPrice: 1.26, profit: -80, openTime: "2026-07-02T09:00:00Z", closeTime: "2026-07-02T11:00:00Z" },
  ctx,
)!;
assert.equal(sell.direction, "sell");
assert.equal(sell.openTime, "2026-07-02T09:00:00Z");
assert.equal(sell.stopLoss, null, "no stop → null (R stays uncomputable, like a broker trade without a stop)");

// Insufficient fields → null (don't persist a meaningless trade).
assert.equal(buildManualTradeRow({ symbol: "EURUSD" }, ctx), null, "no prices/profit");
assert.equal(buildManualTradeRow({ symbol: "", entryPrice: 1, exitPrice: 1, profit: 1 }, ctx), null, "blank symbol");
assert.equal(buildManualTradeRow({ symbol: "EURUSD", entryPrice: "abc", exitPrice: 1, profit: 1 }, ctx), null, "non-numeric entry");
assert.equal(buildManualTradeRow({ symbol: "EURUSD", entryPrice: 1, exitPrice: 1 }, ctx), null, "no profit");

console.log("manual trade checks passed");
