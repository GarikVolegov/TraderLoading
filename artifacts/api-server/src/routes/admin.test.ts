import assert from "node:assert/strict";
import fs from "node:fs";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const {
  normalizeAdminSearch,
  parseAdminAuditTarget,
  parseAdminLimit,
  parseAdminStatusFilter,
  parseAdminSubscriptionPlan,
  parseAdminSubscriptionStatus,
  normalizeAdminSubscriptionPeriodEnd,
  serializeRuntimeFlag,
  serializeAdminUserStatus,
  requireActionReason,
} = await import("./admin.js");

assert.equal(normalizeAdminSearch("  Osman@example.COM "), "osman@example.com");
assert.equal(normalizeAdminSearch("   "), "");
assert.equal(parseAdminLimit("5", 50), 5);
assert.equal(parseAdminLimit("999", 50), 100);
assert.equal(parseAdminLimit("bad", 50), 50);
assert.equal(serializeAdminUserStatus(null), "active");
assert.equal(serializeAdminUserStatus({ status: "suspended" }), "suspended");
assert.equal(requireActionReason("  manual review  "), "manual review");
assert.throws(() => requireActionReason(""), /reason_required/);
assert.equal(parseAdminStatusFilter("suspended"), "suspended");
assert.equal(parseAdminStatusFilter("active"), "active");
assert.equal(parseAdminStatusFilter("banned"), "banned");
assert.equal(parseAdminStatusFilter("all"), "all");
assert.equal(parseAdminStatusFilter("weird"), "all");
assert.equal(parseAdminStatusFilter(["suspended"]), "suspended");
assert.equal(parseAdminSubscriptionPlan("pro"), "pro");
assert.equal(parseAdminSubscriptionPlan("free"), "free");
assert.equal(parseAdminSubscriptionPlan("TEAM"), null);
assert.equal(parseAdminSubscriptionPlan("weird"), null);
assert.equal(parseAdminSubscriptionStatus("active"), "active");
assert.equal(parseAdminSubscriptionStatus("past_due"), "past_due");
assert.equal(parseAdminSubscriptionStatus("weird"), null);
const proPeriodEnd = normalizeAdminSubscriptionPeriodEnd("pro", "2026-07-10");
assert.equal(proPeriodEnd?.toISOString(), "2026-07-10T00:00:00.000Z");
assert.equal(
  normalizeAdminSubscriptionPeriodEnd("free", "2026-07-10"),
  null,
);
assert.equal(normalizeAdminSubscriptionPeriodEnd("pro", ""), undefined);
assert.equal(normalizeAdminSubscriptionPeriodEnd("pro", "not-a-date"), null);
assert.equal(parseAdminAuditTarget("  user_123  "), "user_123");
assert.equal(parseAdminAuditTarget("   "), "");
assert.deepEqual(serializeRuntimeFlag("SENTRY_DSN", "abc"), {
  key: "SENTRY_DSN",
  configured: true,
});
assert.deepEqual(serializeRuntimeFlag("SENTRY_DSN", ""), {
  key: "SENTRY_DSN",
  configured: false,
});

const adminRoutesSource = fs.readFileSync("src/routes/admin.ts", "utf8");
assert.match(adminRoutesSource, /router\.get\("\/admin\/content\/items"/);
assert.match(adminRoutesSource, /router\.post\(\s*"\/admin\/content\/items\/:itemId\/publish"/);
assert.match(adminRoutesSource, /router\.post\(\s*"\/admin\/content\/items\/:itemId\/unpublish"/);
assert.match(adminRoutesSource, /router\.get\("\/admin\/subscriptions"/);
assert.match(adminRoutesSource, /router\.post\(\s*"\/admin\/subscriptions\/:userId"/);
assert.match(adminRoutesSource, /writeAdminAudit/);
assert.match(adminRoutesSource, /"content\.publish"/);
assert.match(adminRoutesSource, /"content\.unpublish"/);
assert.match(adminRoutesSource, /"billing\.subscriptions\.write"/);
assert.match(adminRoutesSource, /"subscriptions\.manual_update"/);

console.log("admin route helper checks passed");
