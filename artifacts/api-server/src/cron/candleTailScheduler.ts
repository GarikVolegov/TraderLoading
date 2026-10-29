// ─── Candle Warehouse Tail Scheduler ──────────────────────────────────────────
// Sincronizzazione periodica ricorrente delle candele M1 chiuse.
// Protetto da lock distribuito (Redis / in-memory fallback) per evitare esecuzioni
// duplicate su cluster orizzontali (Fargate / Railway / Kubernetes / Local).

import cron, { type ScheduledTask } from "node-cron";
import { tryAcquireLock } from "../lib/distributedLock.js";
import { reportJobError } from "../lib/observability.js";
import logger from "../lib/logger.js";
import { RES, symbolId } from "../services/candleRegistry.js";
import { readWatermark } from "../services/ingest/candleStore.js";
import { seedSymbol } from "../services/ingest/seed.js";
import { sourceForSymbol } from "../services/ingest/sources.js";
import { DAY_SECONDS, historyChunks, PRIORITY_HISTORY_SYMBOLS } from "../ingestCli.js";

const TAIL_SAFETY_DAYS = 2;
const TAIL_COLD_START_DAYS = 7;

function isWarehouseEnabled(): boolean {
  const val = process.env.CANDLE_WAREHOUSE?.trim().toLowerCase();
  return val === "1" || val === "true";
}

export async function tailSymbols(symbols: readonly string[]): Promise<{ written: number; failed: number }> {
  const now = Math.floor(Date.now() / 60_000) * 60; // solo minuti completati
  let totalWritten = 0;
  let totalFailed = 0;

  for (const symbol of symbols) {
    const sid = symbolId(symbol);
    const source = sourceForSymbol(symbol);
    if (sid === undefined || !source) continue;

    try {
      const watermark = await readWatermark(sid, RES.M1);
      const from = watermark?.lastTs
        ? watermark.lastTs - TAIL_SAFETY_DAYS * DAY_SECONDS
        : now - TAIL_COLD_START_DAYS * DAY_SECONDS;

      if (from >= now) continue;

      const chunks = historyChunks(from, now).reverse();
      for (const [chunkFrom, chunkTo] of chunks) {
        const result = await seedSymbol(symbol, chunkFrom, chunkTo, source, { resume: false });
        totalWritten += result.written;
      }
    } catch (err) {
      totalFailed += 1;
      logger.warn({ err, symbol }, `[candle-tail] Fallimento tailing simbolo ${symbol}`);
    }
  }

  return { written: totalWritten, failed: totalFailed };
}

export function startCandleTailScheduler(): { close(): Promise<void> } {
  if (!isWarehouseEnabled() || process.env.CANDLE_TAIL_SCHEDULER === "0") {
    return {
      async close(): Promise<void> {},
    };
  }

  const symbols = (process.env.CANDLE_TAIL_SYMBOLS?.split(",") ?? PRIORITY_HISTORY_SYMBOLS).map((s) =>
    s.trim().toUpperCase(),
  );

  // Esecuzione ogni 30 minuti al minuto 05 e 35 (dopo la chiusura di barre M30/H1)
  const cronExpr = process.env.CANDLE_TAIL_CRON ?? "5,35 * * * *";

  const task: ScheduledTask = cron.schedule(cronExpr, () => {
    void (async () => {
      const bucket = Math.floor(Date.now() / (25 * 60_000));
      if (!(await tryAcquireLock(`cron:candle-tail:${bucket}`, 20 * 60_000))) return;

      logger.info({ symbols }, "[candle-tail] Avvio sincronizzazione ricorrente barre M1...");
      const result = await tailSymbols(symbols);
      logger.info(result, `[candle-tail] Sincronizzazione completata: ${result.written} barre M1 salvate.`);
    })().catch((err) => reportJobError(err, { job: "candle-tail" }));
  });

  return {
    async close(): Promise<void> {
      task.stop();
    },
  };
}
