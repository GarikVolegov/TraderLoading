import assert from "node:assert/strict";
import { isEntitlementActive, canAccessChannel } from "./channelAccess.js";

const now = new Date("2026-07-09T12:00:00.000Z");
const past = new Date("2026-07-01T12:00:00.000Z");
const future = new Date("2026-08-09T12:00:00.000Z");

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

console.log("channel access checks passed");
