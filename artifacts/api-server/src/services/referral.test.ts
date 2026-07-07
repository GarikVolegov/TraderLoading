import assert from "node:assert/strict";
import {
  generateReferralCode,
  canAttributeReferral,
  shouldGrantReferralReward,
  canGrantReferralReward,
  REFERRAL_REWARD_XP,
  REFERRAL_REWARD_DAILY_CAP,
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

// Adversarial-review finding: uncapped reward is farmable via disposable sign-ups
// (self-referral guard + per-invitee dedup don't limit how many DISTINCT invitees
// one referrer can accumulate). canGrantReferralReward adds a rolling daily cap.
assert.equal(canGrantReferralReward({ rewardedAt: null }, 0), true, "first reward of the day, under cap");
assert.equal(
  canGrantReferralReward({ rewardedAt: null }, REFERRAL_REWARD_DAILY_CAP - 1),
  true,
  "still under cap",
);
assert.equal(
  canGrantReferralReward({ rewardedAt: null }, REFERRAL_REWARD_DAILY_CAP),
  false,
  "cap reached ⇒ no more rewards today",
);
assert.equal(
  canGrantReferralReward({ rewardedAt: null }, REFERRAL_REWARD_DAILY_CAP + 5),
  false,
  "over cap ⇒ still no",
);
assert.equal(
  canGrantReferralReward({ rewardedAt: new Date() }, 0),
  false,
  "idempotency still applies regardless of cap",
);
assert.ok(REFERRAL_REWARD_DAILY_CAP > 0);

console.log("referral checks passed");
