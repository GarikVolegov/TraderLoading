import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const { isFriendActiveToday, getFriendRelationshipStatus, parseFriendshipId } = await import("./friends.js");

assert.equal(isFriendActiveToday("2026-06-07", "2026-06-07"), true);
assert.equal(isFriendActiveToday("2026-06-06", "2026-06-07"), false);
assert.equal(isFriendActiveToday(null, "2026-06-07"), false);
assert.equal(isFriendActiveToday(undefined, "2026-06-07"), false);
// Exercise the production default (no referenceDate override) at the boundary
// where UTC is yesterday but profile/check-in activity is already today in Rome.
const RealDate = globalThis.Date;
for (const [instant, today, yesterday] of [
  ["2026-07-08T22:30:00Z", "2026-07-09", "2026-07-08"],
  ["2026-01-15T23:30:00Z", "2026-01-16", "2026-01-15"],
]) {
  globalThis.Date = class extends RealDate { constructor() { super(instant); } } as DateConstructor;
  try {
    assert.equal(isFriendActiveToday(today), true);
    assert.equal(isFriendActiveToday(yesterday), false);
  } finally {
    globalThis.Date = RealDate;
  }
}

for (const invalid of ["", "0", "-1", "1.5", "abc", "1suffix", "2147483648", "999999999999999999999"]) {
  assert.equal(parseFriendshipId(invalid), null);
}
assert.equal(parseFriendshipId("1"), 1);
assert.equal(parseFriendshipId("0001"), 1);
assert.equal(parseFriendshipId("2147483647"), 2147483647);

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
