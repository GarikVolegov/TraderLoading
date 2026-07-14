import assert from "node:assert/strict";
import { shouldTrackSignUp, SIGNUP_FRESH_WINDOW_MS } from "./signupConversion.js";

// Finding 4.3: the sign_up conversion was under-counted (consent arrives AFTER the
// tracker first runs, and a tight window expired). This pure decision separates
// "fire once for a fresh account" from "mark an existing user, never fire".

const now = 1_000_000_000_000;

// Fresh account within the window → fire and mark tracked.
assert.deepEqual(
  shouldTrackSignUp({ createdAt: now - 60_000, now, alreadyTracked: false }),
  { track: true, mark: "tracked" },
);

// Already tracked (or marked existing) → never fire again, nothing to persist.
assert.deepEqual(
  shouldTrackSignUp({ createdAt: now - 60_000, now, alreadyTracked: true }),
  { track: false, mark: null },
);

// Account older than the window → an existing user: mark, don't fire.
assert.deepEqual(
  shouldTrackSignUp({ createdAt: now - (SIGNUP_FRESH_WINDOW_MS + 1), now, alreadyTracked: false }),
  { track: false, mark: "existing" },
);

// Right at the window boundary still counts as fresh.
assert.deepEqual(
  shouldTrackSignUp({ createdAt: now - SIGNUP_FRESH_WINDOW_MS, now, alreadyTracked: false }),
  { track: true, mark: "tracked" },
);

// Missing / invalid createdAt → do nothing (no fire, no mark).
assert.deepEqual(shouldTrackSignUp({ createdAt: null, now, alreadyTracked: false }), { track: false, mark: null });
assert.deepEqual(shouldTrackSignUp({ createdAt: undefined, now, alreadyTracked: false }), { track: false, mark: null });
assert.deepEqual(shouldTrackSignUp({ createdAt: "not-a-date", now, alreadyTracked: false }), { track: false, mark: null });

// Accepts Date and ISO string forms.
assert.deepEqual(
  shouldTrackSignUp({ createdAt: new Date(now - 60_000), now, alreadyTracked: false }),
  { track: true, mark: "tracked" },
);
assert.deepEqual(
  shouldTrackSignUp({ createdAt: new Date(now - 60_000).toISOString(), now, alreadyTracked: false }),
  { track: true, mark: "tracked" },
);

// The widened window gives consent-then-fire flows real breathing room.
assert.ok(SIGNUP_FRESH_WINDOW_MS >= 30 * 60 * 1000);

console.log("signup conversion checks passed");
