import assert from "node:assert/strict";
import { createReplayCandlesUrl } from "./replayCandlesApi.js";

assert.equal(
  createReplayCandlesUrl({ symbol: "EUR/USD", interval: "H1" }, { baseUrl: "https://api.example.test" }),
  "https://api.example.test/api/backtest/candles?symbol=EURUSD&interval=H1",
);

console.log("chart replay candles api checks passed");
