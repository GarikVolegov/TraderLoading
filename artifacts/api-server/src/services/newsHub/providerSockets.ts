import { WebSocket } from "ws";
import type { NewsArticle } from "./types.js";
import type { NewsHubRuntime } from "./runtime.js";
import { classifyNewsArticle } from "./intelligence.js";

export interface NewsProviderSocketManager {
  close(): Promise<void>;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function dateOrNow(value: unknown): string {
  const raw = typeof value === "string" || typeof value === "number" ? value : Date.now();
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function articleFromBenzingaMessage(message: unknown): NewsArticle | null {
  const value = typeof message === "object" && message !== null ? (message as Record<string, unknown>) : {};
  const data = typeof value.data === "object" && value.data !== null ? (value.data as Record<string, unknown>) : {};
  const content = typeof data.content === "object" && data.content !== null ? (data.content as Record<string, unknown>) : value;
  const title = clean(content.title ?? content.headline ?? content.name);
  if (!title) return null;
  return {
    title,
    summary: clean(content.summary ?? content.teaser ?? content.body) || title,
    source: "Benzinga",
    publishedAt: dateOrNow(content.created_at ?? content.updated_at ?? data.timestamp),
    url: clean(content.url) || null,
    sentiment: null,
    imageUrl: clean(content.image_url ?? content.image) || null,
  };
}

function articleFromFinnhubMessage(message: unknown): NewsArticle[] {
  const value = typeof message === "object" && message !== null ? (message as Record<string, unknown>) : {};
  const payload = Array.isArray(value.data) ? value.data : [];
  return payload
    .map((item): NewsArticle | null => {
      const record = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
      const title = clean(record.headline ?? record.title);
      if (!title) return null;
      return {
        title,
        summary: clean(record.summary) || title,
        source: clean(record.source) || "Finnhub",
        publishedAt: dateOrNow(record.datetime ? Number(record.datetime) * 1000 : record.publishedAt),
        url: clean(record.url) || null,
        sentiment: null,
        imageUrl: clean(record.image) || null,
      };
    })
    .filter((article): article is NewsArticle => article !== null);
}

function connectWithReconnect(input: {
  provider: "benzinga" | "finnhub";
  url: string;
  runtime: NewsHubRuntime;
  onMessage: (message: unknown) => void;
  onOpen?: (socket: WebSocket) => void;
}): () => void {
  let socket: WebSocket | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let closed = false;
  let attempts = 0;

  const connect = () => {
    if (closed) return;
    attempts += 1;
    input.runtime.setProviderStatus({
      provider: input.provider,
      status: "connecting",
      transport: "websocket",
      message: `Connessione ${input.provider} in corso.`,
    });
    socket = new WebSocket(input.url);
    socket.on("open", () => {
      attempts = 0;
      input.runtime.setProviderStatus({
        provider: input.provider,
        status: "connected",
        transport: "websocket",
        message: `${input.provider} collegato in tempo reale.`,
      });
      if (socket) input.onOpen?.(socket);
    });
    socket.on("message", (raw) => {
      try {
        input.onMessage(JSON.parse(String(raw)) as unknown);
      } catch {
        input.runtime.setProviderStatus({
          provider: input.provider,
          status: "error",
          transport: "websocket",
          message: `Messaggio ${input.provider} non valido.`,
        });
      }
    });
    socket.on("close", () => {
      if (closed) return;
      input.runtime.setProviderStatus({
        provider: input.provider,
        status: "error",
        transport: "websocket",
        message: `${input.provider} disconnesso. Riconnessione automatica.`,
      });
      const delay = Math.min(30_000, 1000 * Math.max(1, attempts));
      reconnectTimer = setTimeout(connect, delay);
    });
    socket.on("error", () => {
      input.runtime.setProviderStatus({
        provider: input.provider,
        status: "error",
        transport: "websocket",
        message: `${input.provider} non raggiungibile.`,
      });
    });
  };

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
  };
}

function ingestIfRelevant(runtime: NewsHubRuntime, article: NewsArticle): void {
  const request = runtime.getLastRequest();
  const classified = classifyNewsArticle(article, { pairs: request.pairs, lang: request.lang });
  if (classified.relevant) runtime.ingestArticle(classified.article);
}

export function attachNewsProviderSockets(runtime: NewsHubRuntime): NewsProviderSocketManager {
  const cleanups: Array<() => void> = [];

  const benzingaToken = process.env.BENZINGA_API_KEY;
  if (benzingaToken) {
    cleanups.push(
      connectWithReconnect({
        provider: "benzinga",
        url: `wss://api.benzinga.com/api/v1/news/stream?token=${encodeURIComponent(benzingaToken)}`,
        runtime,
        onMessage: (message) => {
          const article = articleFromBenzingaMessage(message);
          if (article) ingestIfRelevant(runtime, article);
        },
      }),
    );
  }

  const finnhubToken = process.env.FINNHUB_API_KEY;
  if (finnhubToken) {
    cleanups.push(
      connectWithReconnect({
        provider: "finnhub",
        url: `wss://ws.finnhub.io?token=${encodeURIComponent(finnhubToken)}`,
        runtime,
        onOpen: (socket) => socket.send(JSON.stringify({ type: "subscribe-news", category: "general" })),
        onMessage: (message) => {
          for (const article of articleFromFinnhubMessage(message)) ingestIfRelevant(runtime, article);
        },
      }),
    );
  }

  if (!process.env.BENZINGA_API_KEY) {
    runtime.setProviderStatus({
      provider: "benzinga",
      status: "disabled",
      transport: "none",
      message: "BENZINGA_API_KEY non configurata.",
    });
  }
  if (!process.env.FINNHUB_API_KEY) {
    runtime.setProviderStatus({
      provider: "finnhub",
      status: "disabled",
      transport: "none",
      message: "FINNHUB_API_KEY non configurata.",
    });
  }

  return {
    async close(): Promise<void> {
      for (const cleanup of cleanups) cleanup();
    },
  };
}
