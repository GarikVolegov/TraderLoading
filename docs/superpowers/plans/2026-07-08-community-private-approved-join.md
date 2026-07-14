# Private Communities + Owner-Approved Join — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `isPublic=false` communities actually private — discoverable as a cover only, content gated to approved members, joined via a request the creator (or a `members.kick` holder) approves.

**Architecture:** New `community_join_requests` table (Approach 1 — separate from members). A pure `joinPolicy` helper drives the route decisions. `GET /community/:id` returns cover-only for private non-members; `POST /community/:id/join` creates a pending request for private communities; new approve/reject endpoints gated via the existing `requirePermission`. Channel reads funnel through one `canReadChannel` helper so the future per-channel paywall (sub-project C) is a localized add.

**Tech Stack:** Drizzle ORM + hand-authored Postgres migration; off-contract Express routes (`apiJSON`, not openapi); React 19 + Wouter + TanStack Query; tests are `node:assert` run via `tsx`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-08-community-private-approved-join-design.md`. This plan implements **sub-project A only**. B/C/D are out of scope.
- **Migrations are hand-authored** (idempotent `IF NOT EXISTS`); register in `lib/db/drizzle/meta/_journal.json`. Do NOT run `db:generate`. Current journal head is idx **26** (`0026_community_message_reports`) → new migration is **0027**.
- **Off-contract:** community routes use direct `apiJSON`/`res.json`, NOT openapi.yaml — no `pnpm codegen`.
- **After a schema change**, rebuild lib/db: `node_modules/.bin/tsc -b lib/db/tsconfig.json` (dist is gitignored but api-server imports the built types).
- **Multi-agent shared branch** `feat/community-management`: commit with **pathspec** (`git commit -m "…" -- <paths>`), never `git add -A`; use `${=VAR}` for word-splitting in zsh.
- **i18n:** new copy in all 5 dicts (`it/en/es/fr/de`), ASCII-safe (mojibake gate forbids `Ã/â/Â/ð`), via `t()`/`uiText()` (production-copy gate scans `components/pages/contexts/lib`, excludes `components/ui`).
- **GDPR:** any table with a `user_id` column must be handled in `services/accountDeletion.ts` or `accountDeletion.coverage.static.test.ts` fails the build.
- **Approver gate:** `requirePermission(req, res, communityId, "members.kick")` (returns a `MemberContext` or null after sending 403). No new permission is added.
- **Toolchain PATH:** prefix commands with `export PATH="$HOME/.local/node/bin:$PATH"`.

---

### Task 1: Schema + migration for `community_join_requests`

**Files:**
- Modify: `lib/db/src/schema/community.ts` (append the table + type export)
- Create: `lib/db/drizzle/0027_community_join_requests.sql`
- Modify: `lib/db/drizzle/meta/_journal.json` (append idx 27)

**Interfaces:**
- Produces: `communityJoinRequestsTable` with columns `id, communityId, userId, status, message, decidedByUserId, decidedAt, createdAt`; unique index `community_join_requests_pair_idx` on `(communityId, userId)`; index `community_join_requests_status_idx` on `(communityId, status)`. Type `CommunityJoinRequest = typeof communityJoinRequestsTable.$inferSelect`.

- [ ] **Step 1: Add the table to the schema.** In `lib/db/src/schema/community.ts`, after `communityMessageReportsTable` (near the end), append:

```ts
// Join requests for private (isPublic=false) communities. One row per user per
// community (unique pair); re-request updates it in place. Approved rows leave a
// community_members row behind; the request row is the audit trail (audit 0.5b).
export const communityJoinRequestsTable = pgTable("community_join_requests", {
  id: serial("id").primaryKey(),
  communityId: integer("community_id").notNull(),
  userId: text("user_id").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  message: text("message"),
  decidedByUserId: text("decided_by_user_id"),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("community_join_requests_pair_idx").on(t.communityId, t.userId),
  index("community_join_requests_status_idx").on(t.communityId, t.status),
]);

export type CommunityJoinRequest = typeof communityJoinRequestsTable.$inferSelect;
```

Verify `pgTable, serial, integer, text, timestamp, uniqueIndex, index` are already imported at the top of the file (they are — used by the existing tables).

- [ ] **Step 2: Write the migration.** Create `lib/db/drizzle/0027_community_join_requests.sql`:

```sql
-- Private-community join requests (audit 0.5b). One pending/approved/rejected row
-- per (community, user); re-request updates in place.
CREATE TABLE IF NOT EXISTS "community_join_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"community_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"message" text,
	"decided_by_user_id" text,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_join_requests_pair_idx" ON "community_join_requests" ("community_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_join_requests_status_idx" ON "community_join_requests" ("community_id","status");
```

- [ ] **Step 3: Register the journal entry.** In `lib/db/drizzle/meta/_journal.json`, append after the idx-26 object (mind the comma):

```json
    {
      "idx": 27,
      "version": "7",
      "when": 1783958400000,
      "tag": "0027_community_join_requests",
      "breakpoints": true
    }
```

- [ ] **Step 4: Rebuild lib/db + verify it compiles.**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; cd /Users/gazz/Desktop/TraderLoadingsLOCALE; node_modules/.bin/tsc -b lib/db/tsconfig.json`
Expected: no output, exit 0.

- [ ] **Step 5: Commit.**

```bash
git add lib/db/src/schema/community.ts lib/db/drizzle/0027_community_join_requests.sql lib/db/drizzle/meta/_journal.json
git commit -m "feat(db): community_join_requests table + migration 0027 (private-community joins)" -- lib/db/src/schema/community.ts lib/db/drizzle/0027_community_join_requests.sql lib/db/drizzle/meta/_journal.json
```

---

### Task 2: Pure `joinPolicy` helper (TDD)

**Files:**
- Create: `artifacts/api-server/src/services/community/joinPolicy.ts`
- Test: `artifacts/api-server/src/services/community/joinPolicy.test.ts`

**Interfaces:**
- Produces:
  - `decideJoin(input: { isPublic: boolean; isMember: boolean; isBanned: boolean }): "join" | "request" | "already-member" | "blocked"`
  - `canRequestJoin(existing: { status: string } | null): boolean`
  - `canSeeFullCommunity(input: { isPublic: boolean; isMember: boolean; isOwner: boolean }): boolean`

- [ ] **Step 1: Write the failing test.** Create `artifacts/api-server/src/services/community/joinPolicy.test.ts`:

```ts
import assert from "node:assert/strict";
import { decideJoin, canRequestJoin, canSeeFullCommunity } from "./joinPolicy.js";

// decideJoin — precedence: blocked > already-member > public-join > private-request
assert.equal(decideJoin({ isPublic: true, isMember: false, isBanned: true }), "blocked");
assert.equal(decideJoin({ isPublic: false, isMember: true, isBanned: false }), "already-member");
assert.equal(decideJoin({ isPublic: true, isMember: false, isBanned: false }), "join");
assert.equal(decideJoin({ isPublic: false, isMember: false, isBanned: false }), "request");
// banned outranks membership (a banned pre-existing member is still blocked from re-actions)
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
```

- [ ] **Step 2: Run it — verify it fails (module missing).**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; cd /Users/gazz/Desktop/TraderLoadingsLOCALE; artifacts/api-server/node_modules/.bin/tsx artifacts/api-server/src/services/community/joinPolicy.test.ts`
Expected: FAIL `ERR_MODULE_NOT_FOUND … joinPolicy.js`.

- [ ] **Step 3: Implement.** Create `artifacts/api-server/src/services/community/joinPolicy.ts`:

```ts
// Pure decisions for private-community join/visibility (audit 0.5b). No I/O — the
// routes resolve isPublic/isMember/isBanned from the DB and delegate here.
export type JoinOutcome = "join" | "request" | "already-member" | "blocked";

export function decideJoin(input: { isPublic: boolean; isMember: boolean; isBanned: boolean }): JoinOutcome {
  if (input.isBanned) return "blocked";
  if (input.isMember) return "already-member";
  return input.isPublic ? "join" : "request";
}

/** A user may (re)enter the pending state only if they have no request yet or the
 *  last one was rejected. Pending/approved are terminal for re-requesting. */
export function canRequestJoin(existing: { status: string } | null): boolean {
  return existing === null || existing.status === "rejected";
}

/** Whether a viewer sees the full community (channels/messages) vs. cover-only. */
export function canSeeFullCommunity(input: { isPublic: boolean; isMember: boolean; isOwner: boolean }): boolean {
  return input.isPublic || input.isMember || input.isOwner;
}
```

- [ ] **Step 4: Run it — verify it passes.**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; cd /Users/gazz/Desktop/TraderLoadingsLOCALE; artifacts/api-server/node_modules/.bin/tsx artifacts/api-server/src/services/community/joinPolicy.test.ts`
Expected: `join policy checks passed`.

- [ ] **Step 5: Commit.**

```bash
git add artifacts/api-server/src/services/community/joinPolicy.ts artifacts/api-server/src/services/community/joinPolicy.test.ts
git commit -m "feat(community): pure join/visibility policy helper (tested)" -- artifacts/api-server/src/services/community/joinPolicy.ts artifacts/api-server/src/services/community/joinPolicy.test.ts
```

---

### Task 3: Gate detail + widen discovery (visibility)

**Files:**
- Modify: `artifacts/api-server/src/routes/community.ts` (`GET /community` list ~70-97; `GET /community/:id` ~167-221)

**Interfaces:**
- Consumes: `canSeeFullCommunity` from Task 2.
- Produces: list returns private communities too, each with `locked: boolean`; detail returns cover-only for private non-members with `joinRequestStatus`.

- [ ] **Step 1: Import the policy helper.** At the top of `artifacts/api-server/src/routes/community.ts`, add to the imports:

```ts
import { canSeeFullCommunity } from "../services/community/joinPolicy.js";
import { communityJoinRequestsTable } from "@workspace/db";
```

(Add `communityJoinRequestsTable` to the existing `@workspace/db` import list rather than a second import if you prefer — both compile.)

- [ ] **Step 2: Widen discovery to private communities (cover + `locked`).** Replace the `.where(eq(communitiesTable.isPublic, true))` query body in `GET /community` (lines ~74-92) with:

```ts
    const communities = await db
      .select()
      .from(communitiesTable)
      .orderBy(desc(communitiesTable.memberCount), desc(communitiesTable.createdAt))
      .limit(50);

    const myMemberships = await db
      .select({ communityId: communityMembersTable.communityId })
      .from(communityMembersTable)
      .where(eq(communityMembersTable.userId, userId));

    const myIds = new Set(myMemberships.map((m) => m.communityId));

    res.json(communities.map((c) => ({
      ...c,
      isMember: myIds.has(c.id),
      // Private + non-member: the client shows a cover with "Request to join" and
      // hides content. (Channels/messages are never in this list payload anyway.)
      locked: !c.isPublic && !myIds.has(c.id),
      ratingAvg: c.ratingCount > 0 ? c.ratingSum / c.ratingCount : 0,
    })));
```

- [ ] **Step 3: Gate the detail payload for private non-members.** In `GET /community/:id`, after computing `isOwner` (line ~200) and `membership`, insert before the existing `res.json({...})`:

```ts
    if (!canSeeFullCommunity({ isPublic: community.isPublic, isMember: !!membership, isOwner })) {
      const [myReq] = await db
        .select({ status: communityJoinRequestsTable.status })
        .from(communityJoinRequestsTable)
        .where(and(
          eq(communityJoinRequestsTable.communityId, id),
          eq(communityJoinRequestsTable.userId, userId),
        ))
        .limit(1);
      // Cover only — never channels/roles/messages.
      res.json({
        id: community.id,
        name: community.name,
        description: community.description,
        avatarUrl: community.avatarUrl,
        bannerUrl: community.bannerUrl,
        rules: community.rules,
        accentColor: community.accentColor,
        memberCount: community.memberCount,
        isPublic: community.isPublic,
        isMember: false,
        isOwner: false,
        locked: true,
        joinRequestStatus: myReq?.status ?? "none",
        ratingAvg: community.ratingCount > 0 ? community.ratingSum / community.ratingCount : 0,
      });
      return;
    }
```

(If any of `bannerUrl`/`accentColor`/`rules` are not columns on `communitiesTable`, drop them — check `lib/db/src/schema/community.ts` for the exact column names and include only those that exist. The existing full-detail response spreads `...community`, so every column is already client-visible for members.)

- [ ] **Step 4: Typecheck.**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; cd /Users/gazz/Desktop/TraderLoadingsLOCALE; node_modules/.bin/tsc --noEmit -p artifacts/api-server/tsconfig.json`
Expected: exit 0.

- [ ] **Step 5: Commit.**

```bash
git add artifacts/api-server/src/routes/community.ts
git commit -m "feat(community): private communities discoverable as cover-only; detail gated for non-members (0.5b)" -- artifacts/api-server/src/routes/community.ts
```

---

### Task 4: Join → request for private communities

**Files:**
- Modify: `artifacts/api-server/src/routes/community.ts` (`POST /community/:id/join` ~224-261)

**Interfaces:**
- Consumes: `decideJoin`, `canRequestJoin` from Task 2; `communityJoinRequestsTable` from Task 1.
- Produces: for private communities, returns `{ status: "pending" }` and creates/updates a request row instead of a membership.

- [ ] **Step 1: Rewrite the join handler body.** Replace the body of `POST /community/:id/join` (inside the `try`, lines ~228-256) with:

```ts
    const id = parseInt(req.params.id);
    const [community] = await db
      .select({ isPublic: communitiesTable.isPublic })
      .from(communitiesTable)
      .where(eq(communitiesTable.id, id))
      .limit(1);
    if (!community) { res.status(404).json({ error: "Community non trovata" }); return; }

    const [existingMember] = await db
      .select({ id: communityMembersTable.id })
      .from(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, id), eq(communityMembersTable.userId, userId)))
      .limit(1);
    const [ban] = await db
      .select({ id: communityBansTable.id })
      .from(communityBansTable)
      .where(and(eq(communityBansTable.communityId, id), eq(communityBansTable.userId, userId)))
      .limit(1);

    const outcome = decideJoin({ isPublic: community.isPublic, isMember: !!existingMember, isBanned: !!ban });
    if (outcome === "blocked") { res.status(403).json({ error: "Sei stato bannato da questa community" }); return; }
    if (outcome === "already-member") { res.json({ ok: true, alreadyMember: true }); return; }

    if (outcome === "request") {
      const [existingReq] = await db
        .select({ status: communityJoinRequestsTable.status })
        .from(communityJoinRequestsTable)
        .where(and(
          eq(communityJoinRequestsTable.communityId, id),
          eq(communityJoinRequestsTable.userId, userId),
        ))
        .limit(1);
      if (!canRequestJoin(existingReq ?? null)) { res.json({ status: "pending" }); return; }
      const message = typeof req.body?.message === "string" ? req.body.message.slice(0, 500) : null;
      await db
        .insert(communityJoinRequestsTable)
        .values({ communityId: id, userId, status: "pending", message })
        .onConflictDoUpdate({
          target: [communityJoinRequestsTable.communityId, communityJoinRequestsTable.userId],
          set: { status: "pending", message, decidedByUserId: null, decidedAt: null, createdAt: new Date() },
        });
      res.json({ status: "pending" });
      return;
    }

    // outcome === "join" (public)
    const [defaultRole] = await db
      .select({ id: communityRolesTable.id })
      .from(communityRolesTable)
      .where(and(eq(communityRolesTable.communityId, id), eq(communityRolesTable.isDefault, true)))
      .limit(1);
    await db.insert(communityMembersTable).values({ communityId: id, userId, role: "member", roleId: defaultRole?.id ?? null });
    await db
      .update(communitiesTable)
      .set({ memberCount: sql`${communitiesTable.memberCount} + 1` })
      .where(eq(communitiesTable.id, id));
    res.json({ ok: true });
```

Add `decideJoin, canRequestJoin` to the Task-3 import line from `./joinPolicy.js`.

- [ ] **Step 2: Typecheck.**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; cd /Users/gazz/Desktop/TraderLoadingsLOCALE; node_modules/.bin/tsc --noEmit -p artifacts/api-server/tsconfig.json`
Expected: exit 0.

- [ ] **Step 3: Commit.**

```bash
git add artifacts/api-server/src/routes/community.ts
git commit -m "feat(community): private-community join creates an approval request, not a membership (0.5b)" -- artifacts/api-server/src/routes/community.ts
```

---

### Task 5: Approve / reject endpoints

**Files:**
- Modify: `artifacts/api-server/src/routes/communityModeration.ts` (append two routes)

**Interfaces:**
- Consumes: `requirePermission` (existing, from `communityPermissions.js`); `communityJoinRequestsTable`, `communityMembersTable`, `communityRolesTable`, `communitiesTable` from `@workspace/db`.
- Produces: `GET /community/:id/join-requests`, `POST /community/:id/join-requests/:requestId/resolve`.

- [ ] **Step 1: Ensure imports.** In `communityModeration.ts`, add to the `@workspace/db` import: `communityJoinRequestsTable, communityMembersTable, communityRolesTable, communitiesTable, profileTable`. Confirm `requirePermission` is imported from `../services/communityPermissions.js` (the ban route uses it) and `db, and, eq, sql, desc` from drizzle.

- [ ] **Step 2: Append the pending-queue route.** At the end of `communityModeration.ts`, before `export default router;`:

```ts
// ─── Private-community join requests (audit 0.5b) ────────────────────────────
router.get("/community/:id/join-requests", async (req, res) => {
  const communityId = parseInt(req.params.id);
  const ctx = await requirePermission(req, res, communityId, "members.kick");
  if (!ctx) return;
  try {
    const rows = await db
      .select({
        id: communityJoinRequestsTable.id,
        userId: communityJoinRequestsTable.userId,
        message: communityJoinRequestsTable.message,
        createdAt: communityJoinRequestsTable.createdAt,
        userName: profileTable.name,
        avatarUrl: profileTable.avatarUrl,
      })
      .from(communityJoinRequestsTable)
      .leftJoin(profileTable, eq(profileTable.userId, communityJoinRequestsTable.userId))
      .where(and(
        eq(communityJoinRequestsTable.communityId, communityId),
        eq(communityJoinRequestsTable.status, "pending"),
      ))
      .orderBy(desc(communityJoinRequestsTable.createdAt));
    res.json({ requests: rows });
  } catch (err) {
    console.error("GET /community/:id/join-requests error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});
```

- [ ] **Step 3: Append the resolve route.**

```ts
router.post("/community/:id/join-requests/:requestId/resolve", async (req, res) => {
  const communityId = parseInt(req.params.id);
  const ctx = await requirePermission(req, res, communityId, "members.kick");
  if (!ctx) return;
  try {
    const requestId = parseInt(req.params.requestId);
    const decision = req.body?.decision;
    if (decision !== "approve" && decision !== "reject") {
      res.status(400).json({ error: "Decisione non valida" }); return;
    }
    const [request] = await db
      .select()
      .from(communityJoinRequestsTable)
      .where(and(
        eq(communityJoinRequestsTable.id, requestId),
        eq(communityJoinRequestsTable.communityId, communityId),
      ))
      .limit(1);
    if (!request) { res.status(404).json({ error: "Richiesta non trovata" }); return; }
    if (request.status !== "pending") { res.status(409).json({ error: "Richiesta gia' gestita" }); return; }

    await db.transaction(async (tx) => {
      await tx
        .update(communityJoinRequestsTable)
        .set({ status: decision === "approve" ? "approved" : "rejected", decidedByUserId: ctx.userId, decidedAt: new Date() })
        .where(eq(communityJoinRequestsTable.id, requestId));

      if (decision === "approve") {
        const [defaultRole] = await tx
          .select({ id: communityRolesTable.id })
          .from(communityRolesTable)
          .where(and(eq(communityRolesTable.communityId, communityId), eq(communityRolesTable.isDefault, true)))
          .limit(1);
        const inserted = await tx
          .insert(communityMembersTable)
          .values({ communityId, userId: request.userId, role: "member", roleId: defaultRole?.id ?? null })
          .onConflictDoNothing({ target: [communityMembersTable.communityId, communityMembersTable.userId] })
          .returning({ id: communityMembersTable.id });
        if (inserted.length > 0) {
          await tx
            .update(communitiesTable)
            .set({ memberCount: sql`${communitiesTable.memberCount} + 1` })
            .where(eq(communitiesTable.id, communityId));
        }
      }
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /community/:id/join-requests/:requestId/resolve error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});
```

- [ ] **Step 4: Typecheck.**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; cd /Users/gazz/Desktop/TraderLoadingsLOCALE; node_modules/.bin/tsc --noEmit -p artifacts/api-server/tsconfig.json`
Expected: exit 0. (If `communityMembersTable` has no `(communityId,userId)` unique index for `onConflictDoNothing`, confirm `community_members_pair_idx` exists in `schema/community.ts` — it does — and reference the columns as the target.)

- [ ] **Step 5: Commit.**

```bash
git add artifacts/api-server/src/routes/communityModeration.ts
git commit -m "feat(community): approve/reject join-request endpoints (members.kick-gated, transactional approve)" -- artifacts/api-server/src/routes/communityModeration.ts
```

---

### Task 6: GDPR purge + community-delete cascade + coverage

**Files:**
- Modify: `artifacts/api-server/src/services/accountDeletion.ts` (community block ~155-176)
- Modify: `artifacts/api-server/src/services/accountDeletion.coverage.static.test.ts` (indirect list, if needed)
- Modify: the community-delete route (wherever `DELETE /community/:id` lives — grep `router.delete("/community/:id"`; if none exists, skip the cascade sub-step and note it)

**Interfaces:**
- Consumes: `communityJoinRequestsTable` (has a `user_id` column → coverage test requires it).

- [ ] **Step 1: Add the join-requests purge to account deletion.** In `accountDeletion.ts`, inside the same transaction as the other community deletes (after `DELETE FROM community_members …`), add:

```ts
    // The user's own join requests, and scrub them as an approver of others'.
    await tx.execute(sql`DELETE FROM community_join_requests WHERE user_id = ${userId}`);
    await tx.execute(sql`UPDATE community_join_requests SET decided_by_user_id = NULL WHERE decided_by_user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM community_join_requests WHERE community_id IN (SELECT id FROM communities WHERE creator_id = ${userId})`);
```

(The third line removes requests to the deleted user's own communities, consistent with the surrounding creator-owned cascades.)

- [ ] **Step 2: Run the coverage static test — verify it now passes (the table is covered).**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; cd /Users/gazz/Desktop/TraderLoadingsLOCALE; artifacts/api-server/node_modules/.bin/tsx artifacts/api-server/src/services/accountDeletion.coverage.static.test.ts`
Expected: `account deletion coverage checks passed`. (The test auto-detects `community_join_requests` via its `text("user_id")` column and requires a `DELETE FROM|UPDATE community_join_requests` — the Step-1 lines satisfy it. If it still fails, the regex needs the table name literally present, which it now is.)

- [ ] **Step 3: Cascade on community delete (if the route exists).** Grep `router.delete("/community/:id"` in `routes/community.ts`. If found, add inside its transaction/handler: `await db.delete(communityJoinRequestsTable).where(eq(communityJoinRequestsTable.communityId, id));` alongside the existing child-table deletes. If no such route exists, note it in the commit message and move on.

- [ ] **Step 4: Full BE typecheck + coverage.**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; cd /Users/gazz/Desktop/TraderLoadingsLOCALE; node_modules/.bin/tsc --noEmit -p artifacts/api-server/tsconfig.json && artifacts/api-server/node_modules/.bin/tsx artifacts/api-server/src/services/accountDeletion.coverage.static.test.ts`
Expected: tsc exit 0; `account deletion coverage checks passed`.

- [ ] **Step 5: Commit.**

```bash
git add artifacts/api-server/src/services/accountDeletion.ts artifacts/api-server/src/routes/community.ts
git commit -m "fix(gdpr): purge community_join_requests on account deletion + community-delete cascade" -- artifacts/api-server/src/services/accountDeletion.ts artifacts/api-server/src/routes/community.ts
```

---

### Task 7: i18n keys

**Files:**
- Modify: `artifacts/trader-dashboard/src/lib/i18n/dict.{it,en,es,fr,de}.ts`

**Interfaces:**
- Produces keys used by Task 8: `community.join.request`, `community.join.requested`, `community.join.declined`, `community.join.locked_hint`, `community.requests.title`, `community.requests.empty`, `community.requests.approve`, `community.requests.reject`, `community.requests.tab`.

- [ ] **Step 1: Add the block to each of the 5 dicts** (alphabetical, before the first `community.member.*` key). Insert the same keys with these values (ASCII-safe):

`it`:
```ts
  "community.join.declined": "Richiesta rifiutata",
  "community.join.locked_hint": "Community privata: richiedi l'accesso per vedere i canali.",
  "community.join.request": "Richiedi accesso",
  "community.join.requested": "Richiesta inviata",
  "community.requests.approve": "Approva",
  "community.requests.empty": "Nessuna richiesta in attesa",
  "community.requests.reject": "Rifiuta",
  "community.requests.tab": "Richieste",
  "community.requests.title": "Richieste di accesso",
```
`en`:
```ts
  "community.join.declined": "Request declined",
  "community.join.locked_hint": "Private community: request access to see the channels.",
  "community.join.request": "Request to join",
  "community.join.requested": "Request sent",
  "community.requests.approve": "Approve",
  "community.requests.empty": "No pending requests",
  "community.requests.reject": "Reject",
  "community.requests.tab": "Requests",
  "community.requests.title": "Join requests",
```
`es`:
```ts
  "community.join.declined": "Solicitud rechazada",
  "community.join.locked_hint": "Comunidad privada: solicita acceso para ver los canales.",
  "community.join.request": "Solicitar acceso",
  "community.join.requested": "Solicitud enviada",
  "community.requests.approve": "Aprobar",
  "community.requests.empty": "No hay solicitudes pendientes",
  "community.requests.reject": "Rechazar",
  "community.requests.tab": "Solicitudes",
  "community.requests.title": "Solicitudes de acceso",
```
`fr`:
```ts
  "community.join.declined": "Demande refusee",
  "community.join.locked_hint": "Communaute privee : demandez l'acces pour voir les canaux.",
  "community.join.request": "Demander l'acces",
  "community.join.requested": "Demande envoyee",
  "community.requests.approve": "Approuver",
  "community.requests.empty": "Aucune demande en attente",
  "community.requests.reject": "Refuser",
  "community.requests.tab": "Demandes",
  "community.requests.title": "Demandes d'acces",
```
`de`:
```ts
  "community.join.declined": "Anfrage abgelehnt",
  "community.join.locked_hint": "Private Community: fordere Zugang an, um die Kanaele zu sehen.",
  "community.join.request": "Zugang anfragen",
  "community.join.requested": "Anfrage gesendet",
  "community.requests.approve": "Genehmigen",
  "community.requests.empty": "Keine offenen Anfragen",
  "community.requests.reject": "Ablehnen",
  "community.requests.tab": "Anfragen",
  "community.requests.title": "Zugangsanfragen",
```

- [ ] **Step 2: Run the i18n parity gate.**

Run: `export PATH="$HOME/.local/node/bin:$PATH"; cd /Users/gazz/Desktop/TraderLoadingsLOCALE; artifacts/api-server/node_modules/.bin/tsx artifacts/trader-dashboard/src/lib/i18n.parity.static.test.ts`
Expected: `i18n parity checks passed (… x 5 lingue)`.

- [ ] **Step 3: Commit.**

```bash
git add artifacts/trader-dashboard/src/lib/i18n/dict.it.ts artifacts/trader-dashboard/src/lib/i18n/dict.en.ts artifacts/trader-dashboard/src/lib/i18n/dict.es.ts artifacts/trader-dashboard/src/lib/i18n/dict.fr.ts artifacts/trader-dashboard/src/lib/i18n/dict.de.ts
git commit -m "i18n(community): join-request + requests-queue keys (x5)" -- artifacts/trader-dashboard/src/lib/i18n/dict.it.ts artifacts/trader-dashboard/src/lib/i18n/dict.en.ts artifacts/trader-dashboard/src/lib/i18n/dict.es.ts artifacts/trader-dashboard/src/lib/i18n/dict.fr.ts artifacts/trader-dashboard/src/lib/i18n/dict.de.ts
```

---

### Task 8: Frontend — off-contract client + discovery/locked/requests UI

**Files:**
- Create: `artifacts/trader-dashboard/src/lib/communityJoinApi.ts`
- Modify: the community discovery + detail components (grep `apiJSON("community"` / `apiFetch("community` under `artifacts/trader-dashboard/src/` to locate them — likely `pages/` or `components/` community files) — join button (Join → Request to join / Requested / locked cover), and the community-management modal to add a "Requests" tab.

**Interfaces:**
- Consumes: the Task-4/5 endpoints. `requestJoin(id, message?)`, `fetchJoinRequests(id)`, `resolveJoinRequest(id, requestId, decision)`.

- [ ] **Step 1: Create the off-contract client** (mirror `lib/torneiApi.ts` / `referralApi.ts`):

```ts
import { apiJSON } from "./apiFetch";

export interface JoinRequest {
  id: number;
  userId: string;
  userName: string | null;
  avatarUrl: string | null;
  message: string | null;
  createdAt: string;
}

export const communityJoinRequestsKey = (id: number) => ["/api/community", id, "join-requests"] as const;

export function requestJoin(communityId: number, message?: string): Promise<{ status: string; ok?: boolean; alreadyMember?: boolean }> {
  return apiJSON(`community/${communityId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message ? { message } : {}),
  });
}

export function fetchJoinRequests(communityId: number): Promise<{ requests: JoinRequest[] }> {
  return apiJSON(`community/${communityId}/join-requests`);
}

export function resolveJoinRequest(communityId: number, requestId: number, decision: "approve" | "reject"): Promise<{ ok: boolean }> {
  return apiJSON(`community/${communityId}/join-requests/${requestId}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision }),
  });
}
```

- [ ] **Step 2: Discovery + locked-cover UI.** In the community discovery/detail component(s): when a community has `locked` (or detail `joinRequestStatus`), render the join control as: `joinRequestStatus === "pending"` → disabled `t("community.join.requested")`; `=== "rejected"` → `t("community.join.declined")` + allow re-request; else → `t("community.join.request")` calling `requestJoin(id)`. For a locked detail page, render the cover fields + `t("community.join.locked_hint")` and hide channels. Use the existing `useMutation`/`useQueryClient` + `useLanguage` patterns already in those files.

- [ ] **Step 3: "Requests" tab in community management.** In the community-settings/management modal (grep `CommunitySettingsModal` or the management component), add a tab `t("community.requests.tab")` visible when the viewer is owner or has `members.kick` (the detail payload already returns `myPermissions` — check `myPermissions.includes("members.kick") || isOwner`). The tab uses `useQuery(communityJoinRequestsKey(id), () => fetchJoinRequests(id))` and renders each request with Approve/Reject buttons calling `resolveJoinRequest(...)` then invalidating the query. Show `t("community.requests.empty")` when none.

- [ ] **Step 4: Gates — FE typecheck + i18n parity + production-copy.**

Run:
```
export PATH="$HOME/.local/node/bin:$PATH"; cd /Users/gazz/Desktop/TraderLoadingsLOCALE
node_modules/.bin/tsc --noEmit -p artifacts/trader-dashboard/tsconfig.json
artifacts/api-server/node_modules/.bin/tsx artifacts/trader-dashboard/src/lib/i18n.parity.static.test.ts
artifacts/api-server/node_modules/.bin/tsx artifacts/trader-dashboard/src/production-copy.static.test.ts
```
Expected: fe tsc exit 0; parity passed; production copy passed. (Runtime UI — the join→request→approve flow and the locked cover — is a **manual browser check** by the user; no jsdom here.)

- [ ] **Step 5: Commit.**

```bash
git add artifacts/trader-dashboard/src/lib/communityJoinApi.ts <the community component files you edited>
git commit -m "feat(ui): private-community request-to-join + approvals queue (0.5b)" -- artifacts/trader-dashboard/src/lib/communityJoinApi.ts <same files>
```

---

## Self-Review

**Spec coverage:** data model → Task 1 · pure policy helper → Task 2 · discovery cover + `locked` → Task 3 · detail cover-only + `joinRequestStatus` → Task 3 · channel-message 403 for private non-members → **already enforced** by the existing membership check at `community.ts:351-356` (documented; no new task needed, and the `canReadChannel` choke-point refactor for C is deferred to C to avoid speculative churn) · join→request → Task 4 · approve/reject → Task 5 · GDPR + cascade → Task 6 · UI → Task 8 · i18n → Task 7 · testing (pure + coverage) → Tasks 2/6 (route authz tests need CI-DB, flagged in spec §Testing, not blocking this plan).

**Deviation from spec (noted):** the spec proposed introducing a `canReadChannel` choke-point now; message reads are already membership-gated at `community.ts:351`, so this plan leaves that refactor to sub-project C (YAGNI — no behavior gap today). Flag for C.

**Placeholder scan:** none — every code step is complete; the only conditional instructions ("if `bannerUrl` isn't a column…", "if the delete route exists…") are explicit verification branches with a defined fallback, not placeholders.

**Type consistency:** `decideJoin`/`canRequestJoin`/`canSeeFullCommunity` signatures match between Task 2 (def) and Tasks 3/4 (use). `communityJoinRequestsTable` columns (`status`, `message`, `decidedByUserId`, `decidedAt`) match between Task 1 (schema) and Tasks 4/5/6 (queries). `joinRequestStatus` string values (`none`/`pending`/`rejected`/`approved`) consistent between Task 3 (detail) and Task 8 (UI).
