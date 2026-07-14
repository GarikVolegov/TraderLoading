import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const store = readFileSync(new URL("./store.ts", import.meta.url), "utf8");

// Demo deals (source='demo') AND hand-entered manual journal trades (source='manual')
// have arbitrary balances/profit, so they must not make a user eligible nor count
// toward the leaderboard. Both the eligibility account resolver and the standings
// trade query must exclude both — otherwise the leaderboard is manipulable.
const realOnlyFilters = store.match(/source\}?\s+NOT IN \('demo',\s*'manual'\)/g) ?? [];
assert.ok(
  realOnlyFilters.length >= 2,
  `expected source NOT IN ('demo','manual') in resolveSyncedAccount and the standings query, found ${realOnlyFilters.length}`,
);

console.log("tornei store demo/manual-exclusion static checks passed");
