import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("src/pages/Journal.tsx", "utf8");

// The in-page tab is derived from the URL (?t=…), not local-only state, so the
// bottom-nav/sidebar hub items can deep-link into a specific Journal tab.
assert.match(src, /import\s*\{\s*parseJournalTab,\s*type JournalTab\s*\}\s*from\s*"@\/lib\/journalTabs"/,
  "Journal must import the shared URL-tab parser");
assert.match(src, /from\s*"wouter"/, "Journal must read location/search via wouter");
assert.match(src, /parseJournalTab\(useSearch\(\)\)/,
  "active tab must be initialized by parsing the ?t= search param");
assert.match(src, /navigate\(\s*`\/journal\?t=\$\{[^}]+\}`\s*\)/,
  "switching tabs must push a /journal?t=<tab> URL, mirroring Chat.tsx");

// The local `type Tab` duplicate is retired in favor of the shared JournalTab.
assert.doesNotMatch(src, /type Tab = "panoramica"/,
  "the local Tab union is replaced by the shared JournalTab type");

console.log("Journal hub-tab static checks passed");
