import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket } from "ws";
import { closeWebSocketServer } from "../webSocketShutdown.js";
import { createControlWebSocketServer, startHeartbeat, canSend } from "../webSocketHeartbeat.js";
import { isAtConnectionCapacity } from "../webSocketCapacity.js";
import { rejectWebSocketUpgrade, type WebSocketSecurityOptions } from "../webSocketAuth.js";
import { onWatchlistUpdate } from "./watchlistHub.js";

export function attachWatchlistWebSocket(server: Server, security: WebSocketSecurityOptions = {}) {
  const wss = createControlWebSocketServer();
  const stopHeartbeat = startHeartbeat(wss);

  const clientPairs = new WeakMap<WebSocket, Set<string>>();

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? "", "http://localhost");
    if (url.pathname !== "/api/tools/watchlist/ws") return;
    if (isAtConnectionCapacity(wss.clients.size)) {
      rejectWebSocketUpgrade(socket, 503, "Server at capacity");
      return;
    }
    // Accept anonymous upgrades like other public hubs (news)
    wss.handleUpgrade(request, socket, head, (client) => {
      wss.emit("connection", client, request);
    });
  };

  server.on("upgrade", onUpgrade);

  // Relay item updates to subscribed clients
  const unsubscribe = onWatchlistUpdate((pair, item) => {
    for (const client of wss.clients) {
      if (!canSend(client)) continue;
      const pairs = clientPairs.get(client as WebSocket);
      if (!pairs) continue;
      if (pairs.has(pair)) {
        try {
          client.send(JSON.stringify({ type: "update", pair, item }));
        } catch {
          // ignore
        }
      }
    }
  });

  wss.on("connection", (client: WebSocket) => {
    clientPairs.set(client, new Set());

    client.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg && msg.type === "subscribe" && Array.isArray(msg.pairs)) {
          const set = clientPairs.get(client)!;
          set.clear();
          for (const p of msg.pairs) {
            if (typeof p === "string") set.add(p.toUpperCase());
          }
        }
        if (msg && msg.type === "unsubscribe" && Array.isArray(msg.pairs)) {
          const set = clientPairs.get(client)!;
          for (const p of msg.pairs) set.delete(String(p).toUpperCase());
        }
      } catch {
        // ignore parse errors
      }
    });
  });

  return {
    async close() {
      unsubscribe();
      server.off("upgrade", onUpgrade);
      stopHeartbeat();
      await closeWebSocketServer(wss);
    },
  };
}

export type WatchlistWebSocketServer = ReturnType<typeof attachWatchlistWebSocket>;
