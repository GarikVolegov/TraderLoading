import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket } from "ws";
import type { NewsEvent, NewsRefreshRequest } from "./types.js";
import type { NewsHubRuntime } from "./runtime.js";
import { newsSubscriptionKey } from "./providerCorpus.js";
import { closeWebSocketServer } from "../webSocketShutdown.js";
import { rejectWebSocketUpgrade } from "../webSocketAuth.js";
import { isAllowedWebSocketOrigin } from "../../lib/security.js";
import { isAtConnectionCapacity } from "../webSocketCapacity.js";
import {
  canSend,
  createControlWebSocketServer,
  createSocketRateLimiter,
  startHeartbeat,
} from "../webSocketHeartbeat.js";

type ClientMessage = {
  type?: string;
  pairs?: string;
  lang?: string;
  force?: boolean;
};

type ClientSubscription = {
  pairs?: string;
  formattedPairs: string[];
  lang?: string;
};

export interface NewsHubWebSocketServer {
  close(): Promise<void>;
}

function send(client: WebSocket, event: NewsEvent): void {
  if (canSend(client)) client.send(JSON.stringify(event));
}

function parse(raw: WebSocket.RawData): ClientMessage | null {
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as ClientMessage) : null;
  } catch {
    return null;
  }
}

function requestFromMessage(message: ClientMessage): NewsRefreshRequest {
  return {
    pairs: typeof message.pairs === "string" ? message.pairs : undefined,
    lang: typeof message.lang === "string" ? message.lang : undefined,
    force: message.force === true || message.type === "refresh",
  };
}

function formatPairs(pairs?: string): string[] {
  if (!pairs) return [];
  return pairs.split(",").map((pair) => {
    const normalized = pair.trim().toUpperCase();
    return normalized.length === 6 ? `${normalized.slice(0, 3)}/${normalized.slice(3)}` : normalized;
  }).filter(Boolean);
}

function matchesSnapshot(subscription: ClientSubscription | undefined, event: Extract<NewsEvent, { type: "news_snapshot" }>): boolean {
  if (!subscription) return false;
  return newsSubscriptionKey({pairs:subscription.pairs,lang:subscription.lang}) ===
    newsSubscriptionKey({pairs:(event.snapshot.watchedPairs ?? []).join(","),lang:event.snapshot.lang});
}

export function attachNewsHubWebSocket(server: Server, runtime: NewsHubRuntime): NewsHubWebSocketServer {
  const wss = createControlWebSocketServer();
  const stopHeartbeat = startHeartbeat(wss);
  const subscriptions = new WeakMap<WebSocket, ClientSubscription>();
  const subscriptionCleanups = new WeakMap<WebSocket, () => void>();
  const allowSocketMessage = createSocketRateLimiter(30, 10_000);
  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? "", "http://localhost");
    if (url.pathname !== "/api/news/ws") return;
    const origin = Array.isArray(request.headers.origin)
      ? request.headers.origin[0]
      : request.headers.origin;
    const host = Array.isArray(request.headers.host)
      ? request.headers.host[0]
      : request.headers.host;
    if (!isAllowedWebSocketOrigin(origin, host)) {
      rejectWebSocketUpgrade(socket, 403, "Forbidden");
      return;
    }
    if (isAtConnectionCapacity(wss.clients.size)) {
      rejectWebSocketUpgrade(socket, 503, "Server at capacity");
      return;
    }
    wss.handleUpgrade(request, socket, head, (client) => {
      wss.emit("connection", client, request);
    });
  };

  server.on("upgrade", onUpgrade);

  const unsubscribe = runtime.onEvent((event) => {
    if (wss.clients.size === 0 || event.type === "news_article") return;
    const serialized = JSON.stringify(event);
    for (const client of wss.clients) {
      if (event.type === "news_snapshot") {
        if (matchesSnapshot(subscriptions.get(client), event) && canSend(client)) {
          client.send(serialized);
        }
        continue;
      }
      if (
        event.type === "news_error" &&
        event.subscriptionKey &&
        event.subscriptionKey !== newsSubscriptionKey(subscriptions.get(client) ?? {})
      ) {
        continue;
      }
      if (canSend(client)) client.send(serialized);
    }
  });

  wss.on("connection", (client) => {
    client.on("close", () => subscriptionCleanups.get(client)?.());
    for (const status of runtime.getProviderStatuses()) send(client, { type: "news_provider_status", status });

    client.on("message", (raw) => {
      if (!allowSocketMessage(client)) return;
      const message = parse(raw);
      if (!message) {
        send(client, { type: "news_error", message: "Invalid news hub message" });
        return;
      }

      if (message.type === "refresh" || message.type === "subscribe") {
        subscriptionCleanups.get(client)?.();
        subscriptionCleanups.set(client,runtime.subscribe(requestFromMessage(message)));
        subscriptions.set(client, {
          pairs: typeof message.pairs === "string" ? message.pairs : undefined,
          formattedPairs: formatPairs(message.pairs),
          lang: typeof message.lang === "string" ? message.lang : undefined,
        });
        void runtime.refresh(requestFromMessage(message)).catch((error) => {
          send(client, { type: "news_error", message: error instanceof Error ? error.message : "News refresh failed" });
        });
      }
    });
  });

  return {
    async close(): Promise<void> {
      unsubscribe();
      server.off("upgrade", onUpgrade);
      stopHeartbeat();
      await closeWebSocketServer(wss);
    },
  };
}
