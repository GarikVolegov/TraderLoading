import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const { isValidAccountKeyBackupBody, serializeAccountKeyBackup, validateAccountKeyBackup, validateChatPublicKey, parseChatCursor } = await import("./chat.js");

const pair = await webcrypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
const publicKeyJwk = await webcrypto.subtle.exportKey("jwk", pair.publicKey);
const privateKeyJwk = await webcrypto.subtle.exportKey("jwk", pair.privateKey);
const other = await webcrypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
const otherPrivate = await webcrypto.subtle.exportKey("jwk", other.privateKey);

assert.equal(await validateChatPublicKey(publicKeyJwk), true);
assert.equal(await validateAccountKeyBackup({ publicKeyJwk, privateKeyJwk }), true);
assert.equal(await validateChatPublicKey({}), false);
assert.equal(await validateChatPublicKey([]), false);
assert.equal(await validateChatPublicKey({ ...publicKeyJwk, d: privateKeyJwk.d }), false);
assert.equal(await validateChatPublicKey({ ...publicKeyJwk, key_ops: "deriveBits" }), false);
assert.equal(await validateChatPublicKey({ ...publicKeyJwk, ext: "true" }), false);
assert.equal(await validateChatPublicKey({ ...publicKeyJwk, x: "A".repeat(43), y: "A".repeat(43) }), false);
assert.equal(await validateAccountKeyBackup({ publicKeyJwk, privateKeyJwk: otherPrivate }), false);
assert.equal(await validateAccountKeyBackup({ publicKeyJwk, privateKeyJwk: { ...privateKeyJwk, d: otherPrivate.d } }), false,
  "Matching x/y are insufficient if the private scalar belongs to another pair");
assert.equal(await validateAccountKeyBackup({ publicKeyJwk, privateKeyJwk: { ...privateKeyJwk, d: "A".repeat(43) } }), false);
assert.equal(await validateAccountKeyBackup({ publicKeyJwk, privateKeyJwk: { ...privateKeyJwk, key_ops: [] } }), false);

assert.equal(parseChatCursor(undefined), undefined);
assert.equal(parseChatCursor("1"), 1);
assert.equal(parseChatCursor("2147483647"), 2147483647);
for (const invalid of ["", "0", "-1", "1.5", "12suffix", "abc", "2147483648", "9007199254740993", ["1", "2"], { cursor: "1" }]) {
  assert.equal(parseChatCursor(invalid), null, "Invalid pagination cursor must be rejected");
}

assert.equal(isValidAccountKeyBackupBody({ publicKeyJwk, privateKeyJwk }), true);
assert.equal(isValidAccountKeyBackupBody({ publicKeyJwk }), false);
assert.equal(isValidAccountKeyBackupBody({ privateKeyJwk }), false);
assert.equal(isValidAccountKeyBackupBody({ publicKeyJwk: "nope", privateKeyJwk }), false);

const serialized = serializeAccountKeyBackup("user-1", {
  publicKeyJwk: JSON.stringify(publicKeyJwk),
  privateKeyJwk: JSON.stringify(privateKeyJwk),
});
assert.equal(serialized.userId, "user-1");
assert.equal(serialized.hasBackup, true);
assert.equal(JSON.stringify(serialized.publicKeyJwk) === JSON.stringify(publicKeyJwk), true);
assert.equal(JSON.stringify(serialized.privateKeyJwk) === JSON.stringify(privateKeyJwk), true,
  "Backup serialization preserves the private key without exposing its value in test failures");

assert.deepEqual(serializeAccountKeyBackup("user-1", null), {
  userId: "user-1",
  hasBackup: false,
  publicKeyJwk: null,
  privateKeyJwk: null,
});

console.log("chat account key backup helper checks passed");
