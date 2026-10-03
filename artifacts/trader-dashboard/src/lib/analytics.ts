// Google Analytics 4 — attivo SOLO se VITE_GA_MEASUREMENT_ID è configurato e
// l'utente ha accettato il banner cookie (GDPR). Senza measurement ID tutte le
// funzioni sono no-op, quindi il modulo è sempre sicuro da importare.

import { hasAcceptedCookieConsent } from "./cookieConsent";
import { shouldTrackSignUp } from "./signupConversion";

const MEASUREMENT_ID = (import.meta as ImportMeta & {
  env?: { VITE_GA_MEASUREMENT_ID?: string };
}).env?.VITE_GA_MEASUREMENT_ID?.trim();

const SIGNUP_TRACKED_KEY = "tl_ga_signup_tracked";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;

/** Carica gtag.js. Va richiamata dopo il consenso cookie (e al boot, che la riverifica). */
export function initAnalytics(): boolean {
  if (initialized) return true;
  if (!MEASUREMENT_ID || typeof window === "undefined") return false;
  if (!hasAcceptedCookieConsent()) return false;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID, { anonymize_ip: true });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.appendChild(script);

  initialized = true;
  return true;
}

export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
  if (!initialized || typeof window === "undefined") return;
  window.gtag?.("event", name, params ?? {});
}

/**
 * Registra una conversione `sign_up` una sola volta per browser, quando un
 * utente appena creato (Clerk `createdAt`) arriva autenticato nell'app.
 */
export function trackSignUpConversion(userCreatedAt: Date | string | null | undefined): void {
  if (!initialized || typeof window === "undefined") return;
  try {
    const decision = shouldTrackSignUp({
      createdAt: userCreatedAt,
      now: Date.now(),
      alreadyTracked: Boolean(window.localStorage.getItem(SIGNUP_TRACKED_KEY)),
    });
    if (decision.track) trackEvent("sign_up", { method: "clerk" });
    if (decision.mark) window.localStorage.setItem(SIGNUP_TRACKED_KEY, decision.mark);
  } catch {
    // localStorage bloccato: meglio nessun tracking che un doppio conteggio.
  }
}
