import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const {
  getPlanFromSubscription,
  getStripeBillingConfig,
  isProSubscription,
  maskStripeId,
  getBillingCapabilities,
  paymentRequiredBody,
} = await import("./billing.js");

assert.equal(isProSubscription({ plan: "pro", status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false }), true);
assert.equal(isProSubscription({ plan: "pro", status: "trialing", currentPeriodEnd: null, cancelAtPeriodEnd: false }), true);
assert.equal(isProSubscription({ plan: "pro", status: "past_due", currentPeriodEnd: null, cancelAtPeriodEnd: false }), false);
assert.equal(isProSubscription({ plan: "free", status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false }), false);
assert.equal(isProSubscription(null), false);

assert.equal(getPlanFromSubscription({ plan: "pro", status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false }), "pro");
assert.equal(getPlanFromSubscription({ plan: "pro", status: "canceled", currentPeriodEnd: null, cancelAtPeriodEnd: false }), "free");
assert.equal(getPlanFromSubscription(null), "free");

assert.equal(maskStripeId("sub_1234567890abcdef"), "sub_...cdef");
assert.equal(maskStripeId(null), null);

assert.deepEqual(getBillingCapabilities(null), {
  canCancel: false,
  canResume: false,
  canViewInvoices: false,
});
assert.deepEqual(getBillingCapabilities({
  plan: "pro",
  status: "active",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  stripeCustomerId: "cus_123",
  stripeSubscriptionId: "sub_123",
}), {
  canCancel: true,
  canResume: false,
  canViewInvoices: true,
});
assert.deepEqual(getBillingCapabilities({
  plan: "pro",
  status: "active",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: true,
  stripeCustomerId: "cus_123",
  stripeSubscriptionId: "sub_123",
}), {
  canCancel: false,
  canResume: true,
  canViewInvoices: true,
});

assert.deepEqual(paymentRequiredBody("backtest"), {
  error: "pro_required",
  feature: "backtest",
  message: "Passa a Pro per accedere a questa funzione.",
});

{
  const config = getStripeBillingConfig({
    STRIPE_SECRET_KEY: "sk_test_123",
    STRIPE_WEBHOOK_SECRET: "whsec_123",
    STRIPE_PRO_MONTHLY_PRICE_ID: "price_123",
    APP_BASE_URL: "https://app.traderloadings.test/",
  });
  assert.equal(config.configured, true);
  assert.equal(config.secretKey, "sk_test_123");
  assert.equal(config.webhookSecret, "whsec_123");
  assert.equal(config.priceId, "price_123");
  assert.equal(config.appBaseUrl, "https://app.traderloadings.test");
}

{
  const config = getStripeBillingConfig({});
  assert.equal(config.configured, false);
  assert.deepEqual(config.missing.sort(), ["APP_BASE_URL", "STRIPE_PRO_MONTHLY_PRICE_ID", "STRIPE_SECRET_KEY"].sort());
}

console.log("billing helper checks passed");
