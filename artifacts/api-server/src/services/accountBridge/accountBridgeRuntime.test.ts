import assert from "node:assert/strict";
import { createAccountBridgeRuntime } from "./accountBridgeRuntime.js";
import type { AccountBridgeConfig } from "./types.js";

const readonlyDemo: AccountBridgeConfig = {
  adapter: "demo",
  mode: "demo",
  host: "127.0.0.1",
  port: 8765,
  importJournal: false,
  orderEnabled: false,
  orderAckTimeoutMs: 10_000,
};

const tradingDemo: AccountBridgeConfig = {
  ...readonlyDemo,
  orderEnabled: true,
};

const runtime = createAccountBridgeRuntime(readonlyDemo);

await runtime.start();
const first = await runtime.getSnapshot();
assert.equal(first.adapter, "demo");
assert.equal(runtime.getConfig().orderEnabled, false);

const switched = await runtime.activateConfig(tradingDemo);
assert.equal(switched.adapter, "demo");
assert.equal(runtime.getConfig().orderEnabled, true);

const order = await runtime.placeOrder({ symbol: "EURUSD", direction: "buy", volume: 0.1 }, "runtime-order");
assert.deepEqual(order, { accepted: true, ticket: "DEMO-000001" });

const afterOrder = await runtime.getSnapshot();
assert.equal(afterOrder.openTrades.length, 1);
assert.equal(afterOrder.openTrades[0]?.symbol, "EURUSD");

await runtime.stop();

console.log("account bridge runtime checks passed");
