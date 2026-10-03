import assert from "node:assert/strict";
import {
  normalizeReportReason,
  sanitizeReportDetails,
  REPORT_REASONS,
} from "./messageReports.js";

// Audit 3.6: community message reports. Pure reason whitelist + note sanitation.

// Known reasons pass through; case-insensitive.
assert.equal(normalizeReportReason("spam"), "spam");
assert.equal(normalizeReportReason("HARASSMENT"), "harassment");
assert.equal(normalizeReportReason("  off_topic  "), "off_topic");
// Unknown / non-string → "other" (never rejected, never arbitrary).
assert.equal(normalizeReportReason("nonsense"), "other");
assert.equal(normalizeReportReason(null), "other");
assert.equal(normalizeReportReason(123), "other");
assert.ok(REPORT_REASONS.includes(normalizeReportReason("whatever")));

// Details: trim, blank → null, cap length.
assert.equal(sanitizeReportDetails("  hello  "), "hello");
assert.equal(sanitizeReportDetails("   "), null);
assert.equal(sanitizeReportDetails(""), null);
assert.equal(sanitizeReportDetails(null), null);
assert.equal(sanitizeReportDetails(42), null);
assert.equal(sanitizeReportDetails("x".repeat(900))?.length, 500, "capped at 500 chars");

console.log("message reports checks passed");
