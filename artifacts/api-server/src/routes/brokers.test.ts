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

const tempDir = await mkdtemp(join(tmpdir(), "brokers-route-"));

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
  app.use("/api", createBrokersRouter(runtime));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api/brokers`;

  const createdRes = await fetch(`${base}/profiles`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      label: "Demo terminal",
      brokerName: "TraderLoading",
      kind: "demo",
      accountId: "DEMO-1",
      environment: "demo",
      tradingEnabled: true,
    }),
  });
  assert.equal(createdRes.status, 201);
  const created = (await createdRes.json()) as { profile: { id: string } };

  const connectRes = await fetch(`${base}/profiles/${created.profile.id}/connect`, { method: "POST" });
  assert.equal(connectRes.status, 200);
  const connected = (await connectRes.json()) as { snapshot: { status: string } };
  assert.equal(connected.snapshot.status, "connected");

  const orderRes = await fetch(`${base}/profiles/${created.profile.id}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ symbol: "EURUSD", side: "buy", type: "market", volume: 0.1 }),
  });
  assert.equal(orderRes.status, 200);
  const order = (await orderRes.json()) as { accepted: boolean };
  assert.equal(order.accepted, true);

  const snapshotRes = await fetch(`${base}/profiles/${created.profile.id}/snapshot`);
  assert.equal(snapshotRes.status, 200);
  const snapshot = (await snapshotRes.json()) as { positions: unknown[] };
  assert.equal(snapshot.positions.length, 1);

  const historyRes = await fetch(`${base}/profiles/${created.profile.id}/history`);
  assert.equal(historyRes.status, 200);
  const history = (await historyRes.json()) as unknown[];
  assert.equal(history.length, 1);

  await new Promise<void>((resolve) => server.close(() => resolve()));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("brokers route checks passed");
