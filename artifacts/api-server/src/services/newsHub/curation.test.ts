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

console.log("news curation checks passed");
