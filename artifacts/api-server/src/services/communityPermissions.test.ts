import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const {
  hasPermission,
  isMuteActive,
  sanitizePermissions,
  COMMUNITY_PERMISSIONS,
  memberRank,
  outranks,
  canGrantPermissions,
  OWNER_RANK,
  NO_ROLE_RANK,
} = await import("./communityPermissions.js");

// ─── hasPermission ───────────────────────────────────────────────────────────
// Owner always passes, regardless of role permissions.
assert.equal(hasPermission({ isOwner: true, permissions: [] }, "roles.manage"), true);
assert.equal(hasPermission({ isOwner: true, permissions: [] }, "members.ban"), true);
// Non-owner passes only when the permission is in their role's set.
assert.equal(hasPermission({ isOwner: false, permissions: ["channels.manage"] }, "channels.manage"), true);
assert.equal(hasPermission({ isOwner: false, permissions: ["channels.manage"] }, "members.ban"), false);
assert.equal(hasPermission({ isOwner: false, permissions: [] }, "channels.manage"), false);

// ─── isMuteActive ────────────────────────────────────────────────────────────
const now = new Date("2026-06-28T12:00:00.000Z");
// No mute row → not muted.
assert.equal(isMuteActive(null, now), false);
// Indefinite mute (until === null) → muted.
assert.equal(isMuteActive({ until: null }, now), true);
// Future expiry → still muted.
assert.equal(isMuteActive({ until: new Date("2026-06-28T13:00:00.000Z") }, now), true);
// Past expiry → mute lapsed.
assert.equal(isMuteActive({ until: new Date("2026-06-28T11:00:00.000Z") }, now), false);

// ─── sanitizePermissions ─────────────────────────────────────────────────────
// Keeps known keys, drops unknown ones, dedupes.
assert.deepEqual(
  sanitizePermissions(["channels.manage", "bogus", "channels.manage"]),
  ["channels.manage"],
);
// Non-array / non-string entries → empty.
assert.deepEqual(sanitizePermissions("not an array"), []);
assert.deepEqual(sanitizePermissions([1, 2, null]), []);
assert.deepEqual(sanitizePermissions(undefined), []);
// A valid full set round-trips to every catalog permission.
assert.deepEqual(sanitizePermissions([...COMMUNITY_PERMISSIONS]).sort(), [...COMMUNITY_PERMISSIONS].sort());

// ─── COMMUNITY_PERMISSIONS catalog ───────────────────────────────────────────
for (const key of [
  "community.manage",
  "channels.manage",
  "messages.moderate",
  "files.manage",
  "roles.manage",
  "members.kick",
  "members.ban",
  "members.mute",
  "reviews.respond",
  "reviews.moderate",
]) {
  assert.ok((COMMUNITY_PERMISSIONS as readonly string[]).includes(key), `catalog missing ${key}`);
}
assert.equal(COMMUNITY_PERMISSIONS.length, 10);

// ─── memberRank / outranks (role hierarchy, blocks privilege escalation) ─────
// Owner outranks everyone.
assert.equal(memberRank({ isOwner: true, rolePosition: null }), OWNER_RANK);
// A member's rank is their role position; no role = lowest possible.
assert.equal(memberRank({ isOwner: false, rolePosition: 5 }), 5);
assert.equal(memberRank({ isOwner: false, rolePosition: null }), NO_ROLE_RANK);
// outranks requires a STRICTLY higher rank: equals can't act on equals, so a
// roles.manage holder can't edit/assign a role at their own level (e.g. Admin)
// or moderate a peer.
assert.equal(outranks(5, 3), true);
assert.equal(outranks(3, 3), false);
assert.equal(outranks(3, 5), false);
assert.equal(outranks(OWNER_RANK, 999), true);
assert.equal(outranks(NO_ROLE_RANK, NO_ROLE_RANK), false);

// ─── canGrantPermissions (no granting perms you don't hold) ──────────────────
assert.equal(canGrantPermissions({ isOwner: true, permissions: [] }, ["members.ban"]), true);
assert.equal(canGrantPermissions({ isOwner: false, permissions: ["roles.manage"] }, ["roles.manage"]), true);
assert.equal(
  canGrantPermissions({ isOwner: false, permissions: ["roles.manage"] }, ["roles.manage", "members.ban"]),
  false,
);
assert.equal(canGrantPermissions({ isOwner: false, permissions: [] }, []), true);

console.log("communityPermissions checks passed");
