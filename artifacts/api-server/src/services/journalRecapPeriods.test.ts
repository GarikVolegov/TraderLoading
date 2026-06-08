import assert from "node:assert/strict";
import {
  getJournalRecapPeriodForDate,
  isJournalRecapPeriodEditable,
  validateJournalRecapPeriod,
} from "./journalRecapPeriods.js";

const weekly = getJournalRecapPeriodForDate("weekly", new Date("2026-06-14T08:00:00Z"));
assert.equal(weekly.periodStart, "2026-06-08");
assert.equal(weekly.periodEnd, "2026-06-14");
assert.equal(isJournalRecapPeriodEditable(weekly, new Date("2026-06-14T08:00:00Z")), true);
assert.equal(isJournalRecapPeriodEditable(weekly, new Date("2026-06-15T08:00:00Z")), false);

const fourWeek = getJournalRecapPeriodForDate("four_week", new Date("2026-07-05T08:00:00Z"));
assert.equal(fourWeek.periodStart, "2026-06-08");
assert.equal(fourWeek.periodEnd, "2026-07-05");
assert.equal(isJournalRecapPeriodEditable(fourWeek, new Date("2026-07-04T08:00:00Z")), true);
assert.equal(isJournalRecapPeriodEditable(fourWeek, new Date("2026-07-06T08:00:00Z")), false);
assert.equal(isJournalRecapPeriodEditable(fourWeek, new Date("2026-07-05T22:30:00Z")), false);

assert.equal(validateJournalRecapPeriod("four_week", "2026-06-08", "2026-07-05"), true);
assert.equal(validateJournalRecapPeriod("four_week", "2026-06-09", "2026-07-05"), false);

console.log("journal recap server period checks passed");
