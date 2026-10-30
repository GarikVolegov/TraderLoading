import assert from "node:assert/strict";

process.env.DATABASE_URL = "postgres://user:pass@127.0.0.1:5432/test";

const { syncUserIdentity, clearIdentityCache } = await import("./identitySync.js");
const { getBootstrapAdminEmails } = await import("../lib/adminPermissions.js");

// Test default sovereign bootstrap emails
const emails = getBootstrapAdminEmails();
assert.ok(emails.has("volegovgarik18@gmail.com"), "volegovgarik18@gmail.com must be recognized as bootstrap admin");
assert.ok(emails.has("volegovgarik9@gmail.com"), "volegovgarik9@gmail.com must be recognized as bootstrap admin");

// Test fallback user identity on test DB
clearIdentityCache();
const identity = await syncUserIdentity("user_test_mock");
assert.equal(identity.id, "user_test_mock");
assert.equal(identity.email, null);

console.log("identitySync tests passed");
