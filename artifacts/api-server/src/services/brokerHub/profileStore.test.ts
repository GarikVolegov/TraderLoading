import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBrokerProfileStore, createBrokerProfileStoreFromBackend } from "./profileStore.js";

class MemoryProfileBackend {
  private data: unknown;
  writeDelayMs = 0;

  async read(): Promise<unknown> {
    return JSON.parse(JSON.stringify(this.data ?? null));
  }

  async write(data: unknown): Promise<void> {
    if (this.writeDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.writeDelayMs));
    }
    this.data = JSON.parse(JSON.stringify(data));
  }
}

const tempDir = await mkdtemp(join(tmpdir(), "broker-profile-store-"));

try {
  const path = join(tempDir, "profiles.json");
  await writeFile(
    path,
    JSON.stringify({
      activeProfileId: "legacy-profile",
      profiles: [
        {
          id: "legacy-profile",
          label: "FP Trading 82364482",
          brokerName: "FP Trading",
          kind: "mt5-vps-bridge",
          accountId: "82364482",
          environment: "live",
          tradingEnabled: true,
          port: 8765,
          server: "FPtradingLLC-Live",
          createdAt: "2026-06-06T21:00:02.764Z",
          updatedAt: "2026-06-06T21:00:02.764Z",
        },
      ],
    }),
    "utf8",
  );

  const store = createBrokerProfileStore(path);
  const list = await store.listProfiles();
  const profile = list.profiles[0];

  assert.equal(list.activeProfileId, "legacy-profile");
  assert.equal(profile?.providerKind, "mt5-vps-bridge");
  assert.equal(profile?.connectionStatus, "offline");
  assert.deepEqual(profile?.capabilities, {
    readAccount: true,
    readPositions: true,
    readHistory: true,
    placeOrders: true,
    closePositions: true,
    realtimeUpdates: true,
    requiresTerminal: false,
  });

  const loaded = await store.getProfile("legacy-profile");
  assert.equal(loaded?.providerKind, "mt5-vps-bridge");
  assert.equal(loaded?.route, "local_companion");
  assert.equal(loaded?.health, "waiting_for_companion");
  assert.equal(loaded?.capabilities.placeOrders, true);

  const smartLink = await store.saveProfile({
    label: "FP Trading SmartLink",
    brokerName: "FP Trading",
    kind: "traderloading-mt5-smartlink",
    providerKind: "traderloading-mt5-smartlink",
    accountId: "",
    environment: "live",
    tradingEnabled: false,
    terminalDetected: true,
    accountLoginMode: "terminal_session",
  });
  assert.equal(smartLink.route, "smartlink_mt5");
  assert.equal(smartLink.providerKind, "traderloading-mt5-smartlink");
  assert.equal(smartLink.capabilities.requiresTerminal, true);
  assert.equal(smartLink.terminalDetected, true);
  assert.equal(smartLink.accountLoginMode, "terminal_session");

  const sharedBackend = new MemoryProfileBackend();
  const firstStore = createBrokerProfileStoreFromBackend(sharedBackend);
  const persisted = await firstStore.saveProfile({
    label: "FX Blue Live",
    brokerName: "FP Trading",
    kind: "fxblue-account-sync",
    providerKind: "fxblue-account-sync",
    accountId: "82364482",
    environment: "live",
    route: "fxblue_account_sync",
    connectionStatus: "connected",
  });
  await firstStore.activateProfile(persisted.id);

  const secondStore = createBrokerProfileStoreFromBackend(sharedBackend);
  const reloaded = await secondStore.listProfiles();
  assert.equal(reloaded.activeProfileId, persisted.id);
  assert.equal(reloaded.profiles[0]?.id, persisted.id);
  assert.equal(reloaded.profiles[0]?.connectionStatus, "connected");

  const concurrentBackend = new MemoryProfileBackend();
  concurrentBackend.writeDelayMs = 20;
  const concurrentStoreA = createBrokerProfileStoreFromBackend(concurrentBackend);
  const concurrentStoreB = createBrokerProfileStoreFromBackend(concurrentBackend);
  const [alpha, beta] = await Promise.all([
    concurrentStoreA.saveProfile({
      label: "Alpha",
      brokerName: "FP Trading",
      kind: "fxblue-account-sync",
      providerKind: "fxblue-account-sync",
      accountId: "111",
      environment: "live",
    }),
    concurrentStoreB.saveProfile({
      label: "Beta",
      brokerName: "FP Trading",
      kind: "fxblue-account-sync",
      providerKind: "fxblue-account-sync",
      accountId: "222",
      environment: "live",
    }),
  ]);
  const concurrentList = await concurrentStoreA.listProfiles();
  assert.equal(concurrentList.profiles.some((item) => item.id === alpha.id), true);
  assert.equal(concurrentList.profiles.some((item) => item.id === beta.id), true);
  assert.equal(concurrentList.profiles.length, 2);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("profile store migration checks passed");
