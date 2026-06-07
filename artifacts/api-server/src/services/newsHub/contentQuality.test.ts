import assert from "node:assert/strict";
import { cleanNewsText, createTranslationMemo, preferredArticleUrl } from "./contentQuality.js";

assert.equal(cleanNewsText("Gold slips as dollar rises  MSN", "MSN"), "Gold slips as dollar rises");
assert.equal(cleanNewsText("Gold loses gains - Startup Fortune", "Startup Fortune"), "Gold loses gains");
assert.equal(cleanNewsText("Spot gold steadies", "Reuters"), "Spot gold steadies");

const cache = createTranslationMemo<{ title: string; summary: string }>();
cache.set("it", "Gold", "Summary", { title: "Oro", summary: "Sintesi" });
assert.deepEqual(cache.get("it", "Gold", "Summary"), { title: "Oro", summary: "Sintesi" });
assert.equal(cache.get("en", "Gold", "Summary"), null);

assert.equal(
  preferredArticleUrl({
    url: "https://news.google.com/rss/articles/example",
    resolvedUrl: "https://www.reuters.com",
  }),
  "https://www.reuters.com",
);
assert.equal(preferredArticleUrl({ url: "https://example.com/news" }), "https://example.com/news");

console.log("news content quality checks passed");
