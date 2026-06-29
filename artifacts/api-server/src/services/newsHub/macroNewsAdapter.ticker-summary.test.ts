import assert from "node:assert/strict";
import { buildMacroTickerSummary } from "./macroNewsAdapter.js";
import { computeRiskRegime } from "./riskRegime.js";

// buildMacroTickerSummary must produce a context-aware risk summary, never a feed-source list.
const articles = [
  {
    title: "Fed officials weigh the rate path",
    summary: "Treasury yields steady as markets await the next FOMC decision",
    affectedPairs: ["XAU/USD"],
  },
  {
    title: "Dollar mixed before inflation data",
    summary: "Traders position ahead of the CPI print",
  },
] as unknown as Parameters<typeof buildMacroTickerSummary>[0];

const neutralRegime = computeRiskRegime([]); // { regime: "neutrale", ... }
const summary = buildMacroTickerSummary(articles, neutralRegime);

assert.match(summary, /NEUTRALE/);
assert.match(summary, /driver principale/);
assert.doesNotMatch(summary, /Notizie in tempo reale da/);
assert.ok(summary.length > 20);

// Empty input still yields a meaningful sentence (not a source list).
const empty = buildMacroTickerSummary([], neutralRegime);
assert.doesNotMatch(empty, /Notizie in tempo reale da/);
assert.ok(empty.length > 0);

console.log("buildMacroTickerSummary checks passed");
