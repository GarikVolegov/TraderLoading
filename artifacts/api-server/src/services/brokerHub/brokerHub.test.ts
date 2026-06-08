import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createBrokerVault } from "./brokerVault.js";
import { normalizeBrokerOrder } from "./orderValidation.js";
import { mapCTraderPosition, mapMt5Trade } from "./mappers.js";
import { createBrokerProfileStore } from "./profileStore.js";
import { createBrokerHubRuntime } from "./runtime.js";

const tempDir = await mkdtemp(join(tmpdir(), "broker-hub-"));

try {
  const order = normalizeBrokerOrder({
    symbol: " eurusd ",
    side: "BUY",
    type: "market",
    volume: "0.10",
    stopLoss: "1.0700",
    takeProfit: "1.0900",
  });

  assert.equal(order.ok, true);
  if (order.ok) {
    assert.equal(order.order.symbol, "EURUSD");
    assert.equal(order.order.side, "buy");
    assert.equal(order.order.volume, 0.1);
    assert.equal(order.order.timeInForce, "gtc");
    assert.ok(order.order.clientRequestId.startsWith("order-"));
  }

  const vault = createBrokerVault({
    path: join(tempDir, "vault.json"),
    key: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  });
  await vault.setSecret("profile-1", "accessToken", "secret-token");
  assert.equal(await vault.getSecret("profile-1", "accessToken"), "secret-token");
  const rawVault = await vault.readRawForTest();
  assert.equal(rawVault.includes("secret-token"), false);

  const mt5Position = mapMt5Trade({
    ticket: "1001",
    symbol: "xauusd",
    direction: "buy",
    volume: 0.2,
    openTime: "2026-06-06T10:00:00.000Z",
    entryPrice: 2350.5,
    profit: 12.3,
    status: "open",
  });
  assert.deepEqual(mt5Position, {
    id: "1001",
    brokerPositionId: "1001",
    symbol: "XAUUSD",
    side: "buy",
    volume: 0.2,
    entryPrice: 2350.5,
    markPrice: undefined,
    profit: 12.3,
    openedAt: "2026-06-06T10:00:00.000Z",
    source: "mt5-vps-bridge",
  });

  const cTraderPosition = mapCTraderPosition({
    positionId: 42,
    tradeData: { symbolId: 1, volume: 10000, tradeSide: "SELL", openTimestamp: 1780000000000 },
    price: 1.2345,
    unrealizedNetProfit: -4.2,
  }, { 1: "EURUSD" });
  assert.equal(cTraderPosition.id, "42");
  assert.equal(cTraderPosition.side, "sell");
  assert.equal(cTraderPosition.volume, 0.1);
  assert.equal(cTraderPosition.symbol, "EURUSD");

  const store = createBrokerProfileStore(join(tempDir, "profiles.json"));
  const demoProfile = await store.saveProfile({
    label: "Demo multi-asset",
    brokerName: "TraderLoading",
    kind: "demo",
    accountId: "DEMO-1",
    environment: "demo",
    tradingEnabled: false,
    password: "must-not-persist",
  });
  const mt5Profile = await store.saveProfile({
    label: "FP MT5 VPS",
    brokerName: "FP Trading",
    kind: "mt5-vps-bridge",
    accountId: "MT5-1",
    environment: "live",
    tradingEnabled: true,
    host: "100.64.1.2",
    port: 8765,
    bridgeTokenRef: "mt5-token",
  });
  const fxBlueProfile = await store.saveProfile({
    label: "FX Blue account",
    brokerName: "FX Blue",
    kind: "fxblue-account-sync",
    providerKind: "fxblue-account-sync",
    providerUserId: "trader-one",
    accountId: "123456",
    environment: "live",
    tradingEnabled: true,
    investorPassword: "must-not-persist",
  });
  assert.equal(fxBlueProfile.kind, "fxblue-account-sync");
  assert.equal(fxBlueProfile.route, "fxblue_account_sync");
  assert.equal(fxBlueProfile.health, "waiting_for_fxblue_sync");
  assert.equal(fxBlueProfile.tradingEnabled, true);
  assert.equal(fxBlueProfile.capabilities.placeOrders, false);
  assert.equal("investorPassword" in (fxBlueProfile as object), false);

  const profiles = await store.listProfiles();
  assert.equal(profiles.profiles.length, 3);
  assert.equal("password" in (profiles.profiles[0] as object), false);
  assert.equal(profiles.profiles[1]?.kind, "mt5-vps-bridge");
  assert.equal(profiles.profiles[1]?.host, "100.64.1.2");

  const runtime = createBrokerHubRuntime({ store, vault });
  const connected = await runtime.connectProfile(demoProfile.id);
  assert.equal(connected.snapshot.status, "connected");
  assert.equal(connected.snapshot.accounts[0]?.id, "DEMO-1");

  const rejected = await runtime.placeOrder(demoProfile.id, {
    symbol: "EURUSD",
    side: "buy",
    type: "market",
    volume: 0.1,
  });
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reason, "Live order sending is disabled for this broker profile");

  await store.saveProfile({ ...demoProfile, tradingEnabled: true });
  await runtime.connectProfile(demoProfile.id);
  const accepted = await runtime.placeOrder(demoProfile.id, {
    symbol: "EURUSD",
    side: "buy",
    type: "market",
    volume: 0.1,
  });
  assert.equal(accepted.accepted, true);
  assert.ok(accepted.orderId);

  const history = await runtime.getHistory(demoProfile.id);
  assert.equal(history.length, 1);

  await vault.setSecret(mt5Profile.id, "bridgeToken", "bridge-secret");
  assert.equal(await vault.getSecret(mt5Profile.id, "bridgeToken"), "bridge-secret");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("broker hub checks passed");
