import assert from "node:assert/strict";
import {
  clampCursor,
  cursorFraction,
  cursorFromFraction,
  MIN_REVEALED_BARS,
  seekCursorToTime,
  stepCursor,
} from "./replayCursor";
import type { ReplayCandle } from "./types";

function bars(count: number, start = 1_000, step = 60): ReplayCandle[] {
  return Array.from({ length: count }, (_, i) => ({
    time: start + i * step,
    open: 1,
    high: 2,
    low: 0.5,
    close: 1.5,
  }));
}

// clampCursor keeps the cursor inside [minIndex, length-1]
assert.equal(clampCursor(5, 100, 10), 10);
assert.equal(clampCursor(150, 100, 10), 99);
assert.equal(clampCursor(42, 100, 10), 42);
assert.equal(clampCursor(0, 0, 10), 0, "empty series pins to 0");

// stepCursor moves and clamps
assert.equal(stepCursor(50, 1, 100, 10), 51);
assert.equal(stepCursor(50, -1, 100, 10), 49);
assert.equal(stepCursor(99, 1, 100, 10), 99, "cannot step past the last bar");
assert.equal(stepCursor(10, -5, 100, 10), 10, "cannot step before minIndex");

// scrubber mapping is a bijection over [minIndex, length-1]
assert.equal(cursorFraction(10, 100, 10), 0);
assert.equal(cursorFraction(99, 100, 10), 1);
assert.equal(cursorFromFraction(0, 100, 10), 10);
assert.equal(cursorFromFraction(1, 100, 10), 99);
assert.equal(cursorFromFraction(0.5, 100, 10), Math.round(10 + 0.5 * 89));
assert.equal(cursorFromFraction(-0.5, 100, 10), 10, "fraction clamped low");
assert.equal(cursorFromFraction(1.5, 100, 10), 99, "fraction clamped high");
// degenerate single-bar window
assert.equal(cursorFraction(10, 11, 10), 1);

// seekCursorToTime: first bar at/after the target, clamped to bounds
const series = bars(100);
assert.equal(seekCursorToTime(series, 1_000, 10), 10, "target before window start clamps to minIndex");
assert.equal(seekCursorToTime(series, 1_000 + 50 * 60, 10), 50);
assert.equal(seekCursorToTime(series, 1_000 + 50 * 60 + 1, 10), 51, "between bars → next bar");
assert.equal(seekCursorToTime(series, 999_999, 10), 99, "target after the end clamps to last bar");
assert.equal(seekCursorToTime([], 123, 10), 0);

// default minimum reveal matches the mockup's warm-up window
assert.ok(MIN_REVEALED_BARS >= 10);

console.log("replayCursor checks passed");
