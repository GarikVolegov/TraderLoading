import assert from "node:assert/strict";
import { accountStorage } from "./accountStorage";
import { attributeSignupReferral, captureSignupReferral, claimSignupReferral, confirmSignupReferral, REFERRAL_CAPTURE_KEY, REFERRAL_PENDING_KEY } from "./referralAttribution";
const values = new Map<string, string>();
const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
const now = Date.parse("2026-10-04T08:00:00Z");
captureSignupReferral(storage, "/sign-in", "ref=ABCDEFGH", now);
assert.equal(storage.getItem(REFERRAL_CAPTURE_KEY), null);
captureSignupReferral(storage, "/sign-up", "ref=bad", now);
assert.equal(storage.getItem(REFERRAL_CAPTURE_KEY), null);
captureSignupReferral(storage, "/sign-up", "ref=abcdefgh", now);
captureSignupReferral(storage, "/sign-up/verify-email-address", "ref=ABCDEFGH", now + 1000);
assert.deepEqual(JSON.parse(storage.getItem(REFERRAL_CAPTURE_KEY)!), { code: "ABCDEFGH", capturedAt: now });
// Logging into a pre-existing account consumes the anonymous invitation without attributing it.
assert.equal(claimSignupReferral(storage, "existing", now - 1, now + 2000), null);
assert.equal(storage.getItem(REFERRAL_CAPTURE_KEY), null);
captureSignupReferral(storage, "/sign-up", "ref=ABCDEFGH", now);
const pending = claimSignupReferral(storage, "new-a", now + 1000, now + 2000)!;
assert.deepEqual(pending, { code: "ABCDEFGH", capturedAt: now });
assert.equal(claimSignupReferral(storage, "new-b", now + 1000, now + 2000), null);
assert.deepEqual(claimSignupReferral(storage, "new-a", now + 1000, now + 3000), pending);
// Expired invitations and malformed/future local records cannot attach to a user.
captureSignupReferral(storage, "/sign-up", "ref=IJKLMNOP", now);
assert.equal(claimSignupReferral(storage, "expired", now + 1000, now + 86400001), null);
storage.setItem(REFERRAL_CAPTURE_KEY, JSON.stringify({ code: "IJKLMNOP", capturedAt: now + 10000 }));
assert.equal(claimSignupReferral(storage, "future", now + 10000, now), null);
const scoped = accountStorage("new-a", storage)!;
let releaseToken!: (token: string) => void, calls = 0;
const tokenPromise = new Promise<string>((resolve) => { releaseToken = resolve; });
const options = { storage, userId: "new-a", sessionId: "session-a", pending, getToken: () => tokenPromise, isCurrent: () => true, post: async (token: string, code: string) => { calls++; assert.equal(token, "account-a-token"); assert.equal(code, "ABCDEFGH"); return { attributed: true, rewardXp: 250 }; } };
const first = attributeSignupReferral(options), second = attributeSignupReferral(options);
assert.equal(first, second);
releaseToken("account-a-token");
assert.equal(await first, "confirmed");
assert.equal(calls, 1);
assert.equal(scoped.getItem(REFERRAL_PENDING_KEY), null);
// A failed request preserves the account-bound invitation; another account cannot claim it.
scoped.setItem(REFERRAL_PENDING_KEY, JSON.stringify(pending));
await assert.rejects(attributeSignupReferral({ ...options, getToken: async () => "account-a-token", post: async () => { throw new Error("503"); } }), /503/);
assert.ok(scoped.getItem(REFERRAL_PENDING_KEY));
assert.equal(claimSignupReferral(storage, "new-b", now + 1000, now + 2000), null);
// Switch during token recovery: no request is sent under the new account's session.
let active = true, releaseSwitch!: (token: string) => void;
const switchPromise = new Promise<string>((resolve) => { releaseSwitch = resolve; });
const switching = attributeSignupReferral({ ...options, sessionId: "switching-a", getToken: () => switchPromise, isCurrent: () => active });
active = false; releaseSwitch("account-a-token");
assert.equal(await switching, "cancelled");
assert.equal(calls, 1);
assert.ok(scoped.getItem(REFERRAL_PENDING_KEY));
// Lost confirmation is safe to retry; false (already attributed) is a terminal server confirmation.
await assert.rejects(attributeSignupReferral({ ...options, getToken: async () => "account-a-token", post: async () => ({ invalid: true }) }), /Invalid referral/);
assert.ok(scoped.getItem(REFERRAL_PENDING_KEY));
assert.equal(await attributeSignupReferral({ ...options, getToken: async () => "account-a-token", post: async () => ({ attributed: false }) }), "confirmed");
assert.equal(scoped.getItem(REFERRAL_PENDING_KEY), null);
// An older response must not remove a newer captured invitation for the same account.
scoped.setItem(REFERRAL_PENDING_KEY, JSON.stringify({ code: "IJKLMNOP", capturedAt: now + 1000 }));
confirmSignupReferral(storage, "new-a", pending);
assert.ok(scoped.getItem(REFERRAL_PENDING_KEY));
console.log("Referral capture, new-account qualification, session isolation, deduplication and retry passed");
