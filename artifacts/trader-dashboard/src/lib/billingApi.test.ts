import assert from "node:assert/strict";
import {
  billingQueryKey,
  createCheckoutSession,
  fetchBillingStatus,
} from "./billingApi.js";

const originalFetch = globalThis.fetch;
const calls: Array<{ url: RequestInfo | URL; init?: RequestInit }> = [];

globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
  calls.push({ url, init });
  if (String(url).endsWith("/billing/me")) {
    return Response.json({ plan: "free", pro: false, status: "free" });
  }
  return Response.json({ clientSecret: "cs_test_123" });
}) as typeof fetch;

try {
  assert.deepEqual(billingQueryKey, ["/api/billing/me"]);

  const status = await fetchBillingStatus({ basePath: "/" });
  assert.equal(calls[0]?.url, "/api/billing/me");
  assert.equal(status.plan, "free");
  assert.equal(status.pro, false);

  const checkout = await createCheckoutSession({ basePath: "/" });
  assert.equal(calls[1]?.url, "/api/billing/checkout-session");
  assert.equal(calls[1]?.init?.method, "POST");
  assert.equal(checkout.clientSecret, "cs_test_123");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("billing api checks passed");
