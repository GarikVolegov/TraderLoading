import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Google richiede che le domande/risposte del JSON-LD FAQPage siano visibili
// in pagina: questo test tiene allineati LandingPage e index.html.

const landingSource = readFileSync(new URL("./LandingPage.tsx", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

assert.match(landingSource, /FAQ_ITEMS/);
assert.match(landingSource, /Frequently Asked Questions/);
assert.match(indexHtml, /"@type": "FAQPage"/);

const questionMatches = [...landingSource.matchAll(/question:\s*"([^"]+)"/g)].map((m) => m[1]);
assert.ok(questionMatches.length >= 4, "landing must expose at least 4 FAQ items");

for (const question of questionMatches) {
  assert.ok(
    indexHtml.includes(`"name": "${question}"`),
    `FAQ question missing from index.html JSON-LD: ${question}`,
  );
}

const schemaQuestionCount = [...indexHtml.matchAll(/"@type": "Question"/g)].length;
assert.equal(
  schemaQuestionCount,
  questionMatches.length,
  "JSON-LD must contain exactly the questions visible on the landing page",
);

console.log("landing FAQ static checks passed");
