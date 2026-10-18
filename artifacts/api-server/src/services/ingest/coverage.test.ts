import assert from "node:assert/strict";
import {
  coverageStatus,
  importFailureReason,
  mergeVerifiedRanges,
  missingWeekdays,
  rangeIsVerified,
  validateImportCandles,
} from "./coverage.js";

assert.deepEqual(
  mergeVerifiedRanges([
    { from: 10, to: 20 },
    { from: 0, to: 10 },
    { from: 30, to: 40 },
  ]),
  [
    { from: 0, to: 20 },
    { from: 30, to: 40 },
  ],
);
assert.equal(
  rangeIsVerified(
    [
      { from: 0, to: 10 },
      { from: 11, to: 20 },
    ],
    0,
    20,
  ),
  false,
);
assert.equal(coverageStatus(100, [{ from: 0, to: 20 }], 0, 20, ["2024-06-10"]), "partial");
assert.equal(coverageStatus(100, [{ from: 0, to: 20 }], 0, 20, []), "verified");
assert.equal(coverageStatus(0, [{ from: 0, to: 20 }], 0, 20, []), "unavailable");
assert.equal(importFailureReason("Dukascopy HTTP 429 (Retry-After 60)"), "rate_limited");
assert.equal(importFailureReason("fetch failed"), "network_unavailable");
assert.equal(
  importFailureReason("database postgres://user:secret@example.com failed"),
  "import_failed",
);
assert.equal(importFailureReason(null), null);
const friday = Date.parse("2024-06-07T00:00:00Z") / 1000;
const tuesday = Date.parse("2024-06-11T00:00:00Z") / 1000;
assert.deepEqual(missingWeekdays(friday, tuesday, new Set(["2024-06-07"])), ["2024-06-10"]);
assert.deepEqual(missingWeekdays(friday, friday + 3600, new Set()), []); // unfinished day
const bar = { time: 120, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 };
assert.deepEqual(validateImportCandles([bar], 60, 180), [bar]);
assert.throws(() => validateImportCandles([bar, bar], 60, 180), /duplicate/);
assert.throws(() => validateImportCandles([{ ...bar, high: 0.8 }], 60, 180), /Invalid/);
assert.throws(() => validateImportCandles([{ ...bar, time: 121 }], 60, 180), /Invalid/);
assert.throws(() => validateImportCandles([bar], 60, 120), /Invalid/);
console.log("import coverage checks passed");
