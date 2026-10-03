import assert from "node:assert/strict";
import {
  isChannelFree,
  validateChannelPrice,
  computeApplicationFee,
  MAX_PRICE_CENTS,
  MIN_PRICE_CENTS,
} from "./channelPricing.js";

// ── isChannelFree — free unless a positive price ────────────────────────────
assert.equal(isChannelFree({ priceCents: null }), true);
assert.equal(isChannelFree({ priceCents: 0 }), true);
assert.equal(isChannelFree({ priceCents: -5 }), true);
assert.equal(isChannelFree({ priceCents: 500 }), false);

// ── computeApplicationFee — floor(price × bps / 10000) ──────────────────────
assert.equal(computeApplicationFee(1000, 0), 0);
assert.equal(computeApplicationFee(1000, 1000), 100); // 10%
assert.equal(computeApplicationFee(999, 250), 24); // floor(24.975)

// ── validateChannelPrice ────────────────────────────────────────────────────
// free clears the rest
assert.deepEqual(validateChannelPrice({ priceCents: null, accessModel: "one_time", subInterval: "month" }), {
  ok: true,
  normalized: { priceCents: null, accessModel: null, subInterval: null },
});
// valid one-time clears interval
assert.deepEqual(validateChannelPrice({ priceCents: 500, accessModel: "one_time", subInterval: "month" }), {
  ok: true,
  normalized: { priceCents: 500, accessModel: "one_time", subInterval: null },
});
// valid subscription keeps interval
assert.deepEqual(validateChannelPrice({ priceCents: 999, accessModel: "subscription", subInterval: "month" }), {
  ok: true,
  normalized: { priceCents: 999, accessModel: "subscription", subInterval: "month" },
});
// rejects
assert.equal(validateChannelPrice({ priceCents: 500.5, accessModel: "one_time", subInterval: null }).ok, false);
assert.equal(validateChannelPrice({ priceCents: MIN_PRICE_CENTS - 1, accessModel: "one_time", subInterval: null }).ok, false); // below Stripe min
assert.equal(validateChannelPrice({ priceCents: MAX_PRICE_CENTS + 1, accessModel: "one_time", subInterval: null }).ok, false);
assert.equal(validateChannelPrice({ priceCents: 500, accessModel: "weird", subInterval: null }).ok, false);
assert.equal(validateChannelPrice({ priceCents: 500, accessModel: "subscription", subInterval: null }).ok, false); // sub needs interval
assert.equal(validateChannelPrice({ priceCents: 500, accessModel: "subscription", subInterval: "week" }).ok, false); // bad interval

console.log("channel pricing checks passed");
