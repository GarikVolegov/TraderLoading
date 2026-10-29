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
