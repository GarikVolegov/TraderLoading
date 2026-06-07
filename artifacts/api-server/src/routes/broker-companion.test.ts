import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createBrokerAuditLog } from "../services/brokerHub/auditLog.js";
import { createBrokerVault } from "../services/brokerHub/brokerVault.js";
import { createCompanionStore } from "../services/brokerHub/companionStore.js";
import { createBrokerProfileStore } from "../services/brokerHub/profileStore.js";
import { createBrokerHubRuntime } from "../services/brokerHub/runtime.js";
import { createBrokersRouter } from "./brokers.js";

const tempDir = await mkdtemp(join(tmpdir(), "broker-companion-route-"));

try {
  const companionStore = createCompanionStore(join(tempDir, "companion.json"));
  const runtime = createBrokerHubRuntime({
    store: createBrokerProfileStore(join(tempDir, "profiles.json")),
    vault: createBrokerVault({
      path: join(tempDir, "vault.json"),
      key: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    }),
    auditLog: createBrokerAuditLog(join(tempDir, "audit.ndjson")),
    companionStore,
  });

  const app = express();
  app.use(express.json());
  app.use("/api", createBrokersRouter(runtime, { companionStore }));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api/brokers`;

  const catalogRes = await fetch(`${base}/catalog`);
  assert.equal(catalogRes.status, 200);
  const catalog = (await catalogRes.json()) as {
    brokers: Array<{ displayName: string; recommendedRoute: string; primaryProviderKind: string; userFields: string[] }>;
  };
  const fpTrading = catalog.brokers.find((broker) => broker.displayName === "FP Trading");
  assert.equal(fpTrading?.recommendedRoute, "smartlink_mt5");
  assert.equal(fpTrading?.primaryProviderKind, "traderloading-mt5-smartlink");
  assert.deepEqual(fpTrading?.userFields, []);

  const intentRes = await fetch(`${base}/connect-intents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brokerName: "FP Trading" }),
  });
  assert.equal(intentRes.status, 201);
  const intentCreated = (await intentRes.json()) as {
    intent: { id: string; recommendedRoute: string; safeDisplayStatus: string; availableRoutes: string[] };
  };
  assert.equal(intentCreated.intent.recommendedRoute, "smartlink_mt5");
  assert.equal(intentCreated.intent.safeDisplayStatus, "Collega FP Trading con SmartLink se hai MetaTrader, oppure con le credenziali broker.");
  assert.ok(intentCreated.intent.availableRoutes.includes("file_import"));

  const pairingRes = await fetch(`${base}/companion/pairing`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brokerName: "FP Trading", tradingEnabled: true }),
  });
  assert.equal(pairingRes.status, 201);
  const pairing = (await pairingRes.json()) as {
    profile: { id: string; route: string; health: string; connectionStatus: string; providerKind: string; tradingEnabled: boolean };
    pairing: { token: string; expiresAt: string; instructions: string[] };
  };
  assert.equal(pairing.profile.route, "local_companion");
  assert.equal(pairing.profile.health, "waiting_for_companion");
  assert.equal(pairing.profile.connectionStatus, "connecting");
  assert.equal(pairing.profile.providerKind, "metatrader-local-companion");
  assert.equal(pairing.profile.tradingEnabled, true);
  assert.ok(pairing.pairing.token.length >= 24);
  assert.ok(pairing.pairing.instructions.some((line) => line.includes("TraderLoading Connector")));

  const connectorDownloadRes = await fetch(`${base}/companion/downloads/mt5-ea`);
  assert.equal(connectorDownloadRes.status, 200);
  assert.equal(connectorDownloadRes.headers.get("content-type")?.includes("text/plain"), true);
  assert.equal(connectorDownloadRes.headers.get("content-disposition")?.includes("TraderLoadingConnector.mq5"), true);
  const connectorSource = await connectorDownloadRes.text();
  assert.equal(connectorSource.includes("TraderLoading Connector for MetaTrader 5"), true);

  const settingsDownloadRes = await fetch(
    `${base}/companion/downloads/mt5-settings?profileId=${encodeURIComponent(pairing.profile.id)}&token=${encodeURIComponent(pairing.pairing.token)}&tradingEnabled=true`,
  );
  assert.equal(settingsDownloadRes.status, 200);
  assert.equal(settingsDownloadRes.headers.get("content-disposition")?.includes("TraderLoadingConnector.set"), true);
  const settingsSource = await settingsDownloadRes.text();
  assert.equal(settingsSource.includes(`ProfileId=${pairing.profile.id}`), true);
  assert.equal(settingsSource.includes(`PairingCode=${pairing.pairing.token}`), true);
  assert.equal(settingsSource.includes("AllowLiveTrading=true"), true);

  const initialStatusRes = await fetch(`${base}/companion/status/${pairing.profile.id}`);
  assert.equal(initialStatusRes.status, 200);
  const initialStatus = (await initialStatusRes.json()) as { health: string; connected: boolean; message: string };
  assert.equal(initialStatus.health, "waiting_for_companion");
  assert.equal(initialStatus.connected, false);
  assert.equal(initialStatus.message, "In attesa del TraderLoading Connector.");

  const profilesAfterPairingRes = await fetch(`${base}/profiles`);
  const profilesAfterPairing = (await profilesAfterPairingRes.json()) as { activeProfileId: string | null };
  assert.equal(profilesAfterPairing.activeProfileId, pairing.profile.id);

  const connectBeforeSnapshotRes = await fetch(`${base}/profiles/${pairing.profile.id}/connect`, { method: "POST" });
  assert.equal(connectBeforeSnapshotRes.status, 200);
  const connectBeforeSnapshot = (await connectBeforeSnapshotRes.json()) as { snapshot: { status: string; error?: string } };
  assert.equal(connectBeforeSnapshot.snapshot.status, "connecting");
  assert.equal(connectBeforeSnapshot.snapshot.error, "In attesa del TraderLoading Connector.");

  const orderBeforeHeartbeatRes = await fetch(`${base}/profiles/${pairing.profile.id}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ symbol: "EURUSD", side: "buy", type: "market", volume: 0.1 }),
  });
  assert.equal(orderBeforeHeartbeatRes.status, 200);
  const rejectedOrder = (await orderBeforeHeartbeatRes.json()) as { accepted: boolean; reason: string };
  assert.equal(rejectedOrder.accepted, false);
  assert.equal(rejectedOrder.reason, "Il TraderLoading Connector non e' sincronizzato. Apri MetaTrader e aggiorna il conto.");

  const heartbeatRes = await fetch(`${base}/companion/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profileId: pairing.profile.id, token: pairing.pairing.token, terminal: "MetaTrader 5" }),
  });
  assert.equal(heartbeatRes.status, 200);
  const heartbeat = (await heartbeatRes.json()) as { health: string };
  assert.equal(heartbeat.health, "stale");

  const snapshotRes = await fetch(`${base}/companion/snapshot`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      profileId: pairing.profile.id,
      token: pairing.pairing.token,
      account: { id: "123456", label: "FP Trading 123456", brokerName: "FP Trading", currency: "USD", environment: "live" },
      metrics: { balance: 1000, equity: 1012, margin: 20, freeMargin: 992, currency: "USD", dailyProfit: 12 },
      positions: [
        {
          id: "pos-1",
          brokerPositionId: "1001",
          symbol: "EURUSD",
          side: "buy",
          volume: 0.1,
          entryPrice: 1.08,
          profit: 12,
          source: "metatrader-local-companion",
        },
      ],
      orders: [],
      capabilities: { placeOrders: true, closePositions: true },
    }),
  });
  assert.equal(snapshotRes.status, 200);
  const snapshotAck = (await snapshotRes.json()) as { profile: { accountId: string; health: string }; snapshot: { status: string } };
  assert.equal(snapshotAck.profile.accountId, "123456");
  assert.equal(snapshotAck.profile.health, "connected");
  assert.equal(snapshotAck.snapshot.status, "connected");

  const snapshotAfterRes = await fetch(`${base}/profiles/${pairing.profile.id}/snapshot`);
  const snapshotAfter = (await snapshotAfterRes.json()) as { status: string; accounts: Array<{ id: string }>; positions: unknown[] };
  assert.equal(snapshotAfter.status, "connected");
  assert.equal(snapshotAfter.accounts[0]?.id, "123456");
  assert.equal(snapshotAfter.positions.length, 1);

  const connectedStatusRes = await fetch(`${base}/companion/status/${pairing.profile.id}`);
  assert.equal(connectedStatusRes.status, 200);
  const connectedStatus = (await connectedStatusRes.json()) as { health: string; connected: boolean; message: string };
  assert.equal(connectedStatus.health, "connected");
  assert.equal(connectedStatus.connected, true);
  assert.equal(connectedStatus.message, "Conto sincronizzato.");

  const orderRes = await fetch(`${base}/profiles/${pairing.profile.id}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ symbol: "EURUSD", side: "sell", type: "market", volume: 0.1, clientRequestId: "client-1" }),
  });
  assert.equal(orderRes.status, 200);
  const pendingOrder = (await orderRes.json()) as { accepted: boolean; orderId: string };
  assert.equal(pendingOrder.accepted, true);
  assert.equal(pendingOrder.orderId, "client-1");

  const pendingRes = await fetch(`${base}/companion/orders/pending?profileId=${encodeURIComponent(pairing.profile.id)}&token=${encodeURIComponent(pairing.pairing.token)}`);
  assert.equal(pendingRes.status, 200);
  const pending = (await pendingRes.json()) as { orders: Array<{ order: { symbol: string; side: string } }> };
  assert.equal(pending.orders.length, 1);
  assert.equal(pending.orders[0]?.order.symbol, "EURUSD");

  const resultRes = await fetch(`${base}/companion/orders/client-1/result`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profileId: pairing.profile.id, token: pairing.pairing.token, accepted: true, brokerOrderId: "broker-1" }),
  });
  assert.equal(resultRes.status, 200);
  const result = (await resultRes.json()) as { order: { status: string; brokerOrderId: string } };
  assert.equal(result.order.status, "filled");
  assert.equal(result.order.brokerOrderId, "broker-1");

  const historyRes = await fetch(`${base}/companion/history`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      profileId: pairing.profile.id,
      token: pairing.pairing.token,
      deals: [{ id: "deal-1", symbol: "EURUSD", side: "sell", volume: 0.1, profit: 4, source: "metatrader-local-companion" }],
    }),
  });
  assert.equal(historyRes.status, 200);

  const dealsRes = await fetch(`${base}/profiles/${pairing.profile.id}/history`);
  const deals = (await dealsRes.json()) as Array<{ id: string; profit: number }>;
  assert.equal(deals.length, 1);
  assert.equal(deals[0]?.id, "deal-1");

  const importRes = await fetch(`${base}/import/history`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      brokerName: "Broker non supportato",
      accountLabel: "Broker non supportato import",
      accountId: "IMPORT-1",
      deals: [{ id: "import-deal-1", symbol: "XAUUSD", side: "buy", volume: 0.2, profit: 18, source: "metatrader-local-companion" }],
    }),
  });
  assert.equal(importRes.status, 201);
  const imported = (await importRes.json()) as { profile: { id: string; route: string; health: string; capabilities: { placeOrders: boolean } } };
  assert.equal(imported.profile.route, "file_import");
  assert.equal(imported.profile.health, "import_only");
  assert.equal(imported.profile.capabilities.placeOrders, false);

  const importedHistoryRes = await fetch(`${base}/profiles/${imported.profile.id}/history`);
  const importedHistory = (await importedHistoryRes.json()) as Array<{ id: string; symbol: string; profit: number }>;
  assert.equal(importedHistory.length, 1);
  assert.equal(importedHistory[0]?.id, "import-deal-1");

  await new Promise<void>((resolve) => server.close(() => resolve()));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("broker companion route checks passed");
