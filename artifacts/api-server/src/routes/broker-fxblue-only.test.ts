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

const tempDir = await mkdtemp(join(tmpdir(), "broker-fxblue-only-route-"));

try {
  const runtime = createBrokerHubRuntime({
    store: createBrokerProfileStore(join(tempDir, "profiles.json")),
    vault: createBrokerVault({
      path: join(tempDir, "vault.json"),
      key: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    }),
  });

  const app = express();
  app.use(express.json());
  app.use("/api", createBrokersRouter(runtime, { requireProAccess: async () => true }));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api/brokers`;

  const catalogRes = await fetch(`${base}/catalog`);
  assert.equal(catalogRes.status, 200);
  const catalog = (await catalogRes.json()) as {
    brokers: Array<{ displayName: string; recommendedRoute: string; primaryProviderKind: string; availableRoutes: string[] }>;
  };
  assert.equal(catalog.brokers.length, 1);
  assert.equal(catalog.brokers[0]?.displayName, "FX Blue Account Sync");
  assert.equal(catalog.brokers[0]?.recommendedRoute, "fxblue_account_sync");
  assert.equal(catalog.brokers[0]?.primaryProviderKind, "fxblue-account-sync");
  assert.deepEqual(catalog.brokers[0]?.availableRoutes, ["fxblue_account_sync"]);

  for (const blocked of [
    { method: "POST", path: "/connect-intents", body: { brokerName: "FP Trading" } },
    { method: "POST", path: "/companion/pairing", body: { brokerName: "FP Trading" } },
    { method: "POST", path: "/smartlink/mt5/start", body: { brokerName: "FP Trading" } },
    { method: "POST", path: "/import/history", body: { deals: [{ id: "d1" }] } },
  ]) {
    const res = await fetch(`${base}${blocked.path}`, {
      method: blocked.method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(blocked.body),
    });
    assert.equal(res.status, 410, blocked.path);
    const data = (await res.json()) as { error: string };
    assert.match(data.error, /FX Blue Account Sync/);
  }

  await new Promise<void>((resolve) => server.close(() => resolve()));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("fx blue only broker route checks passed");
