import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBrokerProfileStore } from "./profileStore.js";

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
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("profile store migration checks passed");
