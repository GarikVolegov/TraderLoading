// ─── Candle warehouse store ──────────────────────────────────────────────────
// Write + read access to the partitioned `candle` table. Writes are idempotent
// upserts; reads aggregate the M1 base into the requested timeframe in SQL so we
// never ship millions of M1 rows to Node. See
// docs/superpowers/specs/2026-06-14-candle-warehouse-design.md.
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { candleImportChunksTable, candleIngestionStateTable, candleTable, db } from "@workspace/db";
import type { Candle } from "../candles.js";
import { REPLAY_INSTRUMENTS, RES, SOURCE_ID, symbolId } from "../candleRegistry.js";
import { coverageStatus, importFailureReason, mergeVerifiedRanges, missingWeekdays, rangeIsVerified, type ImportFailureReason, type VerifiedRange } from "./coverage.js";

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

  const CHUNK = 1500; // 9 cols × 1500 = 13.5k params, well under the pg 65k limit
  let written = 0;
  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      await tx
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

    // Automatically roll up D1 daily candles in the same transaction
    if (res === RES.M1 && candles.length > 0) {
      await tx.execute(sql`
        INSERT INTO ${candleTable} (symbol, res, ts, open, high, low, close, volume, source)
        SELECT
          symbol,
          ${RES.D1} as res,
          (ts / 86400) * 86400 as ts,
          (array_agg(open ORDER BY ts ASC))[1] as open,
          max(high) as high,
          min(low) as low,
          (array_agg(close ORDER BY ts DESC))[1] as close,
          sum(volume) as volume,
          source
        FROM ${candleTable}
        WHERE symbol = ${symbolId} AND res = ${RES.M1} AND ts >= ${candles[0].time} AND ts <= ${candles[candles.length - 1].time} AND source = ${sourceId}
        GROUP BY symbol, source, (ts / 86400) * 86400
        ON CONFLICT (symbol, res, ts) DO UPDATE SET
          open = EXCLUDED.open,
          high = EXCLUDED.high,
          low = EXCLUDED.low,
          close = EXCLUDED.close,
          volume = EXCLUDED.volume;
      `);
    }
  });
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

/** Actual persisted bounds, scoped to the canonical quote feed. Unlike the
 * ingestion watermark these also follow partition deletion/restoration. */
export async function readSourceBounds(sid: number, source: number, to: number): Promise<{ firstTs: number; lastTs: number } | null> {
  const rows = await db.execute(sql`SELECT min(ts) AS first, max(ts) AS last FROM ${candleTable}
    WHERE symbol = ${sid} AND res = ${RES.M1} AND source = ${source} AND ts < ${to}`);
  const row = rows.rows[0];
  return row?.first == null || row?.last == null ? null : { firstTs: Number(row.first), lastTs: Number(row.last) };
}

/** Raw base-resolution candles in [fromTs, toTs). */
export async function readBaseRange(
  symbolId: number,
  res: number,
  fromTs: number,
  toTs: number,
  sourceId?: number,
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
        sourceId == null ? undefined : eq(candleTable.source, sourceId),
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
  opts: { limit?: number; fromStart?: boolean; sourceId?: number } = {},
): Promise<Candle[]> {
  const takeLast = opts.fromStart === false && opts.limit != null;

  // Fast-path: read directly from pre-rolled D1 daily candles (100x faster than aggregating M1 base)
  if (intervalSeconds === 86400) {
    const directRows = await db
      .select()
      .from(candleTable)
      .where(
        and(
          eq(candleTable.symbol, symbolId),
          eq(candleTable.res, RES.D1),
          gte(candleTable.ts, fromTs),
          lt(candleTable.ts, toTs),
          opts.sourceId == null ? undefined : eq(candleTable.source, opts.sourceId),
        ),
      )
      .orderBy(takeLast ? desc(candleTable.ts) : asc(candleTable.ts))
      .limit(opts.limit ?? 5000);

    if (directRows.length > 0) {
      const rows = directRows.map((r) => ({
        time: r.ts,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume,
      }));
      return takeLast ? rows.reverse() : rows;
    }
  }

  // Fast-path: aggregate W1 directly from pre-rolled D1 daily candles (1500x faster than aggregating M1 base)
  if (intervalSeconds === WEEK_SECONDS) {
    const direction = sql.raw(takeLast ? "DESC" : "ASC");
    const limit = opts.limit != null ? sql`LIMIT ${opts.limit}` : sql``;
    const weeklyResult = await db.execute(sql`
      SELECT
        ((ts - ${FIRST_MONDAY}) / ${WEEK_SECONDS}) * ${WEEK_SECONDS} + ${FIRST_MONDAY} AS bucket,
        (array_agg(open ORDER BY ts ASC))[1]   AS open,
        max(high)                              AS high,
        min(low)                               AS low,
        (array_agg(close ORDER BY ts DESC))[1] AS close,
        sum(volume)                            AS volume
      FROM ${candleTable}
      WHERE symbol = ${symbolId} AND res = ${RES.D1} AND ts >= ${fromTs} AND ts < ${toTs}
        ${opts.sourceId == null ? sql`` : sql`AND source = ${opts.sourceId}`}
      GROUP BY bucket
      ORDER BY bucket ${direction}
      ${limit}
    `);

    if (weeklyResult.rows.length > 0) {
      const rows = weeklyResult.rows.map((r) => ({
        time: Number(r.bucket),
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        volume: Number(r.volume),
      }));
      return takeLast ? rows.reverse() : rows;
    }
  }

  const offset = intervalSeconds === WEEK_SECONDS ? FIRST_MONDAY : 0;
  // When a limit is given without fromStart, take the most recent N buckets
  // (ORDER DESC + LIMIT) and reverse to ascending; otherwise take the first N.
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
      ${opts.sourceId == null ? sql`` : sql`AND source = ${opts.sourceId}`}
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

export async function importLedgerAvailable(): Promise<boolean> {
  const result = await db.execute(sql`SELECT to_regclass('public.candle_import_chunks') IS NOT NULL AS present`);
  return result.rows[0]?.present === true;
}

export async function readVerifiedRanges(sid: number, source: number): Promise<VerifiedRange[]> {
  if (!await importLedgerAvailable()) return [];
  const rows = await db.select({ from: candleImportChunksTable.fromTs, to: candleImportChunksTable.toTs })
    .from(candleImportChunksTable).where(and(eq(candleImportChunksTable.symbol, sid),
      eq(candleImportChunksTable.res, RES.M1), eq(candleImportChunksTable.source, source), eq(candleImportChunksTable.status, "verified")));
  return mergeVerifiedRanges(rows);
}

export async function isRangeVerified(symbol: string, from: number, to: number, source?: number): Promise<boolean> {
  const sid = symbolId(symbol);
  const sourceId = source ?? SOURCE_ID[REPLAY_INSTRUMENTS[symbol]?.source ?? "dukascopy"];
  if (sid === undefined || !rangeIsVerified(await readVerifiedRanges(sid, sourceId), from, to)) return false;
  // A ledger row survives a deleted partition; check the data before skipping.
  const broken = await db.execute(sql`
    SELECT 1 FROM ${candleImportChunksTable} imported
    WHERE imported.symbol = ${sid} AND imported.res = ${RES.M1} AND imported.source = ${sourceId}
      AND imported.status = 'verified' AND imported.from_ts < ${to} AND imported.to_ts > ${from}
      AND imported.candle_count <> (SELECT count(*) FROM ${candleTable} c WHERE c.symbol = imported.symbol
        AND c.res = imported.res AND c.source = imported.source AND c.ts >= imported.from_ts AND c.ts < imported.to_ts)
    LIMIT 1
  `);
  if (broken.rows.length > 0) return false;
  const days = await db.execute(sql`SELECT DISTINCT to_char(to_timestamp(ts) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day
    FROM ${candleTable} WHERE symbol = ${sid} AND res = ${RES.M1} AND source = ${sourceId} AND ts >= ${from} AND ts < ${to}`);
  return missingWeekdays(from, to, new Set(days.rows.map(row => String(row.day)))).length === 0;
}

export async function recordImportChunk(input: {
  symbol: number; source: number; fromTs: number; toTs: number;
  status: "running" | "verified" | "failed"; candleCount?: number;
  firstTs?: number; lastTs?: number; lastError?: string;
}): Promise<void> {
  const values = { ...input, res: RES.M1, candleCount: input.candleCount ?? 0, updatedAt: new Date() };
  await db.insert(candleImportChunksTable).values(values).onConflictDoUpdate({
    target: [candleImportChunksTable.symbol, candleImportChunksTable.res, candleImportChunksTable.source, candleImportChunksTable.fromTs, candleImportChunksTable.toTs],
    set: { status: values.status, candleCount: values.candleCount, firstTs: input.firstTs ?? null,
      lastTs: input.lastTs ?? null, lastError: input.lastError?.slice(0, 500) ?? null, updatedAt: values.updatedAt },
  });
}

export type WarehouseCoverage = {
  status: "verified" | "partial" | "unavailable";
  candleCount: number; targetFrom: number; targetTo: number;
  verifiedRanges: VerifiedRange[]; missingDays: string[]; missingDayCount: number;
  lastImportedAt: string | null;
  lastImportStatus: "idle" | "running" | "verified" | "failed";
  lastImportReason: ImportFailureReason | null;
};

export async function readCoverage(sid: number, source: number, from: number, to: number): Promise<{
  firstTs: number | null; lastTs: number | null; coverage: WarehouseCoverage;
}> {
  const result = await db.execute(sql`
    SELECT count(*) AS count, min(ts) AS first, max(ts) AS last,
      array_agg(DISTINCT to_char(to_timestamp(ts) AT TIME ZONE 'UTC', 'YYYY-MM-DD')) AS days
    FROM ${candleTable} WHERE symbol = ${sid} AND res = ${RES.M1} AND source = ${source} AND ts >= ${from} AND ts < ${to}
  `);
  const row = result.rows[0];
  const count = Number(row?.count ?? 0);
  // Coverage is measured over the requested five-year target; date controls
  // must still expose every stored bar, including older history and today's tail.
  const bounds = await readSourceBounds(sid, source, Math.floor(Date.now() / 1000));
  const verifiedRanges = await readVerifiedRanges(sid, source);
  const missingDays = missingWeekdays(from, to, new Set((row?.days ?? []) as string[]));
  let lastImportedAt: string | null = null;
  let lastImportStatus: WarehouseCoverage["lastImportStatus"] = "idle";
  let lastImportReason: ImportFailureReason | null = null;
  if (await importLedgerAvailable()) {
    const last = await db.execute(sql`SELECT max(updated_at) AS updated FROM ${candleImportChunksTable}
      WHERE symbol = ${sid} AND res = ${RES.M1} AND source = ${source} AND status = 'verified'`);
    if (last.rows[0]?.updated) lastImportedAt = new Date(String(last.rows[0].updated)).toISOString();
    const attempt = await db.execute(sql`SELECT status, last_error FROM ${candleImportChunksTable}
      WHERE symbol = ${sid} AND res = ${RES.M1} AND source = ${source} ORDER BY updated_at DESC LIMIT 1`);
    const status = attempt.rows[0]?.status;
    if (status === "running" || status === "verified" || status === "failed") lastImportStatus = status;
    if (status === "failed") lastImportReason = importFailureReason(attempt.rows[0]?.last_error == null ? null : String(attempt.rows[0].last_error));
  }
  return { firstTs: bounds?.firstTs ?? null, lastTs: bounds?.lastTs ?? null,
    coverage: { status: coverageStatus(count, verifiedRanges, from, to, missingDays),
      candleCount: count, targetFrom: from, targetTo: to, verifiedRanges, missingDays, missingDayCount: missingDays.length, lastImportedAt, lastImportStatus, lastImportReason } };
}
