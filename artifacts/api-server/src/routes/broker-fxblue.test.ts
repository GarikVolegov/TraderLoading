import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createBrokerVault } from "../services/brokerHub/brokerVault.js";
import { createBrokerProfileStore } from "../services/brokerHub/profileStore.js";
import { createBrokerHubRuntime } from "../services/brokerHub/runtime.js";
import { createBrokersRouter } from "./brokers.js";

const tempDir = await mkdtemp(join(tmpdir(), "broker-fxblue-route-"));

try {
  const runtime = createBrokerHubRuntime({
    store: createBrokerProfileStore(join(tempDir, "profiles.json")),
    vault: createBrokerVault({
      path: join(tempDir, "vault.json"),
      key: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    }),
    connectorFactory: (profile) => {
      const snapshot = {
        profileId: profile.id,
        status: "connected" as const,
        kind: "fxblue-account-sync" as const,
        providerKind: "fxblue-account-sync" as const,
        brokerName: profile.brokerName,
        tradingEnabled: false,
        accounts: [{ id: profile.accountId, label: profile.label, brokerName: profile.brokerName, currency: "USD", environment: "live" as const }],
        metrics: { balance: 10000, equity: 10050, margin: 0, freeMargin: 10050, currency: "USD", dailyProfit: 50 },
        positions: [],
        orders: [],
        lastUpdated: "2026-06-08T10:00:00.000Z",
      };
      return {
        async connect() { return snapshot; },
        async disconnect() {},
        async getAccounts() { return []; },
        async getSnapshot() { return snapshot; },
        async getPositions() { return []; },
        async getOrders() { return []; },
        async getDealsHistory() { return []; },
        async placeOrder() { return { accepted: false, reason: "read only" }; },
        async modifyOrder() { return { accepted: false, reason: "read only" }; },
        async closePosition() { return { accepted: false, reason: "read only" }; },
        onEvent() { return () => {}; },
      };
    },
  });

  const app = express();
  app.use(express.json());
  app.use("/api", createBrokersRouter(runtime));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api/brokers`;

  const createRes = await fetch(`${base}/fxblue/setup-intents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      platform: "MT5",
      brokerName: "FP Trading",
      server: "FPTrading-Live",
      accountNumber: "123456",
      environment: "live",
      investorPassword: "read-only-secret",
    }),
  });
  assert.equal(createRes.status, 201);
  const created = (await createRes.json()) as { intent: { id: string; accountNumber: string }; fxBlueUrl: string };
  assert.equal(created.intent.accountNumber, "123456");
  assert.equal(created.fxBlueUrl, "https://diagnostics.fxblue.com/accountsync.aspx");

  const verifyRes = await fetch(`${base}/fxblue/setup-intents/${created.intent.id}/verify-profile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fxBlueProfileRef: "trader-one" }),
  });
  assert.equal(verifyRes.status, 200);
  const verified = (await verifyRes.json()) as { intent: { status: string }; snapshot: { status: string } };
  assert.equal(verified.intent.status, "profile_verified");
  assert.equal(verified.snapshot.status, "connected");

  const completeRes = await fetch(`${base}/fxblue/setup-intents/${created.intent.id}/complete`, { method: "POST" });
  assert.equal(completeRes.status, 201);
  const completed = (await completeRes.json()) as {
    profile: { id: string; providerKind: string; tradingEnabled: boolean; capabilities: { placeOrders: boolean } };
    snapshot: { status: string };
  };
  assert.equal(completed.profile.providerKind, "fxblue-account-sync");
  assert.equal(completed.profile.tradingEnabled, false);
  assert.equal(completed.profile.capabilities.placeOrders, false);
  assert.equal(completed.snapshot.status, "connected");

  const profilesRes = await fetch(`${base}/profiles`);
  const profiles = (await profilesRes.json()) as { profiles: unknown[] };
  assert.equal(JSON.stringify(profiles).includes("read-only-secret"), false);

  const missingRes = await fetch(`${base}/fxblue/setup-intents/missing/complete`, { method: "POST" });
  assert.equal(missingRes.status, 404);

  const existingSyncRes = await fetch(`${base}/fxblue/setup-intents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      platform: "MT5",
      brokerName: "FP Trading",
      server: "FPTradingLLC-Live",
      accountNumber: "82364482",
      environment: "live",
    }),
  });
  assert.equal(existingSyncRes.status, 201);
  const existingSync = (await existingSyncRes.json()) as { intent: { id: string; accountNumber: string } };
  assert.equal(existingSync.intent.accountNumber, "82364482");

  const existingVerifyRes = await fetch(`${base}/fxblue/setup-intents/${existingSync.intent.id}/verify-profile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fxBlueProfileRef: "82364482" }),
  });
  assert.equal(existingVerifyRes.status, 200);

  const existingCompleteRes = await fetch(`${base}/fxblue/setup-intents/${existingSync.intent.id}/complete`, { method: "POST" });
  assert.equal(existingCompleteRes.status, 201);
  const existingCompleted = (await existingCompleteRes.json()) as { profile: { providerKind: string; tradingEnabled: boolean } };
  assert.equal(existingCompleted.profile.providerKind, "fxblue-account-sync");
  assert.equal(existingCompleted.profile.tradingEnabled, false);

  await new Promise<void>((resolve) => server.close(() => resolve()));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("fx blue broker route checks passed");
