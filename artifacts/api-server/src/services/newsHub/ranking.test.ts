import assert from "node:assert/strict";
import type { NewsArticle } from "./types.js";
import { normalizeNewsSources, rankNewsForDisplay } from "./ranking.js";

function article(input: Partial<NewsArticle> & { title: string; source: string; publishedAt: string; url: string }): NewsArticle {
  return {
    summary: input.title,
    sentiment: null,
    imageUrl: null,
    affectedPairs: ["XAU/USD"],
    impactScore: 7,
    matchConfidence: 0.9,
    freshnessTier: "fresh",
    isFallback: false,
    ...input,
  };
}

const ranked = rankNewsForDisplay([
  article({
    title: "Gold slips as Middle East tensions lift dollar demand",
    source: "Google News",
    publishedAt: "2026-06-07T10:00:00.000Z",
    url: "https://news.google.com/a",
  }),
  article({
    title: "Gold slips as Middle East tensions lift dollar demand - MSN",
    source: "Google News",
    publishedAt: "2026-06-07T09:59:00.000Z",
    url: "https://news.google.com/b",
  }),
  article({
    title: "Gold price update closing session June 7",
    source: "Google News",
    publishedAt: "2026-06-07T09:50:00.000Z",
    url: "https://news.google.com/c",
  }),
  article({
    title: "Fed rate fears return as yields weigh on bullion",
    source: "Google News",
    publishedAt: "2026-06-07T09:40:00.000Z",
    url: "https://news.google.com/d",
  }),
  article({
    title: "Spot gold steadies as Treasury yields retreat",
    source: "Reuters",
    publishedAt: "2026-06-07T09:30:00.000Z",
    url: "https://reuters.example/gold",
  }),
  article({
    title: "Dollar index stalls before Fed speakers",
    source: "CNBC Markets",
    publishedAt: "2026-06-07T09:20:00.000Z",
    url: "https://cnbc.example/dollar",
  }),
  article({
    title: "Bullion traders watch US inflation expectations",
    source: "MarketWatch",
    publishedAt: "2026-06-07T09:10:00.000Z",
    url: "https://marketwatch.example/bullion",
  }),
], {
  limit: 5,
  maxPerSource: 2,
});

assert.equal(ranked.length, 5);
assert.equal(ranked.filter((item) => item.source === "Google News").length, 2);
assert.equal(ranked.some((item) => item.title === "Gold slips as Middle East tensions lift dollar demand - MSN"), false);
assert.equal(ranked[0]?.freshnessTier, "fresh");
assert.ok(ranked.every((item) => typeof item.qualityScore === "number"));
assert.ok((ranked[0]?.qualityScore ?? 0) >= (ranked[ranked.length - 1]?.qualityScore ?? 0));

const normalizedSources = normalizeNewsSources([
  article({
    title: "Gold slips as Middle East tensions lift dollar demand - Reuters",
    source: "Google News",
    publishedAt: "2026-06-07T11:00:00.000Z",
    url: "https://news.google.com/reuters",
  }),
]);

assert.equal(normalizedSources[0]?.source, "Reuters");
assert.equal(normalizedSources[0]?.title, "Gold slips as Middle East tensions lift dollar demand");

console.log("news ranking checks passed");
