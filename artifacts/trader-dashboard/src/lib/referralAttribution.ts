import { accountStorage, type AccountStorage } from "./accountStorage";

export const REFERRAL_CAPTURE_KEY = "tl_signup_referral_v1";
export const REFERRAL_PENDING_KEY = "signup_referral_v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
export interface PendingReferral { code: string; capturedAt: number }

function read(storage: AccountStorage, key: string, now: number): PendingReferral | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(key) ?? "null");
    if (value && typeof value === "object" && "code" in value && "capturedAt" in value &&
      typeof value.code === "string" && /^[A-Z0-9]{8}$/.test(value.code) &&
      typeof value.capturedAt === "number" && Number.isFinite(value.capturedAt) &&
      value.capturedAt <= now && now - value.capturedAt <= MAX_AGE_MS) {
      return { code: value.code, capturedAt: value.capturedAt };
    }
    storage.removeItem(key);
  } catch { /* Unavailable session storage must never block authentication. */ }
  return null;
}

/** Capture only an explicit anonymous signup link. A reload must not reset its age. */
export function captureSignupReferral(storage: AccountStorage, path: string, search: string, now = Date.now()): void {
  if (!/^\/sign-up(?:\/|$)/.test(path)) return;
  const code = new URLSearchParams(search).get("ref")?.trim().toUpperCase();
  if (!code || !/^[A-Z0-9]{8}$/.test(code)) return;
  const previous = read(storage, REFERRAL_CAPTURE_KEY, now);
  try { storage.setItem(REFERRAL_CAPTURE_KEY, JSON.stringify(previous?.code === code ? previous : { code, capturedAt: now })); } catch { /* Optional attribution. */ }
}

/** Claim once for a newly registered account; an existing-account login cannot inherit it. */
export function claimSignupReferral(storage: AccountStorage, userId: string, createdAt: number, now = Date.now()): PendingReferral | null {
  const scoped = accountStorage(userId, storage)!;
  const pending = read(scoped, REFERRAL_PENDING_KEY, now);
  const captured = read(storage, REFERRAL_CAPTURE_KEY, now);
  if (captured) {
    try { storage.removeItem(REFERRAL_CAPTURE_KEY); } catch { return pending; }
    if (!pending && Number.isFinite(createdAt) && createdAt >= captured.capturedAt) {
      try { scoped.setItem(REFERRAL_PENDING_KEY, JSON.stringify(captured)); return captured; } catch { return null; }
    }
  }
  return pending;
}

/** Remove only the matching account's confirmed request, never another account's invitation. */
export function confirmSignupReferral(storage: AccountStorage, userId: string, pending: PendingReferral): void {
  const scoped = accountStorage(userId, storage)!;
  try {
    const current = JSON.parse(scoped.getItem(REFERRAL_PENDING_KEY) ?? "null") as PendingReferral | null;
    if (current?.code === pending.code && current.capturedAt === pending.capturedAt) scoped.removeItem(REFERRAL_PENDING_KEY);
  } catch { /* Optional attribution. */ }
}

const requests = new Map<string, Promise<"confirmed" | "cancelled">>();
/** Coalesce StrictMode effects and repeated clicks; retries still rely on server idempotency. */
export function attributeSignupReferral(options: {
  storage: AccountStorage;
  userId: string;
  sessionId: string;
  pending: PendingReferral;
  getToken: () => Promise<string | null>;
  isCurrent: () => boolean;
  post: (token: string, code: string) => Promise<unknown>;
}): Promise<"confirmed" | "cancelled"> {
  const key = `${options.userId}:${options.sessionId}:${options.pending.code}`;
  const existing = requests.get(key);
  if (existing) return existing;
  const request = (async () => {
    const token = await options.getToken();
    if (!options.isCurrent()) return "cancelled" as const;
    if (!token) throw new Error("Referral authentication unavailable");
    const response = await options.post(token, options.pending.code);
    if (!response || typeof response !== "object" || !("attributed" in response) || typeof response.attributed !== "boolean") {
      throw new Error("Invalid referral attribution response");
    }
    // Both true and false are confirmed server outcomes (invalid/self/already claimed).
    confirmSignupReferral(options.storage, options.userId, options.pending);
    return "confirmed" as const;
  })();
  requests.set(key, request);
  void request.finally(() => { if (requests.get(key) === request) requests.delete(key); }).catch(() => {});
  return request;
}
