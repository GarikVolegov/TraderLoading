import assert from "node:assert/strict";
import {
  createFxBlueBrokerConnector,
  parseFxBlueOverviewScript,
  parseFxBlueProfileRef,
  parseFxBlueRss,
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

const overview = parseFxBlueOverviewScript(`if (!document.MTIntelligenceAccounts) document.MTIntelligenceAccounts = new Array();
document.MTIntelligenceAccounts.push({
"userid": "example","balance": 5232.54,"equity": 5232.54,"closedProfit": 232.54,"floatingProfit": 0,"freeMargin": 5232.54,"dailyBankedGrowth": 0.02,"totalOpenPositions": 0,"openAndPendingOrders": []});`, "example");
assert.equal(overview.metrics?.balance, 5232.54);
assert.equal(overview.metrics?.equity, 5232.54);
assert.equal(overview.metrics?.freeMargin, 5232.54);
assert.equal(overview.metrics?.dailyProfit, 0);

const rss = parseFxBlueRss(`<?xml version="1.0" encoding="iso-8859-1"?><rss version="2.0" xmlns:position="http://www.fxblue.com/positionrss" xmlns:account="http://www.fxblue.com/accountrss"><channel>
<item><title>Account summary</title><description><![CDATA[<table><tr><td>Balance:</td><td>AUD 2,264.22</td></tr></table>]]></description><account:balance>2264.22</account:balance><account:equity>2231.92</account:equity><account:floatingProfit>-32.3</account:floatingProfit><account:closedProfit>-2735.78</account:closedProfit><account:freeMargin>1416.06</account:freeMargin></item>
<item><title>Ticket #25038968: Buy 0.03 AUDCHF @ 0.74708 (open)</title><position:ticket>25038968</position:ticket><position:type>Open position</position:type><position:action>Buy</position:action><position:lots>0.03</position:lots><position:symbol>AUDCHF</position:symbol><position:openPrice>0.74708</position:openPrice><position:closePrice>0.74114</position:closePrice><position:openTime>Tue 16 Aug 2016 03:02:01</position:openTime><position:closeTime>Thu 1 Jan 1970 00:00:00</position:closeTime><position:profit>-24.04</position:profit><position:totalProfit>-24.04</position:totalProfit></item>
<item><title>Ticket #25038969: Sell 0.02 EURUSD @ 1.12000 (closed)</title><position:ticket>25038969</position:ticket><position:type>Closed position</position:type><position:action>Sell</position:action><position:lots>0.02</position:lots><position:symbol>EURUSD</position:symbol><position:openPrice>1.12</position:openPrice><position:closePrice>1.11</position:closePrice><position:openTime>Tue 16 Aug 2016 03:02:01</position:openTime><position:closeTime>Tue 16 Aug 2016 04:02:01</position:closeTime><position:profit>20</position:profit><position:totalProfit>20</position:totalProfit></item>
</channel></rss>`, "signalstart");
assert.equal(rss.account?.id, "signalstart");
assert.equal(rss.metrics?.currency, "AUD");
assert.equal(rss.metrics?.balance, 2264.22);
assert.equal(rss.positions?.length, 1);
assert.equal(rss.positions?.[0]?.symbol, "AUDCHF");
assert.equal(rss.positions?.[0]?.side, "buy");
assert.equal(rss.positions?.[0]?.markPrice, 0.74114);
assert.equal(rss.deals?.length, 1);
assert.equal(rss.deals?.[0]?.symbol, "EURUSD");
assert.equal(rss.deals?.[0]?.side, "sell");

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
