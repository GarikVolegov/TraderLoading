import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const { isValidAccountKeyBackupBody, serializeAccountKeyBackup } = await import("./chat.js");

const publicKeyJwk = { kty: "EC", crv: "P-256", x: "public-x", y: "public-y" };
const privateKeyJwk = { kty: "EC", crv: "P-256", x: "public-x", y: "public-y", d: "private-d" };

assert.equal(isValidAccountKeyBackupBody({ publicKeyJwk, privateKeyJwk }), true);
assert.equal(isValidAccountKeyBackupBody({ publicKeyJwk }), false);
assert.equal(isValidAccountKeyBackupBody({ privateKeyJwk }), false);
assert.equal(isValidAccountKeyBackupBody({ publicKeyJwk: "nope", privateKeyJwk }), false);

assert.deepEqual(
  serializeAccountKeyBackup("user-1", {
    publicKeyJwk: JSON.stringify(publicKeyJwk),
    privateKeyJwk: JSON.stringify(privateKeyJwk),
  }),
  {
    userId: "user-1",
    hasBackup: true,
    publicKeyJwk,
    privateKeyJwk,
  },
);

assert.deepEqual(serializeAccountKeyBackup("user-1", null), {
  userId: "user-1",
  hasBackup: false,
  publicKeyJwk: null,
  privateKeyJwk: null,
});

console.log("chat account key backup helper checks passed");
