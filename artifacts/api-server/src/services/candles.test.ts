import assert from "node:assert/strict";
import { getCandles, isTwelveDataEnabled } from "./candles.js";

assert.equal(isTwelveDataEnabled(undefined), false);
assert.equal(isTwelveDataEnabled(""), false);
assert.equal(isTwelveDataEnabled(" demo "), false);
assert.equal(isTwelveDataEnabled("td_live_key"), true);

const originalFetch = globalThis.fetch;
const originalTwelveDataApiKey = process.env.TWELVEDATA_API_KEY;

try {
  process.env.TWELVEDATA_API_KEY = "td_live_key";
  const calls: string[] = [];
  const baseTime = 1_780_000_000;
  const yahooCandles = Array.from({ length: 130 }, (_, index) => ({
    time: baseTime + index * 15 * 60,
    open: 1.1 + index * 0.0001,
    high: 1.101 + index * 0.0001,
    low: 1.099 + index * 0.0001,
    close: 1.1005 + index * 0.0001,
    volume: 100 + index,
  }));

  globalThis.fetch = (async (url: Parameters<typeof fetch>[0]) => {
    const rawUrl = String(url);
    calls.push(rawUrl);

    if (rawUrl.includes("twelvedata.com")) {
      return Response.json({
        status: "ok",
        values: [
          {
            datetime: "2026-06-08 12:00:00",
            open: "1.10000",
            high: "1.10100",
            low: "1.09900",
            close: "1.10050",
          },
        ],
      });
    }

    const intervalSecs = rawUrl.includes("interval=1d") ? 86400 : rawUrl.includes("interval=1h") ? 3600 : rawUrl.includes("interval=5m") ? 300 : 900;
    const timestamps = yahooCandles.map((_, i) => baseTime + i * intervalSecs);

    return Response.json({
      chart: {
        result: [
          {
            timestamp: timestamps,
            indicators: {
              quote: [
                {
                  open: yahooCandles.map((c) => c.open),
                  high: yahooCandles.map((c) => c.high),
                  low: yahooCandles.map((c) => c.low),
                  close: yahooCandles.map((c) => c.close),
                  volume: yahooCandles.map((c) => c.volume),
                },
              ],
            },
          },
        ],
      },
    });
  }) as typeof fetch;

  const result = await getCandles("EURUSD", "M15");

  assert.equal(result.source, "yahoo");
  assert.equal(result.candles.length, 130);
  assert.match(calls[0] ?? "", /twelvedata\.com/);
  assert.match(calls[1] ?? "", /query1\.finance\.yahoo\.com/);

  const retrievedAt = result.fetchedAt;
  assert.ok(retrievedAt);
  calls.length = 0;
  assert.equal((await getCandles("EURUSD", "M15", { maxAgeMs: 60_000 })).fetchedAt, retrievedAt);
  assert.equal(calls.length, 0, "fresh cached response retains original provider timestamp");
  const successfulFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("simulated provider outage"); }) as typeof fetch;
  const stale = await getCandles("EURUSD", "M15", { maxAgeMs: -1 });
  assert.equal(stale.stale, true);
  assert.equal(stale.fetchedAt, retrievedAt, "failed refresh never relabels the old data as new");
  globalThis.fetch = successfulFetch;
  const recovered = await getCandles("EURUSD", "M15", { maxAgeMs: -1 });
  assert.equal(recovered.stale, false, "successful refresh recovers availability");

  calls.length = 0;
  const m5Result = await getCandles("GBPUSD", "M5");
  assert.equal(m5Result.source, "yahoo");
  assert.equal(m5Result.candles.length, 130);
  assert.match(calls[0] ?? "", /twelvedata\.com/);
  assert.match(calls[0] ?? "", /interval=5min/);
  assert.match(calls[1] ?? "", /query1\.finance\.yahoo\.com/);
  assert.match(calls[1] ?? "", /interval=5m/);

  calls.length = 0;
  await getCandles("USDJPY", "H1");
  assert.match(calls[0] ?? "", /query1\.finance\.yahoo\.com/);
  assert.match(calls[0] ?? "", /interval=1h/);
  assert.match(calls[0] ?? "", /range=2y/);

  calls.length = 0;
  await getCandles("EURUSD", "D1", { startDate: "2020-01-15" });
  assert.match(calls[0] ?? "", /query1\.finance\.yahoo\.com/);
  assert.match(calls[0] ?? "", /interval=1d/);
  assert.match(calls[0] ?? "", /period1=1579046400/);
  assert.doesNotMatch(calls[0] ?? "", /range=2y/);

  globalThis.fetch = (async () => Response.json({
    chart: {
      result: [
        {
          timestamp: [baseTime],
          indicators: {
            quote: [
              {
                open: [1.1],
                high: [1.101],
                low: [1.099],
                close: [1.1005],
                volume: [100],
              },
            ],
          },
        },
      ],
    },
  })) as typeof fetch;

  await assert.rejects(
    getCandles("NZDUSD", "H4"),
    /Servono almeno 120 candele/,
  );

  delete process.env.TWELVEDATA_API_KEY;
  globalThis.fetch = (async () => new Response("", { status: 422 })) as typeof fetch;
  await assert.rejects(
    getCandles("XAUUSD", "M15", { startDate: "2025-02-02" }),
    /Storico intraday non disponibile/,
  );
} finally {
  globalThis.fetch = originalFetch;
  if (originalTwelveDataApiKey == null) {
    delete process.env.TWELVEDATA_API_KEY;
  } else {
    process.env.TWELVEDATA_API_KEY = originalTwelveDataApiKey;
  }
}

console.log("candles provider checks passed");
