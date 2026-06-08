import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createBrokerVault } from "../services/brokerHub/brokerVault.js";
import { createBrokerProfileStore } from "../services/brokerHub/profileStore.js";
import { createBrokerHubRuntime } from "../services/brokerHub/runtime.js";
import { createConnectionIntentStore } from "../services/brokerHub/connectionIntentStore.js";
import { createStaticBrokerProviderRegistry } from "../services/brokerHub/providerRegistry.js";
import { createBrokersRouter } from "./brokers.js";

const tempDir = await mkdtemp(join(tmpdir(), "broker-real-route-"));

try {
  const runtime = createBrokerHubRuntime({
    store: createBrokerProfileStore(join(tempDir, "profiles.json")),
    vault: createBrokerVault({
      path: join(tempDir, "vault.json"),
      key: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    }),
    connectorFactory: (profile) => {
      let closePositionId = "";
      const snapshot = {
        profileId: profile.id,
        status: "connected" as const,
        kind: profile.kind,
        providerKind: profile.providerKind,
        brokerName: profile.brokerName,
        tradingEnabled: profile.tradingEnabled,
        accounts: [
          { id: profile.accountId, label: profile.label, brokerName: profile.brokerName, currency: "USD", environment: "live" as const },
        ],
        metrics: { balance: 1000, equity: 1000, margin: 0, freeMargin: 1000, currency: "USD", dailyProfit: 0 },
        positions: [],
        orders: [],
        lastUpdated: new Date().toISOString(),
      };
      return {
        async connect() {
          return snapshot;
        },
        async disconnect() {},
        async getAccounts() {
          return snapshot.accounts;
        },
        async getSnapshot() {
          return snapshot;
        },
        async getPositions() {
          return [];
        },
        async getOrders() {
          return [];
        },
        async getDealsHistory() {
          return [];
        },
        async placeOrder() {
          return { accepted: true };
        },
        async modifyOrder() {
          return { accepted: false };
        },
        async closePosition() {
          closePositionId = "pos-1";
          return { accepted: true, orderId: `closed-${closePositionId}` };
        },
        onEvent() {
          return () => {};
        },
      };
    },
  });
  const intentStore = createConnectionIntentStore(join(tempDir, "intents.json"));
  const providerRegistry = createStaticBrokerProviderRegistry({
    providerKind: "metaapi-metatrader",
    providerAccountId: "meta-account-1",
    accountId: "12345678",
    label: "FP Trading 12345678",
    connectionStatus: "connected",
    userDisplayStatus: "Conto trovato. Trading disponibile.",
    capabilities: {
      readAccount: true,
      readPositions: true,
      readHistory: true,
      placeOrders: true,
      closePositions: true,
    },
    snapshot: {
      profileId: "pending",
      status: "connected",
      kind: "metaapi-metatrader",
      providerKind: "metaapi-metatrader",
      brokerName: "FP Trading",
      tradingEnabled: true,
      accounts: [{ id: "12345678", label: "FP Trading 12345678", brokerName: "FP Trading", currency: "USD", environment: "live" }],
      metrics: { balance: 1000, equity: 1000, margin: 0, freeMargin: 1000, currency: "USD", dailyProfit: 0 },
      positions: [],
      orders: [],
      lastUpdated: new Date().toISOString(),
    },
  });

  const app = express();
  app.use(express.json());
  app.use("/api", createBrokersRouter(runtime, { intentStore, providerRegistry, enableLegacyConnectionRoutes: true }));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api/brokers`;

  const catalogRes = await fetch(`${base}/catalog`);
  assert.equal(catalogRes.status, 200);
  const catalog = (await catalogRes.json()) as { brokers: Array<{ displayName: string }> };
  assert.ok(catalog.brokers.some((broker) => broker.displayName === "FP Trading"));

  const createRes = await fetch(`${base}/connect-intents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brokerName: "FP Trading" }),
  });
  const created = (await createRes.json()) as { intent: { id: string } };

  const verifyRes = await fetch(`${base}/connect-intents/${created.intent.id}/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      accountNumber: "12345678",
      accountPassword: "broker-password",
      server: "FPMarkets-Live",
      tradingEnabled: true,
    }),
  });
  assert.equal(verifyRes.status, 200);
  const verified = (await verifyRes.json()) as {
    intent: { displayStatus: string; requiredAction: string; recommendedRoute?: string; providerKind?: string; providerAccountId?: string; capabilities?: unknown };
  };
  assert.equal(verified.intent.displayStatus, "Usa SmartLink se hai MetaTrader, oppure collega il conto con numero conto, server e password.");
  assert.equal(verified.intent.requiredAction, "start_authorization");
  assert.equal(verified.intent.recommendedRoute, "smartlink_mt5");
  assert.equal("providerKind" in verified.intent, false);
  assert.equal("providerAccountId" in verified.intent, false);
  assert.equal("capabilities" in verified.intent, false);

  const completeRes = await fetch(`${base}/connect-intents/${created.intent.id}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: "credentials",
      accountNumber: "12345678",
      accountPassword: "broker-password",
      server: "FPMarkets-Live",
      tradingEnabled: true,
    }),
  });
  assert.equal(completeRes.status, 200);
  const completed = (await completeRes.json()) as {
    intent: { displayStatus: string; providerKind?: string };
    profile: { id: string; providerKind: string; providerAccountId: string; capabilities: { placeOrders: boolean }; accountPassword?: string };
    snapshot: { status: string; error?: string };
  };
  assert.equal(completed.intent.displayStatus, "Conto collegato");
  assert.equal("providerKind" in completed.intent, false);
  assert.equal(completed.profile.providerKind, "metaapi-metatrader");
  assert.equal(completed.profile.providerAccountId, "meta-account-1");
  assert.equal(completed.profile.capabilities.placeOrders, true);
  assert.equal("accountPassword" in completed.profile, false);
  assert.equal(completed.snapshot.status, "connected");

  const closeRes = await fetch(`${base}/profiles/${completed.profile.id}/positions/pos-1/close`, { method: "POST" });
  assert.equal(closeRes.status, 200);
  const close = (await closeRes.json()) as { accepted: boolean; orderId?: string };
  assert.equal(close.accepted, true);
  assert.equal(close.orderId, "closed-pos-1");

  const disconnectRes = await fetch(`${base}/profiles/${completed.profile.id}/disconnect`, { method: "POST" });
  assert.equal(disconnectRes.status, 200);
  const disconnected = (await disconnectRes.json()) as { snapshot: { status: string } };
  assert.equal(disconnected.snapshot.status, "offline");

  await new Promise<void>((resolve) => server.close(() => resolve()));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("broker real connection route checks passed");
