// ─── Replay paging + M1 + meta (candle service) ─────────────────────────────
// Covers the backtest-terminal extensions: M1 as a servable interval, cursor
// paging (from/to/limit + nextFrom) shared by warehouse and live paths, the
// pure warehouse window resolver, and the availability meta used by the UI.
import assert from "node:assert/strict";
import {
  getCandles,
  getCandlesMeta,
  paginateCandles,
  resolveWarehouseWindow,
  type Candle,
} from "./candles.js";

const M15 = 900;

function makeCandles(count: number, baseTime: number, step: number): Candle[] {
  return Array.from({ length: count }, (_, index) => ({
    time: baseTime + index * step,
    open: 1.1,
    high: 1.101,
    low: 1.099,
    close: 1.1005,
    volume: 100,
  }));
}

// ── paginateCandles (pure) ───────────────────────────────────────────────────
{
  const candles = makeCandles(130, 1_780_000_000, M15);

  // from filter is inclusive, keeps everything after the anchor
  const fromOnly = paginateCandles(candles, { from: candles[10].time }, M15);
  assert.equal(fromOnly.candles.length, 120);
  assert.equal(fromOnly.candles[0].time, candles[10].time);
  assert.equal(fromOnly.nextFrom, undefined);

  // limit caps the page and exposes the next cursor
  const limited = paginateCandles(candles, { from: candles[10].time, limit: 50 }, M15);
  assert.equal(limited.candles.length, 50);
  assert.equal(limited.nextFrom, candles[59].time + M15);

  // to bound is exclusive
  const bounded = paginateCandles(candles, { from: candles[0].time, to: candles[3].time }, M15);
  assert.equal(bounded.candles.length, 3);
  assert.equal(bounded.nextFrom, undefined);

  // an exactly-full unbounded page still advertises a next cursor
  const exact = paginateCandles(candles, { limit: 130 }, M15);
  assert.equal(exact.candles.length, 130);
  assert.equal(exact.nextFrom, candles[129].time + M15);

  // limit is clamped to the 5000-bar ceiling and to at least 1
  const wide = paginateCandles(candles, { limit: 999_999 }, M15);
  assert.equal(wide.candles.length, 130);
  assert.equal(wide.nextFrom, undefined);
  const floor = paginateCandles(candles, { limit: 0 }, M15);
  assert.equal(floor.candles.length, 1);

  // beyond the end of history: empty page, no cursor, no throw
  const past = paginateCandles(candles, { from: candles[129].time + M15 }, M15);
  assert.equal(past.candles.length, 0);
  assert.equal(past.nextFrom, undefined);
}

// ── resolveWarehouseWindow (pure) ────────────────────────────────────────────
{
  const now = 1_800_000_000;

  const latest = resolveWarehouseWindow({}, M15, now);
  assert.deepEqual(latest, {
    fromTs: now - 5000 * M15 * 3,
    toTs: now,
    limit: 5000,
    fromStart: false,
  });

  const deep = resolveWarehouseWindow({ startDate: "2024-01-10" }, M15, now);
  const dayStart = Math.floor(Date.UTC(2024, 0, 10) / 1000);
  assert.deepEqual(deep, {
    fromTs: dayStart,
    toTs: Math.min(now, dayStart + 5000 * M15 * 3),
    limit: 5000,
    fromStart: true,
  });

  const paged = resolveWarehouseWindow({ from: 1_790_000_000, limit: 200 }, M15, now);
  assert.deepEqual(paged, {
    fromTs: 1_790_000_000,
    toTs: Math.min(now, 1_790_000_000 + 200 * M15 * 3),
    limit: 200,
    fromStart: true,
  });

  const window = resolveWarehouseWindow({ from: 1_790_000_000, to: 1_790_010_000 }, M15, now);
  assert.deepEqual(window, {
    fromTs: 1_790_000_000,
    toTs: 1_790_010_000,
    limit: 5000,
    fromStart: true,
  });

  // `to` in the future is clamped to now
  const clamped = resolveWarehouseWindow({ from: 1_790_000_000, to: now + 999 }, M15, now);
  assert.equal(clamped.toTs, now);
}

// ── getCandles: M1 chain + paging on the live path ───────────────────────────
const originalFetch = globalThis.fetch;
const originalTwelveDataApiKey = process.env.TWELVEDATA_API_KEY;
const originalWarehouseFlag = process.env.CANDLE_WAREHOUSE;

try {
  delete process.env.CANDLE_WAREHOUSE;
  process.env.TWELVEDATA_API_KEY = "td_live_key";
  const calls: string[] = [];
  const baseTime = 1_780_000_000;
  const yahooCandles = makeCandles(130, baseTime, M15);

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

    return Response.json({
      chart: {
        result: [
          {
            timestamp: yahooCandles.map((c) => c.time),
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

  // M1 is a servable interval: TwelveData leads (intraday+key), Yahoo follows
  const m1 = await getCandles("EURUSD", "M1");
  assert.equal(m1.source, "yahoo");
  assert.equal(m1.candles.length, 130);
  assert.match(calls[0] ?? "", /twelvedata\.com/);
  assert.match(calls[0] ?? "", /interval=1min/);
  assert.match(calls[1] ?? "", /query1\.finance\.yahoo\.com/);
  assert.match(calls[1] ?? "", /interval=1m&/);
  assert.match(calls[1] ?? "", /range=5d/);

  // cursor paging on the live path: filter + limit + nextFrom
  calls.length = 0;
  const page = await getCandles("EURJPY", "M15", { from: baseTime + 10 * M15, limit: 50 });
  assert.equal(page.candles.length, 50);
  assert.equal(page.candles[0].time, baseTime + 10 * M15);
  assert.equal(page.nextFrom, baseTime + 60 * M15);
  // the source fetch is anchored to the day of `from`
  assert.match(calls.find((call) => call.includes("yahoo")) ?? "", /period1=/);

  // continuation past the end of history: empty page, no error, no cursor
  const tail = await getCandles("GBPJPY", "M15", { from: baseTime + 500 * M15 });
  assert.equal(tail.candles.length, 0);
  assert.equal(tail.nextFrom, undefined);

  // initial loads (no `from`) keep the minimum-candles guard
  globalThis.fetch = (async () => Response.json({
    chart: {
      result: [
        {
          timestamp: [baseTime],
          indicators: {
            quote: [
              { open: [1.1], high: [1.101], low: [1.099], close: [1.1005], volume: [100] },
            ],
          },
        },
      ],
    },
  })) as typeof fetch;
  delete process.env.TWELVEDATA_API_KEY;
  await assert.rejects(getCandles("AUDJPY", "M1"), /Servono almeno 120 candele/);
} finally {
  globalThis.fetch = originalFetch;
  if (originalTwelveDataApiKey == null) delete process.env.TWELVEDATA_API_KEY;
  else process.env.TWELVEDATA_API_KEY = originalTwelveDataApiKey;
  if (originalWarehouseFlag == null) delete process.env.CANDLE_WAREHOUSE;
  else process.env.CANDLE_WAREHOUSE = originalWarehouseFlag;
}

// ── getCandlesMeta ───────────────────────────────────────────────────────────
try {
  process.env.CANDLE_WAREHOUSE = "1";

  const seen: Array<{ sid: number; res: number }> = [];
  const meta = await getCandlesMeta("EURUSD", {
    loadWatermark: async (sid, res) => {
      seen.push({ sid, res });
      return { firstTs: 1_600_000_000, lastTs: 1_799_000_000 };
    },
  });
  assert.deepEqual(meta, {
    symbol: "EURUSD",
    warehouseEnabled: true,
    warehouse: { firstTs: 1_600_000_000, lastTs: 1_799_000_000 },
  });
  assert.deepEqual(seen, [{ sid: 1, res: 1 }]);

  // never ingested → warehouse null
  const empty = await getCandlesMeta("GBPUSD", { loadWatermark: async () => null });
  assert.deepEqual(empty, { symbol: "GBPUSD", warehouseEnabled: true, warehouse: null });

  // symbol outside the warehouse registry → warehouse null, loader not called
  const outside = await getCandlesMeta("USDMXN", {
    loadWatermark: async () => {
      throw new Error("should not be called");
    },
  });
  assert.deepEqual(outside, { symbol: "USDMXN", warehouseEnabled: true, warehouse: null });

  // flag off → warehouse null, loader not called
  delete process.env.CANDLE_WAREHOUSE;
  const off = await getCandlesMeta("EURUSD", {
    loadWatermark: async () => {
      throw new Error("should not be called");
    },
  });
  assert.deepEqual(off, { symbol: "EURUSD", warehouseEnabled: false, warehouse: null });
} finally {
  if (originalWarehouseFlag == null) delete process.env.CANDLE_WAREHOUSE;
  else process.env.CANDLE_WAREHOUSE = originalWarehouseFlag;
}

console.log("candles paging/meta checks passed");
