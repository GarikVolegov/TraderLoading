import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./MacroNewsTicker.tsx", import.meta.url), "utf8");

// Currencies come from favorites via the shared resolver
assert.match(source, /resolveMacroCurrencies/);
assert.match(source, /from "@\/lib\/favoritePairFilters"/);
assert.match(source, /useBackground\(\)/);

// Manual currency filter fully removed
assert.doesNotMatch(source, /macro-news-currencies/);
assert.doesNotMatch(source, /loadCurrencies/);
assert.doesNotMatch(source, /saveCurrencies/);
assert.doesNotMatch(source, /toggleCurrency/);
assert.doesNotMatch(source, /selectAll/);
assert.doesNotMatch(source, /Filtra per valuta/);

// Query still keyed by the derived currencies
assert.match(source, /queryKey: \["macro-news", MACRO_NEWS_QUERY_VERSION, currenciesKey\]/);

// Risk-on/off block: responsive (stacks on mobile) and not truncated
assert.match(source, /data\.sentiment/);
assert.match(source, /sm:flex-row/);
assert.doesNotMatch(source, /line-clamp-2/);

console.log("macro news favorites checks passed");
