import assert from "node:assert/strict";
import type { Time } from "lightweight-charts";
import {
  getEuropeRomeDayRangeForTime,
  getSessionRangesForTime,
  isTimeInsideRange,
  selectCandlesInRange,
} from "./chartSessionTime.js";

const utc = (iso: string) => Date.parse(iso) / 1000;

const winterDay = getEuropeRomeDayRangeForTime(utc("2026-01-15T12:00:00Z"));
assert.equal(new Date(winterDay.start * 1000).toISOString(), "2026-01-14T23:00:00.000Z");
assert.equal(new Date(winterDay.end * 1000).toISOString(), "2026-01-15T23:00:00.000Z");

const summerDay = getEuropeRomeDayRangeForTime(utc("2026-06-15T12:00:00Z"));
assert.equal(new Date(summerDay.start * 1000).toISOString(), "2026-06-14T22:00:00.000Z");
assert.equal(new Date(summerDay.end * 1000).toISOString(), "2026-06-15T22:00:00.000Z");

const summerSessions = getSessionRangesForTime(utc("2026-06-15T12:00:00Z"));
assert.equal(new Date(summerSessions.asia.start * 1000).toISOString(), "2026-06-14T22:00:00.000Z");
assert.equal(new Date(summerSessions.asia.end * 1000).toISOString(), "2026-06-15T06:00:00.000Z");
assert.equal(new Date(summerSessions.london.start * 1000).toISOString(), "2026-06-15T06:00:00.000Z");
assert.equal(new Date(summerSessions.london.end * 1000).toISOString(), "2026-06-15T15:00:00.000Z");
assert.equal(new Date(summerSessions.newYork.start * 1000).toISOString(), "2026-06-15T12:30:00.000Z");
assert.equal(new Date(summerSessions.newYork.end * 1000).toISOString(), "2026-06-15T21:00:00.000Z");

const dstDay = getEuropeRomeDayRangeForTime(utc("2026-03-29T12:00:00Z"));
assert.equal(new Date(dstDay.start * 1000).toISOString(), "2026-03-28T23:00:00.000Z");
assert.equal(new Date(dstDay.end * 1000).toISOString(), "2026-03-29T22:00:00.000Z");

assert.equal(isTimeInsideRange(utc("2026-06-15T05:59:00Z"), summerSessions.asia), true);
assert.equal(isTimeInsideRange(utc("2026-06-15T06:00:00Z"), summerSessions.asia), false);

const candles = [
  { time: utc("2026-06-14T21:45:00Z") as Time },
  { time: utc("2026-06-14T22:00:00Z") as Time },
  { time: utc("2026-06-15T05:45:00Z") as Time },
  { time: utc("2026-06-15T06:00:00Z") as Time },
];
assert.deepEqual(selectCandlesInRange(candles, summerSessions.asia).map((c) => c.time), [
  candles[1].time,
  candles[2].time,
]);

console.log("chart session time checks passed");
