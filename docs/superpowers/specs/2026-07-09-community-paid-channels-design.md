# Community paid channels — design (sub-project C)

> Part of the community monetization arc: **A** private + owner-approved join (shipped),
> **B** in-app credit wallet + Stripe purchase (shipped), **C** per-channel paid access
> (this doc), **D** real-money creator payout (deferred — compliance).

**Date:** 2026-07-09 · **Branch:** `feat/community-management` · **Status:** design

## 1. Goal

Let a community have **both free and paid channels in the same community**. A channel's
creator (owner, or a member with the `channels.manage` permission) sets a price in in-app
**credits** (sub-project B) and chooses the **access model per channel**:

- **One-time unlock** — pay the price once → permanent access.
- **Subscription** — pay the price per period (N days) → access lapses at expiry; the buyer
  re-pays to extend. **Manual renewal only** (no auto-charge cron): access is checked live
  against `expires_at`, so a lapsed subscription simply reads as locked.

When a buyer unlocks/renews, the credits are **transferred to the channel owner's wallet**
(`reason="channel_sale"`), matching the user's vision that a creator earns a balance
("convertibile poi in saldo sul proprio conto"). Cashing that balance out to real money is
**sub-project D** (deferred); until then earned credits are spendable inside the app only.
Credits keep the B guarantee: **no cash value, non-refundable, non-withdrawable, forfeited on
account deletion**.

## 2. Non-goals (YAGNI)

- No auto-renewing subscriptions / recurring Stripe charges (manual re-pay in credits).
- No refunds or chargebacks on channel purchases (credits have no cash value).
- No creator payout to real money (that is D).
- No per-message / pay-per-view; access is at the **channel** granularity.
- No proration when a creator changes a channel's price (existing entitlements stand as-is
  until they lapse).

## 3. Data model

### 3.1 `community_channels` — add pricing columns (migration 0029)

```
price_credits             integer      NULL   -- NULL or <= 0  ⇒ free
access_model              text         NULL   -- 'one_time' | 'subscription' (only meaningful when priced)
subscription_period_days  integer      NULL   -- required & > 0 when access_model = 'subscription'
```

A channel is **free** unless `price_credits > 0`. Free is the default (all existing channels
migrate as free — columns are nullable, no backfill).

### 3.2 `community_channel_entitlements` — new table

```
id           serial primary key
community_id integer      not null
channel_id   integer      not null
user_id      text         not null
source       text         not null   -- 'purchase' | 'grant'
granted_at   timestamp    not null default now()
expires_at   timestamp    NULL       -- NULL ⇒ permanent (one_time); set ⇒ subscription expiry
```

Indexes: `uniqueIndex (channel_id, user_id)` (one entitlement row per user per channel —
renewals update `expires_at` in place), `index (user_id)` (GDPR purge + "my access" reads).

`text("user_id")` ⇒ the GDPR coverage test forces this table into `accountDeletion.ts`.

## 4. Pure core — `services/community/channelAccess.ts` (TDD)

All decision logic is pure and unit-tested; the route layer only does IO around it.

```ts
export interface ChannelPricing {
  priceCredits: number | null;
  accessModel: string | null;            // 'one_time' | 'subscription' | null
  subscriptionPeriodDays: number | null;
}
export interface Entitlement { expiresAt: Date | null; }

// A channel with no positive price is free.
export function isChannelFree(c: Pick<ChannelPricing, "priceCredits">): boolean;

// An entitlement grants access iff it exists and is not expired at `now`.
export function isEntitlementActive(ent: Entitlement | null, now: Date): boolean;

// The single read/write choke point. Owner and channels.manage bypass payment.
export function canAccessChannel(args: {
  isFree: boolean;
  isOwner: boolean;
  canManage: boolean;                    // holds 'channels.manage'
  entitlement: Entitlement | null;
  now: Date;
}): boolean;

// Expiry after a purchase/renewal. one_time ⇒ null (permanent).
// subscription ⇒ max(now, existingExpiry ?? now) + periodDays days  (renewals stack).
export function computeEntitlementExpiry(args: {
  accessModel: string;
  subscriptionPeriodDays: number;
  existingExpiry: Date | null;
  now: Date;
}): Date | null;

// Validate a creator's pricing edit before persisting.
// free (priceCredits null/<=0) ⇒ ok, other fields cleared.
// priced ⇒ priceCredits a positive integer <= MAX_CHANNEL_PRICE (1_000_000);
//          accessModel ∈ {one_time, subscription};
//          subscription ⇒ subscriptionPeriodDays a positive integer <= 366.
export function validateChannelPricing(p: ChannelPricing):
  | { ok: true; normalized: ChannelPricing }
  | { ok: false; error: string };

// Whether a buyer may purchase now: blocks re-buying an already-active one_time unlock
// (409 already-owned); a subscription may always be (re)purchased to extend.
export function canPurchase(args: {
  isFree: boolean;
  accessModel: string;
  entitlement: Entitlement | null;
  now: Date;
}): { ok: true } | { ok: false; reason: "free" | "already-owned" };
```

## 5. Credit transfer — extend `services/credits/wallet.ts`

Unlock must move credits **buyer → owner atomically** and write the entitlement in the **same
transaction**, so a crash can never leave a buyer charged without access (or vice-versa).

Add a transaction-aware transfer that both debits and credits inside one `db.transaction`,
locking both wallets in a **stable order** (sort by `userId`) to avoid deadlocks, and writing a
debit ledger row for the buyer and a credit ledger row for the owner:

```ts
// Atomic two-wallet move + 2 ledger rows. Rejects non-positive / non-integer amount and
// insufficient buyer balance (throws InsufficientCredits). Self-transfer (buyer===owner) is
// a no-op guard (a creator unlocking their own channel is already bypassed upstream).
export async function transferCredits(args: {
  fromUserId: string; toUserId: string; amount: number;
  reason: string; refId?: string;
}, tx?: DbTx): Promise<void>;
```

`unlockChannel` (in a new `services/community/channelUnlock.ts`) runs ONE `db.transaction`:
load channel FOR SHARE, resolve owner, `canPurchase` guard, `transferCredits(buyer→owner, tx)`,
then upsert the entitlement with `computeEntitlementExpiry`. `spendCredits`/`grantCredits` from
B stay for non-transfer flows; the shared inner ledger step is factored so both reuse it.

## 6. Endpoints — `routes/communityChannels.ts` (new, off-contract)

- `PATCH /community/channels/:channelId/pricing`
  Body `{ priceCredits, accessModel, subscriptionPeriodDays }`. Gated `requirePermission(…, "channels.manage")`.
  `validateChannelPricing` → 400 on failure → update the channel row with the normalized values.
- `POST /community/channels/:channelId/unlock`
  Buyer-only (must be a member; owner/manage get 400 "already have access"). Runs `unlockChannel`.
  → 200 `{ balance, entitlement:{expiresAt} }` · 402 `{ code:"insufficient_credits" }` ·
  409 `{ code:"already_owned" }` · 400 free channel.
- `GET /community/channels/:channelId/access`
  Per-viewer state: `{ isFree, priceCredits, accessModel, subscriptionPeriodDays, locked, entitlement:{expiresAt}|null }`.

The community detail (`GET /community/:id`) channel list gains, per channel:
`priceCredits, accessModel, subscriptionPeriodDays, locked` (`locked = !canAccessChannel(...)`),
so the sidebar can render locks without an extra call per channel.

## 7. Gate integration (the choke point)

A helper `assertChannelAccess(userId, channel, res): Promise<boolean>` centralises the check
and is called **after** the existing membership check in every channel-content handler:

- `GET  /community/channels/:channelId/messages` (read)
- `POST /community/channels/:channelId/messages` (write)
- `GET  /community/channels/:channelId/files`
- `POST /community/channels/:channelId/files` (upload)
- `POST /community/voice/:channelId/join`

It loads the viewer's entitlement + owner/`channels.manage` status and applies
`canAccessChannel`. On deny → `402 { error, code:"channel_locked", priceCredits, accessModel,
subscriptionPeriodDays }`. Owner and `channels.manage` always pass (creators preview their own
paid channels).

## 8. GDPR & cascades

- `accountDeletion.ts`: `DELETE FROM community_channel_entitlements WHERE user_id = $1`
  (satisfies the coverage test) — a user's purchases vanish with the account; credits already
  forfeited per B.
- `communityDeletion.ts` (delete whole community) and `deleteChannelDeep(channelId)` (delete one
  channel): also delete that community's/channel's entitlement rows so no orphans remain.

## 9. Frontend

- **Client** `lib/channelAccessApi.ts` (off-contract): `fetchChannelAccess`, `unlockChannel`,
  `updateChannelPricing` + query keys.
- **Locked channel** in the channel rail: lock icon + price badge; selecting it shows an
  `ChannelUnlockPanel` — "Unlock for N credits" (one-time) or "Access N credits · X days"
  (subscription, showing current expiry if any) → calls unlock → on success invalidates the
  channel/messages/wallet queries. Insufficient-credit (402) deep-links to the buy-credits card.
- **Pricing editor** for `channels.manage`: in the channel settings, a control to set free /
  one-time price / subscription price + period, calling `updateChannelPricing`.
- **i18n ×5** for all new copy (`channel.access.*`), respecting the parity + mojibake gates.

## 10. Testing

- Pure core (`channelAccess.ts`) — full unit coverage of every function incl. edges: free vs
  priced, expired vs active vs permanent entitlement, owner/manage bypass, renewal-stacking
  expiry, validation rejects (non-integer, negative, over-cap, subscription without period),
  `canPurchase` already-owned.
- `transferCredits` — buyer debited + owner credited + two ledger rows + balance conservation;
  insufficient balance throws and rolls back (no partial); non-integer/negative rejected.
- Gate: BE typecheck, GDPR coverage (entitlements table covered), i18n parity + production-copy,
  lib/db rebuild. Live purchase path (real spend) is exercised by the pure/tx tests; end-to-end
  with a running DB is manual (no CI Postgres here).

## 11. Rollout / flags

No new feature flag: a community with zero priced channels behaves exactly as today (all free).
Paid channels light up only when a creator sets a price, and buying requires B's wallet to have
credits (which itself needs the Stripe price env from B). So C ships dark-by-default naturally.
