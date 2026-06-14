import assert from "node:assert/strict";
import type { Candle } from "./candles.js";
import { aggregate, aggregateInterval, bucketStart, mergeTail } from "./aggregate.js";

// 2021-01-04 00:00:00 UTC is a Monday midnight (= 18631 * 86400).
const MONDAY_MIDNIGHT = 1609718400;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;

function m5(index: number, withVolume = true): Candle {
  return {
    time: MONDAY_MIDNIGHT + index * 300,
    open: 100 + index,
    high: 100 + index + 1,
    low: 100 + index - 1,
    close: 100 + index + 0.5,
    ...(withVolume ? { volume: 10 } : {}),
  };
}

// ── 12 × M5 → 1 × H1, OHLCV + bucket time ────────────────────────────────────
{
  const base = Array.from({ length: 12 }, (_, i) => m5(i));
  const [h1, ...rest] = aggregate(base, HOUR);
  assert.equal(rest.length, 0, "12 M5 candles inside one hour collapse to a single H1");
  assert.equal(h1.time, MONDAY_MIDNIGHT, "bucket opens at the hour");
  assert.equal(h1.open, 100, "open = first bar open");
  assert.equal(h1.close, 111.5, "close = last bar close");
  assert.equal(h1.high, 112, "high = max of highs (last bar)");
  assert.equal(h1.low, 99, "low = min of lows (first bar)");
  assert.equal(h1.volume, 120, "volume = sum of bar volumes");
}

// ── Candles spanning two H1 buckets split correctly ──────────────────────────
{
  const base = Array.from({ length: 13 }, (_, i) => m5(i)); // 13th bar starts next hour
  const result = aggregate(base, HOUR);
  assert.equal(result.length, 2, "13th M5 bar opens a second H1 bucket");
  assert.equal(result[1].time, MONDAY_MIDNIGHT + HOUR, "second bucket opens at +1h");
  assert.equal(result[1].open, 112, "second bucket open = 13th bar open");
  assert.equal(result[1].close, 112.5, "second bucket close = 13th bar close");
  assert.equal(result[1].volume, 10, "second bucket has only one bar");
}

// ── Daily bucket aligns to UTC midnight ──────────────────────────────────────
{
  assert.equal(bucketStart(MONDAY_MIDNIGHT + 50000, DAY), MONDAY_MIDNIGHT, "D1 → UTC midnight");
  assert.equal(
    bucketStart(MONDAY_MIDNIGHT, DAY),
    MONDAY_MIDNIGHT,
    "D1 boundary is inclusive of midnight",
  );
}

// ── Weekly bucket aligns to Monday 00:00 UTC ─────────────────────────────────
{
  assert.equal(
    bucketStart(MONDAY_MIDNIGHT, WEEK),
    MONDAY_MIDNIGHT,
    "Monday midnight maps to itself",
  );
  const wednesdayNoon = MONDAY_MIDNIGHT + 2 * DAY + 43200;
  assert.equal(bucketStart(wednesdayNoon, WEEK), MONDAY_MIDNIGHT, "mid-week maps back to Monday");
  const sundayLate = MONDAY_MIDNIGHT + 6 * DAY + 80000;
  assert.equal(
    bucketStart(sundayLate, WEEK),
    MONDAY_MIDNIGHT,
    "Sunday still belongs to the Monday week",
  );
}

// ── Volume left undefined when no source bar carried volume ───────────────────
{
  const base = Array.from({ length: 3 }, (_, i) => m5(i, false));
  const [h1] = aggregate(base, HOUR);
  assert.equal(h1.volume, undefined, "no source volume → aggregated volume undefined");
}

// ── Edge cases ───────────────────────────────────────────────────────────────
{
  assert.deepEqual(aggregate([], HOUR), [], "empty input → empty output");
  assert.throws(() => aggregate([], 0), /positive number/, "rejects zero interval");
  assert.throws(() => aggregate([], -60), /positive number/, "rejects negative interval");
  assert.throws(() => aggregate([], Number.NaN), /positive number/, "rejects NaN interval");
}

// ── aggregateInterval resolves timeframe names ───────────────────────────────
{
  const base = Array.from({ length: 12 }, (_, i) => m5(i));
  assert.deepEqual(aggregateInterval(base, "H1"), aggregate(base, HOUR), "H1 == 3600s");
  assert.throws(
    () => aggregateInterval(base, "X1"),
    /unknown interval/,
    "rejects unknown timeframe",
  );
}

// ── mergeTail splices the live tail onto the warehouse series ─────────────────
{
  const hourly = (i: number, close: number): Candle => ({
    time: MONDAY_MIDNIGHT + i * HOUR,
    open: 1,
    high: 2,
    low: 0,
    close,
    volume: 1,
  });
  const warehouse = [hourly(0, 10), hourly(1, 11), hourly(2, 12)]; // cutoff = +2h
  const live = [
    hourly(1, 99), // older than cutoff → ignored
    { ...hourly(2, 12.5) }, // == cutoff → live wins
    hourly(3, 13), // newer → appended
  ];
  const merged = mergeTail(warehouse, live);
  assert.equal(merged.length, 4, "one bar replaced, one appended");
  assert.equal(merged[1].close, 11, "pre-cutoff warehouse bar kept (stale live ignored)");
  assert.equal(merged[2].close, 12.5, "cutoff bar replaced by fresher live value");
  assert.equal(merged[3].close, 13, "newer live bar appended");
  assert.deepEqual(
    merged.map((c) => c.time),
    [0, 1, 2, 3].map((i) => MONDAY_MIDNIGHT + i * HOUR),
    "result is ascending and de-duplicated",
  );

  assert.deepEqual(mergeTail([], live), live, "empty warehouse → live as-is");
  assert.deepEqual(mergeTail(warehouse, []), warehouse, "empty live → warehouse as-is");
}

console.log("aggregate.test.ts: all assertions passed");
