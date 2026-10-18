import { buildMarketContext, type ContextInputs, type MarketContext } from "./marketContext.js";

type Loaders = {
  [K in "candles" | "news" | "sentiment" | "calendar" | "cot"]: (pair: string) => Promise<NonNullable<ContextInputs[K]>>;
};

/** Background fan-in: slow news never blocks the dashboard. Failures remove a
 * contribution, concurrent readers share one refresh, old data never turns fresh.
 * Keys must be validated against the bounded pair catalog by the route.
 */
export function createMarketContextService(loaders: Loaders, now = Date.now, timeoutMs = 20_000) {
  const cache = new Map<string, { input: ContextInputs; startedAt: number; pending: Promise<void> | null }>();
  async function bounded<T>(work: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("source timeout")), timeoutMs); })]);
    } finally { clearTimeout(timer); }
  }
  return (pair: string): MarketContext => {
    let entry = cache.get(pair);
    if (!entry) { entry = { input: {}, startedAt: 0, pending: null }; cache.set(pair, entry); }
    if (!entry.pending && (entry.startedAt === 0 || now() - entry.startedAt >= 60_000)) {
      entry.startedAt = now();
      const current = entry;
      const keys = ["candles", "news", "sentiment", "calendar", "cot"] as const;
      current.pending = Promise.all(keys.map(async (key) => {
        try {
          const value = await bounded<NonNullable<ContextInputs[typeof key]>>(loaders[key](pair));
          Object.assign(current.input, { [key]: value });
          if (key === "candles") current.input.candlesFetchedAt = current.input.candles?.fetchedAt;
        } catch {
          delete current.input[key];
          if (key === "candles") delete current.input.candlesFetchedAt;
        }
      })).then(() => { current.pending = null; });
    }
    const result = buildMarketContext(pair, entry.input, new Date(now()));
    result.refreshing = entry.pending !== null;
    if (entry.pending && result.score === null) result.status = "warming";
    return result;
  };
}
