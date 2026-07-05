import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Orphan-row guard (finding 2.9): deleting a community had no FK cascades, so it
// left orphaned messages/files/reviews/reports/voice rows behind. deleteCommunityDeep
// must purge EVERY table in the community schema. This reads the schema at run time
// so a newly-added community table that nobody wired into the cascade fails the
// build instead of silently leaking orphans.

const schemaSrc = readFileSync(
  new URL("../../../../lib/db/src/schema/community.ts", import.meta.url),
  "utf8",
);
const deletionSrc = readFileSync(new URL("./communityDeletion.ts", import.meta.url), "utf8");

const communityTables = [...schemaSrc.matchAll(/pgTable\(\s*["']([a-z_]+)["']/g)].map((m) => m[1]);

// Sanity: the extractor must find the full set, not silently zero out.
assert.ok(communityTables.length >= 11, `expected >=11 community tables, got ${communityTables.length}`);
assert.ok(communityTables.includes("communities"));

const missing = communityTables.filter((t) => !new RegExp(`DELETE FROM ${t}\\b`).test(deletionSrc));
assert.deepEqual(
  missing,
  [],
  `Community tables not purged by deleteCommunityDeep: ${missing.join(", ")}`,
);

console.log("community deletion coverage checks passed");
