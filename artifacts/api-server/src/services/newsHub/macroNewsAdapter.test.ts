import assert from "node:assert/strict";
import { macroNewsFromNewsHub, pairsFromMacroCurrencies } from "./macroNewsAdapter.js";
import type { NewsResponse } from "./types.js";

assert.equal(pairsFromMacroCurrencies("USD,XAU"), "XAUUSD");
assert.equal(pairsFromMacroCurrencies("EUR,USD"), "EURUSD");
assert.equal(pairsFromMacroCurrencies("XAU,USD,EUR"), "XAUUSD,EURUSD");
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
      imageUrl: "https://static.reuters.com/gold-market.jpg",
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
assert.deepEqual(macro.articles[0]?.primaryAssets, ["XAU", "USD"]);
assert.deepEqual(macro.articles[0]?.affectedPairs, ["XAU/USD"]);
assert.equal(macro.articles[0]?.originalTitle, "Gold jumps as Treasury yields retreat");
assert.equal(macro.articles[0]?.originalSummary, "Spot gold rises while the dollar softens.");
assert.equal(macro.articles[0]?.timestamp, "2026-06-07T10:55:00.000Z");
assert.equal(macro.articles[0]?.url, "https://example.com/gold");
assert.equal(macro.articles[0]?.imageUrl, "https://static.reuters.com/gold-market.jpg");
assert.equal(macro.articles[0]?.deepDive?.whatHappened, "Spot gold rises while the dollar softens.");
assert.equal(macro.articles[0]?.deepDive?.whyItMatters, "I rendimenti e il dollaro influenzano direttamente XAU/USD.");
assert.equal(macro.articles[0]?.deepDive?.possibleImpact, "Potrebbe sostenere XAU/USD se il dollaro resta debole.");
// Gold rising is a flight-to-safety signal → RISK-OFF (the previous naive
// bull/bear count wrongly called this risk-on). Strong single safe-haven signal.
assert.equal(macro.sentiment, "risk-off");
assert.equal(macro.sentimentIntensity, "forte");
assert.match(macro.summary, /RISK-OFF forte/);
assert.match(macro.summary, /XAU\/USD/);
assert.match(macro.summary, /rendimenti|dollaro/i);

const missingImageMacro = macroNewsFromNewsHub({
  ...news,
  articles: [
    {
      ...news.articles[0]!,
      title: "Trump says US reaches gold purchase agreement as dollar weakens",
      summary: "The White House deal boosts bullion demand while Treasury yields retreat.",
      imageUrl: null,
      primaryAssets: ["XAU", "USD"],
    },
  ],
});
const fallbackImage = missingImageMacro.articles[0]?.imageUrl ?? "";
assert.match(fallbackImage, /^https:\/\/loremflickr\.com\/800\/400\//);
assert.match(decodeURIComponent(fallbackImage), /trump|gold|agreement/i);
assert.doesNotMatch(fallbackImage, /^data:image\/svg\+xml,/);

const duplicateSourceImage = "https://static.reuters.com/shared-market-photo.jpg";
const duplicateImageMacro = macroNewsFromNewsHub({
  ...news,
  articles: [
    {
      ...news.articles[0]!,
      title: "US CPI surprise pushes Treasury yields higher",
      summary: "Inflation data shifts Fed expectations and pressures gold.",
      originalTitle: "US CPI surprise pushes Treasury yields higher",
      originalSummary: "Inflation data shifts Fed expectations and pressures gold.",
      imageUrl: duplicateSourceImage,
      impactScore: 8,
      primaryAssets: ["USD", "XAU"],
    },
    {
      ...news.articles[0]!,
      title: "Fed officials signal caution before rate decision",
      summary: "Policy makers discuss inflation risk before the next FOMC meeting.",
      originalTitle: "Fed officials signal caution before rate decision",
      originalSummary: "Policy makers discuss inflation risk before the next FOMC meeting.",
      imageUrl: duplicateSourceImage,
      impactScore: 8,
      primaryAssets: ["USD"],
    },
    {
      ...news.articles[0]!,
      title: "Gold traders brace for jobs report volatility",
      summary: "Payrolls could shift dollar and yield expectations for XAU/USD.",
      originalTitle: "Gold traders brace for jobs report volatility",
      originalSummary: "Payrolls could shift dollar and yield expectations for XAU/USD.",
      imageUrl: null,
      impactScore: 8,
      primaryAssets: ["XAU", "USD"],
    },
    {
      ...news.articles[0]!,
      title: "Gold traders watch Fed minutes after payrolls",
      summary: "FOMC minutes could shift dollar and yield expectations for XAU/USD.",
      originalTitle: "Gold traders watch Fed minutes after payrolls",
      originalSummary: "FOMC minutes could shift dollar and yield expectations for XAU/USD.",
      imageUrl: null,
      impactScore: 8,
      primaryAssets: ["XAU", "USD"],
    },
  ],
});
const imageUrls = duplicateImageMacro.articles.map((article) => article.imageUrl ?? "");
assert.equal(imageUrls[0], duplicateSourceImage);
assert.notEqual(imageUrls[1], duplicateSourceImage);
assert.equal(new Set(imageUrls).size, imageUrls.length);
assert.match(decodeURIComponent(imageUrls[1] ?? ""), /fed|inflation|centralbank|dollar/i);
assert.match(decodeURIComponent(imageUrls[2] ?? ""), /gold|jobs|payroll|bullion|vault/i);

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

const tradingGradeSnapshot: NewsResponse = {
  ...news,
  articles: [
    {
      ...news.articles[0]!,
      title: "Gold price update as traders wait for direction",
      summary: "Spot gold moves sideways in quiet trade.",
      originalTitle: "Gold price update as traders wait for direction",
      originalSummary: "Spot gold moves sideways in quiet trade.",
      impactScore: 6,
      impactDirection: "neutral",
      freshnessTier: "fresh",
    },
    {
      ...news.articles[0]!,
      title: "US CPI preview lifts Treasury yields before Fed decision",
      summary: "Inflation expectations shift as traders price the next rate decision.",
      originalTitle: "US CPI preview lifts Treasury yields before Fed decision",
      originalSummary: "Inflation expectations shift as traders price the next rate decision.",
      impactScore: 6,
      impactDirection: "bearish",
      freshnessTier: "fresh",
    },
    {
      ...news.articles[0]!,
      title: "Central bank emergency decision shocks markets",
      summary: "Policy makers announce an unexpected rate change.",
      originalTitle: "Central bank emergency decision shocks markets",
      originalSummary: "Policy makers announce an unexpected rate change.",
      impactScore: 8,
      impactDirection: "mixed",
      freshnessTier: "fresh",
    },
  ],
};
const tradingGradeMacro = macroNewsFromNewsHub(tradingGradeSnapshot, { pairs: "XAUUSD" });
assert.equal(tradingGradeMacro.articles.some((article) => /Gold price update/i.test(article.title)), false);
assert.equal(tradingGradeMacro.articles.some((article) => /US CPI preview/i.test(article.title)), true);
assert.equal(tradingGradeMacro.articles.some((article) => /Central bank emergency/i.test(article.title)), true);
assert.equal(tradingGradeMacro.articles.length, 2);

const unclearAgentSummaryMacro = macroNewsFromNewsHub({
  ...news,
  agentSummary: "Attenzione ai seguenti eventi ad alto impatto per XAU/USD: Previsioni CPI USA maggio 2026; Anteprima CPI USA di maggio. Gestire il rischio con stop adeguati.",
  articles: [
    {
      ...news.articles[0]!,
      title: "Anteprima CPI USA di maggio: inflazione sopra attese",
      summary: "Il dato puo' spingere rendimenti Treasury e dollaro piu' in alto, mettendo pressione su oro e azioni.",
      originalTitle: "US May CPI preview: hotter inflation may lift yields",
      originalSummary: "Markets are watching CPI for a Fed repricing.",
      impactScore: 8,
      impactDirection: "bearish",
      primaryAssets: ["XAU", "USD"],
      affectedPairs: ["XAU/USD"],
      freshnessTier: "fresh",
      deepDive: {
        whatHappened: "Il mercato attende il CPI USA.",
        whyItMatters: "Inflazione, dollaro e rendimenti reali sono driver diretti per XAU/USD.",
        possibleImpact: "Sopra attese: pressione su oro; sotto attese: possibile supporto.",
      },
    },
  ],
}, { pairs: "XAUUSD" });
assert.doesNotMatch(unclearAgentSummaryMacro.summary, /^Attenzione ai seguenti eventi/i);
assert.doesNotMatch(unclearAgentSummaryMacro.summary, /maggio/i);
assert.match(unclearAgentSummaryMacro.summary, /RISK-OFF|risk-off/i);
assert.match(unclearAgentSummaryMacro.summary, /XAU\/USD/);
assert.match(unclearAgentSummaryMacro.summary, /rendimenti|dollaro|inflazione/i);

const usdDriverMacro = macroNewsFromNewsHub({
  ...news,
  articles: [
    {
      ...news.articles[0]!,
      title: "Fed officials warn inflation remains sticky",
      summary: "The dollar climbs while Treasury yields rise before the next policy decision.",
      originalTitle: "Fed officials warn inflation remains sticky",
      originalSummary: "The dollar climbs while Treasury yields rise before the next policy decision.",
      impactScore: 8,
      impactDirection: "bearish",
      primaryAssets: ["USD", "XAU"],
      affectedPairs: ["XAU/USD"],
      freshnessTier: "fresh",
    },
  ],
}, { pairs: "XAUUSD" });
assert.equal(usdDriverMacro.articles[0]?.currency, "USD");
assert.deepEqual(usdDriverMacro.articles[0]?.primaryAssets, ["USD", "XAU"]);

const curatedSelectionSnapshot: NewsResponse = {
  ...news,
  articles: [
    {
      ...news.articles[0]!,
      title: "Gold price update as traders wait for direction",
      summary: "Spot gold moves sideways in quiet trade.",
      originalTitle: "Gold price update as traders wait for direction",
      originalSummary: "Spot gold moves sideways in quiet trade.",
      impactScore: 6,
      matchConfidence: 0.7,
      freshnessTier: "fresh",
      impactReason: "Generic market commentary.",
    },
    {
      ...news.articles[0]!,
      title: "US CPI surprise sends Treasury yields higher",
      summary: "Inflation data reprices Fed expectations and pressures XAU/USD.",
      originalTitle: "US CPI surprise sends Treasury yields higher",
      originalSummary: "Inflation data reprices Fed expectations and pressures XAU/USD.",
      impactScore: 9,
      matchConfidence: 0.9,
      freshnessTier: "fresh",
      impactReason: "CPI is a direct driver for USD yields and gold volatility.",
    },
    {
      ...news.articles[0]!,
      title: "Fed minutes show inflation concern",
      summary: "FOMC minutes move dollar and Treasury yield expectations.",
      originalTitle: "Fed minutes show inflation concern",
      originalSummary: "FOMC minutes move dollar and Treasury yield expectations.",
      impactScore: 8,
      matchConfidence: 0.84,
      freshnessTier: "fresh",
    },
    {
      ...news.articles[0]!,
      title: "Payrolls surprise drives dollar volatility",
      summary: "NFP changes rate expectations and moves XAU/USD risk.",
      originalTitle: "Payrolls surprise drives dollar volatility",
      originalSummary: "NFP changes rate expectations and moves XAU/USD risk.",
      impactScore: 8,
      matchConfidence: 0.82,
      freshnessTier: "fresh",
    },
    {
      ...news.articles[0]!,
      title: "Powell warns inflation remains sticky",
      summary: "Fed comments lift Treasury yields before the next rate decision.",
      originalTitle: "Powell warns inflation remains sticky",
      originalSummary: "Fed comments lift Treasury yields before the next rate decision.",
      impactScore: 8,
      matchConfidence: 0.8,
      freshnessTier: "fresh",
    },
  ],
};
const curatedMacro = macroNewsFromNewsHub(curatedSelectionSnapshot, { pairs: "XAUUSD" });
assert.equal(curatedMacro.articles.length, 3);
assert.equal(curatedMacro.articles.some((article) => /Gold price update/i.test(article.title)), false);
assert.equal(curatedMacro.articles[0]?.title, "US CPI surprise sends Treasury yields higher");

console.log("macro news adapter checks passed");
