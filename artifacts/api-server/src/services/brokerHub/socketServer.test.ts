import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import { WebSocket } from "ws";
import { attachBrokerHubWebSocket } from "./socketServer.js";
import type { BrokerHubRuntime } from "./runtime.js";
import type { BrokerEvent } from "./types.js";

const runtime: BrokerHubRuntime = {
  async listProfiles() {
    return { profiles: [], activeProfileId: null };
  },
  async saveProfile() {
    throw new Error("not used");
  },
  async deleteProfile() {
    throw new Error("not used");
  },
  async connectProfile() {
    throw new Error("not used");
  },
  async disconnectProfile() {
    throw new Error("not used");
  },
  async refreshProfile() {
    throw new Error("not used");
  },
  async getSnapshot() {
    throw new Error("not used");
  },
  async getHistory() {
    return [];
  },
  async placeOrder() {
    return { accepted: false };
  },
  async closePosition() {
    return { accepted: false };
  },
  async setSecret() {},
  async getSecret() {
    return null;
  },
  async deleteSecrets() {},
  onEvent() {
    return () => undefined;
  },
  async close() {},
};

const server = createServer(express());
let authCalls = 0;
const socketServer = attachBrokerHubWebSocket(server, runtime, {
  authenticate: async () => {
    authCalls += 1;
    return { userId: "broker-socket-test-user", source: "session" };
  },
  requireProAccess: async () => true,
});

await new Promise<void>((resolve) => {
  server.listen(0, "127.0.0.1", resolve);
});
const address = server.address();
assert.ok(address && typeof address === "object");

const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/brokers/ws`);
await new Promise<void>((resolve, reject) => {
  socket.on("open", resolve);
  socket.on("error", reject);
});
assert.equal(authCalls, 1);

socket.close();
await socketServer.close();
await new Promise<void>((resolve) => server.close(() => resolve()));

{
  const freeServer = createServer(express());
  const freeSocketServer = attachBrokerHubWebSocket(freeServer, runtime, {
    authenticate: async () => ({ userId: "free-user", source: "session" }),
    requireProAccess: async () => false,
  } as never);

  await new Promise<void>((resolve) => {
    freeServer.listen(0, "127.0.0.1", resolve);
  });
  const freeAddress = freeServer.address();
  assert.ok(freeAddress && typeof freeAddress === "object");

  const freeSocket = new WebSocket(`ws://127.0.0.1:${freeAddress.port}/api/brokers/ws`);
  const statusCode = await new Promise<number>((resolve, reject) => {
    freeSocket.on("open", () => reject(new Error("Free broker socket opened")));
    freeSocket.on("unexpected-response", (_request, response) => {
      resolve(response.statusCode ?? 0);
    });
    freeSocket.on("error", reject);
  });

  assert.equal(statusCode, 402);
  await freeSocketServer.close();
  await new Promise<void>((resolve) => freeServer.close(() => resolve()));
}

{
  const rejectedServer = createServer(express());
  const rejectedSocketServer = attachBrokerHubWebSocket(rejectedServer, runtime, {
    authenticate: async () => null,
  });

  await new Promise<void>((resolve) => {
    rejectedServer.listen(0, "127.0.0.1", resolve);
  });
  const rejectedAddress = rejectedServer.address();
  assert.ok(rejectedAddress && typeof rejectedAddress === "object");

  const rejectedSocket = new WebSocket(`ws://127.0.0.1:${rejectedAddress.port}/api/brokers/ws`);
  const statusCode = await new Promise<number>((resolve, reject) => {
    rejectedSocket.on("open", () => reject(new Error("Unauthenticated broker socket opened")));
    rejectedSocket.on("unexpected-response", (_request, response) => {
      resolve(response.statusCode ?? 0);
    });
    rejectedSocket.on("error", reject);
  });

  assert.equal(statusCode, 401);
  await rejectedSocketServer.close();
  await new Promise<void>((resolve) => rejectedServer.close(() => resolve()));
}

{
  let listener: ((event: BrokerEvent) => void) | undefined;
  let connectCalls = 0;
  const ownedRuntime: BrokerHubRuntime = {
    ...runtime,
    async listProfiles() {
      return {
        activeProfileId: null,
        profiles: [
          {
            id: "profile-one",
            ownerUserId: "user-one",
            label: "One",
            brokerName: "Demo",
            kind: "demo",
            providerKind: "demo",
            accountId: "DEMO-1",
            environment: "demo",
            route: "manual",
            health: "import_only",
            tradingEnabled: false,
            capabilities: {
              readAccount: true,
              readPositions: true,
              readHistory: true,
              placeOrders: false,
              closePositions: false,
            },
            connectionStatus: "offline",
            createdAt: "2026-06-10T00:00:00.000Z",
            updatedAt: "2026-06-10T00:00:00.000Z",
          },
          {
            id: "profile-two",
            ownerUserId: "user-two",
            label: "Two",
            brokerName: "Demo",
            kind: "demo",
            providerKind: "demo",
            accountId: "DEMO-2",
            environment: "demo",
            route: "manual",
            health: "import_only",
            tradingEnabled: false,
            capabilities: {
              readAccount: true,
              readPositions: true,
              readHistory: true,
              placeOrders: false,
              closePositions: false,
            },
            connectionStatus: "offline",
            createdAt: "2026-06-10T00:00:00.000Z",
            updatedAt: "2026-06-10T00:00:00.000Z",
          },
        ],
      };
    },
    async connectProfile() {
      connectCalls += 1;
      throw new Error("cross-user command should not reach runtime");
    },
    onEvent(next) {
      listener = next;
      return () => {
        listener = undefined;
      };
    },
  };
  const ownedServer = createServer(express());
  const ownedSocketServer = attachBrokerHubWebSocket(ownedServer, ownedRuntime, {
    authenticate: async () => ({ userId: "user-one", source: "session" }),
    requireProAccess: async () => true,
  });

  await new Promise<void>((resolve) => {
    ownedServer.listen(0, "127.0.0.1", resolve);
  });
  const ownedAddress = ownedServer.address();
  assert.ok(ownedAddress && typeof ownedAddress === "object");

  const ownedSocket = new WebSocket(`ws://127.0.0.1:${ownedAddress.port}/api/brokers/ws`);
  const messages: BrokerEvent[] = [];
  ownedSocket.on("message", (raw) => {
    messages.push(JSON.parse(String(raw)) as BrokerEvent);
  });
  await new Promise<void>((resolve, reject) => {
    ownedSocket.on("open", resolve);
    ownedSocket.on("error", reject);
  });

  ownedSocket.send(JSON.stringify({ type: "connect", profileId: "profile-two" }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(connectCalls, 0);
  assert.ok(messages.some((event) => event.type === "broker_error"));

  assert.ok(listener);
  const emitBrokerEvent = listener;
  emitBrokerEvent({
    type: "snapshot",
    snapshot: {
      profileId: "profile-two",
      status: "connected",
      kind: "demo",
      providerKind: "demo",
      brokerName: "Demo",
      tradingEnabled: false,
      accounts: [],
      metrics: { balance: 0, equity: 0, margin: 0, freeMargin: 0, currency: "USD", dailyProfit: 0 },
      positions: [],
      orders: [],
      lastUpdated: "2026-06-10T00:00:00.000Z",
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(messages.some((event) => event.type === "snapshot" && event.snapshot.profileId === "profile-two"), false);

  ownedSocket.close();
  await ownedSocketServer.close();
  await new Promise<void>((resolve) => ownedServer.close(() => resolve()));
}

console.log("broker hub socket checks passed");
