import assert from "node:assert/strict";
import {
  PUBLIC_SEO_LANGUAGES,
  PUBLIC_SEO_TOPICS,
  getPublicSeoPageByPath,
  getPublicSeoPages,
  publicSeoTopics,
} from "./publicSeoContent";

assert.deepEqual(PUBLIC_SEO_LANGUAGES, ["it", "en", "es", "fr", "de"]);
assert.deepEqual(PUBLIC_SEO_TOPICS, [
  "trading-journal",
  "mt5-trading-journal",
  "fx-blue-account-sync",
  "position-size-calculator",
  "forex-backtesting",
  "macro-news-trading",
  "trading-risk-management",
]);

const pages = getPublicSeoPages();
assert.equal(pages.length, PUBLIC_SEO_LANGUAGES.length * PUBLIC_SEO_TOPICS.length);

for (const topicId of PUBLIC_SEO_TOPICS) {
  const topic = publicSeoTopics[topicId];
  assert.ok(topic.globalFeatureFacts.includes("No financial advice or trading signals"));
  assert.ok(topic.globalFeatureFacts.includes("No order placement from TraderLoading"));

  for (const lang of PUBLIC_SEO_LANGUAGES) {
    const page = topic.locales[lang];
    assert.equal(page.topicId, topicId);
    assert.equal(page.language, lang);
    assert.match(page.path, new RegExp(`^/${lang}/[a-z0-9-]+$`));
    assert.ok(page.title.includes("TraderLoading"));
    assert.ok(
      page.description.length >= 110 && page.description.length <= 165,
      `${page.path} description length is ${page.description.length}`,
    );
    assert.ok(page.sections.length >= 4);
    assert.ok(page.faqs.length >= 4);
    assert.equal(page.cta.href, "/sign-up");
    assert.doesNotMatch(
      JSON.stringify(page),
      /guaranteed profit|profitto garantito|investment advice/i,
    );
  }
}

assert.equal(getPublicSeoPageByPath("/it/diario-trading")?.topicId, "trading-journal");
assert.equal(getPublicSeoPageByPath("/en/trading-risk-management")?.language, "en");

console.log("public SEO content registry checks passed");
