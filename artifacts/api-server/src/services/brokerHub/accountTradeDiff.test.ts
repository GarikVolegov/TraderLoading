import assert from "node:assert/strict";
import { accountTradeChanged, type ComparableTrade } from "./accountTradeDiff.js";

const base: ComparableTrade = {
  symbol: "EURUSD", direction: "buy", volume: "0.10", openTime: "2026-07-01T10:00:00.000Z",
  closeTime: "2026-07-01T12:00:00.000Z", entryPrice: "1.08000", exitPrice: "1.08500",
  stopLoss: "1.07800", takeProfit: "1.09000", profit: "50.00", commission: "-2.00", swap: "0.00",
  status: "closed", brokerProfileId: "prof-1", brokerAccountId: "acct-1",
  riskPriceDistance: "0.00200", returnPct: "2.5000",
};

// Finding 2.2: the import loop re-UPDATEd every existing deal every cycle. A closed
// deal is final, so an identical re-import must be detected as unchanged and skipped.
assert.equal(accountTradeChanged(base, { ...base }), false);

// Numeric equality is format-agnostic: DB canonical strings ("50.00") equal the
// freshly-built value ("50"), so no spurious UPDATE.
assert.equal(
  accountTradeChanged(base, { ...base, profit: "50", commission: "-2", entryPrice: "1.08", exitPrice: "1.085" }),
  false,
);

// A real P&L change is detected.
assert.equal(accountTradeChanged(base, { ...base, profit: "51.00" }), true);
assert.equal(accountTradeChanged(base, { ...base, exitPrice: "1.09000" }), true);

// A null↔value transition on an optional numeric field is a change.
assert.equal(accountTradeChanged(base, { ...base, stopLoss: null }), true);
assert.equal(accountTradeChanged({ ...base, stopLoss: null }, { ...base, stopLoss: null }), false);

// Text field changes (close time, status, symbol, reattached profile) are detected.
assert.equal(accountTradeChanged(base, { ...base, closeTime: "2026-07-01T13:00:00.000Z" }), true);
assert.equal(accountTradeChanged(base, { ...base, status: "open" }), true);
assert.equal(accountTradeChanged(base, { ...base, brokerProfileId: "prof-2" }), true);
assert.equal(accountTradeChanged(base, { ...base, brokerAccountId: null }), true);

console.log("account trade diff checks passed");
