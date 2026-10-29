import assert from "node:assert/strict";
import { aggregate } from "./aggregate.js";
import { readReplayHistory, ReplayHistoryError } from "./replayHistory.js";
import type { Candle } from "./candles.js";

const day = Date.parse("2024-06-03T00:00:00Z") / 1000;
const base: Candle[] = Array.from({ length: 240 }, (_, i) => ({
  time: day + i * 60,
  open: 100 + i,
  high: 101 + i,
  low: 99 + i,
  close: 100.5 + i,
  volume: 1,
}));
const calls: { source?: number; from: number; to: number }[] = [];
const read = async (
  _sid: number,
  seconds: number,
  from: number,
  to: number,
  options: { limit?: number; fromStart?: boolean; sourceId?: number },
) => {
  calls.push({ source: options.sourceId, from, to });
  const rows = aggregate(
    base.filter((c) => c.time >= from && c.time < to),
    seconds,
  );
  return options.fromStart === false
    ? rows.slice(-(options.limit ?? rows.length))
    : rows.slice(0, options.limit ?? rows.length);
};

const loadBounds = async (_sid: number, _source: number, to: number) => {
  const rows = base.filter((c) => c.time < to);
  return rows.length ? { firstTs: rows[0].time, lastTs: rows[rows.length - 1].time } : null;
};

const cutoff = day + 90 * 60;
const result = await readReplayHistory(
  "USOIL",
  "H1",
  { mode: "replay", anchorTime: cutoff, replayTime: cutoff, warmupBars: 2, limit: 2 },
  { read, loadBounds, now: day + 240 * 60 },
);
assert.equal(result.source, "dukascopy");
assert.equal(result.candles[0].time, day);
assert.equal(result.candles.length, 3); // warm-up + containing/future bars
assert.equal(result.nextFrom, day + 180 * 60);
assert.equal(result.partialCandle?.time, day + 60 * 60);
assert.equal(result.partialCandle?.close, 189.5); // excludes the M1 opening at cutoff
assert.equal(result.partialCandle?.high, 190);
assert.equal(result.partialCandle?.volume, 30);
assert.ok(calls.every((c) => c.source === 1));

const boundary = await readReplayHistory(
  "EURUSD",
  "H1",
  { mode: "replay", anchorTime: day + 120 * 60, replayTime: day + 120 * 60 },
  { read, loadBounds, now: day + 240 * 60 },
);
assert.equal(boundary.partialCandle?.time, day + 60 * 60);
assert.equal(boundary.partialCandle?.volume, 60);
await assert.rejects(
  readReplayHistory(
    "XAUUSD",
    "M1",
    { mode: "replay", anchorTime: day - 10 * 86400 },
    { read, loadBounds, now: day + 240 * 60 },
  ),
  ReplayHistoryError,
);
await assert.rejects(
  readReplayHistory("UNKNOWN", "H1", { mode: "replay" }, { read, loadBounds }),
  ReplayHistoryError,
);
const emptyPage = await readReplayHistory(
  "USOIL",
  "M1",
  { mode: "replay", from: day + 300 * 60 },
  { read, loadBounds, now: day + 400 * 60 },
);
assert.deepEqual(emptyPage.candles, []);
const stale = await readReplayHistory(
  "XAUUSD",
  "M1",
  { mode: "replay", limit: 100 },
  { read, loadBounds, now: day + 500 * 86400 },
);
assert.equal(stale.candles.length, 100);
assert.equal(stale.candles[99].time, base[239].time); // default follows persisted data, not today's empty calendar range
const earlier = await readReplayHistory(
  "XAUUSD",
  "M1",
  { mode: "replay", to: day - 60 },
  { read, loadBounds, now: day + 500 * 86400 },
);
assert.deepEqual(earlier.candles, []);
const end = day + 240 * 60;
const endRestore = await readReplayHistory(
  "USOIL",
  "M1",
  { mode: "replay", anchorTime: end, replayTime: end, warmupBars: 30 },
  { read, loadBounds, now: end + 86400 },
);
assert.equal(endRestore.availableTo, end);
assert.equal(endRestore.candles.length, 30);
assert.equal(endRestore.partialCandle?.time, end - 60);
assert.equal(endRestore.nextFrom, undefined);
const dailyEnd = await readReplayHistory(
  "USOIL",
  "D1",
  { mode: "replay", anchorTime: end, replayTime: end + 86400 },
  { read, loadBounds, now: end + 86400 },
);
assert.equal(dailyEnd.availableTo, end);
assert.equal(dailyEnd.replayTime, end);
assert.equal(dailyEnd.partialCandle?.volume, 240);
await assert.rejects(
  readReplayHistory(
    "USOIL",
    "M1",
    { mode: "replay", anchorTime: end + 60 },
    { read, loadBounds, now: end + 86400 },
  ),
  ReplayHistoryError,
);

// Clamp anchor within 7 days prior to archive bounds (e.g. market open after holiday/weekend)
const holidayBridge = await readReplayHistory(
  "EURUSD",
  "H1",
  { mode: "replay", anchorTime: day - 2 * 86400, replayTime: day - 2 * 86400 },
  { read, loadBounds, now: day + 240 * 60 },
);
assert.ok(holidayBridge.candles.length > 0);
assert.equal(holidayBridge.candles[0].time, day);

console.log("canonical replay history checks passed");
