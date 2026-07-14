import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./types.ts", import.meta.url), "utf8");

// Adversarial-review finding (2026-07-14): the server's cover-only payload for
// a private community viewed by a non-member omits creatorId/createdAt too,
// same as the 5 fields already made optional after the CommunityTab.tsx
// crash fix — a type promising these are always `string` would let a future
// "member since"/"created by you" feature pass tsc while reading undefined
// at runtime for the exact same private/non-member case.
assert.match(src, /extends Omit<CommunityType, "creatorId" \| "createdAt">/);
assert.match(src, /creatorId\?:\s*string;/);
assert.match(src, /createdAt\?:\s*string;/);

console.log("CommunityDetail types checks passed");
