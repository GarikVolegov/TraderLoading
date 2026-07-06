import assert from "node:assert/strict";
import { parseTradesCsv } from "./tradesCsv.js";

// Finding 5D: universal CSV import for traders who don't sync a broker. Tolerant of
// common column names (MT4/MT5/cTrader exports) — case-insensitive, alias headers.
const csv = [
  "Ticket,Symbol,Type,Volume,Open Time,Close Time,Open Price,Close Price,S/L,T/P,Commission,Swap,Profit",
  "101,EURUSD,buy,0.10,2026-07-01 09:00,2026-07-01 11:00,1.0800,1.0850,1.0780,1.0900,-2.0,0.0,50.0",
  "102,GBPUSD,Sell,0.20,2026-07-02 10:00,2026-07-02 12:00,1.2700,1.2650,1.2750,,-4.0,-1.0,100.0",
].join("\n");

const { trades, skipped } = parseTradesCsv(csv);
assert.equal(skipped, 0);
assert.equal(trades.length, 2);

assert.equal(trades[0].ticket, "101");
assert.equal(trades[0].symbol, "EURUSD");
assert.equal(trades[0].direction, "buy");
assert.equal(trades[0].volume, "0.10");
assert.equal(trades[0].entryPrice, "1.0800");
assert.equal(trades[0].exitPrice, "1.0850");
assert.equal(trades[0].stopLoss, "1.0780");
assert.equal(trades[0].profit, "50.0");
assert.equal(trades[0].commission, "-2.0");
assert.equal(trades[0].openTime, "2026-07-01 09:00");

assert.equal(trades[1].direction, "sell");
assert.equal(trades[1].takeProfit, undefined, "empty T/P cell → undefined");

// Alias headers (cTrader-ish) + missing/garbage rows are skipped, not crashed.
const aliased = [
  "instrument,direction,lots,entry,exit,pnl",
  "XAUUSD,long,0.5,2350.0,2360.5,120",
  ",,,,,",              // blank row → skipped
  "onlytwo,cols",       // wrong column count → skipped
].join("\n");
const r2 = parseTradesCsv(aliased);
assert.equal(r2.trades.length, 1);
assert.equal(r2.trades[0].symbol, "XAUUSD");
assert.equal(r2.trades[0].direction, "buy", "long → buy");
assert.equal(r2.trades[0].entryPrice, "2350.0");
assert.equal(r2.skipped, 2);

// No recognizable header → nothing parsed.
assert.deepEqual(parseTradesCsv("foo,bar\n1,2"), { trades: [], skipped: 0 });
assert.deepEqual(parseTradesCsv(""), { trades: [], skipped: 0 });

console.log("trades csv checks passed");
