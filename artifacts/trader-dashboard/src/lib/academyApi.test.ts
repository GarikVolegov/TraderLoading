import assert from "node:assert/strict";
import { academyAuthDestination, validAcademyReferral } from "./academyReferral.js";
import {
  academyCheckout,
  payAcademyCommissions,
  reviewAcademySubmission,
  stripeRedirectUrl,
} from "./academyApi.js";

assert.equal(validAcademyReferral("ac0123456789abcdef"), "AC0123456789ABCDEF");
assert.equal(validAcademyReferral("https://other.test"), null);
assert.equal(
  academyAuthDestination("academy=1&academy_ref=AC0123456789ABCDEF"),
  "/academy?ref=AC0123456789ABCDEF",
);
assert.equal(academyAuthDestination("academy=1&redirect_url=https://other.test"), "/academy");
assert.equal(academyAuthDestination("redirect_url=https://other.test"), null);
for (const url of [
  "https://checkout.stripe.com/c/test",
  "https://connect.stripe.com/express/test",
  "https://billing.stripe.com/p/session/test",
])
  assert.equal(stripeRedirectUrl(url), url);
for (const url of [
  "javascript:alert(1)",
  "http://checkout.stripe.com",
  "https://checkout.stripe.com.evil.test",
  "https://someone@checkout.stripe.com/",
])
  assert.throws(() => stripeRedirectUrl(url));

const originalFetch = globalThis.fetch;
const calls: Array<{ url: string; body: unknown }> = [];
globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
  calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "null")) });
  return Response.json({ items: [] });
}) as typeof fetch;
try {
  await academyCheckout("AC0123456789ABCDEF");
  await reviewAcademySubmission("submission-1", "feedback", "2026-10-18T00:00:00.000Z");
  await payAcademyCommissions(["commission-1"]);
  assert.deepEqual(calls[0].body, { referralCode: "AC0123456789ABCDEF" });
  assert.deepEqual(calls[1].body, {
    feedback: "feedback",
    submittedAt: "2026-10-18T00:00:00.000Z",
  });
  assert.deepEqual(calls[2].body, { commissionIds: ["commission-1"] });
} finally {
  globalThis.fetch = originalFetch;
}
console.log(
  "Academy client: explicit attribution, safe destinations and mutation contracts passed.",
);
