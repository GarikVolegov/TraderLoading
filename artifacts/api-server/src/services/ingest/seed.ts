// ─── Seed runner ─────────────────────────────────────────────────────────────
// Orchestrates a one-shot backfill for a single (symbol, range): fetch from a
// source, ensure partitions, upsert, and advance the ingestion watermark. The
// same building blocks drive the nightly tail (smaller range from the watermark).
import { RES, symbolId } from "../candleRegistry.js";
import { ensurePartitions, updateIngestionState, upsertCandles } from "./candleStore.js";
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
}

// Chunk fetches are the thing that rate-limits under a deep backfill. Retry each
// one with a growing cool-off (~5s, 15s, 45s, 90s cap) so a transient rate-limit
// on one month doesn't punch a permanent hole in the warehouse.
const CHUNK_FETCH_RETRY = { attempts: 4, baseDelayMs: 5_000, factor: 3, maxDelayMs: 90_000 } as const;

export async function seedSymbol(
  symbol: string,
  fromTs: number,
  toTs: number,
  source: CandleSource | undefined = sourceForSymbol(symbol),
): Promise<SeedResult> {
  const sid = symbolId(symbol);
  if (sid === undefined) throw new Error(`seed: unknown symbol ${symbol}`);
  if (!source) throw new Error(`seed: no data source supports ${symbol}`);
  if (!source.supports(symbol)) throw new Error(`seed: ${source.name} does not support ${symbol}`);

  const candles = await retryWithBackoff(() => source.fetchRange(symbol, fromTs, toTs), {
    ...CHUNK_FETCH_RETRY,
    onRetry: (error, attempt) =>
      console.warn(
        `[seed] ${symbol} ${new Date(fromTs * 1000).toISOString().slice(0, 10)} fetch attempt ${attempt} failed (${error instanceof Error ? error.message : String(error)}); backing off`,
      ),
  });
  if (candles.length === 0) return { symbol, source: source.name, fetched: 0, written: 0 };

  const firstTs = candles[0].time;
  const lastTs = candles[candles.length - 1].time;
  await ensurePartitions(firstTs, lastTs);
  const written = await upsertCandles(sid, RES.M1, source.id, candles);
  await updateIngestionState(sid, RES.M1, source.id, firstTs, lastTs);

  return { symbol, source: source.name, fetched: candles.length, written, firstTs, lastTs };
}
