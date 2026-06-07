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
import { createBrokersRouter } from "./brokers.js";

const tempDir = await mkdtemp(join(tmpdir(), "broker-intents-route-"));

try {
  const runtime = createBrokerHubRuntime({
    store: createBrokerProfileStore(join(tempDir, "profiles.json")),
    vault: createBrokerVault({
      path: join(tempDir, "vault.json"),
      key: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    }),
  });
  const intentStore = createConnectionIntentStore(join(tempDir, "intents.json"));

  const app = express();
  app.use(express.json());
  app.use("/api", createBrokersRouter(runtime, { intentStore }));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api/brokers`;

  const createRes = await fetch(`${base}/connect-intents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brokerName: "FP Trading" }),
  });
  assert.equal(createRes.status, 201);
  const created = (await createRes.json()) as {
    intent: { id: string; brokerName: string; displayStatus: string; safeDisplayStatus: string; recommendedRoute: string; detectedConnectorKind?: string };
  };
  assert.equal(created.intent.brokerName, "FP Trading");
  assert.equal(created.intent.displayStatus, "Collega FP Trading con SmartLink se hai MetaTrader, oppure con le credenziali broker.");
  assert.equal(created.intent.safeDisplayStatus, "Collega FP Trading con SmartLink se hai MetaTrader, oppure con le credenziali broker.");
  assert.equal(created.intent.recommendedRoute, "smartlink_mt5");
  assert.equal("detectedConnectorKind" in created.intent, false);

  const verifyRes = await fetch(`${base}/connect-intents/${created.intent.id}/verify`, { method: "POST" });
  assert.equal(verifyRes.status, 200);
  const verified = (await verifyRes.json()) as {
    intent: { requiredAction: string; displayStatus: string; safeDisplayStatus: string; detectedConnectorKind?: string };
  };
  assert.equal(verified.intent.requiredAction, "start_authorization");
  assert.equal(verified.intent.displayStatus, "Usa SmartLink se hai MetaTrader, oppure collega il conto con numero conto, server e password.");
  assert.equal(verified.intent.safeDisplayStatus, "Usa SmartLink se hai MetaTrader, oppure collega il conto con numero conto, server e password.");
  assert.equal("detectedConnectorKind" in verified.intent, false);

  const demoRes = await fetch(`${base}/connect-intents/${created.intent.id}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "demo" }),
  });
  assert.equal(demoRes.status, 200);
  const demo = (await demoRes.json()) as {
    intent: { status: string; profileId: string; displayStatus: string; detectedConnectorKind?: string };
    snapshot: { status: string };
  };
  assert.equal(demo.intent.status, "completed");
  assert.equal(demo.intent.displayStatus, "Conto collegato");
  assert.equal("detectedConnectorKind" in demo.intent, false);
  assert.equal(demo.snapshot.status, "connected");

  const advancedCreateRes = await fetch(`${base}/connect-intents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brokerName: "FP Trading" }),
  });
  const advancedCreated = (await advancedCreateRes.json()) as { intent: { id: string } };
  const advancedRes = await fetch(`${base}/connect-intents/${advancedCreated.intent.id}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: "advanced",
      platform: "mt5-vps",
      accountLabel: "FP Trading reale",
      accountId: "123456",
      host: "100.64.1.5",
      port: 8765,
      bridgeToken: "secret-token",
      tradingEnabled: true,
    }),
  });
  assert.equal(advancedRes.status, 200);
  const advanced = (await advancedRes.json()) as {
    intent: { profileId: string; displayStatus: string; detectedConnectorKind?: string };
  };
  assert.equal(advanced.intent.displayStatus, "Conto collegato");
  assert.equal("detectedConnectorKind" in advanced.intent, false);

  const profilesRes = await fetch(`${base}/profiles`);
  const profiles = (await profilesRes.json()) as { profiles: Array<{ id: string; kind: string; brokerName: string }> };
  const advancedProfile = profiles.profiles.find((profile) => profile.id === advanced.intent.profileId);
  assert.equal(advancedProfile?.kind, "mt5-vps-bridge");
  assert.equal(advancedProfile?.brokerName, "FP Trading");

  await new Promise<void>((resolve) => server.close(() => resolve()));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("broker connect intent route checks passed");
