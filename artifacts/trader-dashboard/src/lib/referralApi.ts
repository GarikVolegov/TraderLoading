// Client off-contract del referral (come torneiApi): tipi a mano + apiJSON.
import { apiJSON, type RelativeApiOptions } from "./apiFetch";

export interface ReferralInfo {
  /** The user's stable invite code. */
  code: string;
  /** Relative sign-up link carrying the code, e.g. "/sign-up?ref=ABCD1234". */
  link: string;
  /** How many invitees have been attributed to this user. */
  referrals: number;
  /** XP granted to the referrer per accepted invite. */
  rewardXp: number;
}

export const referralKey = () => ["/api/referral"] as const;

export function fetchReferral(options?: RelativeApiOptions): Promise<ReferralInfo> {
  return apiJSON<ReferralInfo>("referral", undefined, options);
}
