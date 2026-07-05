import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const store = readFileSync(new URL("./store.ts", import.meta.url), "utf8");

// Demo deals (source='demo') have arbitrary balances/profit, so they must not
// make a user eligible nor count toward the leaderboard. Both the eligibility
// account resolver and the standings trade query must exclude them.
const demoFilters = store.match(/source\}?\s*<>\s*'demo'/g) ?? [];
assert.ok(
  demoFilters.length >= 2,
  `expected source<>'demo' in resolveSyncedAccount and the standings query, found ${demoFilters.length}`,
);

console.log("tornei store demo-exclusion static checks passed");
