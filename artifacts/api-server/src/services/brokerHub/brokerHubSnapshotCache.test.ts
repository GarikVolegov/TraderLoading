import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createBrokerProfileStore } from "./profileStore.js";
import { createBrokerHubRuntime } from "./runtime.js";
import type { BrokerConnector, BrokerSnapshot } from "./types.js";

// Finding 2.2: getSnapshot re-fetched the full FX Blue feed AND re-imported every
// deal on EVERY read, so a client polling every ~10s hammered fxblue.com and wrote
// ~N rows/poll. An SWR cache serves a fresh snapshot without re-fetch/re-import.

const tempDir = await mkdtemp(join(tmpdir(), "broker-cache-"));

function fakeConnector(counters: { connects: number }): BrokerConnector {
  const snapshot = (): BrokerSnapshot => ({
    profileId: "p",
    status: "connected",
    kind: "fxblue-account-sync",
    providerKind: "fxblue-account-sync",
    brokerName: "FX Blue",
    tradingEnabled: false,
    accounts: [],
    metrics: { balance: 0, equity: 0, margin: 0, freeMargin: 0, currency: "USD", dailyProfit: 0 },
    positions: [],
    orders: [],
    lastUpdated: new Date().toISOString(),
  });
  return {
    async connect() { counters.connects += 1; return snapshot(); },
    async disconnect() {},
    async getAccounts() { return []; },
    async getSnapshot() { return snapshot(); },
    async getPositions() { return []; },
    async getOrders() { return []; },
    async getDealsHistory() { return []; },
    async placeOrder() { return { accepted: false }; },
    async modifyOrder() { return { accepted: false }; },
    async closePosition() { return { accepted: false }; },
    onEvent() { return () => undefined; },
  };
}

try {
  // ── Fresh cache: two reads within TTL → one fetch + one import ──────────────
  {
    const store = createBrokerProfileStore(join(tempDir, "cached.json"));
    const profile = await store.saveProfile({
      label: "FX Blue", brokerName: "FX Blue", kind: "fxblue-account-sync",
      providerKind: "fxblue-account-sync", providerUserId: "trader-x", accountId: "1", environment: "live",
    });
    const counters = { connects: 0 };
    let imports = 0;
    const runtime = createBrokerHubRuntime({
      store,
      autoSyncIntervalMs: 0,
      snapshotTtlMs: 60_000,
      accountDataImporter: async () => { imports += 1; return { imported: 0, journalCreated: 0, updated: 0, skipped: 0 }; },
      connectorFactory: () => fakeConnector(counters),
    });
    await runtime.getSnapshot(profile.id);
    await runtime.getSnapshot(profile.id);
    assert.equal(counters.connects, 1, "second read within TTL must serve the cache, not re-fetch");
    assert.equal(imports, 1, "second read within TTL must not re-import");
    await runtime.close();
  }

  // ── disconnectProfile invalidates the cache (no stale "connected" snapshot) ──
  {
    const store = createBrokerProfileStore(join(tempDir, "disconnect.json"));
    const profile = await store.saveProfile({
      label: "FX Blue", brokerName: "FX Blue", kind: "fxblue-account-sync",
      providerKind: "fxblue-account-sync", providerUserId: "trader-z", accountId: "3", environment: "live",
    });
    const counters = { connects: 0 };
    const runtime = createBrokerHubRuntime({
      store,
      autoSyncIntervalMs: 0,
      snapshotTtlMs: 60_000,
      accountDataImporter: async () => ({ imported: 0, journalCreated: 0, updated: 0, skipped: 0 }),
      connectorFactory: () => fakeConnector(counters),
    });
    await runtime.getSnapshot(profile.id);
    await runtime.getSnapshot(profile.id);
    assert.equal(counters.connects, 1, "cache warm within TTL");
    await runtime.disconnectProfile(profile.id);
    await runtime.getSnapshot(profile.id);
    assert.equal(counters.connects, 2, "disconnect must invalidate the cache, forcing a fresh fetch");
    await runtime.close();
  }

  // ── TTL 0: every read refetches (proves the cache, not a coincidence) ───────
  {
    const store = createBrokerProfileStore(join(tempDir, "nocache.json"));
    const profile = await store.saveProfile({
      label: "FX Blue", brokerName: "FX Blue", kind: "fxblue-account-sync",
      providerKind: "fxblue-account-sync", providerUserId: "trader-y", accountId: "2", environment: "live",
    });
    const counters = { connects: 0 };
    const runtime = createBrokerHubRuntime({
      store,
      autoSyncIntervalMs: 0,
      snapshotTtlMs: 0,
      accountDataImporter: async () => ({ imported: 0, journalCreated: 0, updated: 0, skipped: 0 }),
      connectorFactory: () => fakeConnector(counters),
    });
    await runtime.getSnapshot(profile.id);
    await runtime.getSnapshot(profile.id);
    assert.equal(counters.connects, 2, "TTL 0 must always refetch");
    await runtime.close();
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("broker hub snapshot cache checks passed");
