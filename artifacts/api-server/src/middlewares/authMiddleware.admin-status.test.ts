import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const { isAccountAllowedByAdminStatus } = await import("./authMiddleware.js");

assert.equal(isAccountAllowedByAdminStatus(null), true);
assert.equal(isAccountAllowedByAdminStatus({ status: "active" }), true);
assert.equal(isAccountAllowedByAdminStatus({ status: "suspended" }), false);
assert.equal(isAccountAllowedByAdminStatus({ status: "banned" }), false);

console.log("auth middleware admin status checks passed");
