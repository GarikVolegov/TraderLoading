import assert from "node:assert/strict";
import { createNewsHubRuntime, shouldRefreshSnapshot } from "./runtime.js";
import type { NewsResponse } from "./types.js";

// Finding 2.3: the periodic tick used to force a full rebuild (RSS + translate + LLM +
// Neon write) every 60s, 24/7, even with zero users. The freshness gate skips the
// rebuild while the last snapshot is still within the fresh window.
assert.equal(shouldRefreshSnapshot(null, 1_000_000, 600_000), true); // never refreshed → rebuild
assert.equal(shouldRefreshSnapshot(1_000_000, 1_300_000, 600_000), false); // 5min old → still fresh
assert.equal(shouldRefreshSnapshot(1_000_000, 1_600_000, 600_000), true); // exactly 10min → stale
assert.equal(shouldRefreshSnapshot(1_000_000, 2_000_000, 600_000), true); // older → stale
assert.equal(shouldRefreshSnapshot(1_000_000, 1_000_000, 0), true); // freshMs 0 → always rebuild

const firstSnapshot: NewsResponse = {
  articles: [
    {
      title: "Fed signals rate cuts",
      summary: "Dollar volatility rises after Fed comments.",
      source: "TestWire",
      publishedAt: "2026-06-07T00:00:00.000Z",
      url: "https://example.com/fed-rate-cuts",
      sentiment: "bearish",
      imageUrl: null,
      impactScore: 8,
    },
    {
      title: "Gold holds gains",
      summary: "Gold remains supported by lower yields.",
      source: "TestWire",
      publishedAt: "2026-06-07T00:01:00.000Z",
      url: "https://example.com/gold-gains",
      sentiment: "bullish",
      imageUrl: null,
      impactScore: 6,
    },
  ],
  fetchedAt: "2026-06-07T00:02:00.000Z",
  hasApiKey: true,
  source: "ai",
  agentSummary: "Two test articles.",
  watchedPairs: ["EUR/USD", "XAU/USD"],
  nextRefreshAt: "2026-06-07T00:03:00.000Z",
};

let fetchCount = 0;
const runtime = createNewsHubRuntime({
  refreshIntervalMs: 0,
  fetchSnapshot: async () => {
    fetchCount += 1;
    return firstSnapshot;
  },
});

const events: string[] = [];
const unsubscribe = runtime.onEvent((event) => {
  events.push(event.type);
});

const snapshot = await runtime.refresh({ pairs: "EURUSD,XAUUSD", lang: "it", force: true });
assert.equal(fetchCount, 1);
assert.equal(snapshot.articles.length, 2);
assert.equal(runtime.getSnapshot()?.articles[0]?.title, "Fed signals rate cuts");
assert.equal(events.filter((type) => type === "news_snapshot").length, 1);
assert.equal(events.filter((type) => type === "news_article").length, 2);

runtime.setProviderStatus({ provider: "benzinga", status: "connected", transport: "websocket" });
const statuses = runtime.getProviderStatuses();
const benzingaStatus = statuses.find((status) => status.provider === "benzinga");
assert.equal(benzingaStatus?.status, "connected");
assert.equal(events.includes("news_provider_status"), true);

await runtime.refresh({ pairs: "EURUSD,XAUUSD", lang: "it", force: true });
assert.equal(fetchCount, 2);
assert.equal(events.filter((type) => type === "news_snapshot").length, 2);
assert.equal(events.filter((type) => type === "news_article").length, 2);

unsubscribe();
await runtime.stop();

console.log("news hub runtime checks passed");
