# Marketplace pivot — Stripe Connect direct payments (design)

> Supersedes the credit-wallet monetization (specs 2026-07-08/09 B/C/D). Paid communities
> become a **marketplace**: buyers pay per unlock in real €, Stripe Connect splits the
> creator's share **directly to the creator's connected account**, so the platform never
> custodies user funds → **no e-money license** required.

**Date:** 2026-07-10 · **Branch:** `feat/community-management` · **Status:** design

## 1. Goal & decisions

Creators earn real money from selling channel access and are paid out **by Stripe**; the
platform only ever takes an application fee. Confirmed decisions:
- **Remove the in-app credit system entirely** (wallet, credit purchase, credit-funded unlock,
  the custody-then-transfer payout saga) — these are exactly what triggered e-money regulation.
- **Support one-time AND subscription channels from v1.**

Why license-free: with Connect **destination charges** the buyer's card is charged, Stripe
routes the creator's share to *their* account and the fee to the platform, and Stripe holds &
pays out the creator's balance. The platform is a marketplace/facilitator (covered by Stripe's
licenses), not a money transmitter. Refunds/disputes are handled by Stripe/Connect. *(Not legal
advice — confirm jurisdictional structure + Stripe Connect terms.)*

## 2. Keep / remove

**Reused unchanged:**
- Private communities + owner-approved join (A).
- Channel entitlement model (`community_channel_entitlements`) + access gating
  (`services/community/channelAccess.ts` `canAccessChannel`/`isChannelFree`, `assertChannelAccess`
  + the WS/file/voice choke points).
- Stripe **Connect account** infra: `creator_payout_accounts` table + the onboarding/account
  functions in `services/payout/payoutService.ts` (`getOrCreateAccountId`, `createOnboardingLink`,
  `getAccountStatus`, `syncConnectAccount`) + the `account.updated` webhook branch.

**Removed:**
- `services/credits/*` (ledger, packs, wallet), `routes/credits.ts`.
- `services/community/channelUnlock.ts` (credit-funded) + the `POST /community/channels/:id/unlock`
  + pricing-in-credits endpoints.
- Payout **withdraw** path: `payoutMath.ts`, `payoutReconcile.ts`, `cron/payoutScheduler.ts`, and
  `requestPayout`/`getEarnedBalance`/`getCashableCredits` in `payoutService.ts`; `POST /payout/request`,
  `/payout/history`, `/payout/config`; the credit/payout FE (`CreditsSettingsSection`, `CreditActivity`,
  `CreatorPayoutSettings` cash-out UI, `PayoutHistory`, credit-based `ChannelUnlockPanel`).
- Tables dropped (migration): `credit_wallets`, `credit_transactions`, `creator_payouts`.
- Billing webhook: the `credit_purchase` grant + the chargeback credit-claw-back branches.

## 3. Data model (migration 0033 add, 0034 drop)

`community_channels` (0033): replace credit pricing with real-currency pricing:
```
price_cents        integer   NULL     -- NULL/<=0 ⇒ free
access_model       text      NULL     -- 'one_time' | 'subscription'
sub_interval       text      NULL     -- 'month' | 'year' (subscription only)
currency           text      NOT NULL DEFAULT 'eur'
stripe_price_id    text      NULL     -- lazily-created Connect Price for subscriptions
```
`community_channel_entitlements` (0033): add `stripe_subscription_id text` (nullable) so a
subscription's lifecycle (renew/cancel) maps back to the entitlement; `expires_at` continues to
gate access.

Drop (0034): `credit_wallets`, `credit_transactions`, `creator_payouts`. Keep
`creator_payout_accounts`.

## 4. Pure core — `services/community/channelPricing.ts` (TDD)
```ts
export const MAX_PRICE_CENTS = 99_999_999; // Stripe per-charge sanity ceiling
export interface ChannelPrice { priceCents: number | null; accessModel: string | null; subInterval: string | null; }
export function isChannelFree(c: { priceCents: number | null }): boolean;              // null/<=0
export function validateChannelPrice(p, cfg): { ok: true; normalized } | { ok: false; reason };
export function computeApplicationFee(priceCents: number, feeBps: number): number;      // floor(price×bps/10000)
```
(`isChannelFree`/`canAccessChannel` in `channelAccess.ts` switch from `priceCredits` to `priceCents`.)

## 5. Purchase flow — `services/community/channelCheckout.ts`

Requires the creator (community `creatorId`) to have a Connect account with `payouts_enabled`.
- **one_time:** `stripe.checkout.sessions.create({ mode:"payment", line_items:[{price_data:{currency,unit_amount:priceCents,product_data:{name}}, quantity:1}], payment_intent_data:{ application_fee_amount: fee, transfer_data:{ destination: creatorAccount } }, metadata:{ type:"channel_unlock", channelId, userId, communityId }, success_url, cancel_url })`.
- **subscription:** ensure a Connect Price exists for the channel (create + persist `stripe_price_id`);
  `mode:"subscription"`, `line_items:[{price: stripePriceId, quantity:1}]`,
  `subscription_data:{ application_fee_percent, transfer_data:{ destination: creatorAccount }, metadata:{ type:"channel_sub", channelId, userId } }`.
- Buyer must be a member and not banned (reuse the community checks); owner/`channels.manage` don't buy.

## 6. Webhook (extend `routes/billing.ts` `handleStripeEvent`)
- `checkout.session.completed` with `metadata.type==="channel_unlock"` → upsert a permanent
  entitlement (one-time). With `type==="channel_sub"` the subscription id is on the session →
  grant entitlement with `expires_at = current_period_end`, store `stripe_subscription_id`.
- `customer.subscription.updated`/`deleted` → find the entitlement by `stripe_subscription_id`,
  set `expires_at = current_period_end` (renewal) or revoke (canceled/unpaid).
- `invoice.paid` (subscription renewal) → extend `expires_at`.
- Dedup stays via `processStripeEventOnce`.

## 7. Endpoints — `routes/communityChannels.ts` (reworked)
- `PATCH /community/channels/:id/pricing` — `channels.manage`; `validateChannelPrice`; store cents.
- `POST /community/channels/:id/checkout` — member-only; returns Stripe Checkout `url`.
- `GET /community/channels/:id/access` — per-viewer state (priceCents/model/locked/entitlement).
- Connect (kept, `routes/payout.ts` → rename intent to "creator account"): `GET /payout/account`,
  `POST /payout/account/onboard`, plus a **Stripe Express dashboard login link**
  (`stripe.accounts.createLoginLink`) so creators manage payouts.

## 8. Frontend
- **Pricing editor**: price in € (not credits), one-time / subscription (+ interval).
- **Locked channel** → `ChannelUnlockPanel` shows the € price and a "Buy access" button →
  `POST checkout` → redirect to Stripe.
- **Creator card** (was payout): onboard Connect → once enabled, show "You're set to receive
  payments" + a Stripe dashboard button. No cash-out form (Stripe pays out).
- Remove credit wallet / buy-credits / cash-out / history UIs. i18n ×5.

## 9. Config & rollout
- `PLATFORM_FEE_BPS` (application fee, default 0). Reuses `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`.
- **Dark by default:** a channel is free unless a creator sets a price AND has a payouts-enabled
  Connect account; without Stripe keys the checkout endpoint 402s. No new global flag needed.
- Stripe webhook must add: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`,
  `account.updated`, `charge.refunded`/`charge.dispute.created` (Stripe handles the money reversal).

## 10. Phasing
1. Pure `channelPricing.ts` + schema 0033 (add cents/subscription fields).
2. `channelCheckout.ts` + `POST /checkout` + webhook grant (one-time), gating switched to cents.
3. Subscription support (Price creation + subscription webhooks).
4. FE rework (pricing €, buy-access, creator account card) + i18n.
5. Remove dead credit/payout code + drop tables (migration 0034).
6. Adversarial review of the money-in path; full-suite gate.
