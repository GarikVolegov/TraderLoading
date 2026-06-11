import assert from "node:assert/strict";
import express from "express";
import type { Request, Response } from "express";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createAccountBridgeRuntime } from "../services/accountBridge/accountBridgeRuntime.js";
import { createAccountProfileStore } from "../services/accountBridge/profileStore.js";
import { createAccountBridgeRouter } from "./account-bridge.js";

const tempDir = await mkdtemp(join(tmpdir(), "account-bridge-route-"));

try {
  const runtime = createAccountBridgeRuntime({
    adapter: "demo",
    mode: "demo",
    host: "127.0.0.1",
    port: 8765,
    importJournal: false,
    orderEnabled: false,
    orderAckTimeoutMs: 10_000,
  });
  const store = createAccountProfileStore(join(tempDir, "connections.json"));

  const app = express();
  app.use(express.json());
  app.use("/api", createAccountBridgeRouter({ store, runtime, requireProAccess: async () => true }));

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api/account/connections`;

  const createResponse = await fetch(baseUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      label: "FP Trading",
      mode: "live",
      adapter: "mt5-local-socket",
      host: "127.0.0.1",
      port: 8765,
      terminalPath: "C:\\MT5\\terminal64.exe",
      importJournal: true,
      orderEnabled: false,
      password: "must-not-return",
    }),
  });

  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()) as { profile: { id: string; label: string }; activeProfileId: string | null };
  assert.equal(created.profile.label, "FP Trading");
  assert.equal(created.activeProfileId, null);

  const activateResponse = await fetch(`${baseUrl}/${created.profile.id}/activate`, { method: "POST" });
  assert.equal(activateResponse.status, 200);
  const activated = (await activateResponse.json()) as { activeProfileId: string; snapshot: { adapter: string; mode: string } };
  assert.equal(activated.activeProfileId, created.profile.id);
  assert.equal(runtime.getConfig().adapter, "mt5-local-socket");
  assert.equal(runtime.getConfig().mode, "live");

  const listResponse = await fetch(baseUrl);
  assert.equal(listResponse.status, 200);
  const list = (await listResponse.json()) as { profiles: Array<Record<string, unknown>>; activeProfileId: string };
  assert.equal(list.activeProfileId, created.profile.id);
  assert.equal(list.profiles.length, 1);
  assert.equal("password" in list.profiles[0]!, false);

  const deleteResponse = await fetch(`${baseUrl}/${created.profile.id}`, { method: "DELETE" });
  assert.equal(deleteResponse.status, 204);

  const productionApp = express();
  productionApp.use(express.json());
  productionApp.use(createAccountBridgeRouter({ store, runtime, env: { NODE_ENV: "production" } }));
  const productionServer = createServer(productionApp);
  await new Promise<void>((resolve) => productionServer.listen(0, "127.0.0.1", resolve));
  const productionAddress = productionServer.address();
  assert.ok(productionAddress && typeof productionAddress === "object");
  const productionResponse = await fetch(`http://127.0.0.1:${productionAddress.port}/account/connections`);
  assert.equal(productionResponse.status, 410);
  await new Promise<void>((resolve) => productionServer.close(() => resolve()));

  const deniedApp = express();
  deniedApp.use(express.json());
  deniedApp.use("/api", createAccountBridgeRouter({
    store,
    runtime,
    requireProAccess: async (_req: Request, res: Response) => {
      res.status(402).json({ error: "pro_required", feature: "broker" });
      return false;
    },
  } as never));
  const deniedServer = createServer(deniedApp);
  await new Promise<void>((resolve) => deniedServer.listen(0, "127.0.0.1", resolve));
  const deniedAddress = deniedServer.address();
  assert.ok(deniedAddress && typeof deniedAddress === "object");
  const deniedResponse = await fetch(`http://127.0.0.1:${deniedAddress.port}/api/account/connections`);
  assert.equal(deniedResponse.status, 402);
  assert.deepEqual(await deniedResponse.json(), { error: "pro_required", feature: "broker" });
  await new Promise<void>((resolve) => deniedServer.close(() => resolve()));

  await runtime.stop();
  await new Promise<void>((resolve) => server.close(() => resolve()));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("account bridge route checks passed");
