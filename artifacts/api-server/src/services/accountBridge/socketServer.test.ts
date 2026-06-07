import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import { WebSocket } from "ws";
import { attachAccountBridgeWebSocket } from "./socketServer.js";
import type { AccountBridgeEvent } from "./types.js";

const app = express();
const server = createServer(app);
const bridge = attachAccountBridgeWebSocket(server, {
  adapter: "demo",
  mode: "demo",
  host: "127.0.0.1",
  port: 8765,
  importJournal: false,
  orderEnabled: false,
  orderAckTimeoutMs: 10_000,
});

await new Promise<void>((resolve) => {
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
assert.ok(address && typeof address === "object");

const received: AccountBridgeEvent[] = [];
const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/account/ws`);
let orderSent = false;

await new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Timed out waiting for order ack")), 1_000);

  socket.on("message", (data) => {
    const message = JSON.parse(String(data)) as AccountBridgeEvent;
    received.push(message);

    if (message.type === "snapshot" && !orderSent) {
      orderSent = true;
      socket.send(
        JSON.stringify({
          type: "place_order",
          requestId: "ws-req-1",
          payload: { symbol: "EURUSD", direction: "sell", volume: 0.2 },
        }),
      );
    }

    if (message.type === "order_ack" && message.requestId === "ws-req-1") {
      clearTimeout(timeout);
      resolve();
    }
  });

  socket.on("error", reject);
});

assert.ok(received.some((event) => event.type === "snapshot" && event.snapshot.status === "connected"));
assert.ok(received.some((event) => event.type === "positions_update" && event.openTrades.length === 1));
assert.ok(received.some((event) => event.type === "order_ack" && event.result.accepted));
assert.equal(received.filter((event) => event.type === "order_ack").length, 1);

socket.close();
await bridge.close();
await new Promise<void>((resolve) => server.close(() => resolve()));

console.log("account bridge socket checks passed");
