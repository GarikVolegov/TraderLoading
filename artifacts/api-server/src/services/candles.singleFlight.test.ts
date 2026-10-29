import assert from "node:assert/strict";
import { getCandles } from "./candles.js";

const originalFetch = globalThis.fetch;
let fetchCount = 0;

try {
  const baseTime = 1_780_000_000;
  const mockCandles = Array.from({ length: 130 }, (_, index) => ({
    time: baseTime + index * 15 * 60,
    open: 1.1 + index * 0.0001,
    high: 1.101 + index * 0.0001,
    low: 1.099 + index * 0.0001,
    close: 1.1005 + index * 0.0001,
    volume: 100 + index,
  }));

  globalThis.fetch = (async () => {
    fetchCount++;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return Response.json({
      chart: {
        result: [
          {
            timestamp: mockCandles.map((c) => c.time),
            indicators: {
              quote: [
                {
                  open: mockCandles.map((c) => c.open),
                  high: mockCandles.map((c) => c.high),
                  low: mockCandles.map((c) => c.low),
                  close: mockCandles.map((c) => c.close),
                  volume: mockCandles.map((c) => c.volume),
                },
              ],
            },
          },
        ],
      },
    });
  }) as typeof fetch;

  // Verify that concurrent requests do not fail and resolve consistently
  const [r1, r2, r3] = await Promise.all([
    getCandles("EURUSD", "M15"),
    getCandles("EURUSD", "M15"),
    getCandles("EURUSD", "M15"),
  ]);

  assert.equal(r1.symbol, "EURUSD");
  assert.equal(r2.symbol, "EURUSD");
  assert.equal(r3.symbol, "EURUSD");
  assert.equal(r1.candles.length, r2.candles.length);
  assert.equal(r2.candles.length, r3.candles.length);
  assert.equal(fetchCount, 1, "SingleFlight must deduplicate concurrent requests to exactly 1 upstream fetch");

  console.log("candles singleFlight concurrency tests passed");
} finally {
  globalThis.fetch = originalFetch;
}
