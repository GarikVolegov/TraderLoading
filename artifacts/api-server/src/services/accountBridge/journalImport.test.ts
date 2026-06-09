import assert from "node:assert/strict";
import { buildJournalEntryFromAccountTrade, getTradeResult } from "./journalImport.js";
import type { AccountTrade } from "./types.js";

const baseTrade: AccountTrade = {
  ticket: "T-100",
  source: "demo",
  symbol: "EURUSD",
  direction: "buy",
  volume: 0.1,
  openTime: "2026-06-06T08:00:00.000Z",
  closeTime: "2026-06-06T09:00:00.000Z",
  entryPrice: 1.08,
  exitPrice: 1.091,
  profit: 42.5,
  status: "closed",
};

assert.equal(getTradeResult({ ...baseTrade, profit: 10 }), "win");
assert.equal(getTradeResult({ ...baseTrade, profit: -1 }), "loss");
assert.equal(getTradeResult({ ...baseTrade, profit: 0 }), "breakeven");
assert.equal(getTradeResult({ ...baseTrade, profit: undefined }), "breakeven");
assert.equal(
  getTradeResult({ ...baseTrade, profit: 5, commission: -8, swap: 0 }),
  "loss",
  "result should follow net P&L after costs",
);

const draft = buildJournalEntryFromAccountTrade(baseTrade);
assert.equal(draft.title, "EURUSD BUY account trade");
assert.equal(draft.tradeDate, "2026-06-06");
assert.equal(draft.result, "win");
assert.equal(draft.tags, "account-import,demo,EURUSD,buy");
assert.match(draft.content, /Ticket: T-100/);
assert.match(draft.content, /Profit: 42.50/);

console.log("account bridge journal import checks passed");
