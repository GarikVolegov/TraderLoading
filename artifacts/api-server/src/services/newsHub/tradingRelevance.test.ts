import assert from "node:assert/strict";
import type { NewsArticle } from "./types.js";
import { filterTradingDecisionRelevantNews, isTradingDecisionRelevantNews } from "./tradingRelevance.js";

function article(title: string, input: Partial<NewsArticle> = {}): NewsArticle {
  return {
    title,
    summary: input.summary ?? title,
    source: "TestWire",
    publishedAt: "2026-06-09T10:00:00.000Z",
    url: "https://example.com/news",
    sentiment: null,
    imageUrl: null,
    ...input,
  };
}

assert.equal(
  isTradingDecisionRelevantNews(article("Fed rate decision sends dollar higher", { impactScore: 9 })),
  true,
);

assert.equal(
  isTradingDecisionRelevantNews(article("US CPI preview lifts Treasury yields", { impactScore: 6 })),
  true,
);

assert.equal(
  isTradingDecisionRelevantNews(article("Gold price update as traders wait", { impactScore: 6 })),
  false,
);

assert.equal(
  isTradingDecisionRelevantNews(article("Minor market recap", { impactScore: 4 })),
  false,
);

const filtered = filterTradingDecisionRelevantNews([
  article("Gold price update as traders wait", { impactScore: 6 }),
  article("US CPI preview lifts Treasury yields", { impactScore: 6 }),
  article("Central bank emergency decision shocks markets", { impactScore: 8 }),
]);

assert.deepEqual(filtered.map((item) => item.title), [
  "US CPI preview lifts Treasury yields",
  "Central bank emergency decision shocks markets",
]);

console.log("news trading relevance checks passed");
