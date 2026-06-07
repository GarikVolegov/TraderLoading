import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createAccountProfileStore,
  profileToBridgeConfig,
} from "./profileStore.js";

const tempDir = await mkdtemp(join(tmpdir(), "account-profiles-"));

try {
  const storePath = join(tempDir, "connections.json");
  const store = createAccountProfileStore(storePath);

  const profile = await store.saveProfile({
    label: "FP Trading reale",
    adapter: "mt5-local-socket",
    mode: "live",
    host: "127.0.0.1",
    port: 8765,
    terminalPath: "C:\\Program Files\\MetaTrader 5\\terminal64.exe",
    importJournal: true,
    orderEnabled: false,
    orderAckTimeoutMs: 5000,
    password: "must-not-persist",
  });

  assert.equal(profile.label, "FP Trading reale");
  assert.equal(profile.mode, "live");
  assert.equal(profile.adapter, "mt5-local-socket");
  assert.equal(profile.orderEnabled, false);
  assert.equal("password" in profile, false);

  await store.activateProfile(profile.id);

  const reloaded = createAccountProfileStore(storePath);
  const snapshot = await reloaded.listProfiles();

  assert.equal(snapshot.activeProfileId, profile.id);
  assert.equal(snapshot.profiles.length, 1);
  assert.equal(snapshot.profiles[0]?.terminalPath, "C:\\Program Files\\MetaTrader 5\\terminal64.exe");
  assert.equal("password" in (snapshot.profiles[0] as object), false);

  const config = profileToBridgeConfig(snapshot.profiles[0]!);
  assert.deepEqual(config, {
    adapter: "mt5-local-socket",
    mode: "live",
    host: "127.0.0.1",
    port: 8765,
    importJournal: true,
    orderEnabled: false,
    orderAckTimeoutMs: 5000,
  });

  await reloaded.deleteProfile(profile.id);
  const empty = await reloaded.listProfiles();
  assert.equal(empty.activeProfileId, null);
  assert.equal(empty.profiles.length, 0);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("account profile store checks passed");
