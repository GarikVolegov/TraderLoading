import { fetchMyfxbookOutlook, type MyfxbookSymbol } from "./myfxbook.js";

export interface SentimentOutlook {
  symbols: MyfxbookSymbol[];
  status: "available" | "stale" | "unavailable";
  source: "myfxbook";
  /** Last successful retrieval; the provider does not supply an observation timestamp. */
  fetchedAt: string | null;
  observedAt: null;
  reason: "not_configured" | "provider_unavailable" | null;
  live: boolean;
  cached: boolean;
  fallback: false;
  hasCredentials: boolean;
}

// A last-good response is useful during an outage, but never indefinitely.
export const SENTIMENT_MAX_STALE_MS = 24 * 60 * 60 * 1000;

export function createSentimentOutlookService({
  fetchSymbols = fetchMyfxbookOutlook,
  hasCredentials = () => Boolean(process.env.MYFXBOOK_EMAIL && process.env.MYFXBOOK_PASSWORD),
  now = Date.now,
}: {
  fetchSymbols?: () => Promise<MyfxbookSymbol[]>;
  hasCredentials?: () => boolean;
  now?: () => number;
} = {}) {
  let lastGood: { symbols: MyfxbookSymbol[]; fetchedAt: string } | null = null;
  let inFlight: Promise<SentimentOutlook> | null = null;

  async function refresh(): Promise<SentimentOutlook> {
    const configured = hasCredentials();
    const base = { source: "myfxbook" as const, observedAt: null, fallback: false as const, hasCredentials: configured };
    if (!configured) {
      lastGood = null;
      return { ...base, symbols: [], status: "unavailable", fetchedAt: null, reason: "not_configured", live: false, cached: false };
    }
    try {
      // Myfxbook includes inactive instruments with zero/invalid percentages.
      // Exclude those rows without discarding valid observations for other pairs.
      const symbols = (await fetchSymbols()).filter((s) =>
        s.name && Number.isFinite(s.longPercentage) && Number.isFinite(s.shortPercentage) &&
        s.longPercentage >= 0 && s.longPercentage <= 100 && s.shortPercentage >= 0 && s.shortPercentage <= 100 &&
        Math.abs(s.longPercentage + s.shortPercentage - 100) <= 1
      );
      if (!symbols.length) throw new Error("Invalid outlook");
      lastGood = { symbols, fetchedAt: new Date(now()).toISOString() };
      return { ...base, ...lastGood, status: "available", reason: null, live: true, cached: false };
    } catch {
      // Do not expose provider error strings (they may contain login URLs).
      if (lastGood && now() - Date.parse(lastGood.fetchedAt) <= SENTIMENT_MAX_STALE_MS) {
        return { ...base, ...lastGood, status: "stale", reason: "provider_unavailable", live: false, cached: true };
      }
      return { ...base, symbols: [], status: "unavailable", fetchedAt: null, reason: "provider_unavailable", live: false, cached: false };
    }
  }

  return () => {
    inFlight ??= refresh().finally(() => { inFlight = null; });
    return inFlight;
  };
}
