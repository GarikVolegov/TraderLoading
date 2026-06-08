import assert from "node:assert/strict";
import {
  createFxBlueBrokerConnector,
  parseFxBlueProfileRef,
  type FxBlueFetchPayload,
} from "./fxBlueConnector.js";
import type { BrokerAccountProfile } from "./types.js";

const profile: BrokerAccountProfile = {
  id: "profile-fxblue",
  label: "FX Blue EURUSD",
  brokerName: "FX Blue",
  kind: "fxblue-account-sync",
  providerKind: "fxblue-account-sync",
  providerUserId: "trader-one",
  providerAccountId: "trader-one",
  accountId: "123456",
  environment: "live",
  route: "fxblue_account_sync",
  health: "waiting_for_fxblue_sync",
  tradingEnabled: false,
  capabilities: {
    readAccount: true,
    readPositions: true,
    readHistory: true,
    placeOrders: false,
    closePositions: false,
    realtimeUpdates: false,
    requiresTerminal: false,
  },
  connectionStatus: "offline",
  createdAt: "2026-06-08T00:00:00.000Z",
  updatedAt: "2026-06-08T00:00:00.000Z",
};

assert.equal(parseFxBlueProfileRef("trader-one"), "trader-one");
assert.equal(parseFxBlueProfileRef(" https://www.fxblue.com/users/trader-one/stats "), "trader-one");
assert.equal(parseFxBlueProfileRef("https://www.fxblue.com/users/trader-one,other/publication"), "trader-one");
assert.throws(() => parseFxBlueProfileRef("https://example.com/users/trader-one"), /Inserisci username o URL FX Blue valido/);

const payload: FxBlueFetchPayload = {
  account: {
    id: "123456",
    label: "FP Trading 123456",
    brokerName: "FP Trading",
    currency: "USD",
    environment: "live",
  },
  metrics: {
    balance: 10000.5,
    equity: 10042.25,
    margin: 120,
    freeMargin: 9922.25,
    dailyProfit: 42.25,
    currency: "USD",
  },
  positions: [
    {
      id: "pos-1",
      symbol: "eurusd",
      side: "BUY",
      volume: 0.1,
      entryPrice: 1.08,
      markPrice: 1.083,
      profit: 30,
      openedAt: "2026-06-08T10:00:00.000Z",
    },
  ],
  deals: [
    {
      id: "deal-1",
      symbol: "xauusd",
      side: "sell",
      volume: 0.2,
      entryPrice: 2340,
      exitPrice: 2330,
      profit: 20,
      openedAt: "2026-06-07T10:00:00.000Z",
      closedAt: "2026-06-07T11:00:00.000Z",
    },
  ],
};

const connector = createFxBlueBrokerConnector(profile, {
  fetchProfile: async (username) => {
    assert.equal(username, "trader-one");
    return payload;
  },
});

const snapshot = await connector.connect();
assert.equal(snapshot.status, "connected");
assert.equal(snapshot.kind, "fxblue-account-sync");
assert.equal(snapshot.providerKind, "fxblue-account-sync");
assert.equal(snapshot.tradingEnabled, false);
assert.equal(snapshot.accounts[0]?.id, "123456");
assert.equal(snapshot.metrics.equity, 10042.25);
assert.equal(snapshot.positions[0]?.symbol, "EURUSD");
assert.equal(snapshot.positions[0]?.source, "fxblue-account-sync");

const history = await connector.getDealsHistory();
assert.equal(history.length, 1);
assert.equal(history[0]?.symbol, "XAUUSD");
assert.equal(history[0]?.source, "fxblue-account-sync");

const rejectedOrder = await connector.placeOrder({
  symbol: "EURUSD",
  side: "buy",
  type: "market",
  volume: 0.1,
  timeInForce: "gtc",
  clientRequestId: "order-1",
});
assert.equal(rejectedOrder.accepted, false);
assert.match(rejectedOrder.reason ?? "", /sola lettura/i);

const rejectedClose = await connector.closePosition("pos-1");
assert.equal(rejectedClose.accepted, false);
assert.match(rejectedClose.reason ?? "", /sola lettura/i);

const waiting = createFxBlueBrokerConnector(
  { ...profile, providerUserId: "waiting-user" },
  { fetchProfile: async () => ({ status: "waiting" }) },
);
const waitingSnapshot = await waiting.connect();
assert.equal(waitingSnapshot.status, "connecting");
assert.equal(waitingSnapshot.error, "FX Blue non ha ancora pubblicato il primo sync leggibile.");

const privateProfile = createFxBlueBrokerConnector(
  { ...profile, providerUserId: "private-user" },
  { fetchProfile: async () => ({ status: "private" }) },
);
const privateSnapshot = await privateProfile.connect();
assert.equal(privateSnapshot.status, "error");
assert.equal(privateSnapshot.error, "Profilo FX Blue privato o feed non accessibile.");

console.log("fx blue connector checks passed");
