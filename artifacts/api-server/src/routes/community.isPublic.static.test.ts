import assert from "node:assert/strict";
import fs from "node:fs";

// Feature-vuota finding: `isPublic` (drives the private-community + owner-
// approved-join flow — community_join_requests, JoinRequestsPanel) was only
// ever READ (GET /community, GET /community/:id), never WRITTEN — POST
// /community and PATCH /community/:id both ignored it, defaulting every
// community to public forever with no way to ever create or convert one to
// private. Both write paths must now accept it.
const createRoute = fs.readFileSync("src/routes/community.ts", "utf8");
const updateRoute = fs.readFileSync("src/routes/communitySettings.ts", "utf8");

const postHandler = createRoute.slice(
  createRoute.indexOf('router.post("/community"'),
  createRoute.indexOf('router.post("/community"') + 1200,
);
assert.match(postHandler, /isPublic/, "POST /community must read isPublic from the request body");

const patchHandler = updateRoute.slice(
  updateRoute.indexOf('router.patch("/community/:id"'),
  updateRoute.indexOf('router.patch("/community/:id"') + 1200,
);
assert.match(
  patchHandler,
  /typeof isPublic === "boolean"/,
  "PATCH /community/:id must accept isPublic so an existing community can be converted to private",
);

console.log("community isPublic write-path checks passed");
