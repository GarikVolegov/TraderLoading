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

const tempDir = await mkdtemp(join(tmpdir(), "broker-credentials-route-"));

try {
  const vault = createBrokerVault({
    path: join(tempDir, "vault.json"),
    key: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  });
  const runtime = createBrokerHubRuntime({
    store: createBrokerProfileStore(join(tempDir, "profiles.json")),
    vault,
  });
  const intentStore = createConnectionIntentStore(join(tempDir, "intents.json"));

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const testUserId = req.headers["x-test-user"];
    if (typeof testUserId === "string") {
      req.user = {
        id: testUserId,
        email: null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
      };
    }
    next();
  });
  app.use("/api", createBrokersRouter(runtime, { intentStore, enableLegacyConnectionRoutes: true, requireProAccess: async () => true }));
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
  const created = (await createRes.json()) as { intent: { id: string } };

  const completeRes = await fetch(`${base}/connect-intents/${created.intent.id}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-test-user": "user-one" },
    body: JSON.stringify({
      mode: "credentials",
      accountNumber: "12345678",
      accountPassword: "broker-password",
      server: "FPMarkets-Live",
      tradingEnabled: false,
    }),
  });

  assert.equal(completeRes.status, 400);
  const completed = (await completeRes.json()) as { error: string; profile?: unknown };
  assert.equal(completed.error, "Collegamento reale non configurato sul server. Configura METAAPI_TOKEN.");
  assert.equal("profile" in completed, false);

  const rawVault = await vault.readRawForTest();
  assert.equal(rawVault.includes("broker-password"), false);

  const profilesRes = await fetch(`${base}/profiles`, { headers: { "x-test-user": "user-one" } });
  const profiles = (await profilesRes.json()) as { profiles: Array<Record<string, unknown>> };
  assert.equal(profiles.profiles.length, 0);

  await new Promise<void>((resolve) => server.close(() => resolve()));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("broker account credentials checks passed");
