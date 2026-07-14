import assert from "node:assert/strict";
import {
  selectLifecycleEmail,
  selectLifecycleRecipients,
  LIFECYCLE_TUNING,
  type LifecycleUserState,
} from "./lifecycleAudience.js";

// Finding 4.1: lifecycle email audience — a pure, deterministic decision engine
// (welcome / weekly digest / inactivity win-back) so who-gets-what is unit-tested
// without touching Resend or the DB. `now` is injected, never read from the clock.

const NOW = new Date("2026-07-07T12:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

function base(overrides: Partial<LifecycleUserState> = {}): LifecycleUserState {
  return {
    userId: "u1",
    createdAt: daysAgo(100),
    lastActiveAt: daysAgo(1),
    welcomeSentAt: daysAgo(99),
    lastDigestAt: daysAgo(30),
    lastWinbackAt: null,
    emailOptOut: false,
    ...overrides,
  };
}

// Opt-out silences every lifecycle email, no matter how eligible.
assert.equal(
  selectLifecycleEmail(base({ emailOptOut: true, welcomeSentAt: null, createdAt: NOW }), NOW),
  null,
  "opt-out ⇒ nothing",
);

// Welcome: a freshly-created account that never got the welcome.
assert.equal(
  selectLifecycleEmail(base({ welcomeSentAt: null, createdAt: daysAgo(1) }), NOW),
  "welcome",
);
// …but not retroactively to an old account that predates lifecycle emails.
assert.equal(
  selectLifecycleEmail(base({ welcomeSentAt: null, createdAt: daysAgo(90) }), NOW),
  "digest",
  "old account skips welcome, still eligible for digest if active",
);
// …and never twice.
assert.equal(
  selectLifecycleEmail(base({ welcomeSentAt: daysAgo(1), createdAt: daysAgo(1), lastActiveAt: null }), NOW),
  null,
  "welcome already sent, no other signal ⇒ nothing",
);

// Win-back: was active, has gone quiet past the inactivity threshold.
assert.equal(
  selectLifecycleEmail(base({ lastActiveAt: daysAgo(20), lastWinbackAt: null }), NOW),
  "winback",
);
// …but respect the cooldown so we don't nag every run.
assert.equal(
  selectLifecycleEmail(base({ lastActiveAt: daysAgo(20), lastWinbackAt: daysAgo(10) }), NOW),
  null,
  "win-back cooldown still active ⇒ nothing",
);
// …cooldown elapsed ⇒ win-back again.
assert.equal(
  selectLifecycleEmail(base({ lastActiveAt: daysAgo(40), lastWinbackAt: daysAgo(31) }), NOW),
  "winback",
);
// A user who was never active gets no win-back (nothing to win back).
assert.equal(
  selectLifecycleEmail(base({ lastActiveAt: null, welcomeSentAt: daysAgo(20), createdAt: daysAgo(20) }), NOW),
  null,
);

// Digest: active in the last week, no digest in the last week.
assert.equal(
  selectLifecycleEmail(base({ lastActiveAt: daysAgo(2), lastDigestAt: daysAgo(8) }), NOW),
  "digest",
);
// …but not more than once a week.
assert.equal(
  selectLifecycleEmail(base({ lastActiveAt: daysAgo(2), lastDigestAt: daysAgo(3) }), NOW),
  null,
  "digest interval not elapsed ⇒ nothing",
);
// …never-digested active user is eligible.
assert.equal(
  selectLifecycleEmail(base({ lastActiveAt: daysAgo(2), lastDigestAt: null }), NOW),
  "digest",
);

// Priority: a brand-new active user gets the welcome, not the digest.
assert.equal(
  selectLifecycleEmail(base({ welcomeSentAt: null, createdAt: daysAgo(1), lastActiveAt: daysAgo(1), lastDigestAt: null }), NOW),
  "welcome",
);

// Batch helper: keeps only users with a decision, pairs each with its kind.
const batch = selectLifecycleRecipients(
  [
    base({ userId: "a", welcomeSentAt: null, createdAt: daysAgo(1), lastActiveAt: daysAgo(1) }),
    base({ userId: "b", lastActiveAt: daysAgo(20), lastWinbackAt: null }),
    base({ userId: "c", emailOptOut: true }),
    base({ userId: "d", lastActiveAt: daysAgo(2), lastDigestAt: daysAgo(8) }),
  ],
  NOW,
);
assert.deepEqual(batch, [
  { userId: "a", kind: "welcome" },
  { userId: "b", kind: "winback" },
  { userId: "d", kind: "digest" },
]);

// Tuning is exposed and sane.
assert.ok(LIFECYCLE_TUNING.inactivityDays > LIFECYCLE_TUNING.digestActiveWithinDays);

console.log("lifecycle audience checks passed");
