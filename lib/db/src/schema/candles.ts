import {
  bigint,
  doublePrecision,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Candle warehouse. The physical `candle` table is RANGE-partitioned by `ts`
// (one partition per month) — see drizzle/0006_candle_warehouse.sql. This
// declaration exists for typed queries only; partitioning is transparent to
// Drizzle. IMPORTANT: apply changes via `db:migrate`, never `db:push` (push would
// recreate `candle` as a plain, unpartitioned table).
//
// Numeric ids (`symbol`, `source`, `res`) come from the registry in
// artifacts/api-server/src/services/candleRegistry.ts. Conventions: `ts` is the
// bar open-time as a UTC unix-second; OHLC is double precision; `volume` is
// tick-volume (Dukascopy) or traded base-volume (Binance).
export const candleTable = pgTable(
  "candle",
  {
    symbol: smallint("symbol").notNull(),
    res: smallint("res").notNull(),
    ts: bigint("ts", { mode: "number" }).notNull(),
    open: doublePrecision("open").notNull(),
    high: doublePrecision("high").notNull(),
    low: doublePrecision("low").notNull(),
    close: doublePrecision("close").notNull(),
    volume: doublePrecision("volume").notNull().default(0),
    source: smallint("source").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.symbol, t.res, t.ts] }) }),
);

// Per-(symbol, res) ingestion watermark, used by the seed/tail jobs to resume
// incrementally and to surface ingestion health.
export const candleIngestionStateTable = pgTable(
  "candle_ingestion_state",
  {
    symbol: smallint("symbol").notNull(),
    res: smallint("res").notNull(),
    source: smallint("source").notNull(),
    firstTs: bigint("first_ts", { mode: "number" }),
    lastTs: bigint("last_ts", { mode: "number" }),
    status: text("status").notNull().default("idle"),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.symbol, t.res] }) }),
);

export type CandleRow = typeof candleTable.$inferSelect;
export type CandleIngestionStateRow = typeof candleIngestionStateTable.$inferSelect;
