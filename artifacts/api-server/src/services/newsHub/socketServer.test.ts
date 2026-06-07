import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import { createNewsHubRuntime } from "./runtime.js";
import { attachNewsHubWebSocket } from "./socketServer.js";
import type { NewsEvent, NewsResponse } from "./types.js";

function snapshotFor(pair: string, title: string): NewsResponse {
  return {
  articles: [
    {
        title,
        summary: `${pair} traders watch this update.`,
      source: "TestWire",
      publishedAt: "2026-06-07T00:00:00.000Z",
        url: `https://example.com/${pair.toLowerCase()}`,
      sentiment: "neutral",
      imageUrl: null,
      impactScore: 7,
        affectedPairs: [pair],
    },
  ],
  fetchedAt: "2026-06-07T00:01:00.000Z",
  hasApiKey: true,
  source: "ai",
    watchedPairs: [pair],
  };
}

const genericSnapshot = snapshotFor("EUR/USD", "Generic EUR update");
const xauSnapshot = snapshotFor("XAU/USD", "Gold refresh for XAU traders");

const runtime = createNewsHubRuntime({
  refreshIntervalMs: 0,
  fetchSnapshot: async (request) => request.pairs === "XAUUSD" ? xauSnapshot : genericSnapshot,
});

await runtime.refresh({ pairs: "EURUSD", lang: "it", force: true });

const app = express();
const server = createServer(app);
const wsServer = attachNewsHubWebSocket(server, runtime);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");

const received: NewsEvent[] = [];
const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/news/ws`);
socket.on("message", (raw) => {
  received.push(JSON.parse(String(raw)) as NewsEvent);
});

await new Promise<void>((resolve, reject) => {
  socket.once("open", resolve);
  socket.once("error", reject);
});

socket.send(JSON.stringify({ type: "subscribe", pairs: "XAUUSD", lang: "it" }));

await new Promise<void>((resolve, reject) => {
  const started = Date.now();
  const interval = setInterval(() => {
    if (received.some((event) => event.type === "news_snapshot")) {
      clearInterval(interval);
      resolve();
    } else if (Date.now() - started > 3000) {
      clearInterval(interval);
      reject(new Error("Timed out waiting for news snapshot"));
    }
  }, 25);
});

const snapshots = received.filter((event): event is Extract<NewsEvent, { type: "news_snapshot" }> => event.type === "news_snapshot");
assert.equal(snapshots.length, 1);
assert.equal(snapshots[0]?.snapshot.watchedPairs?.[0], "XAU/USD");
assert.equal(snapshots[0]?.snapshot.articles[0]?.title, "Gold refresh for XAU traders");
assert.equal(snapshots[0]?.snapshot.articles[0]?.affectedPairs?.[0], "XAU/USD");
assert.equal(received.some((event) => event.type === "news_article" && event.article.title === "Gold refresh for XAU traders"), true);

socket.close();
await wsServer.close();
await new Promise<void>((resolve) => server.close(() => resolve()));
await runtime.stop();

console.log("news hub socket checks passed");
