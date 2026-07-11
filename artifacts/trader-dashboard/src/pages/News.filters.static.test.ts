import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(new URL("./News.tsx", import.meta.url), "utf8");

// Claude Design mockup (ui_kits/dashboard/views-trading.jsx NewsView) filter row:
// impact segmented control, sentiment segmented control, currency chips.
assert.match(pageSource, /impactFilter/);
assert.match(pageSource, /sentimentFilter/);
assert.match(pageSource, /currencyFilters/);
assert.match(pageSource, /impactBand/);
assert.match(pageSource, /filteredArticles/);

console.log("news filters static checks passed");
