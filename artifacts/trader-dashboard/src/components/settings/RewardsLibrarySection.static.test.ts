import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./RewardsLibrarySection.tsx", import.meta.url), "utf8");

// Usability audit (2C): `level` defaulted to 0 while the profile query was still
// in flight, so every user briefly saw the "unlocks at level 5" empty state and
// every milestone rendered as locked before the real level arrived.
assert.match(src, /isLoading:\s*profileLoading/);
assert.match(src, /if \(profileLoading\)/);

console.log("rewards library loading-state checks passed");
