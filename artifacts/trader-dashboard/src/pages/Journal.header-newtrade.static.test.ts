import fs from "node:fs";
import assert from "node:assert/strict";

// "Nuovo Trade" lives in the page header (mockup TopBar). Clicking it deep-links
// to /journal?t=trades&new=1, and TradesTab opens the modal from a URL-driven
// (useSearch-keyed) effect so it works from any tab — not a mount-only read of
// window.location.
const src = fs.readFileSync("src/pages/Journal.tsx", "utf8");

// The header exposes the "Nuovo Trade" action that deep-links into the Trades tab.
assert.match(src, /action=\{/, "PageHeader must receive an action slot");
assert.match(src, /navigate\(\s*["'`]\/journal\?t=trades&new=1["'`]/,
  'the header action must navigate to /journal?t=trades&new=1');

// The modal open is URL-driven, not a mount-only window.location read.
assert.doesNotMatch(src, /window\.location/,
  "TradesTab must not read window.location for the new=1 deep-link (use useSearch)");

// useSearch is now consumed in two places: the tab router AND TradesTab's opener.
const useSearchCount = (src.match(/useSearch\(\)/g) ?? []).length;
assert.ok(useSearchCount >= 2, `useSearch() must be used by TradesTab too (found ${useSearchCount})`);

// Driver compatibility: trade cards keep the `group` class.
assert.match(src, /flex flex-col group/, "trade cards must keep the group class");

console.log("journal header-newtrade static checks passed");
