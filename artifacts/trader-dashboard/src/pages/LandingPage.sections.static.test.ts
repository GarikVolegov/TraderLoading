import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DICT } from "../lib/i18n/all";

const page = readFileSync(new URL("./LandingPage.tsx", import.meta.url), "utf8");
const sections = readFileSync(
  new URL("../components/landing/LandingSections.tsx", import.meta.url),
  "utf8",
);
const process = readFileSync(
  new URL("../components/landing/LandingProcess.tsx", import.meta.url),
  "utf8",
);
const shared = readFileSync(new URL("../components/landing/shared.tsx", import.meta.url), "utf8");
const navigation = readFileSync(
  new URL("../components/landing/LandingNavigation.tsx", import.meta.url),
  "utf8",
);
const source = page + sections + process + shared + navigation;

// Existing public anchors survive the component split and remain navigable.
for (const name of ["features", "how", "pricing", "faq"]) {
  assert.ok(source.includes(`id="${name}"`));
  assert.ok(navigation.includes(`"#${name}"`));
}
assert.match(sections, /\/api\/public\/stats/);
assert.match(sections, /\/api\/public\/testimonials/);
assert.match(sections, /item\.value > 0/);
assert.match(
  sections,
  /if \(!counters\.length && !hasRating && !testimonials\.length\) return null/,
);
assert.match(process, /role="tablist"/);
assert.match(process, /aria-selected/);
assert.match(process, /role="tabpanel"/);
assert.match(process, /landing\.process\.example/);
assert.doesNotMatch(
  source,
  /setInterval|setTimeout|MockSpark|64%|\+24\.6R|landing\.pricing\.popular/,
);
assert.match(shared, /href="\/sign-up"/);
assert.match(shared, /destination: "free_signup"/);
assert.match(page, /landing_demo_start/);
assert.match(page, /landing_demo_complete/);
assert.match(sections, /https:\/\/tradersync\.com\/pricing\//);
assert.match(sections, /https:\/\/edgewonk\.com\/pricing/);

// Literal copy references resolve in every locale, never expose raw i18n keys.
for (const [, key] of source.matchAll(
  /(?:t\(|(?:eyebrowKey|titleKey|bodyKey)=)["'](landing\.[\w.]+)["']/g,
)) {
  for (const [lang, dict] of Object.entries(DICT)) assert.ok(dict[key], `${lang}: missing ${key}`);
}
for (const dict of Object.values(DICT)) {
  assert.doesNotMatch(dict["landing.cta.subtitle"], /migliaia|thousands|miles|milliers|Tausend/i);
  assert.ok(!Object.keys(dict).some((key) => /^landing\.testimonials\.t[123]\./.test(key)));
}
console.log("Landing content, evidence, routes and translations passed");
