import assert from "node:assert/strict";
import {
  formatCompactItalianRelativeTime,
  formatItalianNewsRelativeTime,
  formatIntlRelativeTime,
} from "./relativeTime.js";

const nowMs = Date.parse("2026-06-07T12:00:00.000Z");

assert.equal(formatItalianNewsRelativeTime("not-a-date", { nowMs }), "");
assert.equal(formatItalianNewsRelativeTime("2026-06-07T11:59:40.000Z", { nowMs }), "adesso");
assert.equal(formatItalianNewsRelativeTime("2026-06-07T11:45:00.000Z", { nowMs }), "15 min fa");
assert.equal(formatItalianNewsRelativeTime("2026-06-07T09:00:00.000Z", { nowMs }), "3h fa");
assert.equal(formatItalianNewsRelativeTime("2026-06-06T11:00:00.000Z", { nowMs }), "ieri");
assert.equal(formatItalianNewsRelativeTime("2026-06-04T12:00:00.000Z", { nowMs }), "3 giorni fa");
assert.equal(formatItalianNewsRelativeTime("2026-05-20T12:00:00.000Z", { nowMs }), "20 mag");

assert.equal(formatCompactItalianRelativeTime("2026-06-07T11:30:00.000Z", { nowMs }), "poco fa");
assert.equal(formatCompactItalianRelativeTime("2026-06-07T09:00:00.000Z", { nowMs }), "3h fa");
assert.equal(formatCompactItalianRelativeTime("2026-06-05T11:00:00.000Z", { nowMs }), "2g fa");

assert.equal(formatIntlRelativeTime("2026-06-07T11:59:40.000Z", "it", { nowMs }), "questo minuto");
assert.equal(formatIntlRelativeTime("2026-06-07T11:45:00.000Z", "en", { nowMs }), "15 minutes ago");
assert.equal(formatIntlRelativeTime("2026-06-07T09:00:00.000Z", "en", { nowMs }), "3 hours ago");
assert.equal(formatIntlRelativeTime("2026-06-05T12:00:00.000Z", "en", { nowMs }), "2 days ago");

console.log("relative time checks passed");
