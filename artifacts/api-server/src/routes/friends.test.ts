import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const { isFriendActiveToday, getFriendRelationshipStatus } = await import("./friends.js");

assert.equal(isFriendActiveToday("2026-06-07", "2026-06-07"), true);
assert.equal(isFriendActiveToday("2026-06-06", "2026-06-07"), false);
assert.equal(isFriendActiveToday(null, "2026-06-07"), false);
assert.equal(isFriendActiveToday(undefined, "2026-06-07"), false);

assert.equal(getFriendRelationshipStatus("me", "ari", null), "none");
assert.equal(
  getFriendRelationshipStatus("me", "ari", { userId: "me", friendId: "ari", status: "pending" }),
  "pending_sent",
);
assert.equal(
  getFriendRelationshipStatus("me", "ari", { userId: "ari", friendId: "me", status: "pending" }),
  "pending_received",
);
assert.equal(
  getFriendRelationshipStatus("me", "ari", { userId: "ari", friendId: "me", status: "accepted" }),
  "accepted",
);

console.log("friends route helper checks passed");
