import assert from "node:assert/strict";
import { toHeikinAshi } from "./heikinAshi";
import type { ReplayCandle } from "./types";

const candles: ReplayCandle[] = [
  { time: 0, open: 10, high: 12, low: 9, close: 11, volume: 100 },
  { time: 60, open: 11, high: 13, low: 10.5, close: 12.5, volume: 120 },
  { time: 120, open: 12.5, high: 12.6, low: 11, close: 11.2, volume: 80 },
];

const ha = toHeikinAshi(candles);

// same length, times and volumes preserved
assert.equal(ha.length, 3);
assert.deepEqual(ha.map((c) => c.time), [0, 60, 120]);
assert.deepEqual(ha.map((c) => c.volume), [100, 120, 80]);

// first bar: haClose = (o+h+l+c)/4, haOpen = (o+c)/2
assert.equal(ha[0].close, (10 + 12 + 9 + 11) / 4);
assert.equal(ha[0].open, (10 + 11) / 2);
assert.equal(ha[0].high, Math.max(12, ha[0].open, ha[0].close));
assert.equal(ha[0].low, Math.min(9, ha[0].open, ha[0].close));

// second bar chains off the previous HA bar
assert.equal(ha[1].open, (ha[0].open + ha[0].close) / 2);
assert.equal(ha[1].close, (11 + 13 + 10.5 + 12.5) / 4);
assert.equal(ha[1].high, Math.max(13, ha[1].open, ha[1].close));
assert.equal(ha[1].low, Math.min(10.5, ha[1].open, ha[1].close));

// third bar too
assert.equal(ha[2].open, (ha[1].open + ha[1].close) / 2);

// input is not mutated
assert.equal(candles[0].open, 10);

// empty input
assert.deepEqual(toHeikinAshi([]), []);

console.log("heikinAshi checks passed");
