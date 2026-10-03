import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import type { SocialHubSecurity } from "./socketServer.js";

// socketServer statically imports @workspace/db (only for the default DB-backed
// canAccessChannel, which this test overrides). The db pool config throws without
// DATABASE_URL at import time, so set a dummy first, then import dynamically. No
// connection is made — every test injects canAccessChannel.
process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const { attachSocialHubWebSocket } = await import("./socketServer.js");
const { emitSocialEvent } = await import("./socialEvents.js");

// End-to-end over a real HTTP upgrade + ws client. Auth and channel-membership are
// injected (no Clerk / no DB), so this exercises the actual socket path: upgrade,
// auth gate, subscribe-with-membership, channel-scoped delivery and leak safety.

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function listen(security: SocialHubSecurity): Promise<{ server: Server; hub: ReturnType<typeof attachSocialHubWebSocket>; url: string }> {
  const server = createServer();
  const hub = attachSocialHubWebSocket(server, security);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  return { server, hub, url: `ws://127.0.0.1:${port}/api/social/ws` };
}

function openSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

function nextMessage(ws: WebSocket, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error("timed out waiting for a socket message"));
    }, timeoutMs);
    function onMessage(data: WebSocket.RawData) {
      clearTimeout(timer);
      ws.off("message", onMessage);
      resolve(String(data));
    }
    ws.on("message", onMessage);
  });
}

// 1. An authorized subscriber receives its channel's events — and nothing else.
{
  const { server, hub, url } = await listen({
    authenticate: async () => ({ userId: "u1", source: "clerk" }),
    canAccessChannel: async (_userId, channelId) => channelId === 1,
  });
  const ws = await openSocket(url);
  ws.send(JSON.stringify({ type: "subscribe", channelId: 1 }));
  await delay(50); // let the async membership check + subscribe settle

  const delivered = nextMessage(ws, 1_000);
  emitSocialEvent({ type: "community:message", channelId: 1 });
  assert.deepEqual(JSON.parse(await delivered), { type: "community:message", channelId: 1 });

  // Leak safety: an event for a channel this client never subscribed to is not sent.
  let leaked = false;
  const onLeak = (data: WebSocket.RawData) => {
    if ((JSON.parse(String(data)) as { channelId: number }).channelId === 2) leaked = true;
  };
  ws.on("message", onLeak);
  emitSocialEvent({ type: "community:message", channelId: 2 });
  await delay(100);
  assert.equal(leaked, false, "received an event for an unsubscribed channel");

  ws.off("message", onLeak);
  ws.close();
  await hub.close();
  server.close();
}

// 2. Subscribing to a channel the user can't access is ignored — no delivery.
{
  const { server, hub, url } = await listen({
    authenticate: async () => ({ userId: "u2", source: "clerk" }),
    canAccessChannel: async () => false,
  });
  const ws = await openSocket(url);
  ws.send(JSON.stringify({ type: "subscribe", channelId: 1 }));
  await delay(50);

  let delivered = false;
  ws.on("message", () => {
    delivered = true;
  });
  emitSocialEvent({ type: "community:message", channelId: 1 });
  await delay(100);
  assert.equal(delivered, false, "delivered an event to a non-member");

  ws.close();
  await hub.close();
  server.close();
}

// 3. An unauthenticated upgrade is rejected before the socket opens.
{
  const { server, hub, url } = await listen({ authenticate: async () => null });
  const ws = new WebSocket(url);
  const rejected = await new Promise<boolean>((resolve) => {
    ws.once("open", () => resolve(false));
    ws.once("error", () => resolve(true));
    ws.once("unexpected-response", () => resolve(true));
  });
  assert.equal(rejected, true, "unauthenticated client was allowed to connect");
  ws.close();
  await hub.close();
  server.close();
}

console.log("social websocket integration checks passed");
