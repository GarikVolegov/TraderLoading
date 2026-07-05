import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const {
  createBillingRouter,
  shouldPreserveManualSubscriptionOverride,
  processStripeEventOnce,
  subscriptionCurrentPeriodEnd,
  invoiceSubscriptionId,
} = await import("./billing.js");

// currentPeriodEnd moved from the Subscription top level to the SubscriptionItem
// in the pinned API (2026-05-27.dahlia). Read it from the item, ignore the
// legacy top-level field (which is now always undefined).
assert.equal(subscriptionCurrentPeriodEnd({ items: { data: [{ current_period_end: 1234 }] } } as never), 1234);
assert.equal(subscriptionCurrentPeriodEnd({ items: { data: [] } } as never), null);
assert.equal(
  subscriptionCurrentPeriodEnd({ current_period_end: 999, items: { data: [{ current_period_end: 555 }] } } as never),
  555,
);

// The invoice's subscription id moved to invoice.parent.subscription_details.
assert.equal(invoiceSubscriptionId({ parent: { subscription_details: { subscription: "sub_1" } } } as never), "sub_1");
assert.equal(invoiceSubscriptionId({ parent: { subscription_details: { subscription: { id: "sub_2" } } } } as never), "sub_2");
assert.equal(invoiceSubscriptionId({ parent: null } as never), null);
assert.equal(invoiceSubscriptionId({} as never), null);

assert.equal(
  shouldPreserveManualSubscriptionOverride({
    source: "manual",
    manualOverride: false,
  }),
  false,
);
assert.equal(
  shouldPreserveManualSubscriptionOverride({
    source: "manual",
    manualOverride: true,
  }),
  true,
);
assert.equal(
  shouldPreserveManualSubscriptionOverride({
    source: "stripe",
    manualOverride: false,
  }),
  false,
);

// Stripe webhook idempotency control flow: each event id is processed at most
// once. A retried (duplicate) delivery is acked without re-running side effects;
// a processing failure releases the claim so Stripe's next retry can re-process.
{
  const handled: string[] = [];
  const released: string[] = [];
  const first = await processStripeEventOnce(
    { id: "evt_1", type: "customer.subscription.updated" },
    {
      claim: async () => true,
      release: async (id: string) => {
        released.push(id);
      },
      handle: async () => {
        handled.push("evt_1");
      },
    },
  );
  assert.deepEqual(first, { processed: true, duplicate: false });
  assert.deepEqual(handled, ["evt_1"]);
  assert.deepEqual(released, []);

  const dupHandled: string[] = [];
  const dup = await processStripeEventOnce(
    { id: "evt_1", type: "customer.subscription.updated" },
    {
      claim: async () => false,
      release: async () => {},
      handle: async () => {
        dupHandled.push("x");
      },
    },
  );
  assert.deepEqual(dup, { processed: false, duplicate: true });
  assert.deepEqual(dupHandled, []);

  const releasedOnFail: string[] = [];
  await assert.rejects(
    () =>
      processStripeEventOnce(
        { id: "evt_2", type: "invoice.payment_succeeded" },
        {
          claim: async () => true,
          release: async (id: string) => {
            releasedOnFail.push(id);
          },
          handle: async () => {
            throw new Error("boom");
          },
        },
      ),
    /boom/,
  );
  assert.deepEqual(releasedOnFail, ["evt_2"]);
}

async function startBillingServer(options = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      id: "user-billing",
      email: "user@example.test",
      firstName: null,
      lastName: null,
      profileImageUrl: null,
    };
    next();
  });
  app.use("/api", createBillingRouter(options as never));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    base: `http://127.0.0.1:${address.port}/api`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

{
  const server = await startBillingServer({ getSubscription: async () => null });
  try {
    const response = await fetch(`${server.base}/billing/me`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      plan: "free",
      pro: false,
      status: "free",
      source: null,
      manualOverride: false,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      canCancel: false,
      canResume: false,
      canViewInvoices: false,
    });
  } finally {
    await server.close();
  }
}

{
  const server = await startBillingServer({
    getSubscription: async () => ({
      plan: "pro",
      status: "active",
      source: "stripe",
      manualOverride: false,
      stripeCustomerId: "cus_1234567890",
      stripeSubscriptionId: "sub_1234567890",
      currentPeriodEnd: new Date("2026-07-10T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
    }),
  });
  try {
    const response = await fetch(`${server.base}/billing/me`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      plan: string;
      pro: boolean;
      status: string;
      source: string | null;
      manualOverride: boolean;
      stripeCustomerId: string;
      stripeSubscriptionId: string;
      canCancel: boolean;
      canResume: boolean;
      canViewInvoices: boolean;
    };
    assert.equal(body.plan, "pro");
    assert.equal(body.pro, true);
    assert.equal(body.status, "active");
    assert.equal(body.source, "stripe");
    assert.equal(body.manualOverride, false);
    assert.equal(body.stripeCustomerId, "cus_1234567890");
    assert.equal(body.stripeSubscriptionId, "sub_...7890");
    assert.equal(body.canCancel, true);
    assert.equal(body.canResume, false);
    assert.equal(body.canViewInvoices, true);
  } finally {
    await server.close();
  }
}

{
  const server = await startBillingServer({
    getSubscription: async () => ({
      plan: "pro",
      status: "active",
      source: "manual",
      manualOverride: true,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    }),
  });
  try {
    const response = await fetch(`${server.base}/billing/me`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      plan: string;
      pro: boolean;
      status: string;
      source: string | null;
      manualOverride: boolean;
      canCancel: boolean;
      canResume: boolean;
      canViewInvoices: boolean;
    };
    assert.equal(body.plan, "pro");
    assert.equal(body.pro, true);
    assert.equal(body.status, "active");
    assert.equal(body.source, "manual");
    assert.equal(body.manualOverride, true);
    assert.equal(body.canCancel, false);
    assert.equal(body.canResume, false);
    assert.equal(body.canViewInvoices, false);
  } finally {
    await server.close();
  }
}

{
  const server = await startBillingServer({
    config: { configured: false, missing: ["STRIPE_SECRET_KEY"], appBaseUrl: "http://localhost" },
  });
  try {
    const response = await fetch(`${server.base}/billing/checkout-session`, { method: "POST" });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "stripe_not_configured", missing: ["STRIPE_SECRET_KEY"] });
  } finally {
    await server.close();
  }
}

{
  const actions: string[] = [];
  const server = await startBillingServer({
    getSubscription: async () => ({
      plan: "pro",
      status: "active",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      currentPeriodEnd: new Date("2026-07-10T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
    }),
    cancelSubscription: async (userId: string, subscriptionId: string) => {
      actions.push(`cancel:${userId}:${subscriptionId}`);
      return {
        plan: "pro",
        status: "active",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        currentPeriodEnd: new Date("2026-07-10T00:00:00.000Z"),
        cancelAtPeriodEnd: true,
      };
    },
    resumeSubscription: async (userId: string, subscriptionId: string) => {
      actions.push(`resume:${userId}:${subscriptionId}`);
      return {
        plan: "pro",
        status: "active",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        currentPeriodEnd: new Date("2026-07-10T00:00:00.000Z"),
        cancelAtPeriodEnd: false,
      };
    },
  } as never);
  try {
    const cancelResponse = await fetch(`${server.base}/billing/cancel`, { method: "POST" });
    assert.equal(cancelResponse.status, 200);
    const cancelBody = (await cancelResponse.json()) as { cancelAtPeriodEnd: boolean; canResume: boolean };
    assert.equal(cancelBody.cancelAtPeriodEnd, true);
    assert.equal(cancelBody.canResume, true);

    const resumeResponse = await fetch(`${server.base}/billing/resume`, { method: "POST" });
    assert.equal(resumeResponse.status, 200);
    const resumeBody = (await resumeResponse.json()) as { cancelAtPeriodEnd: boolean; canCancel: boolean };
    assert.equal(resumeBody.cancelAtPeriodEnd, false);
    assert.equal(resumeBody.canCancel, true);
    assert.deepEqual(actions, ["cancel:user-billing:sub_123", "resume:user-billing:sub_123"]);
  } finally {
    await server.close();
  }
}

{
  const server = await startBillingServer({
    getSubscription: async () => ({
      plan: "pro",
      status: "active",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    }),
    listInvoices: async (userId: string, customerId: string) => {
      assert.equal(userId, "user-billing");
      assert.equal(customerId, "cus_123");
      return [
        {
          id: "in_123",
          number: "INV-001",
          status: "paid",
          amountPaid: 700,
          currency: "eur",
          hostedInvoiceUrl: "https://stripe.test/invoice/in_123",
          periodStart: "2026-06-10T00:00:00.000Z",
          periodEnd: "2026-07-10T00:00:00.000Z",
        },
      ];
    },
  } as never);
  try {
    const response = await fetch(`${server.base}/billing/invoices`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      invoices: [
        {
          id: "in_123",
          number: "INV-001",
          status: "paid",
          amountPaid: 700,
          currency: "eur",
          hostedInvoiceUrl: "https://stripe.test/invoice/in_123",
          periodStart: "2026-06-10T00:00:00.000Z",
          periodEnd: "2026-07-10T00:00:00.000Z",
        },
      ],
    });
  } finally {
    await server.close();
  }
}

{
  const server = await startBillingServer({
    config: {
      configured: true,
      missing: [],
      secretKey: "sk_test_123",
      priceId: "price_123",
      appBaseUrl: "http://localhost",
    },
    createCheckoutSession: async () => ({ clientSecret: "cs_test_123" }),
  });
  try {
    const response = await fetch(`${server.base}/billing/checkout-session`, { method: "POST" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { clientSecret: "cs_test_123" });
  } finally {
    await server.close();
  }
}

console.log("billing route checks passed");
