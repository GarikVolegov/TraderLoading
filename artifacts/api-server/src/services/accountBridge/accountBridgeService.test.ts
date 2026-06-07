import assert from "node:assert/strict";
import { createAccountBridgeService } from "./accountBridgeService.js";
import type { AccountBridgeEvent } from "./types.js";

const events: AccountBridgeEvent[] = [];
const service = createAccountBridgeService({
  adapter: "demo",
  mode: "demo",
  host: "127.0.0.1",
  port: 8765,
  importJournal: false,
  orderEnabled: false,
  orderAckTimeoutMs: 10_000,
});

const unsubscribe = service.onEvent((event) => {
  events.push(event);
});

await service.start();
const initial = await service.getSnapshot();

assert.equal(initial.status, "connected");
assert.equal(initial.adapter, "demo");
assert.equal(initial.mode, "demo");

const orderResult = await service.placeOrder(
  { symbol: "eurusd", direction: "buy", volume: "0.1" },
  "req-1",
);

assert.deepEqual(orderResult, { accepted: true, ticket: "DEMO-000001" });
assert.ok(events.some((event) => event.type === "positions_update"));
assert.ok(
  events.some(
    (event) =>
      event.type === "order_ack" &&
      event.requestId === "req-1" &&
      event.result.accepted &&
      event.result.ticket === "DEMO-000001",
  ),
);

const afterOrder = await service.getSnapshot();
assert.equal(afterOrder.openTrades.length, 1);
assert.equal(afterOrder.openTrades[0]?.symbol, "EURUSD");

unsubscribe();
await service.stop();

console.log("account bridge service checks passed");
