import assert from "node:assert/strict";
import { newsCacheKey, newsSnapshotNeedsRefresh, refreshNewsEvidence } from "./news.js";

// Shared snapshots can outlive a release. Hard exclusions must also apply on
// a cache hit, without hiding the source-outage status or changing article URLs.
const base = {
  summary: "Fed policy affects Treasury yields.", source: "Reuters",
  publishedAt: new Date().toISOString(), url: "https://example.com/fed",
  sentiment: null, imageUrl: null, impactScore: 9, matchConfidence: 0.9,
  affectedPairs: ["EUR/USD"], sourceType: "publisher" as const,
};
const snapshot = {
  articles: [
    { ...base, title: "Fed Rate Decision October 2026: Hike or Hold on 28 Oct? - Admirals" },
    { ...base, title: "Fed cuts rates after inflation report", url: "https://example.com/decision" },
  ],
  source: "rss" as const, sourceStatus: "unavailable" as const,
  fetchedAt: new Date().toISOString(), hasApiKey: false,
  nextRefreshAt: new Date().toISOString(),
};
const refreshed = refreshNewsEvidence(snapshot, "EURUSD");
assert.deepEqual(refreshed.articles.map(article => article.url), ["https://example.com/decision"]);
assert.equal(refreshed.sourceStatus, "unavailable");
assert.equal(refreshed.freshArticlesCount, 1);
assert.equal(snapshot.articles.length, 2);
const now = Date.now();
assert.equal(newsSnapshotNeedsRefresh(new Date(now).toISOString(), now), false);
assert.equal(newsSnapshotNeedsRefresh(new Date(now - 86_400_000).toISOString(), now), true, "an L1 cache hit cannot reset the age of stored data");
assert.equal(newsSnapshotNeedsRefresh("invalid", now), true);
assert.equal(newsSnapshotNeedsRefresh(new Date(now + 60_000).toISOString(), now), true);
assert.notEqual(newsCacheKey({pairs:"EURUSD,GBPJPY",lang:"it"}).cacheKey,newsCacheKey({pairs:"EURJPY,GBPUSD",lang:"it"}).cacheKey);
assert.notEqual(newsCacheKey({pairs:"EURUSD",lang:"it"}).cacheKey,newsCacheKey({pairs:"EURUSD",lang:"en"}).cacheKey);
assert.equal(newsCacheKey({pairs:"USDJPY,EUR/USD,EURUSD",lang:"EN-us"}).cacheKey,newsCacheKey({pairs:"EURUSD,USDJPY",lang:"en"}).cacheKey);
console.log("cached news curation checks passed");
