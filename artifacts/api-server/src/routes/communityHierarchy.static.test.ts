import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const roles = readFileSync(new URL("./communityRoles.ts", import.meta.url), "utf8");
const moderation = readFileSync(new URL("./communityModeration.ts", import.meta.url), "utf8");

// Role hierarchy must gate every privileged action, otherwise a member with
// roles.manage can escalate to owner (edit/assign the Admin role, or moderate
// peers). These assertions lock the checks in place.

// Editing / deleting a role requires strictly outranking that role.
const outranksRolePosition = /outranks\(memberRank\(ctx\), role\.position\)/g;
assert.ok(
  (roles.match(outranksRolePosition) ?? []).length >= 2,
  "PATCH and DELETE role must check outranks(memberRank(ctx), role.position)",
);

// Creating / editing a role can't grant permissions the actor lacks.
assert.ok(
  (roles.match(/canGrantPermissions\(ctx,/g) ?? []).length >= 2,
  "POST and PATCH role must check canGrantPermissions",
);

// Assigning a role checks both the target member's current rank and the new
// role's position against the actor.
assert.match(roles, /outranks\(actorRank, currentTargetRank\)/);
assert.match(roles, /outranks\(actorRank, role\.position\)/);

// Kick / ban / mute can't target a peer or senior.
assert.match(roles, /outranks\(memberRank\(ctx\), await getMemberRank\(communityId, targetUserId\)\)/);
assert.ok(
  (moderation.match(/outranks\(memberRank\(ctx\), await getMemberRank\(communityId, targetUserId\)\)/g) ?? []).length >= 2,
  "ban and mute must check outranks against the target's rank",
);

console.log("community hierarchy static checks passed");
