import assert from "node:assert/strict";
import { ensureMacroDeepDive, macroNewsFromNewsHub, pairsFromMacroCurrencies } from "./macroNewsAdapter.js";
import type { NewsResponse } from "./types.js";

assert.equal(pairsFromMacroCurrencies("USD,XAU"), "XAUUSD");
assert.equal(pairsFromMacroCurrencies("EUR,USD"), "EURUSD");
assert.equal(pairsFromMacroCurrencies("XAU,USD,EUR"), "XAUUSD,EURUSD");
assert.equal(pairsFromMacroCurrencies(""), "");
assert.equal(pairsFromMacroCurrencies("USD,JPY,CHF,CAD"), "USDJPY,USDCHF,USDCAD");

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
      contentBasis: "full_text",
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
      url: "https://example.com/Trump%20says%20US%20reaches%20gold%20purchase%20agreement%20as%20dollar%20weakens",
      summary: "The White House deal boosts bullion demand while Treasury yields retreat.",
      imageUrl: null,
      primaryAssets: ["XAU", "USD"],
    },
  ],
});
const fallbackImage = missingImageMacro.articles[0]?.imageUrl ?? "";
assert.match(fallbackImage, /^\/api\/news\/placeholder\?/);
assert.match(decodeURIComponent(fallbackImage), /trump|gold|agreement/i);
assert.doesNotMatch(fallbackImage, /^data:image\/svg\+xml,/);

const duplicateSourceImage = "https://static.reuters.com/shared-market-photo.jpg";
const duplicateImageMacro = macroNewsFromNewsHub({
  ...news,
  articles: [
    {
      ...news.articles[0]!,
      title: "US CPI surprise pushes Treasury yields higher",
      url: "https://example.com/US%20CPI%20surprise%20pushes%20Treasury%20yields%20higher",
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
      url: "https://example.com/Fed%20officials%20signal%20caution%20before%20rate%20decision",
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
      url: "https://example.com/Gold%20traders%20brace%20for%20jobs%20report%20volatility",
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
      url: "https://example.com/Gold%20traders%20watch%20Fed%20minutes%20after%20payrolls",
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
      url: "https://example.com/NZD%2FUSD%20nears%200.5830%20as%20weaker%20dollar%20supports%20the%20kiwi",
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
      url: "https://example.com/New%20Zealand%20Dollar%20rises%20on%20easing%20geopolitical%20risk%2C%20RBNZ%20rate-hike%20expectations",
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
      url: "https://example.com/Gold%20price%20update%20as%20traders%20wait%20for%20direction",
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
      url: "https://example.com/US%20CPI%20preview%20lifts%20Treasury%20yields%20before%20Fed%20decision",
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
      url: "https://example.com/Central%20bank%20emergency%20decision%20shocks%20markets",
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
      url: "https://example.com/Anteprima%20CPI%20USA%20di%20maggio%3A%20inflazione%20sopra%20attese",
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
      url: "https://example.com/Fed%20officials%20warn%20inflation%20remains%20sticky",
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
      url: "https://example.com/Gold%20price%20update%20as%20traders%20wait%20for%20direction",
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
      url: "https://example.com/US%20CPI%20surprise%20sends%20Treasury%20yields%20higher",
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
      url: "https://example.com/Fed%20minutes%20show%20inflation%20concern",
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
      url: "https://example.com/Payrolls%20surprise%20drives%20dollar%20volatility",
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
      url: "https://example.com/Powell%20warns%20inflation%20remains%20sticky",
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
assert.equal(curatedMacro.articles.length, 4);
assert.deepEqual(new Set(curatedMacro.articles.map(article => article.title)), new Set([
  "US CPI surprise sends Treasury yields higher", "Fed minutes show inflation concern",
  "Payrolls surprise drives dollar volatility", "Powell warns inflation remains sticky",
]));
assert.equal(curatedMacro.articles.some((article) => /Gold price update/i.test(article.title)), false);
assert.equal(curatedMacro.articles[0]?.title, "US CPI surprise sends Treasury yields higher");

// The adapter must not manufacture an analysis when the source has none.
const banalSnapshot: NewsResponse = {
  ...news,
  articles: [
    {
      ...news.articles[0]!,
      title: "US CPI surprise sends Treasury yields higher",
      url: "https://example.com/US%20CPI%20surprise%20sends%20Treasury%20yields%20higher",
      summary: "US CPI surprise sends Treasury yields higher",
      originalTitle: "US CPI surprise sends Treasury yields higher",
      originalSummary: "US CPI surprise sends Treasury yields higher",
      impactScore: 9,
      matchConfidence: 0.9,
      freshnessTier: "fresh",
      impactReason: "CPI is a direct driver for USD yields and gold volatility.",
      primaryAssets: ["USD", "XAU"],
      affectedPairs: ["XAU/USD"],
      deepDive: undefined,
    },
  ],
};
const banalMacro = macroNewsFromNewsHub(banalSnapshot, { pairs: "XAUUSD" });
assert.equal(banalMacro.articles.length, 1);
assert.equal(banalMacro.articles[0]?.deepDive, undefined);
const headlineOnly = macroNewsFromNewsHub({ ...news, articles: [{ ...news.articles[0]!, contentBasis: "headline" }] });
assert.equal(headlineOnly.articles[0]?.deepDive, undefined, "A preexisting analysis must be hidden without full-text evidence");

// Evidence filtering leaves missing analysis absent and preserves an existing
// analysis only when the source is explicitly based on full text.
const ensured = ensureMacroDeepDive(
  {
    articles: [
      {
        title: "US payrolls beat estimates",
        summary: "US payrolls beat estimates",
        impact: "alto",
        currency: "USD",
        direction: "bullish",
        source: "Reuters",
        timestamp: "2026-06-07T10:00:00.000Z",
        primaryAssets: ["USD"],
        affectedPairs: ["EUR/USD"],
      },
      {
        title: "Gold steadies",
        summary: "Spot gold holds gains.",
        contentBasis: "full_text",
        impact: "medio",
        currency: "XAU",
        direction: "neutrale",
        source: "Bloomberg",
        deepDive: {
          whatHappened: "kept-what",
          whyItMatters: "kept-why",
          possibleImpact: "kept-impact",
        },
      },
    ],
    sentiment: "risk-on",
    summary: "test",
    fetchedAt: "2026-06-07T11:00:00.000Z",
  },
  "it",
);
assert.equal(ensured.articles[0]?.deepDive, undefined);
assert.equal(ensured.articles[1]?.deepDive?.whatHappened, "kept-what");
assert.equal(ensured.articles[1]?.deepDive?.whyItMatters, "kept-why");

console.log("macro news adapter checks passed");
