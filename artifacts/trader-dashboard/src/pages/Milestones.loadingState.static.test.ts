import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./Milestones.tsx", import.meta.url), "utf8");

// Usability audit (2C): certificates/adminStatus default to [] / undefined while
// their query is still in flight, so "no certificates" briefly flashed for every
// user before the real data arrived. The empty state must also wait on isLoading.
assert.match(page, /isLoading:\s*certificatesLoading/);
assert.match(page, /isLoading:\s*adminStatusLoading/);
assert.match(
  page,
  /certificates\.length === 0 && !isAdmin && !certificatesLoading && !adminStatusLoading/,
);

console.log("milestones loading-state checks passed");
