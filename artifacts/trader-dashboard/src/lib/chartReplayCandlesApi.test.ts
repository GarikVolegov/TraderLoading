import assert from "node:assert/strict";
import { createReplayCandlesUrl } from "./replayCandlesApi.js";

assert.equal(
  createReplayCandlesUrl({ symbol: "EUR/USD", interval: "H1" }, { baseUrl: "https://api.example.test" }),
  "https://api.example.test/api/backtest/candles?symbol=EURUSD&interval=H1",
);

assert.equal(
  createReplayCandlesUrl(
    { symbol: "EUR/USD", interval: "D1", startDate: "2020-01-15" },
    { baseUrl: "https://api.example.test" },
  ),
  "https://api.example.test/api/backtest/candles?symbol=EURUSD&interval=D1&startDate=2020-01-15",
);

console.log("chart replay candles api checks passed");
