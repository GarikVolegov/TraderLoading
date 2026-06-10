import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const { redactAdminSnapshot, normalizeAuditReason } = await import(
  "./adminAudit.js"
);

assert.equal(
  normalizeAuditReason("  revoke stale sessions  "),
  "revoke stale sessions",
);
assert.equal(normalizeAuditReason(""), null);
assert.equal(normalizeAuditReason("   "), null);

assert.deepEqual(
  redactAdminSnapshot({
    email: "user@example.com",
    access_token: "secret",
    refreshToken: "secret",
    brokerSecret: "secret",
    nested: {
      private_key_jwk: "secret",
      ok: true,
    },
  }),
  {
    email: "user@example.com",
    access_token: "[redacted]",
    refreshToken: "[redacted]",
    brokerSecret: "[redacted]",
    nested: {
      private_key_jwk: "[redacted]",
      ok: true,
    },
  },
);

console.log("admin audit helper checks passed");
