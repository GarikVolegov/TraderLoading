# Credit Wallet + Stripe Purchase — Design Spec (Sub-project B)

**Date:** 2026-07-08
**Status:** Approved (brainstorming) → implementation
**Scope:** Sub-project **B** of community monetization. Depends on nothing; **C** (per-channel paid access) spends these credits; **D** (real-money payout) is deferred.

## Model (decided)

Users buy **Credits** with Stripe. Credits are **in-app credit with NO cash value**: non-refundable,
non-withdrawable, forfeited on account deletion. This framing keeps the platform **out of e-money / money-transmitter
regulation** (unlike a cash-out wallet — that is D, deferred). ToS must state this explicitly.

Creators accumulate credits (from C's paid-channel spends) they can spend in-app now; converting credits to real
money is **D**, out of scope.

## Architecture

Off-contract Express routes (`apiJSON`), Drizzle schema + hand-authored migration, reuse the existing Stripe client
(`getStripeBillingConfig`) and webhook (`createStripeWebhookRouter` / `processStripeEventOnce` in `routes/billing.ts`).
Pure ledger/pack logic in a tested service module. React wallet + buy-credits UI, i18n ×5.

### Data model
- **`credit_wallets`**: `userId` (text, unique), `balance` (integer, not null, default 0, always ≥ 0), `updatedAt`.
- **`credit_transactions`** (append-only ledger): `id`, `userId`, `delta` (integer, +buy / −spend / +grant),
  `reason` (`purchase` | `spend` | `grant` | `refund`), `refId` (text, nullable — e.g. channelId for a spend,
  packId for a purchase), `stripeEventId` (text, nullable, **unique** — idempotency for purchases), `balanceAfter`
  (integer), `createdAt`. Index `(userId, createdAt)`.
- Migration **0028** (head is 0027; verify at build time). Balance and ledger row move together in a `db.transaction`.

### Credit packs (server constant, not a table)
`services/credits/packs.ts`: `CREDIT_PACKS = [{ id, credits, stripePriceEnv }]` — e.g. `starter` 100, `plus` 500,
`pro` 1200. The Stripe **Price ID** per pack comes from env (`STRIPE_CREDIT_PRICE_STARTER`, …) so packs stay dark
until configured. `creditPackFor(id)` returns the pack or null.

### Pure core (TDD) — `services/credits/ledger.ts`
- `applyLedger(balance: number, delta: number): { ok: boolean; balance: number }` — computes new balance; `ok:false`
  (no change) if it would go negative (overspend guard) or delta is non-integer/NaN.
- `packCredits(packId): number | null` — via the pack catalog.
These are what C reuses for spend; unit-tested across the truth table.

### Endpoints (off-contract, `routes/credits.ts`)
- `GET /credits/wallet` → `{ balance }` (creates a zero wallet lazily).
- `GET /credits/packs` → catalog `[{ id, credits, priceConfigured }]` (priceConfigured=false hides the pack in UI).
- `POST /credits/checkout { packId }` → creates a Stripe **Checkout Session** (`mode: "payment"`, the pack's Price,
  `metadata: { type: "credit_purchase", userId, packId }`, success/cancel URLs) → `{ url }`. 402/400 if the pack has
  no configured price.
- **Webhook grant:** extend `processStripeEventOnce` (billing.ts) `checkout.session.completed` branch: if
  `session.mode === "payment"` and `metadata.type === "credit_purchase"`, grant `packCredits(packId)` to the user in
  a transaction, writing a `credit_transactions` row with `stripeEventId = event.id` (unique) so a retried webhook is
  a no-op. Credits are granted **only** here (never on the client redirect).

### Credit spend primitive (used by C) — `services/credits/spend.ts`
`spendCredits(userId, amount, reason, refId): Promise<{ ok: boolean; balance: number }>` — in a transaction: read
wallet, `applyLedger`, if ok write the decremented balance + a `spend` ledger row; return ok:false on insufficient
balance. C calls this to charge for a paid-channel entitlement.

## Error handling / edge cases
- Overspend → `applyLedger` returns `ok:false`; endpoint returns 402, no mutation.
- Webhook retry / duplicate event → `stripeEventId` unique conflict → no double-grant (onConflictDoNothing).
- Missing/garbage `packId` or unconfigured price → 400/402, no Checkout session.
- Account deletion → delete `credit_wallets` + `credit_transactions` for the user (credits forfeited, no cash value —
  ToS). Both tables have `user_id` → covered by `accountDeletion.coverage.static.test.ts`.

## Testing
- Pure: `ledger.test.ts` (`applyLedger` guards: normal debit/credit, overspend blocked, non-integer rejected;
  `packCredits`), run under tsx.
- Route/webhook: idempotent grant + spend need CI-DB + a Stripe test event — flagged for CI (like other billing
  tests). The Stripe **live purchase** is a **manual test-mode check by the user** (needs their Stripe keys + webhook).

## Activation (needs the user)
Set `STRIPE_CREDIT_PRICE_*` env (one Stripe Price per pack, `mode=payment`); the webhook already exists. Until set,
`GET /credits/packs` returns `priceConfigured:false` and the buy UI shows "coming soon" — the feature ships dark.

## Out of scope
- Per-channel pricing/paywall + spending (C — next spec).
- Real-money creator payout / cash-out (D — deferred, compliance).
- Promo codes, gifting, subscriptions-in-credits (YAGNI).
