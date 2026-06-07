import assert from "node:assert/strict";
import { classifyNewsArticle, enrichAndFilterNews } from "./intelligence.js";
import type { NewsArticle } from "./types.js";

function article(title: string, summary: string): NewsArticle {
  return {
    title,
    summary,
    source: "TestWire",
    publishedAt: "2026-06-07T00:00:00.000Z",
    url: `https://example.com/${encodeURIComponent(title.toLowerCase())}`,
    sentiment: null,
    imageUrl: null,
  };
}

const cpi = classifyNewsArticle(
  article("US CPI beats expectations as Treasury yields jump", "Markets price fewer Fed cuts and a stronger dollar."),
  { pairs: "XAUUSD", lang: "it" },
);
assert.equal(cpi.relevant, true);
assert.ok(cpi.article.primaryAssets?.includes("XAU"));
assert.ok(cpi.article.primaryAssets?.includes("USD"));
assert.deepEqual(cpi.article.affectedPairs, ["XAU/USD"]);
assert.equal(cpi.article.impactDirection, "bearish");
assert.ok((cpi.article.matchConfidence ?? 0) >= 0.7);
assert.match(cpi.article.relevanceReason ?? "", /oro|XAU|dollaro|rendimenti/i);

const geo = classifyNewsArticle(
  article("Middle East tensions lift safe-haven demand", "Investors seek protection as geopolitical risk rises."),
  { pairs: "XAUUSD", lang: "it" },
);
assert.equal(geo.relevant, true);
assert.equal(geo.article.impactDirection, "bullish");
assert.ok((geo.article.impactScore ?? 0) >= 8);

const miner = classifyNewsArticle(
  article("Gold miners rise after ETF inflows accelerate", "Bullion funds attract new capital."),
  { pairs: "XAUUSD", lang: "it" },
);
assert.equal(miner.relevant, true);
assert.ok((miner.article.matchConfidence ?? 0) >= 0.85);
assert.equal(miner.article.impactDirection, "bullish");

const bitcoin = classifyNewsArticle(
  article("Bitcoin rallies as ETF demand grows", "Crypto traders increase risk exposure."),
  { pairs: "XAUUSD", lang: "it" },
);
assert.equal(bitcoin.relevant, false);
assert.ok((bitcoin.article.matchConfidence ?? 1) < 0.4);

const companyTranscript = classifyNewsArticle(
  article("Gold.com Inc. earnings call transcript Q3 2026", "Shares rise after management discusses revenue guidance."),
  { pairs: "XAUUSD", lang: "it" },
);
assert.equal(companyTranscript.relevant, false);
assert.ok((companyTranscript.article.matchConfidence ?? 1) < 0.45);

const filtered = enrichAndFilterNews(
  [
    article("Bitcoin rallies as ETF demand grows", "Crypto traders increase risk exposure."),
    article("Gold.com Inc. earnings call transcript Q3 2026", "Shares rise after management discusses revenue guidance."),
    article("Fed officials warn inflation remains sticky", "The dollar climbs while gold traders watch real yields."),
    article("Gold spot price holds near record highs", "Bullion demand remains resilient."),
  ],
  { pairs: "XAUUSD", lang: "it" },
);
assert.equal(filtered.length, 2);
assert.equal(filtered.some((item) => item.title.includes("Bitcoin")), false);
assert.equal(filtered.some((item) => item.title.includes("Gold.com Inc.")), false);
assert.equal(filtered[0]?.affectedPairs?.includes("XAU/USD"), true);

console.log("news intelligence checks passed");
