import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import { WebSocket } from "ws";
import { attachAccountBridgeWebSocket } from "./socketServer.js";
import type { AccountBridgeEvent } from "./types.js";

const app = express();
const server = createServer(app);
let authCalls = 0;
const bridge = attachAccountBridgeWebSocket(server, {
  adapter: "demo",
  mode: "demo",
  host: "127.0.0.1",
  port: 8765,
  importJournal: false,
  orderEnabled: false,
  orderAckTimeoutMs: 10_000,
}, {
  authenticate: async () => {
    authCalls += 1;
    return { userId: "socket-test-user", source: "session" };
  },
  requireProAccess: async () => true,
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
assert.equal(authCalls, 1);

socket.close();
await bridge.close();
await new Promise<void>((resolve) => server.close(() => resolve()));

{
  const freeServer = createServer(express());
  const freeBridge = attachAccountBridgeWebSocket(freeServer, {
    adapter: "demo",
    mode: "demo",
    host: "127.0.0.1",
    port: 8765,
    importJournal: false,
    orderEnabled: false,
    orderAckTimeoutMs: 10_000,
  }, {
    authenticate: async () => ({ userId: "free-user", source: "session" }),
    requireProAccess: async () => false,
  } as never);

  await new Promise<void>((resolve) => {
    freeServer.listen(0, "127.0.0.1", resolve);
  });
  const freeAddress = freeServer.address();
  assert.ok(freeAddress && typeof freeAddress === "object");

  const freeSocket = new WebSocket(`ws://127.0.0.1:${freeAddress.port}/api/account/ws`);
  const statusCode = await new Promise<number>((resolve, reject) => {
    freeSocket.on("open", () => reject(new Error("Free account bridge socket opened")));
    freeSocket.on("unexpected-response", (_request, response) => {
      resolve(response.statusCode ?? 0);
    });
    freeSocket.on("error", reject);
  });

  assert.equal(statusCode, 402);
  await freeBridge.close();
  await new Promise<void>((resolve) => freeServer.close(() => resolve()));
}

{
  const rejectedServer = createServer(express());
  const rejectedBridge = attachAccountBridgeWebSocket(rejectedServer, {
    adapter: "demo",
    mode: "demo",
    host: "127.0.0.1",
    port: 8765,
    importJournal: false,
    orderEnabled: false,
    orderAckTimeoutMs: 10_000,
  }, {
    authenticate: async () => null,
  });

  await new Promise<void>((resolve) => {
    rejectedServer.listen(0, "127.0.0.1", resolve);
  });
  const rejectedAddress = rejectedServer.address();
  assert.ok(rejectedAddress && typeof rejectedAddress === "object");

  const rejectedSocket = new WebSocket(`ws://127.0.0.1:${rejectedAddress.port}/api/account/ws`);
  const closeCode = await new Promise<number>((resolve, reject) => {
    rejectedSocket.on("open", () => reject(new Error("Unauthenticated socket opened")));
    rejectedSocket.on("unexpected-response", (_request, response) => {
      resolve(response.statusCode ?? 0);
    });
    rejectedSocket.on("error", reject);
  });

  assert.equal(closeCode, 401);
  await rejectedBridge.close();
  await new Promise<void>((resolve) => rejectedServer.close(() => resolve()));
}

console.log("account bridge socket checks passed");
