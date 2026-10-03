import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settle = readFileSync(new URL("./settle.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../../routes/tornei.ts", import.meta.url), "utf8");

// Each award's prize marker + XP + Pro + certificate must be atomic, so a crash
// mid-award rolls back the marker and a re-run re-applies the effects.
assert.match(settle, /db\.transaction\(async \(tx\) =>/);

// Certificates are created "claimable" and never "pending" from settle (settle
// no longer mints), so no certificate can get stuck pending-but-never-minted.
assert.match(settle, /mintStatus: "claimable"/);
assert.doesNotMatch(settle, /mintStatus: willMint/);
assert.doesNotMatch(settle, /getMintProvider/);

// The claim route must compare-and-set claimable/failed -> pending so two
// concurrent claims can't both mint on-chain, and the loser gets 409.
assert.match(
  route,
  /inArray\(tournamentCertificatesTable\.mintStatus, \["claimable", "failed"\]\)/,
);
assert.match(route, /mint_in_progress/);

console.log("tornei settle/claim static checks passed");
