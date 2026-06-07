import assert from "node:assert/strict";
import type { NewsArticle } from "./types.js";
import {
  applyNewsFreshness,
  createNewsCache,
  sortNewsByFreshness,
  type Clock,
} from "./freshness.js";

const clock: Clock = {
  now: () => new Date("2026-06-07T12:00:00.000Z").getTime(),
};

function article(title: string, publishedAt: string, confidence: number): NewsArticle {
  return {
    title,
    summary: title,
    source: "TestWire",
    publishedAt,
    url: `https://example.com/${title.toLowerCase().replace(/\s+/g, "-")}`,
    sentiment: null,
    imageUrl: null,
    matchConfidence: confidence,
    impactScore: Math.round(confidence * 10),
  };
}

const freshLowConfidence = article("Fresh gold dollar update", "2026-06-07T10:30:00.000Z", 0.52);
const oldHighConfidence = article("Old perfect gold thesis", "2026-05-01T10:00:00.000Z", 0.99);

const withFreshness = applyNewsFreshness([oldHighConfidence, freshLowConfidence], {
  clock,
  freshnessWindowHours: 48,
});

assert.equal(withFreshness[0]?.freshnessTier, "fallback");
assert.equal(withFreshness[0]?.isFallback, true);
assert.equal(withFreshness[1]?.freshnessTier, "fresh");
assert.equal(withFreshness[1]?.isFallback, false);
assert.equal(withFreshness[1]?.ageMinutes, 90);

const sorted = sortNewsByFreshness(withFreshness);
assert.equal(sorted[0]?.title, "Fresh gold dollar update");
assert.equal(sorted[1]?.title, "Old perfect gold thesis");

const cache = createNewsCache<{ value: string }>({ ttlMs: 120_000, clock });
cache.set("XAU:it", { value: "first" });
assert.equal(cache.get("XAU:it")?.value, "first");

const laterClock: Clock = {
  now: () => new Date("2026-06-07T12:02:01.000Z").getTime(),
};
cache.setClock(laterClock);
assert.equal(cache.get("XAU:it"), null);

console.log("news freshness checks passed");
