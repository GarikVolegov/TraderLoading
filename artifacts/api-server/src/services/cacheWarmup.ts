import logger from "../lib/logger.js";
import { getCandles } from "./candles.js";
import { getCotOutlook } from "./cot.js";

const WARMUP_SYMBOLS = ["EURUSD", "XAUUSD", "BTCUSD"] as const;

/**
 * Proactive Cache Warmup Service:
 * Pre-warms the in-memory and distributed cache for key macro instruments and
 * institutional COT reports during process startup.
 * Ensures the first waves of concurrent operators receive instant sub-millisecond responses.
 */
export interface WarmupTask {
  label: string;
  fn: () => Promise<unknown>;
}

export async function warmupCache(options?: {
  enabled?: boolean;
  tasks?: WarmupTask[];
}): Promise<{ warmed: string[]; errors: string[] }> {
  const isEnabled =
    options?.enabled ??
    (process.env.NODE_ENV !== "test" && process.env.DISABLE_CACHE_WARMUP !== "1");

  if (!isEnabled) {
    return { warmed: [], errors: [] };
  }

  const warmed: string[] = [];
  const errors: string[] = [];

  const tasks: WarmupTask[] = options?.tasks ?? [
    {
      label: "COT Outlook",
      fn: () => getCotOutlook(),
    },
    ...WARMUP_SYMBOLS.map((symbol) => ({
      label: `Candles ${symbol} D1`,
      fn: () => getCandles(symbol, "D1", { limit: 120 }),
    })),
  ];

  logger.info({ taskCount: tasks.length }, "Starting background cache warmup");

  const results = await Promise.allSettled(tasks.map((t) => t.fn()));

  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    const label = tasks[i].label;
    if (res.status === "fulfilled") {
      warmed.push(label);
    } else {
      const msg = res.reason instanceof Error ? res.reason.message : String(res.reason);
      errors.push(`${label}: ${msg}`);
    }
  }

  logger.info(
    { warmedCount: warmed.length, errorCount: errors.length },
    "Background cache warmup completed",
  );

  return { warmed, errors };
}
