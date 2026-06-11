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
  buildAdminSubscriptionManualValues,
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
assert.equal(proPeriodEnd.ok, true);
assert.equal(
  proPeriodEnd.ok ? proPeriodEnd.value?.toISOString() : null,
  "2026-07-10T00:00:00.000Z",
);
// Downgrade a free con una data ancora nel form: niente errore, la data si azzera.
assert.deepEqual(normalizeAdminSubscriptionPeriodEnd("free", "2026-07-10"), {
  ok: true,
  value: null,
});
// Upgrade a pro senza data: valore esplicito null (mai undefined), così
// l'upsert sovrascrive eventuali scadenze stantie e l'override ha effetto.
assert.deepEqual(normalizeAdminSubscriptionPeriodEnd("pro", ""), {
  ok: true,
  value: null,
});
assert.deepEqual(normalizeAdminSubscriptionPeriodEnd("pro", null), {
  ok: true,
  value: null,
});
assert.deepEqual(normalizeAdminSubscriptionPeriodEnd("pro", "not-a-date"), {
  ok: false,
});
const downgradedSubscriptionValues = buildAdminSubscriptionManualValues({
  userId: "user_123",
  plan: "free",
  status: "active",
  currentPeriodEnd: null,
  reason: "downgrade richiesto",
  updatedBy: "admin_123",
  updatedAt: new Date("2026-06-10T10:00:00.000Z"),
});
assert.equal(downgradedSubscriptionValues.stripeCustomerId, null);
assert.equal(downgradedSubscriptionValues.stripeSubscriptionId, null);
assert.equal(downgradedSubscriptionValues.stripePriceId, null);
assert.equal(downgradedSubscriptionValues.cancelAtPeriodEnd, false);
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
