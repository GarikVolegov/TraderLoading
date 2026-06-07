import assert from "node:assert/strict";
import { macroNewsFromNewsHub, pairsFromMacroCurrencies } from "./macroNewsAdapter.js";
import type { NewsResponse } from "./types.js";

assert.equal(pairsFromMacroCurrencies("USD,XAU"), "XAUUSD");
assert.equal(pairsFromMacroCurrencies("EUR,USD"), "EURUSD");
assert.equal(pairsFromMacroCurrencies(""), "");

const news: NewsResponse = {
  articles: [
    {
      title: "Gold jumps as Treasury yields retreat",
      summary: "Spot gold rises while the dollar softens.",
      originalTitle: "Gold jumps as Treasury yields retreat",
      originalSummary: "Spot gold rises while the dollar softens.",
      source: "Reuters",
      publishedAt: "2026-06-07T10:55:00.000Z",
      url: "https://example.com/gold",
      sentiment: "bullish",
      imageUrl: null,
      affectedPairs: ["XAU/USD"],
      impactScore: 8,
      impactDirection: "bullish",
      primaryAssets: ["XAU", "USD"],
      freshnessTier: "fresh",
      qualityScore: 0.91,
    },
  ],
  fetchedAt: "2026-06-07T11:00:00.000Z",
  hasApiKey: true,
  source: "ai",
  agentSummary: "Gold is being driven by USD and yields.",
};

const macro = macroNewsFromNewsHub(news);
assert.equal(macro.articles.length, 1);
assert.equal(macro.articles[0]?.currency, "XAU");
assert.equal(macro.articles[0]?.impact, "alto");
assert.equal(macro.articles[0]?.direction, "bullish");
assert.equal(macro.articles[0]?.source, "Reuters");
assert.equal(macro.articles[0]?.originalTitle, "Gold jumps as Treasury yields retreat");
assert.equal(macro.articles[0]?.originalSummary, "Spot gold rises while the dollar softens.");
assert.equal(macro.articles[0]?.timestamp, "2026-06-07T10:55:00.000Z");
assert.equal(macro.articles[0]?.url, "https://example.com/gold");
assert.equal(macro.sentiment, "risk-on");
assert.equal(macro.summary, "Gold is being driven by USD and yields.");

console.log("macro news adapter checks passed");
