import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(new URL("./News.tsx", import.meta.url), "utf8");

// Claude Design mockup (ui_kits/dashboard/views-trading.jsx NewsView) filter row:
// impact segmented control, sentiment segmented control, currency chips.
assert.match(pageSource, /impactFilter/);
assert.match(pageSource, /sentimentFilter/);
assert.match(pageSource, /currencyFilters/);
assert.match(pageSource, /impactBand/);

// The filters must actually be WIRED, not just declared: the controls render
// in JSX and the article list maps the filtered array (a bare `articles.map`
// would mean the filter row is dead code).
assert.match(
  pageSource,
  /<SegmentedControl options=\{IMPACT_FILTER_OPTIONS\} value=\{impactFilter\}/,
);
assert.match(
  pageSource,
  /<SegmentedControl options=\{SENTIMENT_FILTER_OPTIONS\} value=\{sentimentFilter\}/,
);
assert.match(pageSource, /filteredArticles\.map\(/);
assert.doesNotMatch(pageSource, /[^A-Za-z]articles\.map\(/);

console.log("news filters static checks passed");
