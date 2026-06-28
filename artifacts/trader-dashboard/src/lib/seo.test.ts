import assert from "node:assert/strict";
import {
  SEO_PAGE_KEYS,
  SEO_SLUGS,
  SITE_ORIGIN,
  absoluteUrl,
  allMarketingPaths,
  breadcrumbJsonLd,
  faqJsonLd,
  getLanguageFromPath,
  landingAlternates,
  landingPath,
  seoPageAlternates,
  seoPageFromSlug,
  seoPagePath,
} from "./seo.ts";
import { SUPPORTED_LANGUAGES } from "./i18n.ts";

// getLanguageFromPath — only the 4 prefixed languages (and explicit /en) resolve.
assert.equal(getLanguageFromPath("/it"), "it");
assert.equal(getLanguageFromPath("/it/diario-trading"), "it");
assert.equal(getLanguageFromPath("/de/"), "de");
assert.equal(getLanguageFromPath("/"), null, "root has no language prefix");
assert.equal(getLanguageFromPath("/trading-journal"), null, "english slug = no prefix");
assert.equal(getLanguageFromPath("/journal"), null, "app route is not a language");
assert.equal(getLanguageFromPath("/backtest"), null, "app route is not a language");
assert.equal(getLanguageFromPath("/IT"), "it", "case-insensitive prefix");

// base prefix is stripped before matching.
assert.equal(getLanguageFromPath("/app/it/x", "/app"), "it");
assert.equal(getLanguageFromPath("/app/", "/app"), null);

// landingPath — English at root, others prefixed.
assert.equal(landingPath("en"), "/");
assert.equal(landingPath("it"), "/it");
assert.equal(landingPath("de"), "/de");

// seoPagePath — English bare slug, others prefixed; English avoids /backtest.
assert.equal(seoPagePath("trading-journal", "en"), "/trading-journal");
assert.equal(seoPagePath("trading-journal", "it"), "/it/diario-trading");
assert.equal(seoPagePath("backtest", "en"), "/backtesting");
assert.equal(seoPagePath("backtest", "it"), "/it/backtest");
assert.notEqual(
  seoPagePath("backtest", "en"),
  "/backtest",
  "english backtest page must not collide with the app /backtest route",
);

// seoPageFromSlug — round-trips for every page and language.
for (const page of SEO_PAGE_KEYS) {
  for (const lang of SUPPORTED_LANGUAGES) {
    assert.equal(
      seoPageFromSlug(lang, SEO_SLUGS[page][lang]),
      page,
      `slug for ${page}/${lang} should resolve back to ${page}`,
    );
  }
}
assert.equal(seoPageFromSlug("it", "does-not-exist"), null);
assert.equal(seoPageFromSlug("it", undefined), null);

// Every slug across all (page, lang) is unique within a language, so a
// /{lang}/:slug route can never be ambiguous.
for (const lang of SUPPORTED_LANGUAGES) {
  const slugs = SEO_PAGE_KEYS.map((page) => SEO_SLUGS[page][lang]);
  assert.equal(new Set(slugs).size, slugs.length, `slugs for ${lang} must be unique`);
}

// absoluteUrl
assert.equal(absoluteUrl("/"), `${SITE_ORIGIN}/`);
assert.equal(absoluteUrl("/it"), `${SITE_ORIGIN}/it`);
assert.equal(absoluteUrl("it"), `${SITE_ORIGIN}/it`);

// landingAlternates — 5 languages + x-default, x-default points at English root.
const la = landingAlternates();
assert.equal(la.length, SUPPORTED_LANGUAGES.length + 1);
assert.deepEqual(
  la.filter((a) => a.hreflang === "x-default")[0],
  { hreflang: "x-default", href: `${SITE_ORIGIN}/` },
);
assert.deepEqual(
  la.filter((a) => a.hreflang === "it")[0],
  { hreflang: "it", href: `${SITE_ORIGIN}/it` },
);

// seoPageAlternates
const pa = seoPageAlternates("trading-journal");
assert.equal(pa.length, SUPPORTED_LANGUAGES.length + 1);
assert.deepEqual(
  pa.filter((a) => a.hreflang === "x-default")[0],
  { hreflang: "x-default", href: `${SITE_ORIGIN}/trading-journal` },
);

// allMarketingPaths — landings + every page×language, all unique.
const all = allMarketingPaths();
const expectedCount =
  SUPPORTED_LANGUAGES.length + SEO_PAGE_KEYS.length * SUPPORTED_LANGUAGES.length;
assert.equal(all.length, expectedCount);
assert.equal(new Set(all).size, all.length, "marketing paths must be unique");
assert.ok(all.includes("/"), "root landing present");
assert.ok(all.includes("/it/diario-trading"), "localized page present");

// breadcrumbJsonLd
const bc = breadcrumbJsonLd("Home", "Trading Journal", "trading-journal", "en") as {
  itemListElement: Array<{ item: string; position: number }>;
};
assert.equal(bc.itemListElement[0].item, `${SITE_ORIGIN}/`);
assert.equal(bc.itemListElement[1].item, `${SITE_ORIGIN}/trading-journal`);

// faqJsonLd
const faq = faqJsonLd("it", [{ question: "Q?", answer: "A." }]) as {
  inLanguage: string;
  mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>;
};
assert.equal(faq.inLanguage, "it");
assert.equal(faq.mainEntity[0].name, "Q?");
assert.equal(faq.mainEntity[0].acceptedAnswer.text, "A.");

console.log("seo helpers checks passed");
