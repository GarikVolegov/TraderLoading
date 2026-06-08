import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createBrokerVault } from "../services/brokerHub/brokerVault.js";
import { createCompanionStore } from "../services/brokerHub/companionStore.js";
import { createBrokerProfileStore } from "../services/brokerHub/profileStore.js";
import { createBrokerHubRuntime } from "../services/brokerHub/runtime.js";
import type { Mt5SmartLinkService } from "../services/brokerHub/mt5SmartLinkService.js";
import { createBrokersRouter } from "./brokers.js";

const tempDir = await mkdtemp(join(tmpdir(), "broker-smartlink-route-"));

try {
  const companionStore = createCompanionStore(join(tempDir, "companion.json"));
  const runtime = createBrokerHubRuntime({
    store: createBrokerProfileStore(join(tempDir, "profiles.json")),
    vault: createBrokerVault({
      path: join(tempDir, "vault.json"),
      key: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    }),
    companionStore,
  });

  let startedProfileId = "";
  const smartLinkService: Mt5SmartLinkService = {
    async start({ profileId }) {
      startedProfileId = profileId;
      return {
        profileId,
        status: "waiting_for_terminal",
        connected: false,
        terminalDetected: false,
        message: "MetaTrader 5 non rilevato. Apri MetaTrader 5 e riprova.",
      };
    },
    async status(profileId) {
      return {
        profileId,
        status: "waiting_for_snapshot",
        connected: false,
        terminalDetected: true,
        message: "MetaTrader rilevato. Attendo i dati del conto.",
      };
    },
    async login({ profileId, accountNumber, server }) {
      return {
        profileId,
        status: "waiting_for_snapshot",
        connected: false,
        terminalDetected: true,
        message: `Accesso richiesto per ${accountNumber} su ${server}.`,
      };
    },
    async stop(profileId) {
      return {
        profileId,
        status: "stopped",
        connected: false,
        terminalDetected: true,
        message: "SmartLink fermato.",
      };
    },
    async diagnostics(profileId) {
      return {
        profileId,
        checks: [
          { id: "terminal", label: "MetaTrader 5", ok: true, message: "Terminale rilevato." },
          { id: "account", label: "Conto", ok: false, message: "Apri il tuo conto in MetaTrader." },
        ],
      };
    },
  };

  const app = express();
  app.use(express.json());
  app.use("/api", createBrokersRouter(runtime, { companionStore, smartLinkService, enableLegacyConnectionRoutes: true }));
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

  const startRes = await fetch(`${base}/smartlink/mt5/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brokerName: "FP Trading", tradingEnabled: true }),
  });
  assert.equal(startRes.status, 201);
  const started = (await startRes.json()) as {
    profile: {
      id: string;
      route: string;
      providerKind: string;
      connectionStatus: string;
      health: string;
      terminalDetected: boolean;
      accountLoginMode: string;
    };
    status: { connected: boolean; message: string; terminalDetected: boolean };
    snapshot: { status: string; error?: string };
  };
  assert.equal(started.profile.route, "smartlink_mt5");
  assert.equal(started.profile.providerKind, "traderloading-mt5-smartlink");
  assert.equal(started.profile.connectionStatus, "connecting");
  assert.equal(started.profile.health, "waiting_for_companion");
  assert.equal(started.profile.terminalDetected, false);
  assert.equal(started.profile.accountLoginMode, "terminal_session");
  assert.equal(started.status.connected, false);
  assert.equal(started.status.terminalDetected, false);
  assert.equal(started.snapshot.status, "connecting");
  assert.equal(started.snapshot.error, "In attesa di TraderLoading SmartLink.");
  assert.equal(startedProfileId, started.profile.id);
  assert.equal(started.status.message.includes("MetaTrader 5"), true);

  const profilesRes = await fetch(`${base}/profiles`);
  const profiles = (await profilesRes.json()) as { activeProfileId: string | null };
  assert.equal(profiles.activeProfileId, started.profile.id);

  const statusRes = await fetch(`${base}/smartlink/mt5/status?profileId=${encodeURIComponent(started.profile.id)}`);
  assert.equal(statusRes.status, 200);
  const status = (await statusRes.json()) as { connected: boolean; terminalDetected: boolean; message: string };
  assert.equal(status.connected, false);
  assert.equal(status.terminalDetected, true);
  assert.equal(status.message, "MetaTrader rilevato. Attendo i dati del conto.");

  const loginRes = await fetch(`${base}/smartlink/mt5/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profileId: started.profile.id, accountNumber: "123456", password: "secret", server: "FPMarkets-Live" }),
  });
  assert.equal(loginRes.status, 200);
  const login = (await loginRes.json()) as { status: { connected: boolean; message: string }; profile: { accountLoginMode: string; server: string } };
  assert.equal(login.status.connected, false);
  assert.equal(login.profile.accountLoginMode, "credentials");
  assert.equal(login.profile.server, "FPMarkets-Live");
  assert.equal(login.status.message, "Accesso richiesto per 123456 su FPMarkets-Live.");

  const diagnosticsRes = await fetch(`${base}/smartlink/mt5/diagnostics?profileId=${encodeURIComponent(started.profile.id)}`);
  assert.equal(diagnosticsRes.status, 200);
  const diagnostics = (await diagnosticsRes.json()) as { checks: Array<{ id: string; ok: boolean; message: string }> };
  assert.equal(diagnostics.checks.length, 2);
  assert.equal(diagnostics.checks[0]?.id, "terminal");

  const snapshotRes = await fetch(`${base}/companion/snapshot`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      profileId: started.profile.id,
      token: "smartlink",
      account: { id: "123456", label: "FP Trading 123456", brokerName: "FP Trading", currency: "USD", environment: "live" },
      metrics: { balance: 1000, equity: 1008, margin: 20, freeMargin: 988, currency: "USD", dailyProfit: 8 },
      positions: [
        {
          id: "pos-buy-1",
          brokerPositionId: "ticket-buy-1",
          symbol: "EURUSD",
          side: "buy",
          volume: 0.2,
          entryPrice: 1.08,
          profit: 8,
          source: "traderloading-mt5-smartlink",
        },
      ],
      orders: [],
      capabilities: { placeOrders: true, closePositions: true },
    }),
  });
  assert.equal(snapshotRes.status, 200);

  const connectedSnapshotRes = await fetch(`${base}/profiles/${started.profile.id}/snapshot`);
  const connectedSnapshot = (await connectedSnapshotRes.json()) as { status: string; accounts: Array<{ id: string }>; metrics: { equity: number } };
  assert.equal(connectedSnapshot.status, "connected");
  assert.equal(connectedSnapshot.accounts[0]?.id, "123456");
  assert.equal(connectedSnapshot.metrics.equity, 1008);

  const closeRes = await fetch(`${base}/profiles/${started.profile.id}/positions/${encodeURIComponent("ticket-buy-1")}/close`, {
    method: "POST",
  });
  assert.equal(closeRes.status, 200);
  const closeResult = (await closeRes.json()) as { accepted: boolean; orderId: string };
  assert.equal(closeResult.accepted, true);
  const closePendingRes = await fetch(`${base}/companion/orders/pending?profileId=${encodeURIComponent(started.profile.id)}&token=smartlink`);
  assert.equal(closePendingRes.status, 200);
  const closePending = (await closePendingRes.json()) as { orders: Array<{ id: string; order: { symbol: string; side: string; volume: number; closePositionId?: string } }> };
  const closeOrder = closePending.orders.find((item) => item.id === closeResult.orderId);
  assert.equal(closeOrder?.order.symbol, "EURUSD");
  assert.equal(closeOrder?.order.side, "sell");
  assert.equal(closeOrder?.order.volume, 0.2);
  assert.equal(closeOrder?.order.closePositionId, "ticket-buy-1");

  const orderRes = await fetch(`${base}/profiles/${started.profile.id}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ symbol: "EURUSD", side: "buy", type: "market", volume: 0.1, clientRequestId: "smartlink-order-1" }),
  });
  assert.equal(orderRes.status, 200);
  const order = (await orderRes.json()) as { accepted: boolean; orderId: string };
  assert.equal(order.accepted, true);
  assert.equal(order.orderId, "smartlink-order-1");

  const pendingRes = await fetch(`${base}/companion/orders/pending?profileId=${encodeURIComponent(started.profile.id)}&token=smartlink`);
  assert.equal(pendingRes.status, 200);
  const pending = (await pendingRes.json()) as { orders: Array<{ id: string; order: { symbol: string } }> };
  assert.equal(pending.orders.some((item) => item.id === "smartlink-order-1" && item.order.symbol === "EURUSD"), true);

  const orderResultRes = await fetch(`${base}/companion/orders/smartlink-order-1/result`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profileId: started.profile.id, token: "smartlink", accepted: true, brokerOrderId: "mt5-1001" }),
  });
  assert.equal(orderResultRes.status, 200);
  const orderResult = (await orderResultRes.json()) as { order: { status: string; brokerOrderId: string } };
  assert.equal(orderResult.order.status, "filled");
  assert.equal(orderResult.order.brokerOrderId, "mt5-1001");

  const stopRes = await fetch(`${base}/smartlink/mt5/stop`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profileId: started.profile.id }),
  });
  assert.equal(stopRes.status, 200);
  const stopped = (await stopRes.json()) as { status: { status: string; connected: boolean; message: string } };
  assert.equal(stopped.status.status, "stopped");
  assert.equal(stopped.status.connected, false);

  await new Promise<void>((resolve) => server.close(() => resolve()));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("broker smartlink route checks passed");
