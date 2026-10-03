# Creator payout — design (sub-project D)

> Final leg of the community monetization arc (A private+join, B credit wallet, C paid
> channels — all shipped). **D lets a creator convert earned in-app credits into real money**
> paid to their bank via **Stripe Connect Express**. Highest-stakes tier (money *out*), so it
> is **dark by default** and never enabled autonomously.

**Date:** 2026-07-09 · **Branch:** `feat/community-management` · **Status:** design

## 1. Goal

A creator who has earned credits (C channel sales flow credits into their wallet) can **cash
out**: onboard a Stripe Connect **Express** account (Stripe handles KYC / identity / tax forms /
AML), then request a payout that **spends credits** from their wallet and creates a **Stripe
Transfer** of the equivalent real money (minus a platform fee) to their connected account.

This closes the user's original vision — credits are "convertibile poi in saldo sul proprio
conto." Until D is configured+enabled the earned credits simply stay spendable in-app (today's
behavior), so shipping D changes nothing until the operator turns it on.

## 2. Decisions (fixed) & non-goals

**Fixed:** Payout rail = **Stripe Connect Express** (Stripe owns onboarding, KYC, 1099/DAC7 tax
forms, and most AML). Economics are **config-driven** (env), never hardcoded:

- `PAYOUT_CREDIT_CENTS` — payout-currency **cents per 1 credit** (integer). **Unset ⇒ payouts
  disabled** (the whole feature stays dark). e.g. `1` ⇒ 1 credit = €0.01.
- `PAYOUT_MIN_CREDITS` — minimum credits per request (default 1000).
- `PAYOUT_FEE_BPS` — platform fee in basis points, taken from the gross (default 0).
- `PAYOUT_CURRENCY` — ISO currency (default `eur`).
- Reuses `STRIPE_SECRET_KEY` + `APP_BASE_URL` from `getStripeBillingConfig()`; the webhook reuses
  the existing billing webhook + `STRIPE_WEBHOOK_SECRET`.

**Non-goals (YAGNI):** no multi-currency per creator, no instant payouts, no in-app tax-form
generation (Stripe Express does it), no automatic scheduled payouts (creator-initiated only), no
credit *refunds* to buyers from a creator's balance. Credits keep the B guarantee (no cash value
to the *buyer*; only a creator's *earned* balance is cashable, and only via this flow).

## 3. Data model (migration 0030)

### 3.1 `creator_payout_accounts`
```
id                serial pk
user_id           text not null          -- unique
stripe_account_id text not null
payouts_enabled   boolean not null default false   -- Stripe capability gate
details_submitted boolean not null default false   -- finished onboarding
status            text not null default 'pending'  -- pending | verified | restricted
created_at        timestamp not null default now()
updated_at        timestamp not null default now()
```
`uniqueIndex (user_id)` — one Connect account per creator.

### 3.2 `creator_payouts` (the payout ledger)
```
id                 serial pk
user_id            text not null
credits            integer not null       -- credits spent
gross_cents        integer not null       -- credits × PAYOUT_CREDIT_CENTS
fee_cents          integer not null       -- platform fee
net_cents          integer not null       -- transferred to the creator
currency           text not null
stripe_transfer_id text                   -- set once the Transfer is created (unique)
status             text not null default 'pending'  -- pending | paid | failed | refunded
created_at         timestamp not null default now()
```
`index (user_id, created_at)`, `uniqueIndex (stripe_transfer_id)` (NULLs distinct).

Both tables carry `text("user_id")` ⇒ the GDPR coverage test forces them into `accountDeletion.ts`.

## 4. Pure core — `services/payout/payoutMath.ts` (TDD)
```ts
export interface PayoutConfig {
  creditCents: number | null;   // null ⇒ disabled
  minCredits: number;
  feeBps: number;
  currency: string;
}
export function isPayoutConfigured(c: PayoutConfig): boolean;         // creditCents a positive int

// gross = credits × creditCents; fee = floor(gross × feeBps / 10000); net = gross − fee.
export function computePayout(args: { credits: number; creditCents: number; feeBps: number }):
  { grossCents: number; feeCents: number; netCents: number };

// ok only if enabled, credits a positive int ≥ minCredits, ≤ balance, and net > 0.
export function validatePayoutRequest(args: {
  credits: number; balance: number; config: PayoutConfig;
}): { ok: true } | { ok: false; reason: "disabled" | "below_min" | "insufficient" | "invalid" | "zero_net" };
```
`readPayoutConfig(env)` (thin, non-pure) maps env → `PayoutConfig`.

## 5. Money-out flow — `services/payout/payoutService.ts`

**Reserve → external call → compensate** (saga), so a failed Transfer never loses a creator's credits:

1. `validatePayoutRequest`; require an onboarded account with `payouts_enabled`.
2. **Reserve:** in one tx, `spendCredits(userId, credits, refId)` (fails → 402) and insert a
   `creator_payouts` row `status='pending'` with the computed gross/fee/net. (Advisory-lock per
   user like C, so two concurrent requests can't double-spend the same balance.)
3. **Transfer:** `stripe.transfers.create({ amount: netCents, currency, destination: stripeAccountId },
   { idempotencyKey: 'payout:'+payoutRowId })` — the idempotency key makes a retry safe.
4. **Settle:** on success → `status='paid'`, set `stripe_transfer_id`. On a terminal Stripe error →
   **compensate**: `grantCredits(userId, credits, 'refund', {refId})` and `status='failed'` (so the
   creator keeps their credits). Network-ambiguous errors keep `pending` for a reconcile job (out of
   Phase-1 scope; logged).

## 6. Endpoints — `routes/payout.ts` (off-contract)
- `GET  /payout/config` — `{ enabled, creditCents, minCredits, feeBps, currency }` for the UI rate.
- `GET  /payout/account` — `{ onboarded, payoutsEnabled, detailsSubmitted, status }` for the viewer.
- `POST /payout/account/onboard` — create-or-reuse the Connect Express account, return a Stripe
  **Account Link** onboarding `url` (refresh/return to `APP_BASE_URL/settings?section=abbonamento`).
- `POST /payout/request { credits }` — runs the saga (§5). 402 insufficient / 400 below-min-or-
  disabled / 409 account-not-ready / 502 transfer-failed(refunded).

## 7. Webhook — extend `routes/billing.ts` `handleStripeEvent`
Add an `account.updated` branch: upsert `creator_payout_accounts` for `event.account`, setting
`payouts_enabled = account.payouts_enabled`, `details_submitted = account.details_submitted`, and
`status` (verified when payouts_enabled, else restricted/pending). Dedup stays via
`processStripeEventOnce`.

## 8. GDPR & compliance note
`accountDeletion.ts`: `DELETE FROM creator_payouts` + `creator_payout_accounts WHERE user_id`.
Stripe **retains** its own account/transfer records for legal/tax obligations — deleting our rows
removes our copy of the linkage; we do not (and cannot) purge Stripe's ledger. This is the correct
GDPR posture (erase our PII; regulated financial records live at the processor).

## 9. Frontend — `components/settings/CreatorPayoutSettings.tsx`
In Settings → *abbonamento* (next to the credits card). States:
- **Disabled** (config off) → hidden entirely (dark).
- **Not onboarded** → "Cash out your credits" + est. value + **Onboard** button (→ Account Link).
- **Onboarding incomplete** (`details_submitted=false`) → "Finish setup" (re-link).
- **Enabled** → balance in credits + est. €, a request form (credits → shows net after fee), submit.
i18n ×5 (`payout.*`), respecting parity + mojibake gates.

## 10. Testing & rollout
- Pure core (`payoutMath.ts`) fully unit-tested: computePayout rounding, fee edges, every
  `validatePayoutRequest` branch, `isPayoutConfigured`.
- Saga guards testable without Stripe (validation, config-disabled, below-min); the live Transfer +
  Connect onboarding are **manual, in Stripe TEST mode**, by the operator.
- Gate: BE/FE tsc, GDPR coverage (both tables), i18n parity + production-copy, lib/db rebuild.
- **Dark by default:** with `PAYOUT_CREDIT_CENTS` unset, every endpoint reports disabled and the UI
  hides — so D ships inert and is turned on only after the operator verifies test-mode Connect.
- Adversarial multi-agent review of the money-out saga before declaring done (as with B/C).
