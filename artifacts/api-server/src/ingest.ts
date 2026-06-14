// ─── Candle warehouse ingestion CLI ──────────────────────────────────────────
// One-shot seed (backfill) and nightly tail (incremental from the watermark).
// Built to dist/ingest.cjs and run as `node ./dist/ingest.cjs <seed|tail> [flags]`
// — locally for the full backfill, and on AWS as a Fargate RunTask (seed) /
// EventBridge-scheduled RunTask (tail). See
// docs/superpowers/specs/2026-06-14-candle-warehouse-design.md.
import { closeDbPool } from "@workspace/db";
import { RES, SYMBOL_ID } from "./services/candleRegistry.js";
import { readWatermark } from "./services/ingest/candleStore.js";
import { seedSymbol } from "./services/ingest/seed.js";
import { sourceForSymbol } from "./services/ingest/sources.js";

const DAY = 86_400;
const DEFAULT_SEED_YEARS = 5;
const TAIL_SAFETY_DAYS = 2; // overlap re-fetch to self-heal small gaps
const TAIL_COLD_START_DAYS = 7; // when a symbol has no watermark yet

function parseFlags(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) flags[match[1]] = match[2];
    else if (arg.startsWith("--")) flags[arg.slice(2)] = "true";
  }
  return flags;
}

function dayStart(date: string): number {
  const ts = Math.floor(new Date(`${date}T00:00:00.000Z`).getTime() / 1000);
  if (!Number.isFinite(ts)) throw new Error(`invalid date: ${date}`);
  return ts;
}

async function resolveRange(
  mode: "seed" | "tail",
  symbol: string,
  flags: Record<string, string>,
  now: number,
): Promise<{ fromTs: number; toTs: number }> {
  if (mode === "seed") {
    const toTs = flags.to ? dayStart(flags.to) : now;
    const years = Number(flags.years ?? DEFAULT_SEED_YEARS);
    const fromTs = flags.from ? dayStart(flags.from) : toTs - years * 365 * DAY;
    return { fromTs, toTs };
  }
  const watermark = await readWatermark(SYMBOL_ID[symbol as keyof typeof SYMBOL_ID], RES.M1);
  const fromTs = watermark?.lastTs ? watermark.lastTs - TAIL_SAFETY_DAYS * DAY : now - TAIL_COLD_START_DAYS * DAY;
  return { fromTs, toTs: now };
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode !== "seed" && mode !== "tail") {
    console.error("usage: ingest <seed|tail> [--symbols=EURUSD,BTCUSD] [--years=5] [--from=YYYY-MM-DD] [--to=YYYY-MM-DD]");
    process.exitCode = 1;
    return;
  }

  const flags = parseFlags(process.argv.slice(3));
  const now = Math.floor(Date.now() / 1000);
  const supportedSymbols = Object.keys(SYMBOL_ID).filter((symbol) => sourceForSymbol(symbol));
  const symbols = flags.symbols
    ? flags.symbols.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : supportedSymbols;

  console.log(`[ingest] ${mode} | ${symbols.length} symbol(s)`);
  let ok = 0;
  let failed = 0;
  let totalBars = 0;

  for (const symbol of symbols) {
    if (!sourceForSymbol(symbol)) {
      console.warn(`[ingest] skip ${symbol}: no data source`);
      continue;
    }
    try {
      const { fromTs, toTs } = await resolveRange(mode, symbol, flags, now);
      const startedAt = Date.now();
      const result = await seedSymbol(symbol, fromTs, toTs);
      totalBars += result.written;
      ok += 1;
      console.log(
        `[ingest] ${symbol} ${result.source}: ${result.written} bars in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
      );
    } catch (err) {
      failed += 1;
      console.error(`[ingest] ${symbol} FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`[ingest] done: ${ok} ok, ${failed} failed, ${totalBars} bars written`);
  await closeDbPool();
  if (ok === 0 && failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
