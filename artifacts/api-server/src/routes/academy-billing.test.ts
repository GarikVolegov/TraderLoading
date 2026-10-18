import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";
const { createAcademyBillingRouter } = await import("./academy-billing.js");
const actions: string[] = [];
const status = { active: false, status: "none", currentPeriodEnd: null, cancelAtPeriodEnd: false, salesEnabled: false, checkoutAvailable: false, canManage: false, canCancel: false, canResume: false, canManagePayouts: false,
  price: { amountCents: 15000, currency: "eur", interval: "month" }, affiliate: { enrolled: false, termsVersion: "2026-10-17", rateBps: 2000, holdDays: 30, code: null, link: null },
  commissions: { pendingCents: 0, availableCents: 0, paidCents: 0, currency: "eur" } };
const app = express();
app.use(express.json());
app.use((req, _res, next) => { if (req.header("x-user")) req.user = { id: req.header("x-user")!, email: null, firstName: null, lastName: null, profileImageUrl: null }; next(); });
app.use(createAcademyBillingRouter({
  status: async () => status,
  checkout: async user => { actions.push(`checkout:${user.id}`); throw Object.assign(new Error("closed"), { code: "academy_sales_unavailable", status: 503 }); },
  portal: async userId => { actions.push(`portal:${userId}`); return { url: "https://billing.stripe.com/session/test" }; },
  cancellation: async (userId, cancel) => { actions.push(`${cancel ? "cancel" : "resume"}:${userId}`); return { ...status, cancelAtPeriodEnd: cancel }; },
  enroll: async userId => { actions.push(`enroll:${userId}`); return { userId, code: "AC0123456789ABCDEF", termsVersion: "2026-10-17", acceptedAt: new Date() }; },
  commissions: async userId => { actions.push(`commissions:${userId}`); return { currency: "eur", items: [] }; },
  adminGuard: (req, res, next) => { if (req.user?.id !== "admin") { res.status(403).json({ error: "forbidden" }); return; } next(); },
  payouts: async () => ({ currency: "eur", items: [] }),
  pay: async (ids, actor) => { actions.push(`pay:${actor}:${ids.join(",")}`); return { items: ids.map(commissionId => ({ commissionId, status: "processed" })) }; },
}));
const server = createServer(app);
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");
const base = `http://127.0.0.1:${address.port}`;
async function request(path: string, user?: string, body?: unknown) {
  return fetch(`${base}${path}`, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", ...(user ? { "x-user": user } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
try {
  for (const path of ["/academy/billing", "/academy/affiliate/commissions", "/academy/affiliate/payouts"]) assert.equal((await request(path)).status, 401);
  assert.equal((await request("/academy/billing/checkout", undefined, {})).status, 401);
  assert.equal((await request("/academy/affiliate/enroll", undefined, {})).status, 401);
  assert.deepEqual(await (await request("/academy/billing", "free-user")).json(), status);
  assert.equal((await request("/academy/affiliate/enroll", "free-user", { acceptedTerms: false, termsVersion: "2026-10-17" })).status, 400);
  assert.equal((await request("/academy/affiliate/enroll", "free-user", { acceptedTerms: true, termsVersion: "wrong" })).status, 400);
  assert.equal((await request("/academy/affiliate/enroll", "free-user", { acceptedTerms: true, termsVersion: "2026-10-17" })).status, 200, "affiliate enrollment requires no purchase");
  assert.equal(actions.filter(value => value.startsWith("enroll:")).length, 1);
  assert.equal((await request("/academy/billing/checkout", "buyer", { referralCode: "malformed" })).status, 400);
  assert.equal((await request("/academy/billing/checkout", "buyer", { referralCode: "AC0123456789ABCDEF" })).status, 503);
  assert.equal((await request("/academy/billing/portal", undefined, {})).status, 401);
  assert.equal((await request("/academy/billing/portal", "buyer", {})).status, 200);
  assert.ok(actions.includes("portal:buyer"));
  assert.equal((await request("/academy/billing/cancel", "buyer", {})).status, 200);
  assert.equal((await request("/academy/billing/resume", "buyer", {})).status, 200);
  assert.equal((await request("/academy/affiliate/commissions", "affiliate")).status, 200);
  assert.ok(actions.includes("commissions:affiliate"));
  assert.equal((await request("/academy/affiliate/payouts", "affiliate")).status, 403);
  assert.equal((await request("/academy/affiliate/payouts", "affiliate", { commissionIds: ["00000000-0000-0000-0000-000000000001"] })).status, 403);
  assert.equal((await request("/academy/affiliate/payouts", "admin", {})).status, 400, "explicit reviewed IDs required");
  assert.equal((await request("/academy/affiliate/payouts", "admin", { commissionIds: [] })).status, 400);
  assert.equal((await request("/academy/affiliate/payouts", "admin", { commissionIds: ["00000000-0000-0000-0000-000000000001"] })).status, 200);
  assert.ok(actions.includes("pay:admin:00000000-0000-0000-0000-000000000001"));
} finally { await new Promise<void>(resolve => server.close(() => resolve())); }
console.log("Academy billing HTTP authorization and consent checks passed");
