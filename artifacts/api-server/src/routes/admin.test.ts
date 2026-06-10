import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const {
  normalizeAdminSearch,
  parseAdminLimit,
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

console.log("admin route helper checks passed");
