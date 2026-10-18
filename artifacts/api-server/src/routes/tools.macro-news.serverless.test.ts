import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./tools.ts", import.meta.url), "utf8");

assert.match(source, /const NEWS_HUB_MACRO_TIMEOUT_MS = process\.env\.VERCEL \? 25_000 : 45_000/);
assert.match(source, /withTimeout\(\s*getNewsData\(\{ noCache: forceRefresh === true, pairs, lang \}\),\s*NEWS_HUB_MACRO_TIMEOUT_MS/s);
assert.match(source, /fetchMacroNews\(label, currenciesInput, lang, \{ forceRefresh, pairs: pairsInput \}\)/);
const compatibility = source.slice(source.indexOf("export async function fetchMacroNews("), source.indexOf("const VALID_LANGS"));
assert.doesNotMatch(compatibility, /fetchMacroRSSFallback|fetchMacroNewsGroq/);
assert.doesNotMatch(compatibility, /if \(pairs\)/);

console.log("macro-news serverless timeout fallback checks passed");
