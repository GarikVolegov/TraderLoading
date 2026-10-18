import { bucketStart } from "./aggregate.js";
import { INTERVAL_SECONDS, REPLAY_INSTRUMENTS, SOURCE_ID, symbolId } from "./candleRegistry.js";
import type { Candle, CandlesRequestOptions, CandlesResult } from "./candles.js";

export class ReplayHistoryError extends Error {
  readonly status = 409;
}

type HistoryDeps = {
  read: (
    sid: number,
    seconds: number,
    from: number,
    to: number,
    options: { limit?: number; fromStart?: boolean; sourceId?: number },
  ) => Promise<Candle[]>;
  now?: number;
  loadBounds?: (
    sid: number,
    source: number,
    to: number,
  ) => Promise<{ firstTs: number; lastTs: number } | null>;
};

/** Forward pages and warm-up are always aggregated from the same persisted M1
 * quote feed. A replay never switches to Yahoo futures or a transient cache. */
export async function readReplayHistory(
  symbol: string,
  interval: string,
  options: CandlesRequestOptions,
  deps?: HistoryDeps,
): Promise<CandlesResult> {
  const sid = symbolId(symbol);
  const seconds = INTERVAL_SECONDS[interval];
  if (sid === undefined || !seconds)
    throw new ReplayHistoryError("Strumento o timeframe non disponibile nello storico permanente.");
  const source =
    REPLAY_INSTRUMENTS[symbol]?.source ??
    (symbol === "BTCUSD" || symbol === "ETHUSD" ? "binance" : "dukascopy");
  const sourceId = SOURCE_ID[source];
  const read = deps?.read ?? (await import("./ingest/candleStore.js")).readAggregated;
  const now = deps?.now ?? Math.floor(Date.now() / 1000);
  const loadBounds = deps?.loadBounds ?? (await import("./ingest/candleStore.js")).readSourceBounds;
  const archiveBounds = await loadBounds(sid, sourceId, now);
  const availableTo = archiveBounds == null ? undefined : archiveBounds.lastTs + 60;
  const limit = Math.max(1, Math.min(5000, Math.floor(options.limit ?? 5000)));
  const warmup = Math.max(0, Math.min(1000, Math.floor(options.warmupBars ?? 250)));
  const dateAnchor = options.startDate
    ? Date.parse(`${options.startDate}T00:00:00Z`) / 1000
    : undefined;
  const anchor = options.anchorTime ?? options.from ?? dateAnchor;
  let candles: Candle[];
  let forward: Candle[];
  if (anchor != null) {
    if (!Number.isFinite(anchor)) throw new ReplayHistoryError("Data iniziale non valida.");
    if (
      options.from == null &&
      (archiveBounds == null ||
        anchor > archiveBounds.lastTs + 60 ||
        anchor < archiveBounds.firstTs)
    ) {
      throw new ReplayHistoryError("La data scelta è fuori dallo storico permanente disponibile.");
    }
    const from =
      options.from != null
        ? bucketStart(options.from + seconds - 1, seconds)
        : bucketStart(anchor, seconds);
    const to = Math.min(options.to ?? from + 5000 * seconds * 3, availableTo ?? now, now);
    forward = await read(sid, seconds, from, to, { limit, fromStart: true, sourceId });
    if (
      options.from == null &&
      ((forward.length === 0 && anchor !== availableTo) ||
        (forward[0] && forward[0].time > anchor + 4 * 86400))
    ) {
      throw new ReplayHistoryError(
        "Dati permanenti non disponibili per la data scelta. Controlla la copertura o importa lo storico.",
      );
    }
    const previous =
      options.from == null && warmup > 0
        ? await read(sid, seconds, from - Math.max(warmup * 3, 5000) * seconds, from, {
            limit: warmup,
            fromStart: false,
            sourceId,
          })
        : [];
    candles = [...previous, ...forward];
  } else {
    const requestedTo = Math.min(options.to ?? now, now);
    const bounds =
      options.to != null && requestedTo < (availableTo ?? now)
        ? await loadBounds(sid, sourceId, requestedTo)
        : archiveBounds;
    const to = bounds ? Math.min(requestedTo, bounds.lastTs + 60) : requestedTo;
    candles = bounds
      ? await read(sid, seconds, to - 5000 * seconds * 3, to, { limit, fromStart: false, sourceId })
      : [];
    forward = candles;
    if (candles.length === 0 && options.to == null)
      throw new ReplayHistoryError("Storico permanente non ancora importato per questo strumento.");
  }
  const nextFrom =
    anchor != null && forward.length === limit
      ? forward[forward.length - 1].time + seconds
      : undefined;
  const result: CandlesResult = {
    symbol,
    interval,
    source,
    candles,
    ...(availableTo == null ? {} : { availableTo }),
    ...(nextFrom == null ? {} : { nextFrom }),
  };
  if (options.replayTime != null) {
    const observedTo = Math.min(options.replayTime, availableTo ?? now, now);
    const cutoff = Math.floor(observedTo / 60) * 60;
    const start = bucketStart(cutoff - 1, seconds);
    const partial = await read(sid, seconds, start, cutoff, {
      limit: 1,
      fromStart: true,
      sourceId,
    });
    result.partialCandle = partial[0] ?? null;
    result.replayTime = observedTo;
  }
  return result;
}
