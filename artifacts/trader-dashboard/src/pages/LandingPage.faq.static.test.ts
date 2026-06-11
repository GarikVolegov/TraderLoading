import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Google richiede che le domande/risposte del JSON-LD FAQPage siano visibili
// in pagina: la landing ora genera FAQ e metadati nella lingua attiva.

const landingSource = readFileSync(new URL("./LandingPage.tsx", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

assert.match(landingSource, /FAQ_ITEMS/);
assert.match(landingSource, /landing-faq-jsonld/);
assert.match(landingSource, /"@type": "FAQPage"/);
assert.match(landingSource, /landing\.faq\.heading/);
assert.match(landingSource, /landing\.meta\.title/);
assert.match(landingSource, /og:locale/);
assert.match(landingSource, /twitter:title/);
assert.doesNotMatch(indexHtml, /"@type": "FAQPage"/);

const questionKeyMatches = [...landingSource.matchAll(/questionKey:\s*"([^"]+)"/g)].map((m) => m[1]);
const answerKeyMatches = [...landingSource.matchAll(/answerKey:\s*"([^"]+)"/g)].map((m) => m[1]);
assert.ok(questionKeyMatches.length >= 4, "landing must expose at least 4 translated FAQ items");
assert.equal(answerKeyMatches.length, questionKeyMatches.length);

for (const key of [...questionKeyMatches, ...answerKeyMatches]) {
  assert.match(key, /^landing\.faq\./, `FAQ copy must use landing i18n keys: ${key}`);
}

assert.doesNotMatch(landingSource, /Frequently Asked Questions/);
assert.doesNotMatch(landingSource, /Is TraderLoading free\?/);

console.log("landing FAQ static checks passed");
