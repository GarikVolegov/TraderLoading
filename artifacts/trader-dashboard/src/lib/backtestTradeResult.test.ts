import assert from "node:assert/strict";
import { calculateManualBacktestTradeResult } from "./backtestTradeResult.js";

assert.deepEqual(calculateManualBacktestTradeResult("1.1000", "1.1055", "buy"), {
  result: "win",
  pips: "55.0",
});

assert.deepEqual(calculateManualBacktestTradeResult("1.1000", "1.0950", "buy"), {
  result: "loss",
  pips: "-50.0",
});

assert.deepEqual(calculateManualBacktestTradeResult("1.2000", "1.1950", "sell"), {
  result: "win",
  pips: "50.0",
});

assert.deepEqual(calculateManualBacktestTradeResult("1.2000", "1.2050", "sell"), {
  result: "loss",
  pips: "-50.0",
});

assert.deepEqual(calculateManualBacktestTradeResult("1.2000", "1.2000", "sell"), {
  result: "breakeven",
  pips: "0.0",
});

assert.deepEqual(calculateManualBacktestTradeResult("", "1.2000", "buy"), {
  result: "breakeven",
  pips: "0",
});

console.log("backtest trade result checks passed");
