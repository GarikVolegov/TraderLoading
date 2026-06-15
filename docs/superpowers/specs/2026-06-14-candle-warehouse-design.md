# Candle Warehouse Design (Backtest — Phase 1)

## Context

Backtest candles are currently fetched **live** on every request in
[`artifacts/api-server/src/services/candles.ts`](../../../artifacts/api-server/src/services/candles.ts)
from Yahoo → TwelveData → CoinGecko, with a 1h in-memory + Redis cache. There is
**no persistent OHLC storage** (no candle table in `lib/db/src/schema/`).

This causes the three problems the backtest needs to solve:

- **Shallow history**: Yahoo intraday is capped at ~60 days; H1/H4/D1 at ~2 years
  (`YAHOO_RANGE`). Live APIs are rate-limited and capped by nature.
- **Timeframes are not linked**: every timeframe is fetched independently, so an
  H1 candle is _not_ the exact aggregate of its M5 candles. The replay
  timeframe switch uses an approximate anchor (`ChartReplay.tsx` `handleChangeInterval`).
- **Meaningless volume**: forex has no real exchange volume; `candleVolume` falls
  back to `1`, so VWAP and Volume Profile are computed on fake data.

Phase 1 builds the foundation that fixes all three: a local **candle warehouse**
that stores a single high-resolution series (M1) per instrument, seeded from free
bulk sources, and serves every timeframe by deterministic aggregation.

This document specifies **only Phase 1 (the warehouse + ingestion + serving)**.
Phases 2–4 (single replay time-cursor / MTF, indicator engine + real volume, UI
restyle) build on top and are out of scope here.

## Decisions (locked)

| Aspect          | Decision                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| Storage         | Candle warehouse in Postgres (the existing Drizzle/`pg` stack)                                              |
| Base resolution | **M1 universal** (D1 only where free M1 is unavailable)                                                     |
| Seed depth      | **5 years**                                                                                                 |
| Partitioning    | **Native Postgres monthly range partitioning** (no TimescaleDB)                                             |
| Seed sources    | Dukascopy (FX/metals/indices, real tick-volume) · Binance dumps (crypto) · Stooq/Yahoo-max (daily fallback) |
| Execution       | AWS: seed = one-shot Fargate `RunTask`; tail = EventBridge Scheduler → ECS `RunTask`                        |
| Serving         | `getCandles` becomes DB-first: aggregate M1→TF + merge live tail + Redis cache                              |
| Time/price      | bar **open-time, UTC, unix seconds**; tick-volume                                                           |

## Goals

- Persist OHLCV candles locally so backtest history goes back ~5 years for all 17
  supported symbols, independent of live-API range caps.
- Make timeframes mutually consistent: every HTF candle is the exact aggregate of
  the stored M1 candles (the prerequisite for Phase 2's linked timeframes).
- Capture **real tick-volume** for FX/metals/indices (Dukascopy), so Phase 3 can
  make VWAP / Volume Profile meaningful.
- Keep the public contract unchanged: `/api/backtest/candles` and the frontend
  `replayCandlesApi` keep working exactly as today.
- Ship behind a feature flag with a live fallback, so there is **zero regression**
  if the warehouse is empty for a symbol/interval.

## Non-Goals

- No replay/UI changes (Phase 2+).
- No new indicators (Phase 3).
- No TimescaleDB / columnar engine in this iteration.
- No tick-level storage — base is M1, not raw ticks.
- No real-time streaming; the live tail is still the existing pull-based fetch.

## Data Model

### Tables

Two tables in a new `lib/db/src/schema/candles.ts`, exported from
`schema/index.ts`.

```ts
// lib/db/src/schema/candles.ts
import {
  bigint,
  doublePrecision,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Physical table is RANGE-partitioned by `ts` (monthly) via a hand-written SQL
// migration — drizzle-kit cannot emit PARTITION BY. This declaration exists for
// typed queries only; see "Migrations" below.
export const candleTable = pgTable(
  "candle",
  {
    symbol: smallint("symbol").notNull(), // instrument id, see registry
    res: smallint("res").notNull(), // stored resolution: 1 = M1, 1440 = D1
    ts: bigint("ts", { mode: "number" }).notNull(), // bar open-time, UTC unix seconds
    open: doublePrecision("open").notNull(),
    high: doublePrecision("high").notNull(),
    low: doublePrecision("low").notNull(),
    close: doublePrecision("close").notNull(),
    volume: doublePrecision("volume").notNull().default(0), // tick-volume (Dukascopy) / base volume (Binance)
    source: smallint("source").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.symbol, t.res, t.ts] }) }),
);

export const candleIngestionStateTable = pgTable(
  "candle_ingestion_state",
  {
    symbol: smallint("symbol").notNull(),
    res: smallint("res").notNull(),
    source: smallint("source").notNull(),
    firstTs: bigint("first_ts", { mode: "number" }), // earliest stored bar
    lastTs: bigint("last_ts", { mode: "number" }), // watermark: latest stored bar
    status: text("status").notNull().default("idle"), // idle | seeding | tailing | error
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.symbol, t.res] }) }),
);
```

Type/column choices:

- **`ts` as `bigint` (mode number)**: unix seconds; `bigint` avoids the int4/2038
  overflow and stays a JS `number` (always < 2^53). Aligns with the existing
  `Candle.time` (seconds) and lightweight-charts.
- **OHLC as `double precision`**: `float4` (the current `toFixed(5)` approach)
  loses precision on JPY pairs, indices, and BTC. `float8` is fixed-width and
  exact enough (15–16 significant digits).
- **`symbol`/`source` as `smallint`**: narrow rows matter at ~30M rows. The id↔code
  mapping is a single TS registry (below), mirroring how `YAHOO_SYMBOLS` already
  lives in code — no join on the hot path.
- **`res` as `smallint` = minutes per bar** (1 = M1, 1440 = D1). The aggregator
  always reads the finest available `res ≤ requested`.

### Instrument & source registry

A single source of truth in `artifacts/api-server/src/services/candleRegistry.ts`
(or shared lib), reusing the existing symbol set:

```ts
export const SYMBOL_ID: Record<string, number> = {
  EURUSD: 1,
  GBPUSD: 2,
  USDJPY: 3,
  USDCHF: 4,
  AUDUSD: 5,
  NZDUSD: 6,
  USDCAD: 7,
  EURGBP: 8,
  EURJPY: 9,
  GBPJPY: 10,
  AUDJPY: 11,
  XAUUSD: 12,
  US30: 13,
  NAS100: 14,
  SPX500: 15,
  BTCUSD: 16,
  ETHUSD: 17,
};
export const SOURCE_ID = { dukascopy: 1, binance: 2, stooq: 3, yahoo: 4, twelvedata: 5 } as const;
export const RES = { M1: 1, D1: 1440 } as const;
```

### Partitioning & indexes

The physical table is **RANGE-partitioned by `ts`, one partition per month**.

- The composite PK `(symbol, res, ts)` becomes a per-partition btree and is the
  primary access path: every serving query filters `symbol = ? AND res = ? AND
ts BETWEEN ? AND ?`, which the PK satisfies with a leading-equality + range scan.
- Monthly partitions give cheap pruning and let old months be detached/archived
  later without table rewrites.
- A BRIN index on `ts` is **optional** (the PK already leads with symbol/res); add
  it only if symbol-agnostic time scans appear.
- Partition creation is automated: the seed/tail job ensures the needed month
  partitions exist (`CREATE TABLE IF NOT EXISTS candle_YYYY_MM PARTITION OF candle
FOR VALUES FROM (...) TO (...)`) before inserting.

### Migrations

drizzle-kit cannot generate `PARTITION BY`. Approach:

1. Declare both tables in the Drizzle schema (for typed queries).
2. Add a **hand-written** SQL migration `lib/db/drizzle/0006_candle_warehouse.sql`
   (next in sequence) that creates the partitioned parent table, the PK, the
   `candle_ingestion_state` table, and a default set of monthly partitions
   covering the 5-year window. Generate the slot with
   `pnpm db:generate --custom` and fill the SQL by hand.
3. The seed job creates any missing future partitions at runtime.

### Sizing

5-year M1: FX ≈ 1.85M bars/symbol; crypto (24/7) ≈ 2.6M/symbol. Across the 17
symbols ≈ **25–30M rows ≈ 2–2.5 GB heap + PK index**. Comfortable for native
partitioning; TimescaleDB compression is unnecessary at this scale and is not
guaranteed available (the DB provider is a `DATABASE_URL` secret, not pinned in
the repo).

## Symbol ↔ Source Mapping

| Symbol                | Primary (M1) | Dukascopy instrument\* | Binance   | Daily fallback      |
| --------------------- | ------------ | ---------------------- | --------- | ------------------- |
| EURUSD…AUDJPY (11 FX) | Dukascopy    | `eurusd`, `gbpusd`, …  | —         | Stooq EOD           |
| XAUUSD                | Dukascopy    | `xauusd`               | —         | Stooq EOD           |
| US30                  | Dukascopy    | `usa30idxusd`          | —         | Stooq/Yahoo `^DJI`  |
| NAS100                | Dukascopy    | `usatechidxusd`        | —         | Stooq/Yahoo `^NDX`  |
| SPX500                | Dukascopy    | `usa500idxusd`         | —         | Stooq/Yahoo `^GSPC` |
| BTCUSD                | Binance      | —                      | `BTCUSDT` | —                   |
| ETHUSD                | Binance      | —                      | `ETHUSDT` | —                   |

\* Exact Dukascopy instrument ids must be verified at implementation time against
`dukascopy-node`'s instrument list. Binance uses USDT pairs as the USD proxy
(documented limitation). If a Dukascopy instrument is missing for an index, fall
back to **D1** from Stooq/Yahoo-max (`res = D1`); the aggregator still serves
D1/W1 from it, and intraday TFs degrade gracefully to the live path.

## Ingestion Pipeline

New module `artifacts/api-server/src/services/ingest/` (or a `scripts` entry),
with one **adapter per source** behind a common interface:

```ts
interface CandleSource {
  id: number; // SOURCE_ID
  supports(symbol: string): boolean;
  // returns M1 (or D1) candles in [from, to], ascending, UTC unix-seconds open-time
  fetchRange(symbol: string, fromTs: number, toTs: number): Promise<Candle[]>;
}
```

Adapters:

- **DukascopySource** — via `dukascopy-node`, timeframe `m1`, OHLCV with real
  tick-volume. Fetches in chunked date ranges (the library streams per day/week).
- **BinanceSource** — seed from the public monthly dumps
  `https://data.binance.vision/data/spot/monthly/klines/{PAIR}/1m/{PAIR}-1m-YYYY-MM.zip`
  (fast bulk); tail from the REST `klines` API for the current month. Maps
  BTCUSD→BTCUSDT, ETHUSD→ETHUSDT.
- **StooqSource** (daily fallback) — CSV EOD, `res = D1`.

### Modes

- **Seed** (one-off, heavy): for each (symbol, source), fetch from `now − 5y` to
  `now`, in monthly chunks, ensuring month partitions exist, then bulk
  `INSERT … ON CONFLICT (symbol,res,ts) DO UPDATE SET o/h/l/c/volume`. Update
  `candle_ingestion_state` (`first_ts`, `last_ts`, `status`). Idempotent and
  resumable from `last_ts`.
- **Tail** (nightly): for each (symbol, source), re-fetch from
  `last_ts − safetyWindow` (e.g. 2 days) to `now` and upsert. The overlap
  self-heals small gaps without explicit gap detection.

### Normalization & integrity

- All timestamps converted to **UTC unix seconds at bar open**.
- Drop bars with null/NaN OHLC; clamp obvious source glitches (high≥max(o,c),
  low≤min(o,c)) are validated, logged, and skipped if inconsistent.
- Upsert is the only write path → ingestion can always be re-run safely.

## Serving Layer

`getCandles(symbol, interval, options)` is rewritten **DB-first**, keeping the
exact `CandlesResult` shape and the `/api/backtest/candles` contract:

1. **Resolve range** from `interval` + optional `startDate` (reuse existing
   `normalizeStartDate`). Default window mirrors today's behavior (enough bars to
   exceed `MIN_REPLAY_CANDLES = 120`).
2. **Read + aggregate from the warehouse**:
   - `interval === "M1"` → read base rows directly.
   - else → aggregate M1→interval **in SQL** (GROUP BY time-bucket) to avoid
     shipping millions of M1 rows to Node:
     ```sql
     SELECT (ts / :sec) * :sec AS bucket,
            (array_agg(open  ORDER BY ts ASC ))[1]                       AS open,
            max(high) AS high, min(low) AS low,
            (array_agg(close ORDER BY ts DESC))[1]                       AS close,
            sum(volume) AS volume
     FROM candle
     WHERE symbol = :sym AND res = 1 AND ts >= :from AND ts < :to
     GROUP BY bucket ORDER BY bucket;
     ```
   - Bucket alignment is **UTC**: M5→`:00/:05…`, H1→top of hour, H4→`0/4/8/12/16/20`
     UTC, D1→`00:00 UTC`, W1→Monday `00:00 UTC`. (FX 17:00-NY daily is a future
     option, not v1.)
3. **Merge the live tail**: for the latest window (no `startDate`, or `startDate`
   near `now`), fetch the requested TF from the existing live chain and
   **concat + dedupe by bucket open-time**, with live bars winning for any bucket
   at/after the warehouse watermark. This keeps "today's" forming candles fresh
   without needing M1 from Yahoo (the live tail is already at the requested TF).
4. **Cache** the aggregated+merged result in Redis via `getJsonCache/setJsonCache`
   (existing helpers), reusing the current TTL strategy.
5. **Feature flag + fallback**: behind `CANDLE_WAREHOUSE=1`. If the warehouse has
   `< MIN_REPLAY_CANDLES` for (symbol, interval), fall back to the current live
   path unchanged → zero regression while seeding rolls out.

`CandlesResult.source` becomes `"warehouse"` or `"warehouse+live"` for
observability.

### Pure aggregator

`artifacts/api-server/src/services/aggregate.ts`:

```ts
export function aggregate(m1: Candle[], intervalSeconds: number): Candle[];
// open = first.open, close = last.close, high = max, low = min,
// volume = sum, time = bucket open-time (floor(ts/intervalSeconds)*intervalSeconds)
```

Used for (a) merging the live M1 tail when applicable and (b) as the tested
reference the SQL aggregation is checked against. Pure and fully unit-tested.

## AWS Execution

Reuse the existing image
([`Dockerfile.aws`](../../../Dockerfile.aws)); add an ingestion entrypoint built
into the api-server bundle, e.g. `node ./dist/ingest.cjs <seed|tail> [flags]`.
The api-server build must emit `dist/ingest.cjs` alongside `dist/index.cjs`.

- **Seed (one-shot)**: `aws ecs run-task` on the existing Fargate cluster, in the
  **same VPC/subnets/SG** as the service (so it reaches the private DB + Redis),
  with raised CPU/mem (e.g. 2 vCPU / 4 GB) and
  `command = ["node","./dist/ingest.cjs","seed","--years=5"]`. Can be run
  per-symbol to bound memory and parallelize.
- **Tail (nightly)**: add to
  [`infra/aws/cloudformation/ecs-fargate.yml`](../../../infra/aws/cloudformation/ecs-fargate.yml):
  - an `AWS::Scheduler::Schedule` (EventBridge Scheduler, cron e.g. `02:00 UTC`),
  - target = ECS `RunTask` with `ContainerOverrides.command =
["node","./dist/ingest.cjs","tail"]` against the existing task definition,
  - an IAM role granting the scheduler `ecs:RunTask` + `iam:PassRole` for the
    task/execution roles.
    No always-on worker; billed only for the minutes the job runs.

## Rollout Plan

1. Add schema + the `0006_candle_warehouse.sql` migration; apply to the local
   Postgres (`.local-postgres`) via `pnpm db:migrate`/`db:push`.
2. Implement adapters + `aggregate.ts`; unit tests green.
3. **Validate one symbol locally**: seed EURUSD M1 for 5y, then check
   - continuity (no large unexplained gaps inside FX trading hours),
   - tick-volume present and non-trivial,
   - OHLC sanity, and aggregated H1 vs live Yahoo H1 broadly agree.
4. Wire `getCandles` DB-first behind `CANDLE_WAREHOUSE`, with live fallback.
5. Seed all 17 symbols locally; validate; run the existing backtest replay end to
   end against the warehouse.
6. **Promote**: run the seed as a Fargate one-shot against the prod DB; enable the
   flag in prod; create the EventBridge tail schedule.
7. Monitor a few tail cycles, then make the warehouse the default and retire the
   flag (keep live purely as tail-merge + emergency fallback).

## Testing

Unit:

- `aggregate()` — bucket boundaries (M5/H1/H4/D1/W1), open/close/high/low/sum,
  partial trailing bucket, empty input, UTC alignment.
- SQL aggregation parity vs `aggregate()` on a fixture dataset.
- Adapter parsers (Dukascopy / Binance / Stooq) against recorded fixtures →
  normalized UTC unix-second candles.
- Tail watermark + overlap upsert is idempotent (re-run yields identical rows).
- `getCandles` DB-first: aggregation, live-tail merge/dedup, flag-off fallback,
  `< MIN_REPLAY_CANDLES` fallback.

Migration:

- `0006_candle_warehouse.sql` applies cleanly on an empty DB; partitions exist;
  upsert respects the PK.

Manual QA:

- Backtest replay on a deep `startDate` (e.g. 4 years ago) returns ≥120 candles
  from the warehouse with no live call.
- Switching timeframe returns mutually consistent candles (H1 == aggregate of M5).
- Most-recent window still shows a fresh forming candle (live-tail merge).

## Error Handling

- Warehouse miss / insufficient candles → transparent fallback to the live chain.
- A failing source during tail logs to `candle_ingestion_state.last_error`,
  status `error`, and does not block other symbols.
- Malformed source rows are skipped, never inserted.
- Aggregation never ships raw M1 to Node for HTFs (SQL-side GROUP BY) to bound
  memory/latency.

## Open Decisions Resolved

- Base resolution: **M1** (D1 only where free M1 is unavailable).
- Seed depth: **5 years**.
- Storage engine: **native monthly partitioning** (no TimescaleDB).
- Bucket alignment: **UTC** (D1 = 00:00 UTC, W1 = Monday); FX 17:00-NY is future.
- Time/price types: **bigint unix-seconds**, **float8 OHLC**, **tick-volume**.
- Identity: **smallint** symbol/source ids from a TS registry.
- Execution: **AWS Fargate** one-shot seed + **EventBridge Scheduler** nightly tail.
- Rollout: **feature-flagged**, DB-first with live fallback → zero regression.
