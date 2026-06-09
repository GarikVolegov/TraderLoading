import assert from "node:assert/strict";
import { importBrokerAccountData, resultFromTradeNet } from "./accountDataSync.js";
import type { BrokerAccountProfile, BrokerDeal, BrokerSnapshot } from "./types.js";

const previousDatabaseUrl = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;

try {
  const profile: BrokerAccountProfile = {
    id: "profile-1",
    label: "FP Trading FX Blue",
    brokerName: "FP Trading",
    kind: "fxblue-account-sync",
    providerKind: "fxblue-account-sync",
    providerUserId: "trader-one",
    accountId: "123456",
    environment: "live",
    route: "fxblue_account_sync",
    health: "connected",
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
    connectionStatus: "connected",
    createdAt: "2026-06-09T00:00:00.000Z",
    updatedAt: "2026-06-09T00:00:00.000Z",
  };

  const snapshot: BrokerSnapshot = {
    profileId: profile.id,
    status: "connected",
    kind: "fxblue-account-sync",
    providerKind: "fxblue-account-sync",
    brokerName: "FP Trading",
    tradingEnabled: false,
    accounts: [{ id: "123456", label: "FP Trading", brokerName: "FP Trading", currency: "USD", environment: "live" }],
    metrics: { balance: 1000, equity: 1010, margin: 0, freeMargin: 1010, currency: "USD", dailyProfit: 10 },
    positions: [],
    orders: [],
    lastUpdated: "2026-06-09T10:00:00.000Z",
  };

  const deals: BrokerDeal[] = [{
    id: "ticket-1",
    symbol: "XAUUSD",
    side: "buy",
    volume: 0.1,
    entryPrice: 2300,
    exitPrice: 2310,
    stopLoss: 2295,
    profit: 100,
    openedAt: "2026-06-09T09:00:00.000Z",
    closedAt: "2026-06-09T09:30:00.000Z",
    source: "fxblue-account-sync",
  }];

  assert.equal(resultFromTradeNet({ profit: 10, commission: -2, swap: -1 }), "win");
  assert.equal(resultFromTradeNet({ profit: 5, commission: -8, swap: 0 }), "loss");
  assert.equal(resultFromTradeNet({ profit: 5, commission: -3, swap: -2 }), "breakeven");

  const result = await importBrokerAccountData({ profile, snapshot, deals });

  assert.equal(result.imported, 0);
  assert.equal(result.journalCreated, 0);
  assert.equal(result.skipped, 1);
  assert.equal(result.reason, "DATABASE_URL not configured");
} finally {
  if (previousDatabaseUrl) process.env.DATABASE_URL = previousDatabaseUrl;
}

console.log("broker account data sync checks passed");
