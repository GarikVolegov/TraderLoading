import assert from "node:assert/strict";
import { formatUtcReplayTime, parseUtcDateTimeInput, utcDateTimeInput } from "./dateTime";

// Rome's spring DST gap and autumn repeated hour remain unambiguous in UTC.
for (const value of ["2026-03-29T02:30", "2026-10-25T02:30", "2024-02-29T00:00"]) {
  const timestamp = parseUtcDateTimeInput(value);
  assert.notEqual(timestamp, null);
  assert.equal(utcDateTimeInput(timestamp), value);
  assert.equal(timestamp, Date.parse(`${value}:00Z`) / 1000);
}
assert.equal(parseUtcDateTimeInput("2026-02-29T12:00"), null);
assert.equal(parseUtcDateTimeInput("2026-02-30T12:00"), null);
assert.equal(parseUtcDateTimeInput("2026-01-01T25:00"), null);
assert.equal(parseUtcDateTimeInput("2026-01-01"), null);
assert.equal(parseUtcDateTimeInput(""), null);
assert.equal(utcDateTimeInput(null), "");
assert.equal(utcDateTimeInput(Number.NaN), "");
assert.match(formatUtcReplayTime(Date.parse("2026-10-09T23:30:00Z") / 1000, "en-GB"), /10 Oct 2026.*01:30/);
console.log("Replay datetime Europe/Rome checks passed");
