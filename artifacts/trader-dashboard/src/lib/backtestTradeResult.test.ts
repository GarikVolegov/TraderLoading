import assert from "node:assert/strict";
import { calculateManualBacktestTradeResult } from "./backtestTradeResult.js";

// FX majors (x10000).
assert.deepEqual(calculateManualBacktestTradeResult("1.1000", "1.1055", "buy", "EUR/USD"), {
  result: "win",
  pips: "55.0",
});

assert.deepEqual(calculateManualBacktestTradeResult("1.1000", "1.0950", "buy", "EUR/USD"), {
  result: "loss",
  pips: "-50.0",
});

assert.deepEqual(calculateManualBacktestTradeResult("1.2000", "1.1950", "sell", "EUR/USD"), {
  result: "win",
  pips: "50.0",
});

assert.deepEqual(calculateManualBacktestTradeResult("1.2000", "1.2050", "sell", "EUR/USD"), {
  result: "loss",
  pips: "-50.0",
});

assert.deepEqual(calculateManualBacktestTradeResult("1.2000", "1.2000", "sell", "EUR/USD"), {
  result: "breakeven",
  pips: "0.0",
});

assert.deepEqual(calculateManualBacktestTradeResult("", "1.2000", "buy", "EUR/USD"), {
  result: "breakeven",
  pips: "0",
});

// Non-FX-major instruments must use their own pip size, not x10000.
// USD/JPY 150.00 -> 150.50 = 50 pips (x100), NOT 5000.
assert.deepEqual(calculateManualBacktestTradeResult("150.00", "150.50", "buy", "USD/JPY"), {
  result: "win",
  pips: "50.0",
});
// Gold 2000.0 -> 2001.0 = 10 pips (x10).
assert.deepEqual(calculateManualBacktestTradeResult("2000.0", "2001.0", "buy", "XAU/USD"), {
  result: "win",
  pips: "10.0",
});
// Index US30 39000 -> 39100 = 100 pips (x1).
assert.deepEqual(calculateManualBacktestTradeResult("39000", "39100", "buy", "US30"), {
  result: "win",
  pips: "100.0",
});

console.log("backtest trade result checks passed");
