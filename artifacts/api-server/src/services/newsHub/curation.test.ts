import assert from "node:assert/strict";
import type { NewsArticle } from "./types.js";
import { scoreCuratedNewsArticle, selectCuratedNews } from "./curation.js";

function article(title: string, input: Partial<NewsArticle> = {}): NewsArticle {
  return {
    title,
    summary: input.summary ?? title,
    source: input.source ?? "Reuters",
    publishedAt: input.publishedAt ?? "2026-06-09T10:00:00.000Z",
    url: input.url ?? "https://example.com/news",
    sentiment: input.sentiment ?? null,
    imageUrl: input.imageUrl ?? null,
    affectedPairs: input.affectedPairs ?? ["XAU/USD"],
    primaryAssets: input.primaryAssets ?? ["XAU", "USD"],
    impactScore: input.impactScore ?? 8,
    matchConfidence: input.matchConfidence ?? 0.82,
    freshnessTier: input.freshnessTier ?? "fresh",
    verified: input.verified ?? true,
    impactReason: input.impactReason,
    relevanceReason: input.relevanceReason,
    originalTitle: input.originalTitle,
    originalSummary: input.originalSummary,
    impactDirection: input.impactDirection,
    isFallback: input.isFallback,
    qualityScore: input.qualityScore,
    deepDive: input.deepDive,
    sources: input.sources,
    citationUrls: input.citationUrls,
    resolvedUrl: input.resolvedUrl,
    sourceUrl: input.sourceUrl,
  };
}

const selectedPair = article("US CPI surprise sends Treasury yields higher", {
  summary: "Inflation data reprices Fed expectations and pressures XAU/USD.",
  impactReason: "CPI is a direct driver for USD yields and gold volatility.",
});
assert.equal(selectCuratedNews([selectedPair], { pairs: "XAUUSD" }).length, 1);
assert.ok(scoreCuratedNewsArticle(selectedPair, { pairs: "XAUUSD" }).score >= 8);

const genericMedium = article("Gold price update as traders wait for direction", {
  summary: "Spot gold moves sideways in quiet trade.",
  impactScore: 6,
  matchConfidence: 0.7,
  impactReason: "Generic market commentary.",
});
assert.equal(selectCuratedNews([genericMedium], { pairs: "XAUUSD" }).length, 0);

const fallbackArticle = article("Fed rate decision shocks dollar markets", {
  summary: "The decision moves yields and FX volatility.",
  freshnessTier: "fallback",
  isFallback: true,
});
assert.equal(selectCuratedNews([fallbackArticle], { pairs: "XAUUSD" }).length, 0);

const macroDriver = article("ECB rate decision lifts euro volatility", {
  summary: "The central bank decision changes rate expectations for EUR/USD.",
  affectedPairs: ["EUR/USD"],
  primaryAssets: ["EUR", "USD"],
  impactScore: 8,
  matchConfidence: 0.78,
});
assert.equal(selectCuratedNews([macroDriver], { pairs: "EURUSD" }).length, 1);

const duplicateWeak = article("US CPI surprise pushes Treasury yields higher", {
  summary: "Markets react to inflation data.",
  impactScore: 8,
  matchConfidence: 0.62,
  publishedAt: "2026-06-09T10:01:00.000Z",
});
const duplicateStrong = article("US CPI surprise pushes Treasury yields higher", {
  summary: "Inflation reprices Fed expectations and directly affects XAU/USD.",
  impactScore: 9,
  matchConfidence: 0.9,
  publishedAt: "2026-06-09T10:02:00.000Z",
});
const deduped = selectCuratedNews([duplicateWeak, duplicateStrong], { pairs: "XAUUSD" });
assert.equal(deduped.length, 1);
assert.equal(deduped[0]?.impactScore, 9);

const ranked = selectCuratedNews([
  article("Fed minutes show inflation concern", {
    summary: "Officials remain focused on sticky inflation.",
    impactScore: 8,
    matchConfidence: 0.8,
    publishedAt: "2026-06-09T10:00:00.000Z",
  }),
  article("US jobs report triggers dollar breakout", {
    summary: "Payrolls surprise changes Fed expectations for XAU/USD.",
    impactScore: 9,
    matchConfidence: 0.92,
    publishedAt: "2026-06-09T09:59:00.000Z",
  }),
], { pairs: "XAUUSD" });
assert.equal(ranked[0]?.title, "US jobs report triggers dollar breakout");

const limited = selectCuratedNews([
  article("US CPI surprise sends Treasury yields higher"),
  article("Fed minutes show inflation concern", { summary: "FOMC minutes move dollar expectations." }),
  article("Payrolls surprise drives dollar volatility", { summary: "NFP changes rate expectations." }),
  article("Powell warns inflation remains sticky", { summary: "Fed comments move Treasury yields." }),
], { pairs: "XAUUSD", limit: 3 });
assert.equal(limited.length, 3);

// Chronological sort: the curated picks come back newest-first regardless of score.
const chronological = selectCuratedNews([
  article("Fed minutes show inflation concern", {
    summary: "Officials remain focused on sticky inflation.",
    impactScore: 8,
    matchConfidence: 0.8,
    publishedAt: "2026-06-09T10:00:00.000Z",
  }),
  article("US jobs report triggers dollar breakout", {
    summary: "Payrolls surprise changes Fed expectations for XAU/USD.",
    impactScore: 9,
    matchConfidence: 0.92,
    publishedAt: "2026-06-09T09:59:00.000Z",
  }),
], { pairs: "XAUUSD", sort: "chronological" });
assert.equal(chronological.length, 2);
assert.equal(chronological[0]?.title, "Fed minutes show inflation concern");

// minKeep backfill: a below-threshold (but non-stale) article is kept when the
// feed would otherwise starve, while stale/fallback items stay excluded.
const weakButUsable = article("Gold steadies near record on rate cut expectations", {
  summary: "Bullion consolidates as markets weigh interest rates outlook.",
  impactScore: 5,
  matchConfidence: 0.5,
});
assert.equal(selectCuratedNews([weakButUsable], { pairs: "EURUSD" }).length, 0);
assert.equal(selectCuratedNews([weakButUsable], { pairs: "EURUSD", minKeep: 3 }).length, 1);
const staleWeak = article("Fed rate decision shocks dollar markets", {
  summary: "The decision moves yields and FX volatility.",
  freshnessTier: "stale",
});
assert.equal(selectCuratedNews([staleWeak], { pairs: "XAUUSD", minKeep: 3 }).length, 0);

// minKeep never overrides the strongest-first selection: the high-impact
// article still leads when backfill kicks in.
const backfilled = selectCuratedNews([
  weakButUsable,
  article("US CPI surprise sends Treasury yields higher", {
    summary: "Inflation data reprices Fed expectations and pressures XAU/USD.",
  }),
], { pairs: "XAUUSD", minKeep: 2 });
assert.equal(backfilled.length, 2);
assert.equal(backfilled[0]?.title, "US CPI surprise sends Treasury yields higher");

// Hard noise: price-forecast listicles never enter the feed, not even via
// minKeep backfill, regardless of impact score.
const forecastListicle = article("Previsioni per il prezzo dell'oro (XAU/USD) per oggi, domani e la prossima settimana", {
  summary: "Analisi e previsioni sul prezzo dell'oro.",
  originalTitle: "Gold Price Forecast (XAU/USD) for today, tomorrow and next week",
  impactScore: 9,
  matchConfidence: 0.9,
});
assert.equal(selectCuratedNews([forecastListicle], { pairs: "XAUUSD", minKeep: 3 }).length, 0);

// Near-duplicate stories from different outlets keep only the stronger one.
const outletA = article("Gold drops 9% ahead of crucial CPI inflation print", {
  summary: "Bullion slides as markets brace for US inflation data.",
  impactScore: 9,
  matchConfidence: 0.9,
  publishedAt: "2026-06-09T10:05:00.000Z",
});
const outletB = article("Gold drops 9% ahead of key CPI inflation data print", {
  summary: "Gold falls before the US CPI release.",
  impactScore: 8,
  matchConfidence: 0.8,
  publishedAt: "2026-06-09T10:00:00.000Z",
});
const crossOutlet = selectCuratedNews([outletB, outletA], { pairs: "XAUUSD" });
assert.equal(crossOutlet.length, 1);
assert.equal(crossOutlet[0]?.impactScore, 9);

// Corporate/single-stock housekeeping (dividends, mining deals) is penalized
// out of the feed even when it names the traded asset.
const dividendNote = article("Azioni Newmont Corporation: data del dividendo", {
  summary: "Newmont annuncia la data di stacco del dividendo.",
  originalTitle: "Newmont Corporation shares: dividend ex-date announced",
  originalSummary: "Newmont announces its dividend ex-date.",
  impactScore: 8,
  matchConfidence: 0.32,
});
assert.equal(selectCuratedNews([dividendNote], { pairs: "XAUUSD" }).length, 0);

// Evergreen explainers are hard-excluded, also from backfill.
const explainer = article("Come viene fissato il prezzo dell'oro: spiegazione del fixing", {
  summary: "Una guida al meccanismo del fixing di Londra.",
  originalTitle: "How the gold price is set: London fixing explained",
  impactScore: 8,
  matchConfidence: 0.9,
});
assert.equal(selectCuratedNews([explainer], { pairs: "XAUUSD", minKeep: 3 }).length, 0);

// Translated near-duplicates with different original outlets are still merged:
// the translated titles converge even when the originals differ.
const trumpA = article("Il prezzo dell'oro crolla sotto i 4.250 dollari mentre Trump promette nuovi dazi", {
  summary: "Il metallo scivola dopo le dichiarazioni sui dazi.",
  originalTitle: "Gold price tumbles below $4,250 as Trump pledges fresh tariffs - FXStreet",
  impactScore: 9,
  matchConfidence: 0.9,
  publishedAt: "2026-06-09T19:13:00.000Z",
});
const trumpB = article("Il prezzo dell'oro scende sotto i 4.250 dollari mentre Trump promette nuovi dazi", {
  summary: "Oro in calo dopo le promesse sui dazi.",
  originalTitle: "Gold slips under $4,250 on Trump tariff pledge - Kitco News",
  impactScore: 8,
  matchConfidence: 0.85,
  publishedAt: "2026-06-09T19:55:00.000Z",
});
const trumpDeduped = selectCuratedNews([trumpA, trumpB], { pairs: "XAUUSD" });
assert.equal(trumpDeduped.length, 1);
assert.equal(trumpDeduped[0]?.impactScore, 9);

// Re-published bank calls hours apart are merged too: headline function words
// (dell', mentre, …) are ignored so the shared substance dominates.
const msA = article("Morgan Stanley prevede un indebolimento del dollaro USA mentre la Fed mantiene i tassi", {
  summary: "La banca vede un dollaro più debole nel 2026.",
  impactScore: 8,
  matchConfidence: 0.8,
  publishedAt: "2026-06-09T20:25:00.000Z",
});
const msB = article("Morgan Stanley avverte che il dollaro USA potrebbe indebolirsi mentre la Fed mantiene i tassi", {
  summary: "La banca ribadisce la view ribassista sul dollaro.",
  impactScore: 8,
  matchConfidence: 0.82,
  publishedAt: "2026-06-10T00:54:00.000Z",
});
const msDeduped = selectCuratedNews([msA, msB], { pairs: "XAUUSD" });
assert.equal(msDeduped.length, 1);

// …but genuinely different stories on the same asset are NOT merged.
const distinctStories = selectCuratedNews([
  article("L'oro crolla sotto i 4.250 dollari a causa delle rinnovate tensioni tra Stati Uniti e Iran", {
    summary: "Le tensioni geopolitiche muovono i beni rifugio.",
    publishedAt: "2026-06-09T23:15:00.000Z",
  }),
  article("Il prezzo dell'oro crolla sotto i 4.250 dollari mentre Trump promette di rispondere ai dazi", {
    summary: "Le dichiarazioni sui dazi pesano sul metallo.",
    publishedAt: "2026-06-09T19:13:00.000Z",
  }),
], { pairs: "XAUUSD" });
assert.equal(distinctStories.length, 2);

// Clickbait evergreen: question op-eds, time-to-buy advice and key-level
// technical clickbait are hard-excluded.
for (const noisy of [
  article("Perché l'oro rimane uno scudo affidabile durante i periodi incerti?", {
    originalTitle: "Why Gold Remains A Trusted Shield During Uncertain Times? - Kalkine Media",
  }),
  article("Analisi del prezzo dell'oro: zone chiave di acquisto a $ 4.900", {
    originalTitle: "Gold Price Analysis: Key Buy Zones at $4900 - IndexBox",
  }),
  article("L'oro è sceso del 23% dal picco. È ora di acquistare?", {
    originalTitle: "Gold is down 23% from its peak. Time to buy?",
  }),
  article("Analista veterano individua il livello critico per i prezzi dell'oro", {
    originalTitle: "Veteran analyst spots critical level for gold prices",
  }),
  article("Tasso di oro e argento oggi 10 giugno: i prezzi aggiornati", {
    originalTitle: "Gold and silver rate today June 10: latest prices",
  }),
  article("Il prezzo dell'oro sale da ₹ 10 a ₹ 1,53.170; argento in ribasso", {
    originalTitle: "Gold price up ₹10 to ₹1,53,170; silver down",
  }),
  article("Da Gift Nifty alla guerra USA-Iran: 8 cose fondamentali prima dell'apertura", {
    originalTitle: "From Gift Nifty to US-Iran war: 8 things to know before market opens",
  }),
  article("L'oro scende sotto Rs 1,5 lakh in mezzo alla svendita globale", {
    originalTitle: "Gold falls below Rs 1.5 lakh amid global selloff",
  }),
  article("Il prezzo dell'oro scende di 6.591 Tk per bhori", {
    originalTitle: "Gold price drops by Tk 6,591 per bhori",
  }),
  article("Prezzo oro e argento oggi, 10 giugno: controlla i prezzi a Mumbai, Delhi, Chennai", {
    originalTitle: "Gold and silver price today, June 10: check prices in Mumbai, Delhi, Chennai",
  }),
  article("Prezzo dell'oro oggi: l'oro MCX scende oltre Rs 2.000", {
    originalTitle: "Gold price today: MCX gold slips over Rs 2,000",
  }),
]) {
  assert.equal(selectCuratedNews([noisy], { pairs: "XAUUSD", minKeep: 3 }).length, 0, noisy.title);
}

// Quiet-day last resort: with zero fresh candidates, fallback-tier articles
// backfill the floor instead of returning an empty feed (stale stays out).
const fallbackOnly = article("Fed rate decision moves Treasury yields", {
  summary: "The decision changes rate expectations for XAU/USD.",
  freshnessTier: "fallback",
  isFallback: true,
});
assert.equal(selectCuratedNews([fallbackOnly], { pairs: "XAUUSD" }).length, 0);
assert.equal(selectCuratedNews([fallbackOnly], { pairs: "XAUUSD", minKeep: 3 }).length, 1);

console.log("news curation checks passed");
