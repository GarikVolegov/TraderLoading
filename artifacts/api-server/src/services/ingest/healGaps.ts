// ─── Warehouse gap healer ────────────────────────────────────────────────────
// DB-driven backfill of the MISSING months only: for each warehouse symbol,
// find which calendar months of the target window have no M1 rows and re-seed
// exactly those (single-lane, gentle). Far cheaper than re-running whole 5y
// symbols, and it rides on seedSymbol's retry+backoff. Run:
//   CANDLE_WAREHOUSE=1 DATABASE_URL=… tsx src/services/ingest/healGaps.ts [years]
import { candleTable, closeDbPool, db } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { RES, SYMBOL_ID } from "../candleRegistry.js";
import { seedSymbol } from "./seed.js";
import { sourceForSymbol } from "./sources.js";

function monthStartUtc(year: number, month: number): number {
  return Math.floor(Date.UTC(year, month, 1) / 1000);
}

/** Calendar months (UTC) with at least one M1 row for a symbol. */
async function coveredMonths(symbolId: number): Promise<Set<string>> {
  const rows = await db
    .select({ month: sql<string>`to_char(to_timestamp(ts) AT TIME ZONE 'UTC', 'YYYY-MM')` })
    .from(candleTable)
    .where(and(eq(candleTable.symbol, symbolId), eq(candleTable.res, RES.M1)))
    .groupBy(sql`1`);
  return new Set(rows.map((r) => r.month));
}

async function main(): Promise<void> {
  const years = Number(process.argv[2] ?? 5);
  const now = new Date();
  const startYear = now.getUTCFullYear() - years;
  const symbols = Object.keys(SYMBOL_ID).filter((s) => sourceForSymbol(s));

  const summary: Array<{ symbol: string; missing: number; healed: number }> = [];

  for (const symbol of symbols) {
    const sid = SYMBOL_ID[symbol as keyof typeof SYMBOL_ID];
    const covered = await coveredMonths(sid);

    // Enumerate every month in [startYear-now]; collect the ones with no data.
    const missing: Array<{ from: number; to: number; label: string }> = [];
    for (let y = startYear; y <= now.getUTCFullYear(); y++) {
      for (let m = 0; m < 12; m++) {
        const label = `${y}-${String(m + 1).padStart(2, "0")}`;
        const from = monthStartUtc(y, m);
        const to = monthStartUtc(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1);
        if (from >= Math.floor(now.getTime() / 1000)) continue; // future month
        if (from < monthStartUtc(startYear, now.getUTCMonth())) continue; // before window
        if (!covered.has(label)) missing.push({ from, to, label });
      }
    }

    if (missing.length === 0) {
      console.log(`[heal] ${symbol}: complete`);
      summary.push({ symbol, missing: 0, healed: 0 });
      continue;
    }

    console.log(`[heal] ${symbol}: ${missing.length} missing month(s) → re-seeding`);
    let healed = 0;
    for (const chunk of missing) {
      try {
        const result = await seedSymbol(symbol, chunk.from, chunk.to);
        if (result.written > 0) healed += 1;
        console.log(`[heal]   ${symbol} ${chunk.label}: ${result.written} bars`);
      } catch (err) {
        console.warn(`[heal]   ${symbol} ${chunk.label} FAILED: ${err instanceof Error ? err.message : String(err)}`);
      }
      // Gentle pause between chunks so Dukascopy doesn't rate-limit a single lane.
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
    summary.push({ symbol, missing: missing.length, healed });
  }

  console.log("\n[heal] summary:");
  for (const row of summary) {
    console.log(`  ${row.symbol}: ${row.healed}/${row.missing} months healed`);
  }
  await closeDbPool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
