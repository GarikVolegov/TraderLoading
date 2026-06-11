import assert from "node:assert/strict";
import {
  billingStatusQueryOptions,
  billingQueryKey,
  cancelSubscription,
  createCheckoutSession,
  fetchBillingStatus,
  fetchBillingInvoices,
  resumeSubscription,
} from "./billingApi.js";

const originalFetch = globalThis.fetch;
const calls: Array<{ url: RequestInfo | URL; init?: RequestInit }> = [];

globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
  calls.push({ url, init });
  if (String(url).endsWith("/billing/me")) {
    return Response.json({
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
  }
  if (String(url).endsWith("/billing/invoices")) {
    return Response.json({
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
  }
  if (String(url).endsWith("/billing/cancel") || String(url).endsWith("/billing/resume")) {
    return Response.json({ plan: "pro", pro: true, status: "active", cancelAtPeriodEnd: String(url).endsWith("/billing/cancel") });
  }
  return Response.json({ clientSecret: "cs_test_123" });
}) as typeof fetch;

try {
  assert.deepEqual(billingQueryKey, ["/api/billing/me"]);
  assert.equal(billingStatusQueryOptions().staleTime, 0);
  assert.equal(billingStatusQueryOptions().refetchOnMount, "always");
  assert.equal(billingStatusQueryOptions().refetchOnReconnect, "always");
  assert.equal(billingStatusQueryOptions().refetchOnWindowFocus, "always");

  const status = await fetchBillingStatus({ basePath: "/" });
  assert.equal(calls[0]?.url, "/api/billing/me");
  assert.equal(status.plan, "free");
  assert.equal(status.pro, false);
  assert.equal(status.source, null);
  assert.equal(status.manualOverride, false);

  const checkout = await createCheckoutSession({ basePath: "/" });
  assert.equal(calls[1]?.url, "/api/billing/checkout-session");
  assert.equal(calls[1]?.init?.method, "POST");
  assert.equal(checkout.clientSecret, "cs_test_123");

  const canceled = await cancelSubscription({ basePath: "/" });
  assert.equal(calls[2]?.url, "/api/billing/cancel");
  assert.equal(calls[2]?.init?.method, "POST");
  assert.equal(canceled.cancelAtPeriodEnd, true);

  const resumed = await resumeSubscription({ basePath: "/" });
  assert.equal(calls[3]?.url, "/api/billing/resume");
  assert.equal(calls[3]?.init?.method, "POST");
  assert.equal(resumed.cancelAtPeriodEnd, false);

  const invoices = await fetchBillingInvoices({ basePath: "/" });
  assert.equal(calls[4]?.url, "/api/billing/invoices");
  assert.equal(invoices.invoices[0]?.amountPaid, 700);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("billing api checks passed");
