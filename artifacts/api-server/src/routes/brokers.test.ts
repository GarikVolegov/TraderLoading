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
  app.use("/api", createBrokersRouter(runtime, { requireProAccess: async () => true }));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api/brokers`;

  const createdRes = await fetch(`${base}/profiles`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-test-user": "user-one" },
    body: JSON.stringify({
      label: "Demo terminal",
      brokerName: "TraderLoading",
      kind: "demo",
      accountId: "DEMO-1",
      environment: "demo",
      tradingEnabled: true,
      ownerUserId: "attacker",
    }),
  });
  assert.equal(createdRes.status, 201);
  const created = (await createdRes.json()) as { profile: { id: string; ownerUserId: string } };
  assert.equal(created.profile.ownerUserId, "user-one");

  const anonymousListRes = await fetch(`${base}/profiles`);
  assert.equal(anonymousListRes.status, 401);

  const otherUserListRes = await fetch(`${base}/profiles`, {
    headers: { "x-test-user": "user-two" },
  });
  assert.equal(otherUserListRes.status, 200);
  const otherUserList = (await otherUserListRes.json()) as { profiles: unknown[] };
  assert.equal(otherUserList.profiles.length, 0);

  const otherUserConnectRes = await fetch(`${base}/profiles/${created.profile.id}/connect`, {
    method: "POST",
    headers: { "x-test-user": "user-two" },
  });
  assert.equal(otherUserConnectRes.status, 404);

  const connectRes = await fetch(`${base}/profiles/${created.profile.id}/connect`, {
    method: "POST",
    headers: { "x-test-user": "user-one" },
  });
  assert.equal(connectRes.status, 200);
  const connected = (await connectRes.json()) as { snapshot: { status: string } };
  assert.equal(connected.snapshot.status, "connected");

  const orderRes = await fetch(`${base}/profiles/${created.profile.id}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-test-user": "user-one" },
    body: JSON.stringify({ symbol: "EURUSD", side: "buy", type: "market", volume: 0.1 }),
  });
  assert.equal(orderRes.status, 200);
  const order = (await orderRes.json()) as { accepted: boolean };
  assert.equal(order.accepted, true);

  const snapshotRes = await fetch(`${base}/profiles/${created.profile.id}/snapshot`, {
    headers: { "x-test-user": "user-one" },
  });
  assert.equal(snapshotRes.status, 200);
  const snapshot = (await snapshotRes.json()) as { positions: unknown[] };
  assert.equal(snapshot.positions.length, 1);

  const historyRes = await fetch(`${base}/profiles/${created.profile.id}/history`, {
    headers: { "x-test-user": "user-one" },
  });
  assert.equal(historyRes.status, 200);
  const history = (await historyRes.json()) as unknown[];
  assert.equal(history.length, 1);

  await new Promise<void>((resolve) => server.close(() => resolve()));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("brokers route checks passed");
