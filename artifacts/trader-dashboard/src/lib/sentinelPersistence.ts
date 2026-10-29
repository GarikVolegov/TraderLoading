// ─── Sentinel State Persistence (AUREUS PROTOCOL) ──────────────────────────
// Guarantees that when an operator disables or toggles the AI Sentinel
// (Continuous Auto-Scan, Auto-Execute, or Chart Overlays in Forge or Cockpit),
// their sovereign preference is persistently preserved in localStorage across
// app restarts, reloads, page transitions, and PWA updates.

const STORAGE_KEYS = {
  FORGE_AUTO_SCAN: "aureus_forge_auto_scan_v1",
  FORGE_AUTO_EXECUTE: "aureus_forge_auto_execute_v1",
  FORGE_OVERLAY: "aureus_forge_overlay_v1",
  COCKPIT_AUTO_SCAN: "aureus_cockpit_auto_scan_v1",
  COCKPIT_AUTO_ALIGN: "aureus_cockpit_auto_align_v1",
} as const;

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Storage access may throw in restricted iframes or security modes
  }
  return null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Returns whether continuous auto-scan in the Forge (Backtest) is enabled.
 * Default is FALSE if not explicitly set by the operator (prevents surprise scans).
 */
export function getStoredForgeSentinelAutoScan(defaultValue = false): boolean {
  const val = safeGetItem(STORAGE_KEYS.FORGE_AUTO_SCAN);
  if (val === null) return defaultValue;
  return val === "true" || val === "1";
}

export function setStoredForgeSentinelAutoScan(enabled: boolean): void {
  safeSetItem(STORAGE_KEYS.FORGE_AUTO_SCAN, enabled ? "true" : "false");
}

/**
 * Returns whether automatic setup execution in the Forge is enabled.
 * Default is FALSE for safety unless explicitly enabled by the operator.
 */
export function getStoredForgeSentinelAutoExecute(defaultValue = false): boolean {
  const val = safeGetItem(STORAGE_KEYS.FORGE_AUTO_EXECUTE);
  if (val === null) return defaultValue;
  return val === "true" || val === "1";
}

export function setStoredForgeSentinelAutoExecute(enabled: boolean): void {
  safeSetItem(STORAGE_KEYS.FORGE_AUTO_EXECUTE, enabled ? "true" : "false");
}

/**
 * Returns whether AI setup overlay on the Forge chart is shown.
 * Default is TRUE.
 */
export function getStoredForgeSentinelOverlay(defaultValue = true): boolean {
  const val = safeGetItem(STORAGE_KEYS.FORGE_OVERLAY);
  if (val === null) return defaultValue;
  return val === "true" || val === "1";
}

export function setStoredForgeSentinelOverlay(enabled: boolean): void {
  safeSetItem(STORAGE_KEYS.FORGE_OVERLAY, enabled ? "true" : "false");
}

/**
 * Returns whether continuous auto-scan in the Trading Cockpit is enabled.
 * Default is FALSE if not explicitly turned on.
 */
export function getStoredCockpitSentinelAutoScan(defaultValue = false): boolean {
  const val = safeGetItem(STORAGE_KEYS.COCKPIT_AUTO_SCAN);
  if (val === null) return defaultValue;
  return val === "true" || val === "1";
}

export function setStoredCockpitSentinelAutoScan(enabled: boolean): void {
  safeSetItem(STORAGE_KEYS.COCKPIT_AUTO_SCAN, enabled ? "true" : "false");
}

/**
 * Returns whether auto-align in the Trading Cockpit is enabled.
 * Default is TRUE.
 */
export function getStoredCockpitSentinelAutoAlign(defaultValue = true): boolean {
  const val = safeGetItem(STORAGE_KEYS.COCKPIT_AUTO_ALIGN);
  if (val === null) return defaultValue;
  return val === "true" || val === "1";
}

export function setStoredCockpitSentinelAutoAlign(enabled: boolean): void {
  safeSetItem(STORAGE_KEYS.COCKPIT_AUTO_ALIGN, enabled ? "true" : "false");
}
