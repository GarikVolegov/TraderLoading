// ─── Lifecycle email audience (pure decision engine) ─────────────────────────
// Given a user's activity/email-history snapshot and a `now`, decide which
// lifecycle email (if any) they should receive. No I/O, no clock read — every
// input is passed in so the whole who-gets-what policy is unit-testable. The
// I/O wrapper (query the snapshot, send via Resend, stamp the sent-at) lives in
// lifecycleEmails.ts.

export type LifecycleEmailKind = "welcome" | "digest" | "winback";

export interface LifecycleUserState {
  userId: string;
  /** Account creation time. */
  createdAt: Date;
  /** Last meaningful activity (trade/journal/login); null ⇒ never active. */
  lastActiveAt: Date | null;
  /** When the welcome email was sent; null ⇒ never. */
  welcomeSentAt: Date | null;
  /** When the last weekly digest was sent; null ⇒ never. */
  lastDigestAt: Date | null;
  /** When the last win-back email was sent; null ⇒ never. */
  lastWinbackAt: Date | null;
  /** User silenced lifecycle emails. */
  emailOptOut: boolean;
}

export interface LifecycleTuning {
  /** Only greet accounts created within this window (no retroactive welcomes). */
  welcomeMaxAgeDays: number;
  /** "Active" for a digest = activity within this many days. */
  digestActiveWithinDays: number;
  /** Minimum gap between two digests. */
  digestIntervalDays: number;
  /** Quiet at least this long ⇒ win-back candidate. */
  inactivityDays: number;
  /** Minimum gap between two win-backs. */
  winbackCooldownDays: number;
}

export const LIFECYCLE_TUNING: LifecycleTuning = {
  welcomeMaxAgeDays: 3,
  digestActiveWithinDays: 7,
  digestIntervalDays: 7,
  inactivityDays: 14,
  winbackCooldownDays: 30,
};

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 86_400_000;
}

/**
 * Which lifecycle email this user should get right now, or null. Priority:
 * welcome → win-back → digest. Win-back and digest are mutually exclusive by
 * activity recency, so the order only matters for the freshly-created case.
 */
export function selectLifecycleEmail(
  user: LifecycleUserState,
  now: Date,
  tuning: LifecycleTuning = LIFECYCLE_TUNING,
): LifecycleEmailKind | null {
  if (user.emailOptOut) return null;

  // Welcome: never sent, and the account is still fresh.
  if (user.welcomeSentAt === null && daysBetween(user.createdAt, now) <= tuning.welcomeMaxAgeDays) {
    return "welcome";
  }

  // Win-back: was active once, but has since gone quiet past the threshold.
  if (user.lastActiveAt !== null) {
    const idle = daysBetween(user.lastActiveAt, now);
    if (idle >= tuning.inactivityDays) {
      const winbackAge = user.lastWinbackAt === null ? Infinity : daysBetween(user.lastWinbackAt, now);
      if (winbackAge >= tuning.winbackCooldownDays) return "winback";
      return null; // idle but still in cooldown — say nothing
    }

    // Digest: active in the last week, and due for one.
    if (idle <= tuning.digestActiveWithinDays) {
      const digestAge = user.lastDigestAt === null ? Infinity : daysBetween(user.lastDigestAt, now);
      if (digestAge >= tuning.digestIntervalDays) return "digest";
    }
  }

  return null;
}

export interface LifecycleRecipient {
  userId: string;
  kind: LifecycleEmailKind;
}

/** Map a batch of user states to the (userId, kind) pairs that need an email. */
export function selectLifecycleRecipients(
  users: LifecycleUserState[],
  now: Date,
  tuning: LifecycleTuning = LIFECYCLE_TUNING,
): LifecycleRecipient[] {
  const out: LifecycleRecipient[] = [];
  for (const user of users) {
    const kind = selectLifecycleEmail(user, now, tuning);
    if (kind) out.push({ userId: user.userId, kind });
  }
  return out;
}
