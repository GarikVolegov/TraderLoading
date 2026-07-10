import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("src/pages/Zen.tsx", "utf8");

// The active tab is still derived from the URL (?t=…) so the bottom-nav/
// sidebar hub items can deep-link a tab — but Zen no longer renders its own
// in-page tab selector, since the contextual nav now owns that job.
assert.match(src, /import\s*\{\s*parseZenTab\s*\}\s*from\s*"@\/lib\/zenTabs"/,
  "Zen must import the shared URL-tab parser");
assert.match(src, /from\s*"wouter"/, "Zen must read the search string via wouter");
assert.match(src, /parseZenTab\(useSearch\(\)\)/,
  "active tab must be read by parsing the ?t= search param");

// No more in-page selector UI: the Radix Tabs primitive (which rendered the
// TabsList tab strip) is gone; content renders via plain conditionals keyed
// off `tab`, one component per branch.
assert.doesNotMatch(src, /from\s*"@\/components\/ui\/tabs"/,
  "the in-page Tabs/TabsList primitive must be removed — nav owns tab switching now");
assert.doesNotMatch(src, /onValueChange/, "no in-page tab-switch handler should remain");
for (const tab of ["breathing", "visualization", "quotes", "gratitude", "meditation", "insight"]) {
  assert.match(src, new RegExp(`tab === "${tab}"`), `content still switches on tab === "${tab}"`);
}

console.log("Zen hub-tab static checks passed");
