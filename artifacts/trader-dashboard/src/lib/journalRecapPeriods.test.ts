import assert from "node:assert/strict";
import {
  FOUR_WEEK_ANCHOR_ISO,
  getJournalRecapPeriod,
  getNextJournalRecapWindow,
  isJournalRecapEditable,
} from "./journalRecapPeriods.js";

assert.equal(FOUR_WEEK_ANCHOR_ISO, "2026-06-08");

const weekly = getJournalRecapPeriod("weekly", new Date("2026-06-13T12:00:00+02:00"));
assert.equal(weekly.periodStart, "2026-06-08");
assert.equal(weekly.periodEnd, "2026-06-14");
assert.equal(weekly.editWindowStart, "2026-06-13");
assert.equal(weekly.editWindowEnd, "2026-06-14");
assert.equal(isJournalRecapEditable(weekly, new Date("2026-06-13T10:00:00+02:00")), true);
assert.equal(isJournalRecapEditable(weekly, new Date("2026-06-12T10:00:00+02:00")), false);

const fourWeek = getJournalRecapPeriod("four_week", new Date("2026-07-04T12:00:00+02:00"));
assert.equal(fourWeek.periodStart, "2026-06-08");
assert.equal(fourWeek.periodEnd, "2026-07-05");
assert.equal(fourWeek.editWindowStart, "2026-07-04");
assert.equal(fourWeek.editWindowEnd, "2026-07-05");
assert.equal(isJournalRecapEditable(fourWeek, new Date("2026-07-05T09:00:00+02:00")), true);
assert.equal(isJournalRecapEditable(fourWeek, new Date("2026-07-03T09:00:00+02:00")), false);

const nextFourWeek = getNextJournalRecapWindow("four_week", new Date("2026-06-20T12:00:00+02:00"));
assert.equal(nextFourWeek.editWindowStart, "2026-07-04");
assert.equal(nextFourWeek.editWindowEnd, "2026-07-05");

console.log("journal recap frontend period checks passed");
