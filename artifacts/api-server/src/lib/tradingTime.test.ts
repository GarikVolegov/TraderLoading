import assert from "node:assert/strict";
import { tradingDay, tradingHour, tradingDayOfWeek } from "./tradingTime.js";

// Europe/Rome bucketing: a late-UTC timestamp belongs to the NEXT Rome day, so
// the coach, discipline and risk guard all agree on "which day" a trade is in.
// 2026-06-01T23:30Z is 2026-06-02 01:30 in Rome (CEST, +2).
assert.equal(tradingDay(new Date("2026-06-01T23:30:00Z")), "2026-06-02");
// Winter (CET, +1): 2026-01-15T23:30Z is 2026-01-16 00:30 Rome.
assert.equal(tradingDay(new Date("2026-01-15T23:30:00Z")), "2026-01-16");
// Same day when the offset doesn't cross midnight.
assert.equal(tradingDay(new Date("2026-06-01T09:00:00Z")), "2026-06-01");

// Hour in Rome time (09:00Z = 11:00 CEST).
assert.equal(tradingHour(new Date("2026-06-01T09:00:00Z")), 11);
// Midnight Rome (2026-06-01T22:00Z = 00:00 CEST next day).
assert.equal(tradingHour(new Date("2026-06-01T22:00:00Z")), 0);

// Day of week 0-6 (Sun-Sat), Rome. 2026-06-01 is Monday; 23:30Z rolls to Tuesday.
assert.equal(tradingDayOfWeek(new Date("2026-06-01T09:00:00Z")), 1);
assert.equal(tradingDayOfWeek(new Date("2026-06-01T23:30:00Z")), 2);

// Invalid dates → null.
assert.equal(tradingDay(new Date("nope")), null);
assert.equal(tradingHour(new Date("nope")), null);
assert.equal(tradingDayOfWeek(new Date("nope")), null);

console.log("tradingTime.test.ts: all assertions passed");
