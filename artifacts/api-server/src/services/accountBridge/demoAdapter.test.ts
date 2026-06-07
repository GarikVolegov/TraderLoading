import assert from "node:assert/strict";
import { createDemoAccountAdapter } from "./demoAdapter.js";

const adapter = createDemoAccountAdapter();
await adapter.connect();

const initial = await adapter.getSnapshot();
assert.equal(initial.status, "connected");
assert.equal(initial.mode, "demo");
assert.equal(initial.orderEnabled, true);
assert.equal(initial.metrics.currency, "USD");

const result = await adapter.placeOrder({ symbol: "EURUSD", direction: "buy", volume: 0.1 });
assert.equal(result.accepted, true);
assert.ok(result.ticket);

const afterOrder = await adapter.getSnapshot();
assert.equal(afterOrder.openTrades.length, 1);

await adapter.disconnect();
const disconnected = await adapter.getSnapshot();
assert.equal(disconnected.status, "offline");

const listenerAdapter = createDemoAccountAdapter();
const originalConsoleError = console.error;
let laterListenerCalls = 0;
console.error = () => {};
try {
  listenerAdapter.onEvent(() => {
    throw new Error("listener failed");
  });
  listenerAdapter.onEvent(() => {
    laterListenerCalls += 1;
  });

  await assert.doesNotReject(() => listenerAdapter.connect());
  await assert.doesNotReject(() =>
    listenerAdapter.placeOrder({ symbol: "GBPUSD", direction: "sell", volume: 0.2 }),
  );
  assert.equal(laterListenerCalls, 3);
} finally {
  console.error = originalConsoleError;
}

const resultOwnershipAdapter = createDemoAccountAdapter();
await resultOwnershipAdapter.connect();
resultOwnershipAdapter.onEvent((event) => {
  if (event.type === "order_ack") {
    event.result.ticket = "MUTATED";
  }
});

const ownedResult = await resultOwnershipAdapter.placeOrder({ symbol: "USDJPY", direction: "buy", volume: 0.3 });
assert.equal(ownedResult.accepted, true);
assert.match(ownedResult.ticket ?? "", /^DEMO-\d{6}$/);
assert.notEqual(ownedResult.ticket, "MUTATED");

const snapshotIsolationAdapter = createDemoAccountAdapter();
let secondSnapshotBalance: number | undefined;
let secondSnapshotOpenTradeCount: number | undefined;
snapshotIsolationAdapter.onEvent((event) => {
  if (event.type === "snapshot") {
    event.snapshot.metrics.balance = -1;
    event.snapshot.openTrades.push({
      ticket: "MUTATED",
      symbol: "MUTATED",
      direction: "buy",
      volume: 1,
      openTime: new Date().toISOString(),
      entryPrice: 1,
      status: "open",
      source: "demo",
    });
  }
});
snapshotIsolationAdapter.onEvent((event) => {
  if (event.type === "snapshot") {
    secondSnapshotBalance = event.snapshot.metrics.balance;
    secondSnapshotOpenTradeCount = event.snapshot.openTrades.length;
  }
});
await snapshotIsolationAdapter.connect();
assert.equal(secondSnapshotBalance, 10_000);
assert.equal(secondSnapshotOpenTradeCount, 0);

const positionsIsolationAdapter = createDemoAccountAdapter();
let secondPositionsSymbol: string | undefined;
positionsIsolationAdapter.onEvent((event) => {
  if (event.type === "positions_update") {
    event.openTrades[0]!.symbol = "MUTATED";
  }
});
positionsIsolationAdapter.onEvent((event) => {
  if (event.type === "positions_update") {
    secondPositionsSymbol = event.openTrades[0]?.symbol;
  }
});
await positionsIsolationAdapter.connect();
await positionsIsolationAdapter.placeOrder({ symbol: "AUDUSD", direction: "buy", volume: 0.4 });
assert.equal(secondPositionsSymbol, "AUDUSD");

console.log("demo account adapter checks passed");
