import assert from "node:assert/strict";
import test from "node:test";
import { isSameMinute, msUntilNextMinute } from "./useMinuteClock";

test("msUntilNextMinute aligns wakeups to the next minute boundary with a 50ms safety margin", () => {
  const baseMinuteMs = Date.UTC(2026, 9, 25, 10, 15, 0, 0);
  assert.equal(msUntilNextMinute(baseMinuteMs), 60_050);
  assert.equal(msUntilNextMinute(baseMinuteMs + 15_000), 45_050);
  assert.equal(msUntilNextMinute(baseMinuteMs + 59_500), 1_000);
});

test("isSameMinute only triggers re-renders when the minute bucket changes", () => {
  const t1 = new Date("2026-10-25T10:15:02.000Z");
  const t2 = new Date("2026-10-25T10:15:58.999Z");
  const t3 = new Date("2026-10-25T10:16:00.000Z");
  assert.equal(isSameMinute(t1, t2), true);
  assert.equal(isSameMinute(t1, t3), false);
});
