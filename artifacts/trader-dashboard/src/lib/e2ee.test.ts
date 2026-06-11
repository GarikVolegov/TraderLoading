import assert from "node:assert/strict";
import {
  decryptMessage,
  encryptMessage,
  getOrCreateAccountKeyPair,
  getSharedKey,
} from "./e2ee.js";

async function createExportedEcdhPair(): Promise<{
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  );

  return {
    publicKey: await crypto.subtle.exportKey("jwk", pair.publicKey),
    privateKey: await crypto.subtle.exportKey("jwk", pair.privateKey),
  };
}

const firstLocalPair = await createExportedEcdhPair();
const restoredLocalPair = await createExportedEcdhPair();
const friendPair = await createExportedEcdhPair();

await getSharedKey(firstLocalPair.privateKey, friendPair.publicKey);

const friendToRestoredKey = await getSharedKey(
  friendPair.privateKey,
  restoredLocalPair.publicKey,
);
const encrypted = await encryptMessage("messaggio dopo nuovo login", friendToRestoredKey);

const restoredToFriendKey = await getSharedKey(
  restoredLocalPair.privateKey,
  friendPair.publicKey,
);

assert.equal(
  await decryptMessage(encrypted.ciphertext, encrypted.iv, restoredToFriendKey),
  "messaggio dopo nuovo login",
);

console.log("e2ee key cache checks passed");

const localOnlyPair = await createExportedEcdhPair();
const accountBackedPair = await createExportedEcdhPair();
const savedBackups: Array<{ publicKey: JsonWebKey; privateKey: JsonWebKey }> = [];

const restoredPair = await getOrCreateAccountKeyPair("account-1", {
  load: async () => accountBackedPair,
  save: async (keyPair) => {
    savedBackups.push(keyPair);
  },
  loadLocal: async () => localOnlyPair,
  saveLocal: async () => {},
});

assert.deepEqual(restoredPair, accountBackedPair);
assert.equal(savedBackups.length, 0);

const fallbackLocalPair = await createExportedEcdhPair();
const restoredWhenBackupUnavailable = await getOrCreateAccountKeyPair("account-2", {
  load: async () => {
    throw new Error("backup endpoint unavailable");
  },
  save: async () => {
    throw new Error("backup endpoint unavailable");
  },
  loadLocal: async () => fallbackLocalPair,
  saveLocal: async () => {},
});

assert.deepEqual(restoredWhenBackupUnavailable, fallbackLocalPair);

console.log("e2ee account key restore checks passed");
