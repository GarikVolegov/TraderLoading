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
import { createStaticSnapTradeRegistry } from "../services/brokerHub/snapTradeProvider.js";
import { createBrokersRouter } from "./brokers.js";

const tempDir = await mkdtemp(join(tmpdir(), "broker-snaptrade-route-"));

try {
  const vault = createBrokerVault({
    path: join(tempDir, "vault.json"),
    key: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  });
  const runtime = createBrokerHubRuntime({
    store: createBrokerProfileStore(join(tempDir, "profiles.json")),
    vault,
    connectorFactory: (profile) => {
      const snapshot = {
        profileId: profile.id,
        status: "connected" as const,
        kind: "snaptrade-brokerage" as const,
        providerKind: "snaptrade-brokerage" as const,
        brokerName: profile.brokerName,
        tradingEnabled: profile.tradingEnabled,
        accounts: [{ id: profile.providerAccountId ?? "", label: profile.label, brokerName: profile.brokerName, currency: "USD", environment: "live" as const }],
        metrics: { balance: 1250, equity: 1250, margin: 0, freeMargin: 2400, currency: "USD", dailyProfit: 0 },
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
          return { accepted: false };
        },
        async modifyOrder() {
          return { accepted: false };
        },
        async closePosition() {
          return { accepted: false };
        },
        onEvent() {
          return () => {};
        },
      };
    },
  });
  const intentStore = createConnectionIntentStore(join(tempDir, "intents.json"));
  const providerRegistry = createStaticSnapTradeRegistry();

  const app = express();
  app.use(express.json());
  app.use("/api", createBrokersRouter(runtime, { intentStore, providerRegistry }));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api/brokers`;

  const createRes = await fetch(`${base}/connect-intents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brokerName: "Broker azioni/crypto supportati" }),
  });
  assert.equal(createRes.status, 201);
  const created = (await createRes.json()) as { intent: { id: string } };

  const verifyRes = await fetch(`${base}/connect-intents/${created.intent.id}/verify`, { method: "POST" });
  assert.equal(verifyRes.status, 200);
  const verified = (await verifyRes.json()) as {
    intent: { authorizationUrl?: string; sessionId?: string; providerKind?: string; providerAccountId?: string; displayStatus: string };
  };
  assert.equal(verified.intent.authorizationUrl, "https://portal.snaptrade.test/session");
  assert.equal(verified.intent.sessionId, "session-1");
  assert.equal(verified.intent.displayStatus, "Apri il portale sicuro e collega il conto broker.");
  assert.equal("providerKind" in verified.intent, false);
  assert.equal("providerAccountId" in verified.intent, false);

  const completeRes = await fetch(`${base}/connect-intents/${created.intent.id}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "authorization", tradingEnabled: true }),
  });
  assert.equal(completeRes.status, 200);
  const completed = (await completeRes.json()) as {
    profile: { id: string; providerKind: string; providerUserId?: string; providerAccountId?: string; accountPassword?: string };
    snapshot: { status: string; metrics: { balance: number } };
  };
  assert.equal(completed.profile.providerKind, "snaptrade-brokerage");
  assert.equal(completed.profile.providerUserId, "snap-user-1");
  assert.equal(completed.profile.providerAccountId, "snap-account-1");
  assert.equal("accountPassword" in completed.profile, false);
  assert.equal(completed.snapshot.status, "connected");

  assert.equal(await vault.getSecret(completed.profile.id, "snapTradeUserSecret"), "snap-secret-1");

  await new Promise<void>((resolve) => server.close(() => resolve()));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("broker snaptrade intent checks passed");
