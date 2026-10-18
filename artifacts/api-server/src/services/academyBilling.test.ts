import assert from "node:assert/strict";
import type Stripe from "stripe";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";
const { getAcademyConfig, isAcademyPrice, isAcademyEntitled, isAcademySubscription, academyCommissionCents, academyReversedCents, handleAcademyStripeEvent } = await import("./academyBilling.js");

assert.equal(getAcademyConfig({}).configured, false);
assert.equal(getAcademyConfig({ ACADEMY_SALES_ENABLED: "1" }).salesEnabled, false);
assert.equal(getAcademyConfig({ ACADEMY_SALES_ENABLED: "true" }).salesEnabled, true);
assert.equal(getAcademyConfig({ STRIPE_SECRET_KEY: "sk_test", STRIPE_ACADEMY_MONTHLY_PRICE_ID: "price_150", APP_BASE_URL: "https://academy.test" }).configured, false, "webhook signing is required before sales");

const price = { active: true, currency: "eur", unit_amount: 15000, recurring: { interval: "month", interval_count: 1, usage_type: "licensed" }, tax_behavior: "inclusive", type: "recurring" } as Stripe.Price;
assert.equal(isAcademyPrice(price), true);
for (const change of [{ active: false }, { currency: "usd" }, { unit_amount: 14999 }, { unit_amount: 18000 }, { tax_behavior: "exclusive" }, { tax_behavior: "unspecified" }, { recurring: { interval: "year", interval_count: 1, usage_type: "licensed" } }, { recurring: { interval: "month", interval_count: 2, usage_type: "licensed" } }, { recurring: { interval: "month", interval_count: 1, usage_type: "metered" } }]) {
  assert.equal(isAcademyPrice({ ...price, ...change } as Stripe.Price), false);
}
const now = new Date("2026-10-18T00:00:00Z");
const paid = { status: "active", paidThrough: new Date("2026-11-18T00:00:00Z"), paymentRevoked: false };
assert.equal(isAcademyEntitled(paid, now), true);
assert.equal(isAcademyEntitled(null, now), false);
for (const change of [{ status: "trialing" }, { status: "past_due" }, { status: "canceled" }, { paidThrough: null }, { paidThrough: now }, { paymentRevoked: true }]) {
  assert.equal(isAcademyEntitled({ ...paid, ...change }, now), false);
}
assert.equal(isAcademySubscription({ metadata: { type: "academy" }, items: { data: [] } } as never), true);
assert.equal(isAcademySubscription({ metadata: { type: "channel_sub" }, items: { data: [] } } as never), false);
assert.equal(isAcademySubscription({ metadata: { userId: "user_pro" }, items: { data: [] } } as never), false);
assert.equal(academyCommissionCents(15000), 3000, "20% of gross, VAT included");
assert.equal(academyCommissionCents(7500), 1500);
assert.equal(academyCommissionCents(0), 0);
assert.equal(academyCommissionCents(1), 0);
for (const invalid of [-1, 1.5, Infinity, NaN]) assert.throws(() => academyCommissionCents(invalid));
const row = { grossPaidCents: 15000, amountCents: 3000, reversedCents: 0 };
assert.equal(academyReversedCents(row, 5000, false), 1000);
assert.equal(academyReversedCents(row, 1, false), 1, "remaining commission never exceeds 20% of net collected cents");
assert.equal(academyReversedCents({ ...row, reversedCents: 1000 }, 5000, false), 1000, "duplicate refund is cumulative");
assert.equal(academyReversedCents({ ...row, reversedCents: 1000 }, 1000, false), 1000, "old refund cannot regress reversal");
assert.equal(academyReversedCents(row, 15000, false), 3000);
assert.equal(academyReversedCents(row, 17000, false), 3000);
assert.equal(academyReversedCents(row, 0, true), 3000);
assert.equal(academyReversedCents({ ...row, amountCents: 0 }, 15000, true), 0, "unattributed invoices pay no commission");
// Non-Academy metadata is not consumed by this product dispatcher.
assert.equal(await handleAcademyStripeEvent({ type: "checkout.session.completed", data: { object: { metadata: { type: "channel_sub" } } } } as never, {} as never), false);
assert.equal(await handleAcademyStripeEvent({ type: "account.updated", data: { object: {} } } as never, {} as never), false);
console.log("Academy billing price, access, commission and dispatch checks passed");
