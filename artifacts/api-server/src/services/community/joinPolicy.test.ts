import assert from "node:assert/strict";
import { decideJoin, canRequestJoin, canSeeFullCommunity } from "./joinPolicy.js";

// decideJoin — precedence: blocked > already-member > public-join > private-request
assert.equal(decideJoin({ isPublic: true, isMember: false, isBanned: true }), "blocked");
assert.equal(decideJoin({ isPublic: false, isMember: true, isBanned: false }), "already-member");
assert.equal(decideJoin({ isPublic: true, isMember: false, isBanned: false }), "join");
assert.equal(decideJoin({ isPublic: false, isMember: false, isBanned: false }), "request");
// banned outranks membership (a banned pre-existing member is still blocked)
assert.equal(decideJoin({ isPublic: false, isMember: true, isBanned: true }), "blocked");

// canRequestJoin — may (re)enter pending only when absent or previously rejected
assert.equal(canRequestJoin(null), true);
assert.equal(canRequestJoin({ status: "rejected" }), true);
assert.equal(canRequestJoin({ status: "pending" }), false);
assert.equal(canRequestJoin({ status: "approved" }), false);

// canSeeFullCommunity — public OR member OR owner
assert.equal(canSeeFullCommunity({ isPublic: true, isMember: false, isOwner: false }), true);
assert.equal(canSeeFullCommunity({ isPublic: false, isMember: true, isOwner: false }), true);
assert.equal(canSeeFullCommunity({ isPublic: false, isMember: false, isOwner: true }), true);
assert.equal(canSeeFullCommunity({ isPublic: false, isMember: false, isOwner: false }), false);

console.log("join policy checks passed");
