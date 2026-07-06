import assert from "node:assert/strict";
import {
  generateReferralCode,
  canAttributeReferral,
  shouldGrantReferralReward,
  REFERRAL_REWARD_XP,
} from "./referral.js";

// Finding 4.2: per-user referral code — deterministic, stable, URL-safe.
{
  const a = generateReferralCode("user_abc");
  assert.equal(a, generateReferralCode("user_abc"), "same user ⇒ same code (stable)");
  assert.notEqual(a, generateReferralCode("user_xyz"), "different users ⇒ different codes");
  assert.match(a, /^[0-9A-Z]{8}$/, "8-char uppercase alphanumeric");
}

// Attribution guards: a real referrer, not yourself, both present.
assert.equal(canAttributeReferral("ref-1", "new-1"), true);
assert.equal(canAttributeReferral("ref-1", "ref-1"), false, "no self-referral");
assert.equal(canAttributeReferral("", "new-1"), false);
assert.equal(canAttributeReferral("ref-1", ""), false);

// Reward is idempotent: granted once (rewardedAt null), never again.
assert.equal(shouldGrantReferralReward({ rewardedAt: null }), true);
assert.equal(shouldGrantReferralReward({ rewardedAt: new Date() }), false, "already rewarded");

assert.ok(REFERRAL_REWARD_XP > 0);

console.log("referral checks passed");
