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
      deepDive: {
        whatHappened: "Spot gold rises while the dollar softens.",
        whyItMatters: "I rendimenti e il dollaro influenzano direttamente XAU/USD.",
        possibleImpact: "Potrebbe sostenere XAU/USD se il dollaro resta debole.",
      },
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
assert.equal(macro.articles[0]?.deepDive?.whatHappened, "Spot gold rises while the dollar softens.");
assert.equal(macro.articles[0]?.deepDive?.whyItMatters, "I rendimenti e il dollaro influenzano direttamente XAU/USD.");
assert.equal(macro.articles[0]?.deepDive?.possibleImpact, "Potrebbe sostenere XAU/USD se il dollaro resta debole.");
// Gold rising is a flight-to-safety signal → RISK-OFF (the previous naive
// bull/bear count wrongly called this risk-on). Strong single safe-haven signal.
assert.equal(macro.sentiment, "risk-off");
assert.equal(macro.sentimentIntensity, "forte");
assert.equal(macro.summary, "Gold is being driven by USD and yields.");

const staleSnapshot: NewsResponse = {
  ...news,
  articles: [
    {
      ...news.articles[0]!,
      title: "NZD/USD nears 0.5830 as weaker dollar supports the kiwi",
      summary: "The RBNZ-Fed policy split helps New Zealand dollar buyers while USD softens.",
      imageUrl: null,
      affectedPairs: ["XAU/USD"],
      primaryAssets: ["XAU", "USD"],
    },
    news.articles[0]!,
  ],
};
const filteredMacro = macroNewsFromNewsHub(staleSnapshot, { pairs: "XAUUSD" });
assert.equal(filteredMacro.articles.some((article) => /NZD\/USD/i.test(article.title)), false);
assert.equal(filteredMacro.articles.length, 1);

const dominantNzdSnapshot: NewsResponse = {
  ...news,
  articles: [
    {
      ...news.articles[0]!,
      title: "New Zealand Dollar rises on easing geopolitical risk, RBNZ rate-hike expectations",
      summary: "The kiwi advances as traders reassess the RBNZ path and broader risk appetite.",
      originalTitle: "New Zealand Dollar rises on easing geopolitical risk, RBNZ rate-hike expectations",
      originalSummary: "The kiwi advances as traders reassess the RBNZ path and broader risk appetite.",
      imageUrl: null,
      affectedPairs: ["XAU/USD"],
      primaryAssets: ["XAU", "USD"],
    },
    news.articles[0]!,
  ],
};
const filteredDominantNzdMacro = macroNewsFromNewsHub(dominantNzdSnapshot, { pairs: "XAUUSD" });
assert.equal(filteredDominantNzdMacro.articles.some((article) => /New Zealand Dollar|RBNZ|kiwi/i.test(`${article.title} ${article.summary}`)), false);
assert.equal(filteredDominantNzdMacro.articles.length, 1);

console.log("macro news adapter checks passed");
