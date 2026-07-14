# Private Communities + Owner-Approved Join — Design Spec

**Date:** 2026-07-08
**Status:** Approved (brainstorming) → ready for implementation plan
**Scope:** Sub-project **A** of the community monetization + privacy initiative.

## Context & sequencing

The user wants communities that (1) can be **private**, joined only with the **creator's approval**, and
eventually (2) monetized via an **in-app currency** with **per-section (per-channel) paid access**, where earned
currency is later **convertible to a real payout** to the creator.

This is four stacked subsystems, decomposed and sequenced:

| | Piece | Money | Status |
|---|---|---|---|
| **A** | Private communities + owner-approved join | none | **this spec** |
| **B** | In-app currency wallet + buy-with-Stripe | in | future spec |
| **C** | Paid **per-channel** access (spend currency; creator earns) | internal | future spec |
| **D** | Creator payout — earned currency → real withdrawable money | out | **deferred** — gated on compliance groundwork |

**D is explicitly deferred.** Converting in-app currency into real, withdrawable money makes TraderLoadings a
marketplace / money transmitter, triggering Stripe Connect + creator KYC, tax reporting (1099-K / EU DAC7), VAT on
digital sales, and AML / money-transmission obligations that vary by jurisdiction. That is legal/business
groundwork the founder owns, not something to ship from code alone.

This spec covers **only A**. A also resolves audit finding **0.5(b)** (private communities currently aren't
private — `isPublic` only filters discovery; detail/join/messages are open to any authenticated user who knows the
serial id). A is designed to make **C** a localized change, not a restructuring (see "Forethought for C").

Audit **0.5(a)** — the role/rank hierarchy that stops a `roles.manage` holder self-promoting to owner — is **already
fixed** (`services/communityPermissions.ts`: `OWNER_RANK`, `outranks`, `canGrantPermissions`, enforced across
role/moderation routes) and is a dependency A relies on for its approver gate.

## Goal

A private (`isPublic=false`) community is **discoverable as a cover only**; its channels and messages are visible
only to approved members. A non-member **requests to join**; the **creator or a member with the `members.kick`
permission** approves or rejects. Public communities are unchanged.

## Architecture

Follows the existing community subsystem: hand-authored Drizzle schema + SQL migration; off-contract Express routes
(`routes/community.ts`, `routes/communityModeration.ts` style, direct `apiJSON`, not in `openapi.yaml`); pure
policy helpers in a service module; React UI with i18n in all 5 languages.

### Data model

New table **`community_join_requests`** (`lib/db/src/schema/community.ts`):

| column | type | notes |
|---|---|---|
| `id` | serial PK | |
| `communityId` | integer, not null | |
| `userId` | text, not null | the requester (Clerk user id) |
| `status` | text, not null, default `'pending'` | `pending` \| `approved` \| `rejected` |
| `message` | text, nullable | optional note from the requester |
| `decidedByUserId` | text, nullable | approver, set on resolve |
| `decidedAt` | timestamp, nullable | set on resolve |
| `createdAt` | timestamp, not null, default now | |

Indexes: `uniqueIndex(communityId, userId)` (one request row per user per community; re-request updates it in
place), `index(communityId, status)` (pending-queue read).

Migration **`0027_community_join_requests.sql`** (current head is `0026`; verify the next free index in
`meta/_journal.json` at implementation time and register the journal entry). Hand-authored, idempotent
`CREATE TABLE IF NOT EXISTS` + `CREATE ... INDEX IF NOT EXISTS`.

`communities.isPublic` is **reused unchanged**: `true` = public (discoverable, open self-join — today's behavior);
`false` = private (discoverable cover-only, request-to-join).

### Pure policy helper

`services/community/joinPolicy.ts` (pure, unit-tested), consumed by the routes:

```ts
type JoinOutcome = "join" | "request" | "already-member" | "blocked";

// Decide what POST /community/:id/join should do.
export function decideJoin(input: {
  isPublic: boolean;
  isMember: boolean;
  isBanned: boolean;
}): JoinOutcome;
// isBanned → "blocked"; isMember → "already-member"; isPublic → "join"; else → "request".

// Whether a rejected/absent request may (re)enter pending.
export function canRequestJoin(existing: { status: string } | null): boolean;
// null or status==="rejected" → true; "pending"/"approved" → false (idempotent).

// Whether a viewer may see the full community (channels/messages) vs cover-only.
export function canSeeFullCommunity(input: { isPublic: boolean; isMember: boolean; isOwner: boolean }): boolean;
// isPublic || isMember || isOwner.
```

The approver gate (`isOwner || hasPermission("members.kick")`) reuses the existing permission machinery
(`getMemberPermissions`, `communityPermissions.ts`); no new permission is introduced (the user chose "reuse a
members-management permission" over a dedicated one — `members.kick` is the existing membership-management perm).
Swapping to a dedicated `members.approve` permission later is a one-line catalog change.

### Channel-read choke point (forethought for C)

Introduce a single **`canReadChannel(userId, community, channel)`** helper used by every channel/message read.
In A it returns `isPublic || isMember(userId)`. C will add the paid-tier check **inside this one function** (plus a
`channel_access` table and a per-user entitlement from a currency purchase), so per-channel paywalls are a localized
change, not a sweep across routes. All A message/channel read routes MUST route through this helper.

## Data flow

### Visibility & gating
- **`GET /community` (discovery list):** returns the **public cover** `{id, name, avatarUrl, bannerUrl, description,
  rules, memberCount, accentColor}` for **both** public and private communities, each with `locked = !isPublic &&
  !isMember`. (Today it lists only `isPublic`; this widens discovery to private communities — cover only, never
  channels.)
- **`GET /community/:id` (detail):** if `canSeeFullCommunity` → full payload (channels, roles, settings) as today;
  else (private + non-member) → **cover only** plus the viewer's own `joinRequestStatus` (`none` \| `pending` \|
  `rejected`). Public + non-member → full (public communities stay open).
- **Channel message reads** and any member-scoped mutation: gated via `canReadChannel` / existing membership check;
  private + non-member → **403** (not 404 — the cover already reveals existence; consistency with discovery).

### Join → request → approval
- **`POST /community/:id/join`** → `decideJoin`:
  - `blocked` → 403 (respects `community_bans`).
  - `already-member` → 200 no-op.
  - `join` (public) → insert `community_members` (default role), as today.
  - `request` (private) → upsert `community_join_requests` to `pending` with optional `message` (only if
    `canRequestJoin`); return `{ status: "pending" }`. Does **not** create a member.
- **`GET /community/:id/join-requests`** → pending queue `[{ id, userId, userName, avatarUrl, message, createdAt }]`.
  Gate: `isOwner || members.kick`; else 403.
- **`POST /community/:id/join-requests/:requestId/resolve { decision: "approve" | "reject" }`** → same gate. In a
  `db.transaction`:
  - `approve`: set request `approved` + `decidedBy/decidedAt`; `insert community_members … onConflictDoNothing`
    (idempotent). If the request is already non-pending → 409.
  - `reject`: set request `rejected` + `decidedBy/decidedAt`.

### Notifications (MVP)
An in-app **pending-count badge** for approvers (derived from `GET .../join-requests`), surfaced on the community
management entry. Push-to-approver on a new request is a **flagged nice-to-have** (reuse `sendPushToUser` + the
existing `social` pref) — out of MVP to avoid scope creep.

## UI

- **Discovery card (private):** lock badge + **"Request to join"** button → after POST, **"Requested"** (disabled).
- **Locked detail page (private, non-member):** render the cover (name, banner, description, rules, member count) +
  request state; **no channels/messages**. States: "Request to join" / "Requested" / "Request declined — request
  again".
- **Community management → "Requests" tab** (visible when `isOwner || members.kick`): pending list with
  Approve/Reject; a count badge on the tab.
- **i18n:** new `community.join.*` / `community.requests.*` keys in all 5 languages (it/en/es/fr/de), ASCII-safe per
  the mojibake gate; using `t()`/`uiText()` per the production-copy gate.

## Error handling & edge cases

- Request to a **public** community → just joins (no request row).
- Approver acting on an **already-resolved** request → 409 no-op.
- Approve when the user is **already a member** → idempotent (`onConflictDoNothing`).
- Non-approver hitting the approve endpoints → **403** (rank/permission enforced; consistent with the fixed
  hierarchy — an approver must also `outrank` nothing here since approval only adds a default-role member).
- **Banned** requester → `blocked` (403); no request created.
- **Community deletion** must cascade-delete its `community_join_requests` (add to the community-delete path).
- **GDPR:** `community_join_requests` has a `user_id` column → in `services/accountDeletion.ts`:
  `DELETE FROM community_join_requests WHERE user_id = :userId` (the user's own requests), **and**
  `UPDATE community_join_requests SET decided_by_user_id = NULL WHERE decided_by_user_id = :userId` (scrub the
  deleted user as an *approver* of someone else's request — never delete another member's request row). The
  `accountDeletion.coverage.static.test.ts` guard fails the build until `community_join_requests` is covered — that
  is the enforcement.

## Testing

- **Pure unit tests** (`joinPolicy.test.ts`, run under tsx, no DB): `decideJoin`, `canRequestJoin`,
  `canSeeFullCommunity`, `canReadChannel` (membership branch) across the truth table.
- **Route authz tests** (need CI Postgres, like the existing community authz suite): non-member gets 403 on private
  detail/messages; non-approver gets 403 on the approve endpoints; approve inserts a member; reject does not;
  re-request after reject works; request to a public community joins directly. Provided as tests even though they
  run in CI, per audit 4.4.
- **GDPR coverage static test** includes `community_join_requests`.

## Forethought for C (paid per-channel) — not built here

C will add: a `channel_access` requirement per channel (`free` | a paid tier), a per-user channel **entitlement**
row created when the user spends in-app currency (B) on a paid channel, and the paid-tier branch **inside
`canReadChannel`**. Because A funnels every channel read through `canReadChannel` and establishes the
membership/request model, C is a bounded, additive change — no restructuring of A's routes.

## Out of scope (this spec)

- In-app currency, wallet, Stripe purchase (B).
- Per-channel pricing/tiers and entitlements (C).
- Real-money creator payout / Stripe Connect / KYC / tax (D — deferred).
- Invite links / codes (not requested; request-to-join is the join model).
