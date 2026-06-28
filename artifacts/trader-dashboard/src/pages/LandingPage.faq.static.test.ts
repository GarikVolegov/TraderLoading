import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Google requires the FAQPage JSON-LD Q&A to be visible on the page. The landing
// builds localized FAQ structured data via faqJsonLd (lib/seo.ts) from FAQ_ITEMS
// and emits it — together with the canonical/hreflang and OG/Twitter meta —
// through the shared <Seo> head manager (components/Seo.tsx).

const landingSource = readFileSync(new URL("./LandingPage.tsx", import.meta.url), "utf8");
const seoComponent = readFileSync(new URL("../components/Seo.tsx", import.meta.url), "utf8");
const seoLib = readFileSync(new URL("../lib/seo.ts", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

// FAQ structured data is generated from translated items and rendered via <Seo>.
assert.match(landingSource, /FAQ_ITEMS/);
assert.match(landingSource, /faqJsonLd/);
assert.match(landingSource, /<Seo/);
assert.match(landingSource, /landing\.faq\.heading/);
assert.match(landingSource, /landing\.meta\.title/);

// The FAQPage schema + social meta live in the shared SEO modules now.
assert.match(seoLib, /"@type": "FAQPage"/);
assert.match(seoComponent, /og:locale/);
assert.match(seoComponent, /twitter:title/);

// The static index.html must NOT hardcode a FAQPage (it's per-language at runtime).
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
