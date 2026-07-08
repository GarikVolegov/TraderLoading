import assert from "node:assert/strict";
import {
  isChannelFree,
  isEntitlementActive,
  canAccessChannel,
  computeEntitlementExpiry,
  validateChannelPricing,
  canPurchase,
  MAX_CHANNEL_PRICE,
  MAX_SUBSCRIPTION_DAYS,
} from "./channelAccess.js";

const now = new Date("2026-07-09T12:00:00.000Z");
const past = new Date("2026-07-01T12:00:00.000Z");
const future = new Date("2026-08-09T12:00:00.000Z");
const DAY = 86_400_000;

// ── isChannelFree — free unless a positive price ────────────────────────────
assert.equal(isChannelFree({ priceCredits: null }), true);
assert.equal(isChannelFree({ priceCredits: 0 }), true);
assert.equal(isChannelFree({ priceCredits: -5 }), true);
assert.equal(isChannelFree({ priceCredits: 50 }), false);

// ── isEntitlementActive — exists & not expired at now ───────────────────────
assert.equal(isEntitlementActive(null, now), false);
assert.equal(isEntitlementActive({ expiresAt: null }, now), true); // permanent
assert.equal(isEntitlementActive({ expiresAt: future }, now), true);
assert.equal(isEntitlementActive({ expiresAt: past }, now), false); // lapsed
assert.equal(isEntitlementActive({ expiresAt: now }, now), false); // boundary = expired

// ── canAccessChannel — free OR owner OR manage OR active entitlement ─────────
const base = { isFree: false, isOwner: false, canManage: false, entitlement: null, now };
assert.equal(canAccessChannel({ ...base, isFree: true }), true);
assert.equal(canAccessChannel({ ...base, isOwner: true }), true);
assert.equal(canAccessChannel({ ...base, canManage: true }), true);
assert.equal(canAccessChannel({ ...base, entitlement: { expiresAt: future } }), true);
assert.equal(canAccessChannel({ ...base, entitlement: { expiresAt: past } }), false);
assert.equal(canAccessChannel(base), false);

// ── computeEntitlementExpiry — one_time permanent; subscription stacks ───────
assert.equal(
  computeEntitlementExpiry({ accessModel: "one_time", subscriptionPeriodDays: 30, existingExpiry: null, now }),
  null,
);
// fresh subscription from now
assert.equal(
  computeEntitlementExpiry({ accessModel: "subscription", subscriptionPeriodDays: 30, existingExpiry: null, now })?.getTime(),
  now.getTime() + 30 * DAY,
);
// renewal on an active subscription stacks from the existing (future) expiry
assert.equal(
  computeEntitlementExpiry({ accessModel: "subscription", subscriptionPeriodDays: 30, existingExpiry: future, now })?.getTime(),
  future.getTime() + 30 * DAY,
);
// renewal on a lapsed subscription restarts from now
assert.equal(
  computeEntitlementExpiry({ accessModel: "subscription", subscriptionPeriodDays: 30, existingExpiry: past, now })?.getTime(),
  now.getTime() + 30 * DAY,
);

// ── validateChannelPricing ──────────────────────────────────────────────────
// free clears the other fields
assert.deepEqual(
  validateChannelPricing({ priceCredits: null, accessModel: "one_time", subscriptionPeriodDays: 30 }),
  { ok: true, normalized: { priceCredits: null, accessModel: null, subscriptionPeriodDays: null } },
);
assert.deepEqual(
  validateChannelPricing({ priceCredits: 0, accessModel: null, subscriptionPeriodDays: null }),
  { ok: true, normalized: { priceCredits: null, accessModel: null, subscriptionPeriodDays: null } },
);
// valid one_time clears period
assert.deepEqual(
  validateChannelPricing({ priceCredits: 50, accessModel: "one_time", subscriptionPeriodDays: 30 }),
  { ok: true, normalized: { priceCredits: 50, accessModel: "one_time", subscriptionPeriodDays: null } },
);
// valid subscription keeps period
assert.deepEqual(
  validateChannelPricing({ priceCredits: 50, accessModel: "subscription", subscriptionPeriodDays: 30 }),
  { ok: true, normalized: { priceCredits: 50, accessModel: "subscription", subscriptionPeriodDays: 30 } },
);
// rejects
assert.equal(validateChannelPricing({ priceCredits: 50.5, accessModel: "one_time", subscriptionPeriodDays: null }).ok, false);
assert.equal(validateChannelPricing({ priceCredits: MAX_CHANNEL_PRICE + 1, accessModel: "one_time", subscriptionPeriodDays: null }).ok, false);
assert.equal(validateChannelPricing({ priceCredits: 50, accessModel: "weird", subscriptionPeriodDays: null }).ok, false);
assert.equal(validateChannelPricing({ priceCredits: 50, accessModel: "subscription", subscriptionPeriodDays: null }).ok, false);
assert.equal(validateChannelPricing({ priceCredits: 50, accessModel: "subscription", subscriptionPeriodDays: 0 }).ok, false);
assert.equal(validateChannelPricing({ priceCredits: 50, accessModel: "subscription", subscriptionPeriodDays: MAX_SUBSCRIPTION_DAYS + 1 }).ok, false);

// ── canPurchase ─────────────────────────────────────────────────────────────
assert.deepEqual(canPurchase({ isFree: true, accessModel: "one_time", entitlement: null, now }), { ok: false, reason: "free" });
assert.deepEqual(canPurchase({ isFree: false, accessModel: "one_time", entitlement: null, now }), { ok: true });
// already own an active one_time (permanent) → blocked
assert.deepEqual(canPurchase({ isFree: false, accessModel: "one_time", entitlement: { expiresAt: null }, now }), { ok: false, reason: "already-owned" });
// expired one_time entitlement → re-buy allowed
assert.deepEqual(canPurchase({ isFree: false, accessModel: "one_time", entitlement: { expiresAt: past }, now }), { ok: true });
// subscription always (re)purchasable to extend, even while active
assert.deepEqual(canPurchase({ isFree: false, accessModel: "subscription", entitlement: { expiresAt: future }, now }), { ok: true });

console.log("channel access checks passed");
