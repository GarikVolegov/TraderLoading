import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import type { NewsEvent, NewsRefreshRequest } from "./types.js";
import type { NewsHubRuntime } from "./runtime.js";
import { closeWebSocketServer } from "../webSocketShutdown.js";

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
  if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(event));
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
  const watched = event.snapshot.watchedPairs ?? [];
  if (subscription.formattedPairs.length === 0) return watched.length === 0;
  return subscription.formattedPairs.every((pair) => watched.includes(pair));
}

function matchesArticle(subscription: ClientSubscription | undefined, event: Extract<NewsEvent, { type: "news_article" }>): boolean {
  if (!subscription) return false;
  if (subscription.formattedPairs.length === 0) return true;
  const affected = event.article.affectedPairs ?? [];
  return affected.some((pair) => subscription.formattedPairs.includes(pair));
}

export function attachNewsHubWebSocket(server: Server, runtime: NewsHubRuntime): NewsHubWebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const subscriptions = new WeakMap<WebSocket, ClientSubscription>();
  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? "", "http://localhost");
    if (url.pathname !== "/api/news/ws") return;
    wss.handleUpgrade(request, socket, head, (client) => {
      wss.emit("connection", client, request);
    });
  };

  server.on("upgrade", onUpgrade);

  const unsubscribe = runtime.onEvent((event) => {
    for (const client of wss.clients) {
      if (event.type === "news_snapshot") {
        if (matchesSnapshot(subscriptions.get(client), event)) send(client, event);
        continue;
      }
      if (event.type === "news_article") {
        if (matchesArticle(subscriptions.get(client), event)) send(client, event);
        continue;
      }
      send(client, event);
    }
  });

  wss.on("connection", (client) => {
    for (const status of runtime.getProviderStatuses()) send(client, { type: "news_provider_status", status });

    client.on("message", (raw) => {
      const message = parse(raw);
      if (!message) {
        send(client, { type: "news_error", message: "Invalid news hub message" });
        return;
      }

      if (message.type === "refresh" || message.type === "subscribe") {
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
      await closeWebSocketServer(wss);
    },
  };
}
