import assert from "node:assert/strict";
import {
  COOKIE_CONSENT_ACCEPTED_VALUE,
  COOKIE_CONSENT_STORAGE_KEY,
  acceptCookieConsent,
  hasAcceptedCookieConsent,
} from "./cookieConsent.js";

function createStorage(throws = false): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      if (throws) throw new Error("storage unavailable");
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      if (throws) throw new Error("storage unavailable");
      values.set(key, value);
    },
  };
}

const storage = createStorage();
assert.equal(hasAcceptedCookieConsent(storage), false);

acceptCookieConsent(storage);

assert.equal(
  storage.getItem(COOKIE_CONSENT_STORAGE_KEY),
  COOKIE_CONSENT_ACCEPTED_VALUE,
);
assert.equal(hasAcceptedCookieConsent(storage), true);

assert.equal(hasAcceptedCookieConsent(createStorage(true)), false);
assert.doesNotThrow(() => acceptCookieConsent(createStorage(true)));

console.log("cookie consent storage helpers passed");
