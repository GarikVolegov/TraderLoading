import assert from "node:assert/strict";
import type { NewsArticle } from "./types.js";
import { normalizeNewsSources, paginateNews, rankNewsForDisplay, sortNewsChronologically } from "./ranking.js";

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

// Chronological ordering: newest first, undated articles sink to the bottom.
const chronological = sortNewsChronologically([
  article({ title: "older", source: "A", publishedAt: "2026-06-07T08:00:00.000Z", url: "https://x/old" }),
  article({ title: "newest", source: "B", publishedAt: "2026-06-07T12:00:00.000Z", url: "https://x/new" }),
  { ...article({ title: "undated", source: "C", publishedAt: "", url: "https://x/undated" }), publishedAt: null },
  article({ title: "middle", source: "D", publishedAt: "2026-06-07T10:00:00.000Z", url: "https://x/mid" }),
]);
assert.deepEqual(chronological.map((a) => a.title), ["newest", "middle", "older", "undated"]);

// Server pagination: stable offset slicing with a nextCursor until exhausted.
const corpus = Array.from({ length: 7 }, (_, i) =>
  article({ title: `n${i}`, source: "S", publishedAt: `2026-06-07T1${i}:00:00.000Z`, url: `https://x/${i}` }),
);
const page1 = paginateNews(corpus, { cursor: null, limit: 3 });
assert.deepEqual(page1.articles.map((a) => a.title), ["n0", "n1", "n2"]);
assert.equal(page1.nextCursor, "3");
assert.equal(page1.totalCount, 7);

const page2 = paginateNews(corpus, { cursor: page1.nextCursor, limit: 3 });
assert.deepEqual(page2.articles.map((a) => a.title), ["n3", "n4", "n5"]);
assert.equal(page2.nextCursor, "6");

const page3 = paginateNews(corpus, { cursor: page2.nextCursor, limit: 3 });
assert.deepEqual(page3.articles.map((a) => a.title), ["n6"]);
assert.equal(page3.nextCursor, null);

// Bad/oversized inputs are clamped, not crashing.
assert.equal(paginateNews(corpus, { cursor: "not-a-number", limit: 3 }).articles.length, 3);
assert.equal(paginateNews(corpus, { cursor: "0", limit: 999 }).articles.length, 7);
assert.equal(paginateNews([], { cursor: null, limit: 3 }).nextCursor, null);

console.log("news ranking checks passed");
