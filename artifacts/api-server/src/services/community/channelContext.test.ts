import assert from "node:assert/strict";
import { resolveChannelContext } from "./channelContext.js";

let membershipReads = 0;
const deps = {
  findChannel: async (id: number) => id === 34 ? { id, communityId: 12 } : null,
  memberContext: async (communityId: number, userId: string) => {
    membershipReads++;
    assert.equal(communityId, 12);
    return { isMember: userId === "member" || userId === "banned", isOwner: userId === "owner", isBanned: userId === "banned" };
  },
};
assert.equal(await resolveChannelContext("member", 99, deps), null);
assert.equal(membershipReads, 0, "missing channels disclose no membership context");
for (const user of ["member", "owner"]) {
  assert.deepEqual(await resolveChannelContext(user, 34, deps), { channelId: 34, communityId: 12 });
}
for (const user of ["outsider", "banned"]) {
  assert.equal(await resolveChannelContext(user, 34, deps), null, "another account or banned membership cannot resolve private context");
}
console.log("legacy checkout channel authorization checks passed");
