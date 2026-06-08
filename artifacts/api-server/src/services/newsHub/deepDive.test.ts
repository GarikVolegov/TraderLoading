import assert from "node:assert/strict";
import { buildNewsDeepDive } from "./deepDive.js";
import type { NewsArticle } from "./types.js";

function article(input: Partial<NewsArticle> = {}): NewsArticle {
  return {
    title: "US CPI beats expectations as Treasury yields jump",
    summary: "Markets price fewer Fed cuts and a stronger dollar after inflation data.",
    source: "TestWire",
    publishedAt: "2026-06-08T10:00:00.000Z",
    url: "https://example.com/cpi",
    sentiment: "bearish",
    imageUrl: null,
    affectedPairs: ["XAU/USD"],
    primaryAssets: ["XAU", "USD"],
    impactScore: 8,
    impactDirection: "bearish",
    relevanceReason: "Inflazione e CPI influenzano aspettative sui tassi, dollaro e rendimenti reali: sono driver diretti dell'oro/XAU.",
    ...input,
  };
}

const bearish = buildNewsDeepDive(article(), { lang: "it" });
assert.match(bearish.whatHappened, /Markets price fewer Fed cuts/i);
assert.match(bearish.whyItMatters, /XAU\/USD/);
assert.match(bearish.whyItMatters, /Inflazione|CPI|rendimenti/i);
assert.match(bearish.possibleImpact, /pressione ribassista|ribassista/i);
assert.match(bearish.possibleImpact, /XAU\/USD/);

const bullish = buildNewsDeepDive(article({
  title: "Gold rises as dollar weakens",
  summary: "Bullion catches a bid after the dollar retreats.",
  sentiment: "bullish",
  impactDirection: "bullish",
  impactScore: 7,
}), { lang: "it" });
assert.match(bullish.possibleImpact, /sostenere|rialzista/i);

const mixed = buildNewsDeepDive(article({
  impactDirection: "mixed",
  sentiment: "neutral",
  impactScore: 6,
}), { lang: "it" });
assert.match(mixed.possibleImpact, /volatilit/i);

const sparse = buildNewsDeepDive(article({
  title: "Markets wait for central bank signals",
  summary: "",
  relevanceReason: undefined,
  impactReason: undefined,
  affectedPairs: [],
  primaryAssets: [],
  impactDirection: "neutral",
  sentiment: null,
  impactScore: 2,
}), { lang: "it" });
assert.match(sparse.whatHappened, /Markets wait/);
assert.match(sparse.whyItMatters, /mercato|macro|volatil/i);
assert.match(sparse.possibleImpact, /limitato|monitorare|volatilit/i);

const english = buildNewsDeepDive(article(), { lang: "en" });
assert.match(english.whyItMatters, /XAU\/USD/);
assert.match(english.possibleImpact, /bearish pressure|downside pressure|volatility/i);

const attached = {
  ...article(),
  deepDive: buildNewsDeepDive(article(), { lang: "it" }),
};
assert.equal(typeof attached.deepDive.whatHappened, "string");
assert.equal(typeof attached.deepDive.whyItMatters, "string");
assert.equal(typeof attached.deepDive.possibleImpact, "string");

console.log("news deep dive checks passed");
