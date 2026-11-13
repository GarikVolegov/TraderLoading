import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket } from "ws";
import { getCandles, isSupportedSymbol } from "./candles.js";
import { closeWebSocketServer } from "./webSocketShutdown.js";
import {
  canSend,
  createControlWebSocketServer,
  startHeartbeat,
} from "./webSocketHeartbeat.js";

export interface WatchlistItem {
  pair: string;
  supported: boolean;
  price: number | null;
  changePct: number | null;
  spark: number[];
  latestBarMs: number | null;
}

export interface WatchlistWebSocketServer {
  close(): Promise<void>;
}

const SPARK_BARS = 20;
const WS_REFRESH_INTERVAL_MS = 60_000;

export function parseWatchlistPairs(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const sym = part.trim().toUpperCase().replace("/", "");
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);
    out.push(sym);
    if (out.length >= 24) break;
  }
  return out;
}

async function buildWatchlistItem(pair: string): Promise<WatchlistItem> {
  if (!isSupportedSymbol(pair)) {
    return { pair, supported: false, price: null, changePct: null, spark: [], latestBarMs: null };
  }

  try {
    const result = await getCandles(pair, "D1");
    const candles = result.candles ?? [];
    if (candles.length === 0) {
      return { pair, supported: true, price: null, changePct: null, spark: [], latestBarMs: null };
    }
    const last = candles[candles.length - 1];
    const prev = candles.length >= 2 ? candles[candles.length - 2] : null;
    const price = Number.isFinite(last.close) ? last.close : null;
    const changePct =
      price !== null && prev && Number.isFinite(prev.close) && prev.close !== 0
        ? ((price - prev.close) / prev.close) * 100
        : null;
    const spark = candles
      .slice(-SPARK_BARS)
      .map((c) => c.close)
      .filter((v) => Number.isFinite(v));
    const latestBarMs = Number.isFinite(last.time) ? last.time * 1000 : null;
    return { pair, supported: true, price, changePct, spark, latestBarMs };
  } catch {
    return { pair, supported: true, price: null, changePct: null, spark: [], latestBarMs: null };
  }
}

export async function getWatchlistItems(pairs: string[]): Promise<WatchlistItem[]> {
  return Promise.all(pairs.map((pair) => buildWatchlistItem(pair)));
}

export function attachWatchlistWebSocket(server: Server): WatchlistWebSocketServer {
  const wss = createControlWebSocketServer();
  const stopHeartbeat = startHeartbeat(wss);
  const subscriptions = new WeakMap<WebSocket, string[]>();

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? "", "http://localhost");
    if (url.pathname !== "/api/tools/watchlist/ws") return;
    wss.handleUpgrade(request, socket, head, (client) => {
      wss.emit("connection", client, request);
    });
  };

  server.on("upgrade", onUpgrade);

  const pushPairs = async (client: WebSocket, pairs: string[]) => {
    if (pairs.length === 0 || !canSend(client)) return;
    const items = await getWatchlistItems(pairs);
    for (const item of items) {
      if (!canSend(client)) break;
      client.send(JSON.stringify({ type: "update", pair: item.pair, item }));
    }
  };

  wss.on("connection", (client) => {
    client.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as { type?: string; pairs?: unknown };
        if (msg.type === "subscribe" && Array.isArray(msg.pairs)) {
          const pairs = msg.pairs
            .filter((p): p is string => typeof p === "string")
            .map((p) => p.trim().toUpperCase().replace("/", ""))
            .filter(Boolean)
            .slice(0, 24);
          subscriptions.set(client, pairs);
          void pushPairs(client, pairs);
        }
      } catch {
        // ignore malformed client messages
      }
    });
  });

  const timer = setInterval(() => {
    for (const client of wss.clients) {
      const pairs = subscriptions.get(client);
      if (pairs && pairs.length > 0 && canSend(client)) {
        void pushPairs(client, pairs);
      }
    }
  }, WS_REFRESH_INTERVAL_MS);
  timer.unref();

  return {
    async close() {
      clearInterval(timer);
      stopHeartbeat();
      server.off("upgrade", onUpgrade);
      await closeWebSocketServer(wss);
    },
  };
}
