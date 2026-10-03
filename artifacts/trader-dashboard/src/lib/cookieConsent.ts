export const COOKIE_CONSENT_STORAGE_KEY = "tl_cookie_consent_v1";
export const COOKIE_CONSENT_ACCEPTED_VALUE = "accepted";
export const COOKIE_CONSENT_DECLINED_VALUE = "declined";

function getDefaultStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function hasAcceptedCookieConsent(
  storage: Storage | undefined = getDefaultStorage(),
): boolean {
  try {
    return (
      storage?.getItem(COOKIE_CONSENT_STORAGE_KEY) ===
      COOKIE_CONSENT_ACCEPTED_VALUE
    );
  } catch {
    return false;
  }
}

/** True se l'utente ha già risposto al banner (accettato O rifiutato). */
export function hasRespondedToCookieConsent(
  storage: Storage | undefined = getDefaultStorage(),
): boolean {
  try {
    const value = storage?.getItem(COOKIE_CONSENT_STORAGE_KEY);
    return (
      value === COOKIE_CONSENT_ACCEPTED_VALUE ||
      value === COOKIE_CONSENT_DECLINED_VALUE
    );
  } catch {
    return false;
  }
}

export function acceptCookieConsent(
  storage: Storage | undefined = getDefaultStorage(),
): void {
  try {
    storage?.setItem(COOKIE_CONSENT_STORAGE_KEY, COOKIE_CONSENT_ACCEPTED_VALUE);
  } catch {
    // Storage may be blocked; the popup still hides for the current render.
  }
}

export function declineCookieConsent(
  storage: Storage | undefined = getDefaultStorage(),
): void {
  try {
    storage?.setItem(COOKIE_CONSENT_STORAGE_KEY, COOKIE_CONSENT_DECLINED_VALUE);
  } catch {
    // Storage may be blocked; the popup still hides for the current render.
  }
}
