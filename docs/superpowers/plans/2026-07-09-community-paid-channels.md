# Community paid channels — implementation plan (sub-project C)

> **For agentic workers:** TDD, bite-sized steps, gate each task. Spec:
> `docs/superpowers/specs/2026-07-09-community-paid-channels-design.md`.

**Goal:** Per-channel paid access in communities — creator sets a credit price and picks
one-time-unlock or subscription; buyers spend credits (which flow to the owner's wallet).

**Tech:** TS, Express 5, Drizzle/Postgres, React 19. Off-contract (direct apiJSON). Tests are
`node:assert` via tsx.

## Global constraints
- Credits: no cash value, non-refundable, non-withdrawable, forfeited on account deletion.
- Off-contract: no openapi/codegen. Shared branch: pathspec commits only, never `git add -A`.
- Migrations hand-authored SQL + `_journal.json` entry; head is 0028 → this adds **0029**.
- i18n: add keys to all 5 dicts; respect parity + mojibake (no Ã/â/Â/ð) gates.
- Gates per task: BE tsc `node_modules/.bin/tsc --noEmit -p artifacts/api-server/tsconfig.json`;
  FE tsc `-p artifacts/trader-dashboard/tsconfig.json`; lib/db `tsc -b lib/db/tsconfig.json`;
  GDPR `accountDeletion.coverage.static.test.ts`; i18n `i18n.parity.static.test.ts`;
  copy `production-copy.static.test.ts`. Run tsx tests via `artifacts/api-server/node_modules/.bin/tsx`.

---

### Task 1: Pure core `channelAccess.ts` (TDD)

**Files:** Create `artifacts/api-server/src/services/community/channelAccess.ts` +
`…/channelAccess.test.ts`.

**Produces:** `isChannelFree`, `isEntitlementActive`, `canAccessChannel`,
`computeEntitlementExpiry`, `validateChannelPricing`, `canPurchase`, `MAX_CHANNEL_PRICE=1_000_000`,
`MAX_SUBSCRIPTION_DAYS=366` (signatures per spec §4).

- [ ] Write failing tests covering: free vs priced; entitlement active/expired/permanent/null;
  owner & manage bypass; expiry one_time=null; subscription expiry = now+period; renewal stacks
  from `max(now, existingExpiry)`; validation ok (free clears fields; priced ok) and rejects
  (non-integer price, negative, over cap, bad accessModel, subscription w/o positive period,
  period over cap); `canPurchase` free→reason:"free", active one_time→"already-owned",
  subscription always ok, expired one_time ok (re-buy allowed).
- [ ] Run → FAIL. Implement minimal pure functions. Run → PASS.
- [ ] Gate: BE tsc. Commit `feat(community): channel-access pure core (C task 1)`.

### Task 2: Schema + migration 0029

**Files:** Modify `lib/db/src/schema/community.ts` (add 3 columns to `communityChannelsTable`;
add `communityChannelEntitlementsTable` + `CommunityChannelEntitlement` type). Create
`lib/db/drizzle/0029_channel_paid_access.sql`. Modify `lib/db/drizzle/meta/_journal.json` (idx 29).

- [ ] Add columns `priceCredits`, `accessModel`, `subscriptionPeriodDays` (all nullable) to
  `communityChannelsTable`.
- [ ] Add `communityChannelEntitlementsTable` per spec §3.2 (uniqueIndex (channelId,userId),
  index (userId)) + inferred type export.
- [ ] Write `0029_channel_paid_access.sql`: `ALTER TABLE community_channels ADD COLUMN …` ×3;
  `CREATE TABLE community_channel_entitlements …` + the 2 indexes.
- [ ] Append journal idx 29 (tag `0029_channel_paid_access`, when = prior when + 86400000).
- [ ] Gate: `tsc -b lib/db/tsconfig.json` (rebuild dist). Commit
  `feat(db): channel pricing cols + entitlements table, migration 0029 (C task 2)`.

### Task 3: `transferCredits` in wallet.ts (TDD-ish via existing ledger test harness)

**Files:** Modify `artifacts/api-server/src/services/credits/wallet.ts`. Extend
`…/credits/ledger.test.ts` or add cases to a wallet-level test where feasible (pure ledger math
already covered; the tx path is integration — assert the pure invariants used).

**Produces:** `transferCredits({fromUserId,toUserId,amount,reason,refId?}, tx?)`.

- [ ] Factor the inner "lock wallet → applyLedger → update balance → insert ledger row" into a
  reusable helper that accepts a tx handle (keep `spendCredits`/`grantCredits` behaviour).
- [ ] Implement `transferCredits`: one `db.transaction` (or use passed tx); guard
  amount positive integer; no-op if from===to; lock both wallets ordered by userId; debit buyer
  (throw `InsufficientCredits` if `applyLedger` rejects → rolls back); credit owner; write 2
  ledger rows (`delta<0` buyer, `delta>0` owner) with `reason`/`refId`.
- [ ] Add/extend tests for the pure guards (amount validation, conservation via applyLedger).
- [ ] Gate: BE tsc + `credits/ledger.test.ts`. Commit
  `feat(credits): atomic transferCredits (C task 3)`.

### Task 4: `unlockChannel` orchestration

**Files:** Create `artifacts/api-server/src/services/community/channelUnlock.ts`.

**Produces:** `unlockChannel(userId, channelId): Promise<{balance, entitlement:{expiresAt}}>`
throwing typed errors (`ChannelFreeError`, `AlreadyOwnedError`, `InsufficientCredits`,
`ChannelNotFoundError`).

- [ ] One `db.transaction`: load channel (404 if none); if `isChannelFree` → ChannelFreeError;
  resolve community.creatorId as owner; load existing entitlement; `canPurchase` guard →
  AlreadyOwnedError; `transferCredits(buyer→owner, amount=priceCredits, "channel_sale",
  refId=channelId, tx)`; compute expiry via `computeEntitlementExpiry`; upsert entitlement
  (onConflict (channelId,userId) doUpdate set expiresAt, source, grantedAt); return balance +
  entitlement.
- [ ] Gate: BE tsc. Commit `feat(community): unlockChannel atomic spend→entitlement (C task 4)`.

### Task 5: Endpoints `routes/communityChannels.ts` + register

**Files:** Create `artifacts/api-server/src/routes/communityChannels.ts`. Modify
`artifacts/api-server/src/routes/index.ts` (import + `router.use`).

- [ ] `PATCH /community/channels/:channelId/pricing` — `requirePermission(…, "channels.manage")`,
  `validateChannelPricing`, update row, return normalized pricing.
- [ ] `POST /community/channels/:channelId/unlock` — require membership; owner/manage → 400
  already-have-access; call `unlockChannel`; map typed errors to 400/402/409.
- [ ] `GET /community/channels/:channelId/access` — return per-viewer access state (§6).
- [ ] Register `communityChannelsRouter` in `routes/index.ts`.
- [ ] Gate: BE tsc. Commit `feat(community): channel pricing/unlock/access endpoints (C task 5)`.

### Task 6: Gate integration + channel-list flags + GDPR/cascades

**Files:** Modify `artifacts/api-server/src/routes/community.ts` (helper `assertChannelAccess`
+ call in the 3 content handlers + voice; add pricing/locked to GET /community/:id channel list).
Modify `artifacts/api-server/src/routes/social.ts` if it serves channel files. Modify
`artifacts/api-server/src/services/accountDeletion.ts` + `communityDeletion.ts` and the
`deleteChannelDeep` path.

- [ ] Add `assertChannelAccess(userId, channel, res)` (loads entitlement + owner/manage, applies
  `canAccessChannel`, 402 `channel_locked` on deny) and call after each membership check in:
  GET messages, POST messages, GET files, POST files, voice join.
- [ ] Extend GET /community/:id channel mapping with `priceCredits, accessModel,
  subscriptionPeriodDays, locked` per viewer.
- [ ] `accountDeletion.ts`: DELETE entitlements by user_id. `communityDeletion.ts` +
  `deleteChannelDeep`: DELETE entitlements by community_id / channel_id.
- [ ] Gate: BE tsc + `accountDeletion.coverage.static.test.ts`. Commit
  `feat(community): enforce channel access at read/write + GDPR purge (C task 6)`.

**CHECKPOINT — backend complete.** Backend is gate-green here; frontend (Task 7) needs manual
browser verification.

### Task 7: Frontend + i18n

**Files:** Create `artifacts/trader-dashboard/src/lib/channelAccessApi.ts`,
`…/components/social/ChannelUnlockPanel.tsx`, a pricing control in the channel settings UI.
Modify `CommunityTab.tsx`/channel rail for lock badges; the 5 dicts; `types.ts` for the new
channel fields + access shape.

- [ ] `channelAccessApi.ts`: `fetchChannelAccess`, `unlockChannel`, `updateChannelPricing` + keys.
- [ ] Lock icon + price badge on locked channels; `ChannelUnlockPanel` (one-time / subscription
  copy + expiry) → unlock → invalidate channel/messages/wallet queries; 402 insufficient →
  point to buy-credits.
- [ ] Pricing editor (free / one-time / subscription+period) gated to `channels.manage`.
- [ ] Add `channel.access.*` keys to all 5 dicts.
- [ ] Gate: FE tsc + i18n parity + production-copy. Commit
  `feat(community): paid-channel locks, unlock panel, pricing editor + i18n (C task 7)`.
