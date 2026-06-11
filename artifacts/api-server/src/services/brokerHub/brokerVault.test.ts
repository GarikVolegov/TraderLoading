import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createBrokerVault } from "./brokerVault.js";

const tempDir = await mkdtemp(join(tmpdir(), "broker-vault-"));
const previousNodeEnv = process.env.NODE_ENV;
const previousVaultKey = process.env.BROKER_VAULT_KEY;

try {
  process.env.NODE_ENV = "production";
  delete process.env.BROKER_VAULT_KEY;

  assert.throws(
    () => createBrokerVault({ path: join(tempDir, "vault.json") }),
    /BROKER_VAULT_KEY must be set in production/,
  );

  const vault = createBrokerVault({
    path: join(tempDir, "vault-with-explicit-key.json"),
    key: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  });

  await vault.setSecret("profile-1", "accessToken", "secret-token");
  assert.equal(await vault.getSecret("profile-1", "accessToken"), "secret-token");
} finally {
  if (previousNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = previousNodeEnv;
  }
  if (previousVaultKey === undefined) {
    delete process.env.BROKER_VAULT_KEY;
  } else {
    process.env.BROKER_VAULT_KEY = previousVaultKey;
  }
  await rm(tempDir, { recursive: true, force: true });
}

console.log("broker vault production key checks passed");
