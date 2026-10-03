// Pure decision for the GA4 `sign_up` conversion (finding 4.3). Kept free of
// browser globals so it is unit-testable and reused by both the conversion tracker
// and the cookie-consent accept handler (which must retry the fire once consent is
// finally granted). Widened window: consent often arrives minutes after the first
// authenticated load, so a tight window silently dropped the conversion.

export const SIGNUP_FRESH_WINDOW_MS = 30 * 60 * 1000;

export interface SignUpDecision {
  /** Fire the `sign_up` event now. */
  track: boolean;
  /** What to persist in the once-per-browser guard (null = persist nothing). */
  mark: "tracked" | "existing" | null;
}

export function shouldTrackSignUp(opts: {
  createdAt: Date | string | number | null | undefined;
  now: number;
  alreadyTracked: boolean;
  freshWindowMs?: number;
}): SignUpDecision {
  const { createdAt, now, alreadyTracked } = opts;
  const window = opts.freshWindowMs ?? SIGNUP_FRESH_WINDOW_MS;
  if (alreadyTracked || createdAt === null || createdAt === undefined) {
    return { track: false, mark: null };
  }
  const createdMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdMs)) return { track: false, mark: null };
  if (now - createdMs > window) return { track: false, mark: "existing" };
  return { track: true, mark: "tracked" };
}
