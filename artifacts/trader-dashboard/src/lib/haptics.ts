/**
 * AUREUS PROTOCOL — Motore Aptico Sovrano (Haptic Fidelity Engine)
 *
 * Fornisce un feedback tattile micro-chirurgico nativo su dispositivi iOS (WebKit/PWA)
 * e Android attraverso l'API `navigator.vibrate`, con guardrail di sicurezza per
 * ambienti server-side o desktop dove l'hardware aptico non è supportato.
 */

function vibrate(pattern: number | number[]): boolean {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return false;
  }
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

/** Verifica se il dispositivo supporta il feedback aptico */
export function isHapticSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/** Tocco leggero (10ms): spunta checklist, click filtri, selezione righe */
export function hapticLight(): boolean {
  return vibrate(10);
}

/** Tocco intermedio (20ms): navigazione tab, apertura modali, pulsanti secondari */
export function hapticMedium(): boolean {
  return vibrate(20);
}

/** Micro-impulso inerziale per swipe gestuale (12ms) */
export function hapticSwipe(): boolean {
  return vibrate(12);
}

/** Scatto meccanico per toggle modalità Cinema (28ms) */
export function hapticCinemaToggle(): boolean {
  return vibrate(28);
}

/** Doppia conferma aptica per validazione regola checklist (15ms - 25ms - 20ms) */
export function hapticChecklistValidation(): boolean {
  return vibrate([15, 25, 20]);
}

/** Allerta aptica disciplinare per violazione o deroga (35ms - 30ms - 45ms) */
export function hapticViolation(): boolean {
  return vibrate([35, 30, 45]);
}

/** Conferma positiva (20ms - pausa 30ms - 20ms): salvataggio piano, conferma regola */
export function hapticSuccess(): boolean {
  return vibrate([20, 30, 20]);
}

/** Alert o avviso disciplinare (40ms - pausa 40ms - 40ms): rischio superato, deviazione */
export function hapticWarning(): boolean {
  return vibrate([40, 40, 40]);
}

/** Impulso Sovrano (40ms - 30ms - 40ms - 30ms - 60ms): vittoria arena, trade in profitto */
export function hapticSovereign(): boolean {
  return vibrate([40, 30, 40, 30, 60]);
}

export type HapticStyle = "selection" | "light" | "medium" | "heavy" | "success" | "warning" | "error";

/** Helper polimorfo per attivare feedback aptico in base allo stile richiesto */
export function triggerHaptic(style: HapticStyle = "selection"): boolean {
  switch (style) {
    case "selection":
    case "light":
      return hapticLight();
    case "medium":
      return hapticMedium();
    case "heavy":
      return hapticCinemaToggle();
    case "success":
      return hapticSuccess();
    case "warning":
      return hapticWarning();
    case "error":
      return hapticViolation();
    default:
      return hapticLight();
  }
}

