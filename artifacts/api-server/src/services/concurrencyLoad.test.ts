import test from "node:test";
import assert from "node:assert/strict";
import { createCotService, type CotReport } from "./cot.js";

test("concurrencyLoad: 50 simultaneous calls to getCotOutlook resolve atomically without collisions", async () => {
  const CONCURRENCY = 50;
  let loaderCalls = 0;

  const mockReport: CotReport = {
    market: "EURO FX - CHICAGO MERCANTILE EXCHANGE",
    currency: "EUR",
    date: new Date().toISOString().slice(0, 10),
    nonCommLong: 100000,
    nonCommShort: 80000,
    commLong: 50000,
    commShort: 60000,
    retailLong: 20000,
    retailShort: 30000,
    nonCommNet: 20000,
    commNet: -10000,
    retailNet: -10000,
    history: [],
    source: "CFTC · Legacy Futures Only",
    fetchedAt: new Date().toISOString(),
    publishedAt: null,
    status: "available",
  };

  const service = createCotService(async () => {
    loaderCalls++;
    await new Promise((r) => setTimeout(r, 20));
    return [mockReport];
  });

  const start = Date.now();
  const promises = Array.from({ length: CONCURRENCY }, () => service());
  const results = await Promise.all(promises);
  const duration = Date.now() - start;

  assert.equal(results.length, CONCURRENCY);
  assert.equal(loaderCalls, 1, "Concurrency loader must execute exactly once for all simultaneous callers");

  for (const res of results) {
    assert.equal(typeof res.status, "string");
    assert.equal(Array.isArray(res.reports), true);
  }

  // All results must be consistent
  const firstReportsCount = results[0].reports.length;
  for (const res of results) {
    assert.equal(res.reports.length, firstReportsCount);
  }

  assert.ok(duration < 2_000, `Concurrency test completed in ${duration}ms`);
});
