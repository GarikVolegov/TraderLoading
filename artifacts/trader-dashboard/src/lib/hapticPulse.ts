/**
 * AUREUS PROTOCOL — Sovereign Haptic Feedback Engine
 * Micro-telemetria aptica per dispositivi tattili e PWA mobili.
 * Fornisce un feedback discreto, nobile e calibrato su azioni solenni (Varco, firma ordine, cambio presidio).
 */

export type HapticStyle = "light" | "medium" | "heavy" | "selection" | "success" | "warning" | "error";

const HAPTIC_PATTERNS: Record<HapticStyle, number | number[]> = {
  light: 10,
  selection: 15,
  medium: 25,
  heavy: 45,
  success: [15, 60, 30],
  warning: [30, 80, 30],
  error: [40, 90, 40, 90, 40],
};

/**
 * Attiva un micro-impulso aptico sul dispositivo dell'operatore, se supportato.
 * Privo di effetti collaterali su browser desktop o piattaforme sprovviste di vibrazione.
 */
export function triggerHaptic(style: HapticStyle = "selection"): void {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return;
  }

  try {
    if ("vibrate" in navigator && typeof navigator.vibrate === "function") {
      const pattern = HAPTIC_PATTERNS[style];
      navigator.vibrate(pattern);
    }
  } catch {
    // Silenzioso: non interrompere mai il flusso decisionale
  }
}
