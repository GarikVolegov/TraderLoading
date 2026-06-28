import assert from "node:assert/strict";
import { normalizeWords, isRedundantText } from "./macroNewsDedup.js";

// normalizeWords: lowercase, strip diacritics + punctuation, split on whitespace.
assert.deepEqual(normalizeWords("Perché, influénza!"), ["perche", "influenza"]);
assert.deepEqual(normalizeWords("  Cosa   è  successo  "), ["cosa", "e", "successo"]);
assert.deepEqual(normalizeWords(""), []);
assert.deepEqual(normalizeWords("   "), []);

const title =
  "Il presidente Donald Trump ha appena preso un colpo al presidente della Fed, Kevin Warsh, scelto con cura, sui tassi di interesse";
const summary =
  "Il presidente Donald Trump ha appena preso un colpo sul presidente della Fed, Kevin Warsh, scelto con cura, sui tassi di interesse";

// A summary that only restates the title (one word differs: "al" vs "sul") is redundant.
assert.equal(isRedundantText(summary, [title]), true);

// An identical string is redundant.
assert.equal(isRedundantText(title, [title]), true);

// Empty / whitespace candidates are treated as redundant (nothing to render).
assert.equal(isRedundantText("", [title]), true);
assert.equal(isRedundantText("   ", [title]), true);

// An enriched "what happened" (summary + source/recency) ADDS information → keep it,
// even though most of its words already appeared.
const enriched = `${summary} Fonte: ANZ, pubblicata circa 3 ore fa.`;
assert.equal(isRedundantText(enriched, [title]), false);
assert.equal(isRedundantText(enriched, [title, summary]), false);

// Distinct analysis text shares almost nothing with the headline → keep it.
const whyItMatters =
  "Le indicazioni di banca centrale muovono i differenziali di tasso: e' il canale che riprezza gli asset collegati nel breve.";
assert.equal(isRedundantText(whyItMatters, [title, summary]), false);

// A genuinely different summary (real lead, not an echo) is kept.
const goldTitle = "Gold jumps as Treasury yields retreat";
const goldSummary = "Spot gold rises while the dollar softens.";
assert.equal(isRedundantText(goldSummary, [goldTitle]), false);

console.log("macro news dedup checks passed");
