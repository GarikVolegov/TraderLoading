import assert from "node:assert/strict";
import { articleKey, extractProfileKeywords, personalizeArticles } from "./personalization.js";
import type { NewsArticle } from "./types.js";

function a(title: string, summary = "", source = "Wire"): NewsArticle {
  return { title, summary, source, publishedAt: null, url: `https://x/${encodeURIComponent(title)}`, sentiment: null, imageUrl: null } as NewsArticle;
}

const base = [
  a("Fed holds rates steady", "policy unchanged", "Reuters"),
  a("Gold drifts sideways", "quiet session", "CNBC"),
  a("Bitcoin ETF inflows accelerate", "crypto demand", "CoinDesk"),
];

// No prefs/feedback → order unchanged.
assert.deepEqual(
  personalizeArticles(base, { keywords: [], profile: "" }, []).map((x) => x.title),
  base.map((x) => x.title),
);

// Keyword floats the matching article to the top.
assert.equal(
  personalizeArticles(base, { keywords: ["bitcoin"], profile: "" }, [])[0]?.title,
  "Bitcoin ETF inflows accelerate",
);

// Profile keywords behave like keywords.
assert.equal(
  personalizeArticles(base, { keywords: [], profile: "Scalper sul gold, solo intraday" }, [])[0]?.title,
  "Gold drifts sideways",
);

// 👎 on an article sinks it; 👍 on a source lifts that source.
const fb = personalizeArticles(base, { keywords: [], profile: "" }, [
  { articleKey: articleKey(base[0]!), source: "Reuters", vote: -1 },
  { articleKey: "other", source: "CoinDesk", vote: 1 },
]);
assert.notEqual(fb[0]?.title, "Fed holds rates steady");
assert.equal(fb[0]?.title, "Bitcoin ETF inflows accelerate");

// Short macro terms are kept (3+ letters).
assert.deepEqual(extractProfileKeywords("scalper oro intraday").sort(), ["intraday", "oro", "scalper"]);

console.log("news personalization checks passed");
