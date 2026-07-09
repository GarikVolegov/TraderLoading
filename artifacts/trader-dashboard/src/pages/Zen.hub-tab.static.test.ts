import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("src/pages/Zen.tsx", "utf8");

// The Radix Tabs must become URL-controlled (?t=…) instead of uncontrolled
// defaultValue, so the bottom-nav/sidebar hub items can deep-link a tab.
assert.match(src, /import\s*\{\s*parseZenTab,\s*type ZenTab\s*\}\s*from\s*"@\/lib\/zenTabs"/,
  "Zen must import the shared URL-tab parser");
assert.match(src, /from\s*"wouter"/, "Zen must read location/search via wouter");
assert.match(src, /parseZenTab\(useSearch\(\)\)/,
  "active tab must be initialized by parsing the ?t= search param");
assert.match(src, /navigate\(\s*`\/zen\?t=\$\{[^}]+\}`\s*\)/,
  "switching tabs must push a /zen?t=<tab> URL");
assert.match(src, /<Tabs\s+value=\{[^}]+\}\s+onValueChange=\{[^}]+\}/,
  "Tabs must be controlled (value/onValueChange), not uncontrolled defaultValue");
assert.doesNotMatch(src, /<Tabs defaultValue="breathing"/,
  "the uncontrolled defaultValue is replaced by URL-controlled state");

console.log("Zen hub-tab static checks passed");
