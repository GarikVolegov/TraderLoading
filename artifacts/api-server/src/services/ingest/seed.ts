// ─── Seed runner ─────────────────────────────────────────────────────────────
// Orchestrates a one-shot backfill for a single (symbol, range): fetch from a
// source, ensure partitions, upsert, and advance the ingestion watermark. The
// same building blocks drive the nightly tail (smaller range from the watermark).
import { RES, symbolId } from "../candleRegistry.js";
import {
  ensurePartitions,
  isRangeVerified,
  recordImportChunk,
  updateIngestionState,
  upsertCandles,
} from "./candleStore.js";
import { validateImportCandles } from "./coverage.js";
import { retryWithBackoff } from "./retry.js";
import { sourceForSymbol } from "./sources.js";
import type { CandleSource } from "./types.js";

export interface SeedResult {
  symbol: string;
  source: string;
  fetched: number;
  written: number;
  firstTs?: number;
  lastTs?: number;
  skipped?: boolean;
}

// Chunk fetches are the thing that rate-limits under a deep backfill. Retry each
// one with a growing cool-off (~5s, 15s, 45s, 90s cap) so a transient rate-limit
// on one month doesn't punch a permanent hole in the warehouse.
const CHUNK_FETCH_RETRY = {
  attempts: 4,
  baseDelayMs: 5_000,
  factor: 3,
  maxDelayMs: 90_000,
} as const;

type SeedDependencies = {
  ensurePartitions: typeof ensurePartitions;
  isRangeVerified: typeof isRangeVerified;
  recordImportChunk: typeof recordImportChunk;
  updateIngestionState: typeof updateIngestionState;
  upsertCandles: typeof upsertCandles;
  retry: typeof retryWithBackoff;
};
const defaultDependencies: SeedDependencies = {
  ensurePartitions,
  isRangeVerified,
  recordImportChunk,
  updateIngestionState,
  upsertCandles,
  retry: retryWithBackoff,
};

export async function seedSymbol(
  symbol: string,
  fromTs: number,
  toTs: number,
  source: CandleSource | undefined = sourceForSymbol(symbol),
  options: { resume?: boolean } = {},
  deps: SeedDependencies = defaultDependencies,
): Promise<SeedResult> {
  const sid = symbolId(symbol);
  if (sid === undefined) throw new Error(`seed: unknown symbol ${symbol}`);
  if (!source) throw new Error(`seed: no data source supports ${symbol}`);
  if (!source.supports(symbol)) throw new Error(`seed: ${source.name} does not support ${symbol}`);

  if (options.resume && (await deps.isRangeVerified(symbol, fromTs, toTs, source.id))) {
    return { symbol, source: source.name, fetched: 0, written: 0, skipped: true };
  }
  const chunk = { symbol: sid, source: source.id, fromTs, toTs };
  await deps.recordImportChunk({ ...chunk, status: "running" });
  try {
    const raw = await deps.retry(() => source.fetchRange(symbol, fromTs, toTs), {
      ...CHUNK_FETCH_RETRY,
      onRetry: (error, attempt) =>
        console.warn(
          `[seed] ${symbol} ${new Date(fromTs * 1000).toISOString().slice(0, 10)} fetch attempt ${attempt} failed (${error instanceof Error ? error.message : String(error)}); backing off`,
        ),
    });
    const candles = validateImportCandles(raw, fromTs, toTs);
    if (candles.length === 0) {
      // Empty source responses must remain repairable, never certify a trading
      // month merely because the provider returned HTTP 200.
      throw new Error("Source returned no M1 candles for import range");
    }

    const firstTs = candles[0].time;
    const lastTs = candles[candles.length - 1].time;
    await deps.ensurePartitions(firstTs, lastTs);
    const written = await deps.upsertCandles(sid, RES.M1, source.id, candles);
    await deps.updateIngestionState(sid, RES.M1, source.id, firstTs, lastTs);
    await deps.recordImportChunk({
      ...chunk,
      status: "verified",
      candleCount: written,
      firstTs,
      lastTs,
    });

    return { symbol, source: source.name, fetched: candles.length, written, firstTs, lastTs };
  } catch (error) {
    await deps.recordImportChunk({
      ...chunk,
      status: "failed",
      lastError: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
