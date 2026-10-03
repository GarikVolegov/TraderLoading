import assert from "node:assert/strict";

// The module imports @workspace/db, which builds a (lazy, never-connected) pg pool
// at load and requires DATABASE_URL. Provide a dummy and dynamic-import so this pure
// unit test needs no real database.
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
const { buildModerationLogEntry, recordModerationAction, MODERATION_ACTIONS } = await import(
  "./communityModerationLog.js"
);

// Finding 2.9: ban/kick/mute/role-change/message-delete had no audit trail. The
// log row builder is the pure core; the columns must be shaped correctly.

// Defaults: missing target/metadata become null.
const minimal = buildModerationLogEntry({ communityId: 1, actorUserId: "mod-1", action: "member.ban" });
assert.equal(minimal.communityId, 1);
assert.equal(minimal.actorUserId, "mod-1");
assert.equal(minimal.action, "member.ban");
assert.equal(minimal.targetUserId, null);
assert.equal(minimal.targetId, null);
assert.equal(minimal.metadata, null);

// Full entry: target + metadata serialized to JSON.
const full = buildModerationLogEntry({
  communityId: 2,
  actorUserId: "mod-2",
  action: "member.mute",
  targetUserId: "victim",
  targetId: 99,
  metadata: { reason: "spam", until: null },
});
assert.equal(full.targetUserId, "victim");
assert.equal(full.targetId, 99);
assert.deepEqual(JSON.parse(full.metadata as string), { reason: "spam", until: null });

// Empty metadata object → null (nothing worth storing).
assert.equal(
  buildModerationLogEntry({ communityId: 1, actorUserId: "m", action: "role.create", metadata: {} }).metadata,
  null,
);

// Oversized metadata is capped (and stays valid JSON) so a crafted field can't bloat the row.
const capped = buildModerationLogEntry({
  communityId: 1,
  actorUserId: "m",
  action: "member.ban",
  metadata: { reason: "x".repeat(5000) },
});
assert.ok((capped.metadata as string).length <= 2000);
assert.doesNotThrow(() => JSON.parse(capped.metadata as string));

// The action set covers every moderation surface we wire.
for (const a of [
  "member.ban", "member.unban", "member.mute", "member.unmute", "member.kick",
  "member.role_change", "message.delete", "file.delete", "channel.delete",
  "review.hide", "review.unhide", "role.create", "role.update", "role.delete",
]) {
  assert.ok((MODERATION_ACTIONS as readonly string[]).includes(a), `missing action ${a}`);
}

// recordModerationAction inserts the built row and must NEVER throw (audit logging
// can't break the moderation action it records) — even if the DB insert fails.
{
  const inserts: unknown[] = [];
  const fakeDb = { insert: () => ({ values: async (row: unknown) => { inserts.push(row); } }) };
  await recordModerationAction(
    { communityId: 3, actorUserId: "a", action: "member.kick", targetUserId: "t" },
    fakeDb as never,
  );
  assert.equal(inserts.length, 1);
  assert.equal((inserts[0] as { action: string }).action, "member.kick");
}
{
  const throwingDb = { insert: () => ({ values: async () => { throw new Error("db down"); } }) };
  await assert.doesNotReject(() =>
    recordModerationAction({ communityId: 3, actorUserId: "a", action: "member.ban" }, throwingDb as never),
  );
}

console.log("community moderation log checks passed");
