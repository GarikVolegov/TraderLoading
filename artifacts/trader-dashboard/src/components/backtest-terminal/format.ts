// ─── Terminal formatting helpers ─────────────────────────────────────────────
import type { Language } from "@/lib/i18n";

const LOCALE_BY_LANGUAGE: Record<Language, string> = {
  it: "it-IT",
  en: "en-GB",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
};

export function terminalLocale(language: Language): string {
  return LOCALE_BY_LANGUAGE[language] ?? "it-IT";
}

/** Instrument-aware price decimals (same table as the legacy ChartReplay). */
export function priceDecimals(symbol: string): number {
  const s = symbol.replace("/", "").toUpperCase();
  if (s.includes("JPY")) return 3;
  if (["US30", "NAS100", "SPX500"].includes(s)) return 1;
  if (s.includes("BTC")) return 1;
  if (s.includes("ETH")) return 2;
  if (s === "XAUUSD") return 2;
  return 5;
}

export function formatPrice(price: number, symbol: string): string {
  return price.toFixed(priceDecimals(symbol));
}

export function formatMoney(value: number, language: Language): string {
  return new Intl.NumberFormat(terminalLocale(language), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatSignedMoney(value: number, language: Language): string {
  const formatted = formatMoney(Math.abs(value), language);
  return value < 0 ? `−${formatted}` : `+${formatted}`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${value >= 0 ? "" : "−"}${Math.abs(value).toFixed(digits)}%`;
}

export function formatBarTime(
  timeSeconds: number,
  intervalSeconds: number,
  language: Language,
): string {
  const locale = terminalLocale(language);
  if (intervalSeconds >= 86_400) {
    // Daily+ bars are labeled by their session day: the close timestamp is
    // 00:00 of the NEXT day and would shift every label forward.
    return new Date(timeSeconds * 1000).toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  const closeTime = new Date((timeSeconds + intervalSeconds) * 1000);
  return closeTime.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
