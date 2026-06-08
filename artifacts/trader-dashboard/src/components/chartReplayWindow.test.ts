import assert from "node:assert/strict";
import type { Time } from "lightweight-charts";
import {
  DEFAULT_REPLAY_VISIBLE_CANDLES,
  getReplayIntervalSeconds,
  applyFormingCandleForAnchor,
  resolveReplayPointCloseTime,
  resolveReplayStartIndex,
  resolveReplayWindowForAnchor,
  resolveReplayWindowForCloseAnchor,
} from "./chartReplayWindow.js";

const day = 24 * 60 * 60;
const base = Date.UTC(2026, 0, 1) / 1000;
const candles = Array.from({ length: 200 }, (_, index) => ({ time: (base + index * day) as Time }));

assert.equal(DEFAULT_REPLAY_VISIBLE_CANDLES, 120);
assert.equal(resolveReplayStartIndex(candles, "", DEFAULT_REPLAY_VISIBLE_CANDLES), 0);
assert.equal(resolveReplayStartIndex(candles, "2026-01-11", DEFAULT_REPLAY_VISIBLE_CANDLES), 10);
assert.equal(resolveReplayStartIndex(candles, "2026-06-30", DEFAULT_REPLAY_VISIBLE_CANDLES), 80);
assert.equal(resolveReplayStartIndex(candles, "2027-01-01", DEFAULT_REPLAY_VISIBLE_CANDLES), 80);
assert.equal(resolveReplayStartIndex(candles.slice(0, 20), "2026-01-11", DEFAULT_REPLAY_VISIBLE_CANDLES), 0);

const anchored = resolveReplayWindowForAnchor(candles, base + 150 * day, DEFAULT_REPLAY_VISIBLE_CANDLES);
assert.equal(anchored.revealedCount, DEFAULT_REPLAY_VISIBLE_CANDLES);
assert.equal(anchored.startIndex, 31);

const anchoredBeforeData = resolveReplayWindowForAnchor(candles, base - 10 * day, DEFAULT_REPLAY_VISIBLE_CANDLES);
assert.equal(anchoredBeforeData.startIndex, 0);

const shortAnchored = resolveReplayWindowForAnchor(candles.slice(0, 20), base + 15 * day, DEFAULT_REPLAY_VISIBLE_CANDLES);
assert.equal(shortAnchored.startIndex, 0);
assert.equal(shortAnchored.revealedCount, 20);

assert.equal(getReplayIntervalSeconds("M15"), 15 * 60);
assert.equal(getReplayIntervalSeconds("H1"), 60 * 60);
assert.equal(getReplayIntervalSeconds("D1"), 24 * 60 * 60);

const quarterHour = 15 * 60;
const h1OpenTime = base + 30 * 60 * 60;
const h1CloseAnchor = h1OpenTime + getReplayIntervalSeconds("H1");
const m15Candles = Array.from({ length: 160 }, (_, index) => ({ time: (base + index * quarterHour) as Time }));
const h1ToM15 = resolveReplayWindowForCloseAnchor(m15Candles, h1CloseAnchor, "M15", 20);
assert.equal(m15Candles[h1ToM15.startIndex + h1ToM15.revealedCount - 1].time, h1OpenTime + 45 * 60);

const progressedH1ToM15 = resolveReplayWindowForCloseAnchor(
  m15Candles,
  h1CloseAnchor,
  "M15",
  DEFAULT_REPLAY_VISIBLE_CANDLES + 40,
);
assert.equal(progressedH1ToM15.revealedCount, DEFAULT_REPLAY_VISIBLE_CANDLES);

const m15CloseAnchor = h1OpenTime + 45 * 60 + getReplayIntervalSeconds("M15");
const h1Candles = Array.from({ length: 60 }, (_, index) => ({ time: (base + index * 60 * 60) as Time }));
const m15ToH1 = resolveReplayWindowForCloseAnchor(h1Candles, m15CloseAnchor, "H1", 20);
assert.equal(h1Candles[m15ToH1.startIndex + m15ToH1.revealedCount - 1].time, h1OpenTime);
assert.equal(resolveReplayPointCloseTime(m15Candles[42], "M15"), (m15Candles[42].time as number) + quarterHour);

const preservedM15Point = m15CloseAnchor;
const h4Candles = Array.from({ length: 30 }, (_, index) => ({ time: (base + index * 4 * 60 * 60) as Time }));
const h1ToH4 = resolveReplayWindowForCloseAnchor(h4Candles, preservedM15Point, "H4", 20);
const h4AnchorCandle = h4Candles[h1ToH4.startIndex + h1ToH4.revealedCount - 1];
assert.ok((h4AnchorCandle.time as number) < preservedM15Point);
assert.ok(((h4AnchorCandle.time as number) + getReplayIntervalSeconds("H4")) >= preservedM15Point);

const completeH1Candles = Array.from({ length: 60 }, (_, index) => ({
  time: (base + index * 60 * 60) as Time,
  open: 1,
  high: 1.8,
  low: 0.7,
  close: 1.5,
}));
const forming = applyFormingCandleForAnchor(completeH1Candles, m15CloseAnchor, "H1", 1.23);
const formingCandle = forming[30];
assert.equal(formingCandle.close, 1.23);
assert.equal(formingCandle.high, 1.23);
assert.equal(formingCandle.low, 1);
assert.equal(completeH1Candles[30].close, 1.5);

console.log("chart replay window checks passed");
