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

// Concrete figures from the original headline surface in whatHappened when the
// visible summary does not already contain them.
const figures = buildNewsDeepDive(article({
  title: "US CPI rises 3.2% as payrolls add 250,000 jobs",
  summary: "Inflation accelerated more than expected while hiring stayed strong.",
}), { lang: "it" });
assert.match(figures.whatHappened, /3\.2\s*%/);
assert.match(figures.whatHappened, /250,000/);
assert.match(figures.whatHappened, /Dati chiave/);

// Figures already visible in the summary are NOT repeated as "Dati chiave".
const noRepeat = buildNewsDeepDive(article({
  title: "US CPI rises 3.2%",
  summary: "Inflation came in at 3.2%, above the 3.2% consensus.",
}), { lang: "it" });
assert.doesNotMatch(noRepeat.whatHappened, /Dati chiave/);

// A banal summary (identical to the title) is grounded with the source.
const banal = buildNewsDeepDive(article({
  title: "Gold climbs to fresh record",
  summary: "Gold climbs to fresh record",
  source: "Reuters",
}), { lang: "it" });
assert.match(banal.whatHappened, /Fonte: Reuters/);

// Variant seeds rotate the phrasing so adjacent feed cards do not repeat the
// same template sentence.
const seedA = buildNewsDeepDive(article(), { lang: "it", variantSeed: 0 });
const seedB = buildNewsDeepDive(article(), { lang: "it", variantSeed: 1 });
assert.notEqual(seedA.possibleImpact, seedB.possibleImpact);
assert.notEqual(seedA.whyItMatters, seedB.whyItMatters);
assert.match(seedB.possibleImpact, /ribassista/i);

// High-impact data releases carry the two-sided (above/below expectations)
// scenario so the detail is actionable, not generic.
assert.match(seedA.possibleImpact, /Sopra le attese|sotto le attese/i);

// For a bullish call the scenario leads with the supportive side, so the hint
// extends the thesis instead of contradicting it.
const bullishHint = buildNewsDeepDive(article({
  title: "Bullish for gold: CPI inflation could send real yields lower",
  summary: "Inflation outlook may push real yields down, supporting bullion.",
  sentiment: "bullish",
  impactDirection: "bullish",
}), { lang: "it" });
assert.match(bullishHint.possibleImpact, /sotto le attese.+sopra le attese/i);

console.log("news deep dive checks passed");
