// Durable history ingestion. Months commit independently and verified imports
// can be resumed; a single database-wide lane avoids provider rate-limit storms.
import { closeDbPool, pool } from "@workspace/db";
import { readFile } from "node:fs/promises";
import { DAY_SECONDS, historyChunks, historyStart, parseIngestOptions } from "./ingestCli.js";
import { RES, symbolId, SYMBOL_ID } from "./services/candleRegistry.js";
import { readWatermark } from "./services/ingest/candleStore.js";
import { seedSymbol } from "./services/ingest/seed.js";
import { sourceForSymbol } from "./services/ingest/sources.js";
import { createCsvSource, parseDukascopyM1Csv } from "./services/ingest/csv.js";

const TAIL_SAFETY_DAYS = 2;
const TAIL_COLD_START_DAYS = 7;
const INGEST_LOCK = 207330001;

async function main(): Promise<void> {
  const supported = Object.keys(SYMBOL_ID).filter(symbol => sourceForSymbol(symbol));
  const options = parseIngestOptions(process.argv.slice(2), supported);
  const now = Math.floor(Date.now() / 60_000) * 60; // completed M1 bars only
  const csvCandles = options.file ? parseDukascopyM1Csv(await readFile(options.file, "utf8")) : null;
  const csvSource = csvCandles ? createCsvSource(options.symbols[0], csvCandles) : undefined;
  if (csvCandles) {
    options.from ??= csvCandles[0].time;
    options.to ??= csvCandles[csvCandles.length - 1].time + 60;
    if (options.from < csvCandles[0].time || options.to > csvCandles[csvCandles.length - 1].time + 60) throw new Error("Import bounds must be inside the CSV's actual time range");
  }
  if ((options.to ?? now) > now) throw new Error("to cannot be in the future");
  if (options.from != null && options.from >= (options.to ?? now)) throw new Error("from must precede the end of history");
  const client = await pool.connect();
  let locked = false;
  try {
    locked = (await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [INGEST_LOCK])).rows[0].locked;
    if (!locked) throw new Error("Another history import is already running for this database; wait for it to finish.");
    const ranges = new Map<string, Array<[number, number]>>();
    for (const symbol of options.symbols) {
      if (options.mode !== "tail") {
        const to = options.to ?? now;
        ranges.set(symbol, historyChunks(options.from ?? historyStart(to, options.years), to));
      } else {
        const watermark = await readWatermark(symbolId(symbol)!, RES.M1);
        const from = watermark?.lastTs ? watermark.lastTs - TAIL_SAFETY_DAYS * DAY_SECONDS : now - TAIL_COLD_START_DAYS * DAY_SECONDS;
        ranges.set(symbol, historyChunks(from, now).reverse());
      }
    }
    const total = [...ranges.values()].reduce((count, chunks) => count + chunks.length, 0);
    let done = 0, failed = 0, written = 0, skipped = 0, consecutiveFailures = 0;
    console.log(`[ingest] ${options.mode}; ${options.symbols.join(", ")}; ${total} chunks; newest first; resume=${options.resume}`);
    // Round-robin gives every selected pair recent history before going deeper.
    while ([...ranges.values()].some(chunks => chunks.length > 0)) {
      for (const [symbol, chunks] of ranges) {
        const chunk = chunks.shift();
        if (!chunk) continue;
        const [from, to] = chunk;
        const label = `${symbol} ${new Date(from * 1000).toISOString().slice(0, 10)}..${new Date(to * 1000).toISOString().slice(0, 16)}`;
        const startedAt = Date.now();
        try {
          const result = await seedSymbol(symbol, from, to, csvSource ?? sourceForSymbol(symbol), { resume: options.mode !== "tail" && options.resume });
          written += result.written;
          consecutiveFailures = 0;
          if (result.skipped) skipped += 1;
          console.log(`[ingest] ${++done}/${total} ${label}: ${result.skipped ? "verified; skipped" : `${result.written} bars saved`} (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
        } catch (error) {
          failed += 1;
          consecutiveFailures += 1;
          console.error(`[ingest] ${++done}/${total} ${label} FAILED: ${error instanceof Error ? error.message : String(error)}`);
          // A failed tail must not advance that symbol's watermark past a gap.
          if (options.mode === "tail") chunks.length = 0;
          if (consecutiveFailures >= 3) throw new Error("History source failed three consecutive chunks. Import stopped; saved chunks are retained and the next run resumes them.");
        }
      }
    }
    console.log(`[ingest] finished: ${done - failed} successful chunks, ${skipped} already verified, ${failed} failed, ${written} bars saved`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock($1)", [INGEST_LOCK]);
    client.release();
  }
}

main().catch(error => {
  console.error(`[ingest] ${error instanceof Error ? error.message : String(error)}`);
  console.error("usage: ingest <seed|tail> [--symbols=XAUUSD,EURUSD,USOIL] [--years=5] [--from=YYYY-MM-DD] [--to=YYYY-MM-DD] [--resume=true|false]; import --symbols=SYMBOL --file=PATH --source=dukascopy");
  process.exitCode = 1;
}).finally(closeDbPool);
