import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const {
  ADMIN_PERMISSIONS_BY_ROLE,
  getBootstrapAdminIds,
  hasAdminPermission,
  resolveAdminPrincipal,
} = await import("./adminPermissions.js");

assert.equal(hasAdminPermission("super_admin", "security.roles.write"), true);
assert.equal(hasAdminPermission("support_agent", "users.read"), true);
assert.equal(hasAdminPermission("support_agent", "users.suspend"), false);
assert.equal(hasAdminPermission("moderator", "moderation.resolve"), true);
assert.equal(hasAdminPermission("moderator", "trading.read"), false);
assert.ok(
  ADMIN_PERMISSIONS_BY_ROLE.super_admin.includes("system.feature_flags.write"),
);

assert.deepEqual(
  getBootstrapAdminIds("user_a, user_b ,, "),
  new Set(["user_a", "user_b"]),
);
assert.deepEqual(resolveAdminPrincipal("user_a", null, new Set(["user_a"])), {
  userId: "user_a",
  role: "super_admin",
  source: "bootstrap",
});
assert.deepEqual(
  resolveAdminPrincipal(
    "user_b",
    { role: "support_agent", status: "active" },
    new Set(),
  ),
  {
    userId: "user_b",
    role: "support_agent",
    source: "database",
  },
);
assert.equal(
  resolveAdminPrincipal(
    "user_c",
    { role: "support_agent", status: "disabled" },
    new Set(),
  ),
  null,
);

console.log("admin auth helper checks passed");
