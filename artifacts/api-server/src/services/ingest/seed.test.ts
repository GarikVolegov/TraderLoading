import assert from "node:assert/strict";
import { seedSymbol } from "./seed.js";
import type { CandleSource } from "./types.js";

const records: { status: string; candleCount?: number }[] = [];
let writes = 0;
let watermarks = 0;
let verified = false;
const deps = {
  ensurePartitions: async () => {},
  isRangeVerified: async () => verified,
  recordImportChunk: async (row: { status: string; candleCount?: number }) => {
    records.push(row);
  },
  updateIngestionState: async () => {
    watermarks++;
  },
  upsertCandles: async (_sid: number, _res: number, _source: number, rows: unknown[]) => {
    writes++;
    return rows.length;
  },
  retry: async <T>(fn: () => Promise<T>): Promise<T> => fn(),
};
const candle = { time: 120, open: 1, high: 2, low: 0.5, close: 1.5 };
let values = [candle];
const source: CandleSource = {
  id: 1,
  name: "dukascopy",
  supports: (symbol) => symbol === "EURUSD",
  async fetchRange() {
    return values;
  },
};
const result = await seedSymbol("EURUSD", 60, 180, source, { resume: true }, deps);
assert.equal(result.written, 1);
assert.deepEqual(
  records.map((r) => r.status),
  ["running", "verified"],
);
assert.equal(records[1].candleCount, 1);
assert.equal(writes, 1);
assert.equal(watermarks, 1);
verified = true;
const skipped = await seedSymbol("EURUSD", 60, 180, source, { resume: true }, deps);
assert.equal(skipped.skipped, true);
assert.equal(writes, 1);
verified = false;
values = [];
await assert.rejects(seedSymbol("EURUSD", 60, 180, source, {}, deps), /no M1 candles/);
assert.equal(records[records.length - 1].status, "failed");
assert.equal(watermarks, 1); // no empty-success watermark / certified month
values = [{ ...candle, high: 0.9 }];
await assert.rejects(seedSymbol("EURUSD", 60, 180, source, {}, deps), /Invalid/);
assert.equal(writes, 1);
assert.equal(records[records.length - 1].status, "failed");
const outage = {
  ...source,
  async fetchRange() {
    throw new Error("Dukascopy HTTP 429");
  },
};
await assert.rejects(seedSymbol("EURUSD", 60, 180, outage, {}, deps), /HTTP 429/);
assert.equal(records[records.length - 1].status, "failed");
console.log("resumable seed ledger checks passed");
