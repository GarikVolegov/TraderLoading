import test from "node:test";
import assert from "node:assert/strict";
import {
  storeOfflineReplaySession,
  getOfflineReplaySession,
  listOfflineReplaySessions,
  deleteOfflineReplaySession,
  clearAllOfflineReplaySessions,
  findMatchingOfflineReplayBuffer,
  getStorageQuotaEstimate,
  requestStoragePersistence,
  exportOfflineSessionJson,
  importOfflineSessionJson,
} from "./replayOfflineBuffer.js";
import { fetchReplayCandles, type ReplayCandleRaw } from "./replayCandlesApi.js";

test("storeOfflineReplaySession stores session and computes metrics", async () => {
  await clearAllOfflineReplaySessions();

  const mockCandles: ReplayCandleRaw[] = [
    { time: 1729800000, open: 1.085, high: 1.087, low: 1.084, close: 1.086, volume: 100 },
    { time: 1729800900, open: 1.086, high: 1.089, low: 1.0855, close: 1.088, volume: 150 },
    { time: 1729801800, open: 1.088, high: 1.091, low: 1.0875, close: 1.0905, volume: 200 },
  ];

  const session = await storeOfflineReplaySession({
    id: "test-eurusd-m15",
    name: "EURUSD M15 NFP Breakout",
    symbol: "EURUSD",
    interval: "M15",
    mode: "replay",
    candles: mockCandles,
    from: 1729800000,
    to: 1729801800,
  });

  assert.strictEqual(session.id, "test-eurusd-m15");
  assert.strictEqual(session.symbol, "EURUSD");
  assert.strictEqual(session.interval, "M15");
  assert.strictEqual(session.barCount, 3);
  assert.ok(session.sizeBytes > 0);
  assert.strictEqual(session.source, "offline_buffer");

  const retrieved = await getOfflineReplaySession("test-eurusd-m15");
  assert.ok(retrieved);
  assert.strictEqual(retrieved?.name, "EURUSD M15 NFP Breakout");
  assert.strictEqual(retrieved?.candles.length, 3);
});

test("listOfflineReplaySessions lists all stored sessions", async () => {
  const list = await listOfflineReplaySessions();
  assert.ok(list.length >= 1);
  assert.strictEqual(list[0].id, "test-eurusd-m15");
});

test("findMatchingOfflineReplayBuffer slices matching candles", async () => {
  const match = await findMatchingOfflineReplayBuffer({
    symbol: "EUR/USD",
    interval: "M15",
    mode: "replay",
    from: 1729800900,
  });

  assert.ok(match);
  assert.strictEqual(match?.source, "offline_buffer");
  assert.strictEqual(match?.candles.length, 2);
  assert.strictEqual(match?.candles[0].time, 1729800900);
});

test("fetchReplayCandles failover: returns offline buffer when fetch fails", async () => {
  // Una richiesta verso un URL che fallisce (es. porta inesistente o offline)
  const failoverResult = await fetchReplayCandles(
    {
      symbol: "EURUSD",
      interval: "M15",
      mode: "replay",
      from: 1729800000,
      to: 1729801800,
    },
    { baseUrl: "http://127.0.0.1:59999", skipCache: true },
  );

  assert.ok(failoverResult);
  assert.strictEqual(failoverResult.source, "offline_buffer");
  assert.strictEqual(failoverResult.candles.length, 3);
  assert.strictEqual(failoverResult.candles[0].open, 1.085);
});

test("deleteOfflineReplaySession and clearAllOfflineReplaySessions cleans store", async () => {
  const deleted = await deleteOfflineReplaySession("test-eurusd-m15");
  assert.strictEqual(deleted, true);

  const afterDelete = await getOfflineReplaySession("test-eurusd-m15");
  assert.strictEqual(afterDelete, null);

  await clearAllOfflineReplaySessions();
  const list = await listOfflineReplaySessions();
  assert.strictEqual(list.length, 0);
});

test("exportOfflineSessionJson and importOfflineSessionJson roundtrip", async () => {
  const sampleCandles: ReplayCandleRaw[] = [
    { time: 1704067200, open: 2060, high: 2065, low: 2058, close: 2063, volume: 50 },
    { time: 1704067260, open: 2063, high: 2068, low: 2062, close: 2067, volume: 80 },
  ];

  const session = await storeOfflineReplaySession({
    id: "gold-m1-export-test",
    name: "XAUUSD M1 Test Pack",
    symbol: "XAUUSD",
    interval: "M1",
    mode: "replay",
    candles: sampleCandles,
    from: 1704067200,
    to: 1704067260,
  });

  const jsonStr = exportOfflineSessionJson(session);
  assert.ok(jsonStr.includes("gold-m1-export-test"));
  assert.ok(jsonStr.includes("XAUUSD"));

  const imported = await importOfflineSessionJson(jsonStr);
  assert.strictEqual(imported.id, "gold-m1-export-test");
  assert.strictEqual(imported.symbol, "XAUUSD");
  assert.strictEqual(imported.barCount, 2);

  const quota = await getStorageQuotaEstimate();
  assert.ok(quota.usedBytes > 0);

  const persistence = await requestStoragePersistence();
  assert.strictEqual(typeof persistence, "boolean");

  await deleteOfflineReplaySession("gold-m1-export-test");
});
