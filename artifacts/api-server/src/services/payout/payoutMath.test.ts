import assert from "node:assert/strict";
import { isPayoutConfigured, computePayout, validatePayoutRequest } from "./payoutMath.js";

// ── isPayoutConfigured — creditCents must be a positive integer ──────────────
assert.equal(isPayoutConfigured({ creditCents: null, minCredits: 1000, feeBps: 0, currency: "eur" }), false);
assert.equal(isPayoutConfigured({ creditCents: 0, minCredits: 1000, feeBps: 0, currency: "eur" }), false);
assert.equal(isPayoutConfigured({ creditCents: -1, minCredits: 1000, feeBps: 0, currency: "eur" }), false);
assert.equal(isPayoutConfigured({ creditCents: 1.5, minCredits: 1000, feeBps: 0, currency: "eur" }), false);
assert.equal(isPayoutConfigured({ creditCents: 1, minCredits: 1000, feeBps: 0, currency: "eur" }), true);

// ── computePayout — gross = credits×creditCents; fee floored; net = gross−fee ─
assert.deepEqual(computePayout({ credits: 1000, creditCents: 1, feeBps: 0 }), { grossCents: 1000, feeCents: 0, netCents: 1000 });
assert.deepEqual(computePayout({ credits: 1000, creditCents: 2, feeBps: 1000 }), { grossCents: 2000, feeCents: 200, netCents: 1800 }); // 10% fee
// fee floors (999 × 250bps = 24.975 → 24)
assert.deepEqual(computePayout({ credits: 999, creditCents: 1, feeBps: 250 }), { grossCents: 999, feeCents: 24, netCents: 975 });

// ── validatePayoutRequest ────────────────────────────────────────────────────
const cfg = { creditCents: 1, minCredits: 1000, feeBps: 0, currency: "eur" };
assert.deepEqual(validatePayoutRequest({ credits: 1000, balance: 5000, config: cfg }), { ok: true });
assert.deepEqual(validatePayoutRequest({ credits: 1000, balance: 5000, config: { ...cfg, creditCents: null } }), { ok: false, reason: "disabled" });
assert.deepEqual(validatePayoutRequest({ credits: 0, balance: 5000, config: cfg }), { ok: false, reason: "invalid" });
assert.deepEqual(validatePayoutRequest({ credits: 10.5, balance: 5000, config: cfg }), { ok: false, reason: "invalid" });
assert.deepEqual(validatePayoutRequest({ credits: 500, balance: 5000, config: cfg }), { ok: false, reason: "below_min" });
assert.deepEqual(validatePayoutRequest({ credits: 2000, balance: 1000, config: cfg }), { ok: false, reason: "insufficient" });
// zero_net: a 100% fee leaves nothing to transfer
assert.deepEqual(validatePayoutRequest({ credits: 1000, balance: 5000, config: { ...cfg, feeBps: 10000 } }), { ok: false, reason: "zero_net" });

console.log("payout math checks passed");
