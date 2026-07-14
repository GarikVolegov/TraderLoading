// Referral / invite reward (audit finding 4.2). A social/community/tournaments
// product had no referral loop. Each user gets a stable code; when an invitee signs
// up with it and activates, the referrer earns a one-time XP reward. Pure core here
// (code + guards + idempotency); the DB/endpoints wire it.

import { createHash } from "node:crypto";

/** One-time XP granted to the referrer when an invitee activates. */
export const REFERRAL_REWARD_XP = 250;

/**
 * Stable, URL-safe referral code for a user: a deterministic 8-char uppercase
 * alphanumeric derived from the user id, so it never needs storing/regenerating and
 * two users never share one in practice.
 */
export function generateReferralCode(userId: string): string {
  const hex = createHash("sha256").update(userId).digest("hex").slice(0, 16);
  const base36 = BigInt(`0x${hex}`).toString(36).toUpperCase();
  return base36.slice(0, 8).padStart(8, "0");
}

/** Whether a referral may be recorded: a real, distinct referrer and invitee. */
export function canAttributeReferral(referrerUserId: string, referredUserId: string): boolean {
  return Boolean(referrerUserId) && Boolean(referredUserId) && referrerUserId !== referredUserId;
}

/** Idempotency gate: grant the referral reward only if it hasn't been granted yet. */
export function shouldGrantReferralReward(referral: { rewardedAt: Date | null }): boolean {
  return referral.rewardedAt === null;
}

/**
 * Max XP-rewarded referrals credited to one referrer per rolling 24h (adversarial
 * review finding: self-referral + per-invitee dedup don't stop one referrer farming
 * unlimited XP via disposable sign-ups — this bounds it without needing an
 * invitee-activation hook).
 */
export const REFERRAL_REWARD_DAILY_CAP = 5;

/** Reward gate: idempotent AND under the rolling daily cap for this referrer. */
export function canGrantReferralReward(
  referral: { rewardedAt: Date | null },
  rewardedInLast24h: number,
  cap: number = REFERRAL_REWARD_DAILY_CAP,
): boolean {
  return shouldGrantReferralReward(referral) && rewardedInLast24h < cap;
}
