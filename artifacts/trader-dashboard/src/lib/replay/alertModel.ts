/**
 * ─── Replay Price Alert Model (AUREUS PROTOCOL) ─────────────────────────────
 * TradingView-style price alerts for the backtest replay terminal:
 * - On-chart price levels with drag & drop adjustments
 * - Automatic pause of replay playback when price touches the level
 * - Synesthetic audio chime & visual notifications
 */

export interface ReplayPriceAlert {
  id: string;
  symbol: string;
  price: number;
  createdAt: number;
  status: "active" | "triggered" | "disabled";
  condition?: "crossing" | "crossing_up" | "crossing_down";
  pauseReplay: boolean;
  label?: string;
  lastTriggeredAt?: number;
}

export function createAlertStorageKey(sessionKey: string, symbol: string): string {
  const norm = symbol.replace("/", "").toUpperCase();
  return `aureus:backtest-alerts:${sessionKey}:${norm}`;
}

export function loadStoredAlerts(sessionKey: string, symbol: string): ReplayPriceAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(createAlertStorageKey(sessionKey, symbol));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (a): a is ReplayPriceAlert =>
          typeof a === "object" &&
          a !== null &&
          typeof a.id === "string" &&
          typeof a.price === "number" &&
          Number.isFinite(a.price),
      );
    }
  } catch {
    // Graceful fallback
  }
  return [];
}

export function saveStoredAlerts(
  sessionKey: string,
  symbol: string,
  alerts: ReplayPriceAlert[],
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      createAlertStorageKey(sessionKey, symbol),
      JSON.stringify(alerts),
    );
  } catch {
    // Quota exceeded or private browsing
  }
}

/**
 * Checks if a candle has crossed or touched an alert price.
 */
export function isPriceAlertTriggered(
  alert: ReplayPriceAlert,
  candle: { high: number; low: number; open: number; close: number },
  prevClose?: number | null,
): boolean {
  if (alert.status !== "active") return false;

  const touched = candle.high >= alert.price && candle.low <= alert.price;
  if (!touched) return false;

  if (alert.condition === "crossing_up" && prevClose != null) {
    return prevClose < alert.price && candle.close >= alert.price;
  }
  if (alert.condition === "crossing_down" && prevClose != null) {
    return prevClose > alert.price && candle.close <= alert.price;
  }

  return true;
}
