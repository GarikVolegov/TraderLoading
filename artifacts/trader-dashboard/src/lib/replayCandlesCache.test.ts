import assert from "node:assert/strict";
import {
  buildCandleCacheKey,
  isCacheableReplayRequest,
  getReplayCandlesFromCache,
  saveReplayCandlesToCache,
  clearReplayCandleCache,
  packCandleArray,
  unpackCandleArray,
} from "./replayCandlesCache";
import { fetchReplayCandles, type ReplayCandlesRequest, type ReplayCandlesResponse } from "./replayCandlesApi";

// 1. Verifica serializzazione e decompressione compatta delle candele
const rawSample = [
  { time: 1000, open: 1.05, high: 1.08, low: 1.04, close: 1.07, volume: 50 },
  { time: 1060, open: 1.07, high: 1.09, low: 1.06, close: 1.08, volume: 65 },
];
const packedSample = packCandleArray(rawSample);
assert.deepEqual(packedSample, [
  [1000, 1.05, 1.08, 1.04, 1.07, 50],
  [1060, 1.07, 1.09, 1.06, 1.08, 65],
], "Le tuple packed devono corrispondere esattamente a [time, open, high, low, close, volume]");
const unpackedSample = unpackCandleArray(packedSample);
assert.deepEqual(unpackedSample, rawSample, "La decompressione deve preservare fedelmente le candele grezze");

// 2. Verifica generazione chiave normalizzata
const key1 = buildCandleCacheKey({ symbol: "EUR/USD", interval: "m1", mode: "replay", from: 100, to: 200 });
const key2 = buildCandleCacheKey({ symbol: "EURUSD", interval: "M1", mode: "replay", from: 100, to: 200 });
assert.equal(key1, key2, "La chiave di cache deve essere normalizzata e indipendente da '/' e dal casing");

// 2. Verifica idoneità cache
assert.ok(isCacheableReplayRequest({ symbol: "XAUUSD", interval: "M1", mode: "replay" }));
assert.ok(isCacheableReplayRequest({ symbol: "XAUUSD", interval: "M1", from: 100, to: 200 }));
assert.ok(isCacheableReplayRequest({ symbol: "XAUUSD", interval: "D1", startDate: "2024-01-01" }));
assert.equal(isCacheableReplayRequest({ symbol: "XAUUSD", interval: "M1" }), false, "Le richieste generiche senza mode o range fisso non sono cacheabili");

// Pulisci prima dei test
await clearReplayCandleCache();

// 3. Test get su cache vuota
const req: ReplayCandlesRequest = {
  symbol: "BTCUSD",
  interval: "M5",
  mode: "replay",
  from: 1000,
  to: 2000,
};

const emptyResult = await getReplayCandlesFromCache(req);
assert.equal(emptyResult, null, "Cache miss deve ritornare null");

// 4. Test put e get su cache
const mockResponse: ReplayCandlesResponse = {
  candles: [
    { time: 1000, open: 50000, high: 50100, low: 49900, close: 50050, volume: 10 },
    { time: 1300, open: 50050, high: 50200, low: 50000, close: 50150, volume: 12 },
  ],
  availableTo: 2000,
  source: "test-cache",
};

await saveReplayCandlesToCache(req, mockResponse);

const cachedResult = await getReplayCandlesFromCache(req);
assert.ok(cachedResult, "Dovrebbe ritornare i dati presenti in cache");
assert.equal(cachedResult.candles.length, 2);
assert.equal(cachedResult.candles[0].close, 50050);
assert.equal(cachedResult.availableTo, 2000);

// 5. Test clear cache
await clearReplayCandleCache();
const afterClear = await getReplayCandlesFromCache(req);
assert.equal(afterClear, null, "Dopo clearReplayCandleCache i dati devono essere azzerati");

// 6. Test integrazione con fetchReplayCandles
const originalFetch = globalThis.fetch;
let fetchCount = 0;

try {
  globalThis.fetch = (async () => {
    fetchCount++;
    return Response.json({
      candles: [{ time: 500, open: 1.1, high: 1.2, low: 1.0, close: 1.15 }],
      availableTo: 600,
    });
  }) as typeof fetch;

  const replayReq: ReplayCandlesRequest = {
    symbol: "GBPUSD",
    interval: "H1",
    mode: "replay",
    from: 500,
    to: 600,
  };

  await clearReplayCandleCache();
  fetchCount = 0;

  // Prima chiamata: deve chiamare fetch (cache miss)
  const firstRes = await fetchReplayCandles(replayReq, { baseUrl: "https://api.test" });
  assert.equal(fetchCount, 1, "La prima chiamata deve effettuare il fetch di rete");
  assert.equal(firstRes.candles[0].close, 1.15);

  // Seconda chiamata con gli stessi parametri: deve usare la cache (fetchCount non deve aumentare)
  const secondRes = await fetchReplayCandles(replayReq, { baseUrl: "https://api.test" });
  assert.equal(fetchCount, 1, "La seconda chiamata deve essere servita dalla cache locale senza chiamare fetch");
  assert.equal(secondRes.candles[0].close, 1.15);

  // Terza chiamata con skipCache: true deve bypassare la cache
  const thirdRes = await fetchReplayCandles(replayReq, { baseUrl: "https://api.test", skipCache: true });
  assert.equal(fetchCount, 2, "Con skipCache: true deve forzare la chiamata di rete");
  assert.equal(thirdRes.candles[0].close, 1.15);
} finally {
  globalThis.fetch = originalFetch;
  await clearReplayCandleCache();
}

console.log("replay candles cache tests passed successfully");
