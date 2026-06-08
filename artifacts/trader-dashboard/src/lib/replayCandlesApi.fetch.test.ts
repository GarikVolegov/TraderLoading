import assert from "node:assert/strict";
import { fetchReplayCandles } from "./replayCandlesApi.js";

const originalFetch = globalThis.fetch;
let calledUrl: RequestInfo | URL | undefined;
let calledInit: RequestInit | undefined;

try {
  const controller = new AbortController();
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calledUrl = url;
    calledInit = init;
    return Response.json({ candles: [{ time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }] });
  }) as typeof fetch;

  const data = await fetchReplayCandles({ symbol: "XAU/USD", interval: "M15" }, {
    baseUrl: "https://api.example.test",
    signal: controller.signal,
  });

  assert.equal(data.candles[0]?.close, 1.5);
  assert.equal(calledUrl, "https://api.example.test/api/backtest/candles?symbol=XAUUSD&interval=M15");
  assert.equal(calledInit?.signal, controller.signal);

  globalThis.fetch = (async () => new Response("", { status: 503 })) as typeof fetch;
  await assert.rejects(
    fetchReplayCandles({ symbol: "EURUSD", interval: "H4" }, { baseUrl: "https://api.example.test" }),
    /HTTP 503/,
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log("replay candles api fetch checks passed");
