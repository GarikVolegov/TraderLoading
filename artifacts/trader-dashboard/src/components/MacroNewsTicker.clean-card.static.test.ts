import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tickerSource = readFileSync(new URL("./MacroNewsTicker.tsx", import.meta.url), "utf8");

assert.match(tickerSource, /primaryAssets\?: string\[\]/);
assert.match(tickerSource, /affectedPairs\?: string\[\]/);
assert.match(tickerSource, /function macroArticleAssetLabels/);
assert.match(tickerSource, /function macroArticleDataTypeLabel/);
assert.match(tickerSource, /MACRO_NEWS_QUERY_VERSION/);
assert.match(tickerSource, /queryKey: \["macro-news", MACRO_NEWS_QUERY_VERSION, currenciesKey\]/);
assert.match(tickerSource, /Impatto/);
assert.match(tickerSource, /Tipo dato/);
assert.match(tickerSource, /Asset/);
assert.match(tickerSource, /Approfondisci/);

const cardListStart = tickerSource.indexOf("{data?.articles && data.articles.length > 0 && (");
const dialogStart = tickerSource.indexOf("<MacroNewsDetailDialog");
assert.notEqual(cardListStart, -1);
assert.notEqual(dialogStart, -1);
const cardListSource = tickerSource.slice(cardListStart, dialogStart);

assert.doesNotMatch(cardListSource, /Fonti verificate/);
assert.doesNotMatch(cardListSource, /article\.citationUrls\.map/);
assert.doesNotMatch(cardListSource, /article\.sources!\.map/);
assert.doesNotMatch(cardListSource, /<p className="text-xs text-muted-foreground leading-relaxed">\s*\{article\.summary\}/);

console.log("macro news clean card static checks passed");
