export const MISSION_XP_MIN = 1;
export const MISSION_XP_MAX = 100;

/**
 * Validate and bound a mission template's XP reward. Templates seed daily
 * missions whose reward is credited to the profile on completion, and profile
 * XP drives the Pro leaderboard — so an unbounded reward is an exploit
 * (a single template with xpReward=1_000_000 dominates the ranking).
 *
 * Returns null for invalid input (non-numeric or below MISSION_XP_MIN) so the
 * caller can respond 400; otherwise floors to a whole value and caps the upper
 * bound to [MISSION_XP_MIN, MISSION_XP_MAX].
 */
export function clampMissionXpReward(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const floored = Math.floor(n);
  if (floored < MISSION_XP_MIN) return null;
  return Math.min(floored, MISSION_XP_MAX);
}
