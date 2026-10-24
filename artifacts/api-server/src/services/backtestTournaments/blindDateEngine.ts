import { getCandlesMeta, isSupportedSymbol } from "../candles.js";
import { INTERVAL_SECONDS } from "../candleRegistry.js";

// Default safe historical boundary: 2021-06-01 to 2023-12-01 UTC
const DEFAULT_FALLBACK_BOUNDS: Record<string, { firstTs: number; lastTs: number }> = {
  XAUUSD: { firstTs: 1622505600, lastTs: 1701388800 },
  EURUSD: { firstTs: 1622505600, lastTs: 1701388800 },
  GBPUSD: { firstTs: 1622505600, lastTs: 1701388800 },
  US30: { firstTs: 1622505600, lastTs: 1701388800 },
  NAS100: { firstTs: 1622505600, lastTs: 1701388800 },
  BTCUSD: { firstTs: 1622505600, lastTs: 1701388800 },
};

function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Checks if a given unix timestamp falls on a weekend market closure (Forex / Metals).
 * Crypto (BTCUSD, ETHUSD) trades 24/7.
 */
export function isWeekendMarketClosed(ts: number, symbol: string): boolean {
  const norm = normalizeSymbol(symbol);
  if (norm.startsWith("BTC") || norm.startsWith("ETH")) {
    return false;
  }
  const date = new Date(ts * 1000);
  const day = date.getUTCDay(); // 0 = Sun, 6 = Sat
  const hour = date.getUTCHours();

  // Friday after 22:00 UTC
  if (day === 5 && hour >= 22) return true;
  // Saturday all day
  if (day === 6) return true;
  // Sunday before 21:00 UTC
  if (day === 0 && hour < 21) return true;

  return false;
}

/**
 * Adjusts a weekend timestamp to the next Monday London session (08:00 UTC).
 */
export function adjustToActiveTradingSession(ts: number, symbol: string): number {
  if (!isWeekendMarketClosed(ts, symbol)) return ts;

  const date = new Date(ts * 1000);
  const day = date.getUTCDay();

  // Advance to Monday
  let daysToAdd = 1;
  if (day === 5) daysToAdd = 3; // Fri -> Mon
  else if (day === 6) daysToAdd = 2; // Sat -> Mon
  else if (day === 0) daysToAdd = 1; // Sun -> Mon

  date.setUTCDate(date.getUTCDate() + daysToAdd);
  date.setUTCHours(8, 0, 0, 0); // London open 08:00 UTC
  return Math.floor(date.getTime() / 1000);
}

export interface BlindDateOptions {
  excludeTimestamps?: number[];
  minSpacingDays?: number; // Minimum days apart from other participants (default: 5)
  seed?: number;
}

/**
 * Generates a valid, realistic historical starting candle timestamp for blind multiplayer backtesting.
 * Ensures:
 * 1. Warmup history exists prior to the timestamp.
 * 2. Sufficient future history exists after the timestamp.
 * 3. Not on a weekend market holiday (for Forex / Indices / Gold).
 * 4. Aligned to the requested timeframe interval.
 * 5. Distinct and spaced out from other participants in the same room.
 */
export async function getBlindHistoricalTimestamp(
  pair: string,
  timeframe: string = "M5",
  options: BlindDateOptions = {},
): Promise<number> {
  const norm = normalizeSymbol(pair);
  const intervalSec = INTERVAL_SECONDS[timeframe] || 300;
  const minSpacingSec = (options.minSpacingDays ?? 5) * 86400;

  let bounds = DEFAULT_FALLBACK_BOUNDS[norm] || { firstTs: 1622505600, lastTs: 1701388800 };

  try {
    if (isSupportedSymbol(norm)) {
      const meta = await getCandlesMeta(norm);
      if (meta?.warehouse?.firstTs && meta?.warehouse?.lastTs) {
        bounds = {
          firstTs: meta.warehouse.firstTs,
          lastTs: meta.warehouse.lastTs,
        };
      }
    }
  } catch {
    // Fall back to DEFAULT_FALLBACK_BOUNDS
  }

  // 30 days buffer for warmup, 14 days buffer before warehouse end
  const safeMin = bounds.firstTs + 30 * 86400;
  const safeMax = Math.max(safeMin + 30 * 86400, bounds.lastTs - 14 * 86400);

  const span = safeMax - safeMin;
  const excludeList = options.excludeTimestamps || [];

  for (let attempt = 0; attempt < 20; attempt++) {
    // Generate pseudo-random or seeded offset
    const randomFraction = Math.random();
    let candidate = safeMin + Math.floor(randomFraction * span);

    // Adjust for weekend closure
    candidate = adjustToActiveTradingSession(candidate, norm);

    // Align to timeframe interval
    candidate = Math.floor(candidate / intervalSec) * intervalSec;

    // Check collision with already assigned participants
    const collision = excludeList.some((ex) => Math.abs(ex - candidate) < minSpacingSec);
    if (!collision || attempt === 19) {
      return candidate;
    }
  }

  // Fallback safe aligned timestamp
  return Math.floor(safeMin / intervalSec) * intervalSec;
}

/**
 * Assigns unique blind historical timestamps to an entire list of participants.
 */
export async function assignBlindHistoricalDates(
  participantIds: string[],
  pair: string,
  timeframe: string = "M5",
): Promise<Record<string, number>> {
  const assignments: Record<string, number> = {};
  const usedTimestamps: number[] = [];

  for (const pid of participantIds) {
    const ts = await getBlindHistoricalTimestamp(pair, timeframe, {
      excludeTimestamps: usedTimestamps,
      minSpacingDays: 7, // At least 1 week apart between traders
    });
    assignments[pid] = ts;
    usedTimestamps.push(ts);
  }

  return assignments;
}
