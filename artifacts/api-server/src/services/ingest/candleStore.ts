// ─── Candle warehouse store ──────────────────────────────────────────────────
// Write + read access to the partitioned `candle` table. Writes are idempotent
// upserts; reads aggregate the M1 base into the requested timeframe in SQL so we
// never ship millions of M1 rows to Node. See
// docs/superpowers/specs/2026-06-14-candle-warehouse-design.md.
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { candleIngestionStateTable, candleTable, db } from "@workspace/db";
import type { Candle } from "../candles.js";
import { RES } from "../candleRegistry.js";

const WEEK_SECONDS = 604800;
const FIRST_MONDAY = 345600; // 1970-01-05 00:00 UTC, anchor for Monday-aligned weeks

/** Ensure a monthly partition exists for every month spanned by [fromTs, toTs]. */
export async function ensurePartitions(fromTs: number, toTs: number): Promise<void> {
  const end = new Date(toTs * 1000);
  let y = new Date(fromTs * 1000).getUTCFullYear();
  let m = new Date(fromTs * 1000).getUTCMonth(); // 0-based
  const endY = end.getUTCFullYear();
  const endM = end.getUTCMonth();

  while (y < endY || (y === endY && m <= endM)) {
    const monthStart = Date.UTC(y, m, 1) / 1000;
    const monthEnd = Date.UTC(y, m + 1, 1) / 1000; // Date.UTC rolls Dec→Jan over the year
    const name = `candle_p${y}_${String(m + 1).padStart(2, "0")}`;
    await db.execute(
      sql.raw(
        `CREATE TABLE IF NOT EXISTS "${name}" PARTITION OF "candle" FOR VALUES FROM (${monthStart}) TO (${monthEnd})`,
      ),
    );
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
}

/** Idempotently upsert candles. Returns the number of rows written. */
export async function upsertCandles(
  symbolId: number,
  res: number,
  sourceId: number,
  candles: Candle[],
): Promise<number> {
  if (candles.length === 0) return 0;
  const rows = candles.map((c) => ({
    symbol: symbolId,
    res,
    ts: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume ?? 0,
    source: sourceId,
  }));

  const CHUNK = 1000; // 9 cols × 1000 = 9k params, well under the pg limit
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    await db
      .insert(candleTable)
      .values(slice)
      .onConflictDoUpdate({
        target: [candleTable.symbol, candleTable.res, candleTable.ts],
        set: {
          open: sql`excluded.open`,
          high: sql`excluded.high`,
          low: sql`excluded.low`,
          close: sql`excluded.close`,
          volume: sql`excluded.volume`,
          source: sql`excluded.source`,
        },
      });
    written += slice.length;
  }
  return written;
}

/** Record the ingestion watermark for a (symbol, res), widening first/last ts. */
export async function updateIngestionState(
  symbolId: number,
  res: number,
  sourceId: number,
  firstTs: number,
  lastTs: number,
  status = "idle",
): Promise<void> {
  await db
    .insert(candleIngestionStateTable)
    .values({ symbol: symbolId, res, source: sourceId, firstTs, lastTs, status })
    .onConflictDoUpdate({
      target: [candleIngestionStateTable.symbol, candleIngestionStateTable.res],
      set: {
        source: sourceId,
        firstTs: sql`LEAST(${candleIngestionStateTable.firstTs}, excluded.first_ts)`,
        lastTs: sql`GREATEST(${candleIngestionStateTable.lastTs}, excluded.last_ts)`,
        status,
        lastError: null,
        updatedAt: new Date(),
      },
    });
}

/** Ingestion watermark for a (symbol, res), or null if never ingested. */
export async function readWatermark(
  symbolId: number,
  res: number,
): Promise<{ firstTs: number | null; lastTs: number | null } | null> {
  const rows = await db
    .select({ firstTs: candleIngestionStateTable.firstTs, lastTs: candleIngestionStateTable.lastTs })
    .from(candleIngestionStateTable)
    .where(and(eq(candleIngestionStateTable.symbol, symbolId), eq(candleIngestionStateTable.res, res)))
    .limit(1);
  return rows[0] ?? null;
}

/** Raw base-resolution candles in [fromTs, toTs). */
export async function readBaseRange(
  symbolId: number,
  res: number,
  fromTs: number,
  toTs: number,
): Promise<Candle[]> {
  const rows = await db
    .select()
    .from(candleTable)
    .where(
      and(
        eq(candleTable.symbol, symbolId),
        eq(candleTable.res, res),
        gte(candleTable.ts, fromTs),
        lt(candleTable.ts, toTs),
      ),
    )
    .orderBy(asc(candleTable.ts));
  return rows.map((r) => ({
    time: r.ts,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
  }));
}

/**
 * Aggregate the M1 base into `intervalSeconds` buckets in SQL. Buckets are
 * UTC-aligned; weekly buckets are anchored to Monday 00:00 UTC. Mirrors the pure
 * `aggregate()` helper, which is the tested reference.
 */
export async function readAggregated(
  symbolId: number,
  intervalSeconds: number,
  fromTs: number,
  toTs: number,
  opts: { limit?: number; fromStart?: boolean } = {},
): Promise<Candle[]> {
  const offset = intervalSeconds === WEEK_SECONDS ? FIRST_MONDAY : 0;
  // When a limit is given without fromStart, take the most recent N buckets
  // (ORDER DESC + LIMIT) and reverse to ascending; otherwise take the first N.
  const takeLast = opts.fromStart === false && opts.limit != null;
  const direction = sql.raw(takeLast ? "DESC" : "ASC");
  const limit = opts.limit != null ? sql`LIMIT ${opts.limit}` : sql``;
  const result = await db.execute(sql`
    SELECT
      ((ts - ${offset}) / ${intervalSeconds}) * ${intervalSeconds} + ${offset} AS bucket,
      (array_agg(open ORDER BY ts ASC))[1]   AS open,
      max(high)                              AS high,
      min(low)                               AS low,
      (array_agg(close ORDER BY ts DESC))[1] AS close,
      sum(volume)                            AS volume
    FROM ${candleTable}
    WHERE symbol = ${symbolId} AND res = ${RES.M1} AND ts >= ${fromTs} AND ts < ${toTs}
    GROUP BY bucket
    ORDER BY bucket ${direction}
    ${limit}
  `);
  const rows = result.rows.map((r) => ({
    time: Number(r.bucket),
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
    volume: Number(r.volume),
  }));
  return takeLast ? rows.reverse() : rows;
}
