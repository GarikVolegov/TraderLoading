import assert from "node:assert/strict";
import { isPayoutConfigured, computePayout, validatePayoutRequest, readPayoutConfig, MAX_PAYOUT_CENTS } from "./payoutMath.js";

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
assert.deepEqual(validatePayoutRequest({ credits: 1000, balance: 5000, config: { ...cfg, feeBps: 9999 } }).ok, true);
// too_large: gross would overflow the int4 cents columns
const bigCredits = MAX_PAYOUT_CENTS; // creditCents=1 ⇒ gross = MAX+? ; use creditCents 2 to overflow
assert.deepEqual(validatePayoutRequest({ credits: bigCredits, balance: bigCredits + 1, config: { ...cfg, creditCents: 2 } }), { ok: false, reason: "too_large" });

// ── readPayoutConfig — fail-safe on unsafe config (disable = creditCents null) ─
assert.equal(readPayoutConfig({ PAYOUT_CREDIT_CENTS: "1" } as NodeJS.ProcessEnv).creditCents, 1);
assert.equal(readPayoutConfig({} as NodeJS.ProcessEnv).creditCents, null); // unset ⇒ dark
// malformed / out-of-range fee ⇒ disable (fail safe, not fee=0)
assert.equal(readPayoutConfig({ PAYOUT_CREDIT_CENTS: "1", PAYOUT_FEE_BPS: "99999" } as NodeJS.ProcessEnv).creditCents, null);
assert.equal(readPayoutConfig({ PAYOUT_CREDIT_CENTS: "1", PAYOUT_FEE_BPS: "abc" } as NodeJS.ProcessEnv).creditCents, null);
// unset fee ⇒ 0, still enabled
assert.equal(readPayoutConfig({ PAYOUT_CREDIT_CENTS: "1" } as NodeJS.ProcessEnv).feeBps, 0);
// zero-decimal currency (JPY) ⇒ disable (our cents math assumes 2 decimals)
assert.equal(readPayoutConfig({ PAYOUT_CREDIT_CENTS: "1", PAYOUT_CURRENCY: "jpy" } as NodeJS.ProcessEnv).creditCents, null);
assert.equal(readPayoutConfig({ PAYOUT_CREDIT_CENTS: "1", PAYOUT_CURRENCY: "usd" } as NodeJS.ProcessEnv).creditCents, 1);

console.log("payout math checks passed");
