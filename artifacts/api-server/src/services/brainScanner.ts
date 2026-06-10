import cron from "node-cron";
import fs from "fs";
import path from "path";
import { and, eq } from "drizzle-orm";
import {
  db,
  brainScanConfigTable,
  brainStrategiesTable,
  brainAnalysesTable,
} from "@workspace/db";
import { getCandles, isSupportedSymbol } from "./candles.js";
import { renderCandleChartPng, bufferToDataUrl } from "./chartImage.js";
import { analyzeChart, representativeLevels } from "./brainAnalyst.js";
import { buildAnalysisContext } from "./knowledgeGraph.js";
import { isBrainConfigured } from "./llmClient.js";
import { getUserNotificationLanguage, sendPushToUser, type SchedulerHandle } from "../routes/push.js";
import { getServerNotificationCopy } from "./notifications/notificationCopy.js";
import logger from "../lib/logger.js";
import { resolveUploadPath } from "../lib/uploads.js";

const BRAIN_UPLOADS_DIR = resolveUploadPath("brain");
const _lastNotified = new Map<string, number>();

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      try {
        await fn(items[current]);
      } catch (err) {
        logger.warn({ err }, "Brain scan task error");
      }
    }
  });
  await Promise.all(workers);
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

async function getStrategy(cfg: typeof brainScanConfigTable.$inferSelect, userId: string) {
  if (cfg.strategyId) {
    const [configured] = await db.select().from(brainStrategiesTable)
      .where(and(eq(brainStrategiesTable.id, cfg.strategyId), eq(brainStrategiesTable.userId, userId)))
      .limit(1);
    if (configured) return configured;
  }

  const [active] = await db.select().from(brainStrategiesTable)
    .where(and(eq(brainStrategiesTable.userId, userId), eq(brainStrategiesTable.active, true)))
    .limit(1);
  return active ?? null;
}

async function scanUser(cfg: typeof brainScanConfigTable.$inferSelect): Promise<void> {
  if (!cfg.userId) return;

  const pairs = parseJsonArray(cfg.pairs).filter(isSupportedSymbol);
  const timeframes = parseJsonArray(cfg.timeframes);
  if (pairs.length === 0 || timeframes.length === 0) return;

  const strategy = await getStrategy(cfg, cfg.userId);
  if (!strategy) return;

  const minConfidence = Number(cfg.minConfidence) || 70;
  const cadenceMs = (cfg.intervalMinutes || 30) * 60 * 1000;
  const combos: Array<{ pair: string; tf: string }> = [];
  for (const pair of pairs) for (const tf of timeframes) combos.push({ pair, tf });

  await mapLimit(combos, 2, async ({ pair, tf }) => {
    const { candles } = await getCandles(pair, tf);
    const png = renderCandleChartPng({ symbol: pair, interval: tf, candles });
    const recent = candles.slice(-120);
    const graphContext = await buildAnalysisContext(cfg.userId, strategy.id, pair, tf);
    const signal = await analyzeChart({
      imageDataUrl: bufferToDataUrl(png),
      symbol: pair,
      interval: tf,
      strategyRules: strategy.rules,
      graphContext,
      candleMeta: {
        lastClose: recent[recent.length - 1]?.close ?? 0,
        recentHigh: Math.max(...recent.map((c) => c.high)),
        recentLow: Math.min(...recent.map((c) => c.low)),
        count: recent.length,
      },
    });

    if (signal.direction === "wait" || signal.confidence < minConfidence) return;

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    if (!fs.existsSync(BRAIN_UPLOADS_DIR)) fs.mkdirSync(BRAIN_UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(BRAIN_UPLOADS_DIR, filename), png);
    const imageRef = `/api/uploads/brain/${filename}`;
    const representative = representativeLevels(signal);

    await db.insert(brainAnalysesTable).values({
      userId: cfg.userId,
      strategyId: strategy.id,
      symbol: pair,
      interval: tf,
      mode: "autonomous",
      imageRef,
      direction: signal.direction,
      confidence: String(signal.confidence),
      reasoning: signal.reasoning || signal.context || "-",
      entryPrice: representative.entry == null ? null : String(representative.entry),
      stopLoss: representative.stopLoss == null ? null : String(representative.stopLoss),
      takeProfit: representative.takeProfit == null ? null : String(representative.takeProfit),
      context: signal.context || null,
      zonesJson: JSON.stringify({
        entryZone: signal.entryZone ?? null,
        stopLossZones: signal.stopLossZones,
        takeProfitZones: signal.takeProfitZones,
      }),
      rawModel: signal.model,
      rawJson: signal.raw,
    });

    const dedupeKey = `${cfg.userId}:${pair}:${tf}:${signal.direction}`;
    const last = _lastNotified.get(dedupeKey) ?? 0;
    if (Date.now() - last < cadenceMs) return;
    _lastNotified.set(dedupeKey, Date.now());

    const language = await getUserNotificationLanguage(cfg.userId);
    const copy = getServerNotificationCopy(language);
    const reasoning = (signal.reasoning || signal.context || "").slice(0, 120);
    await sendPushToUser(
      cfg.userId,
      {
        title: copy.brainTitle(signal.direction, pair, tf),
        body: copy.brainBody(signal.confidence, reasoning),
        tag: `brain-${pair}-${tf}`,
        data: { url: "/brain" },
      },
      "brain",
    );
  });

  await db.update(brainScanConfigTable)
    .set({ lastRunAt: new Date() })
    .where(eq(brainScanConfigTable.id, cfg.id));
}

const noopScheduler: SchedulerHandle = {
  async close() {},
};

export function startBrainScanner(): SchedulerHandle {
  if (process.env.BRAIN_SCAN_ENABLED !== "true") {
    logger.info("Brain scanner disabled because BRAIN_SCAN_ENABLED is not true");
    return noopScheduler;
  }
  if (!isBrainConfigured()) {
    logger.info("Brain scanner disabled because no LLM provider is configured");
    return noopScheduler;
  }

  logger.info("Autonomous brain scanner started");
  let isClosing = false;
  let activeRun: Promise<void> | null = null;

  async function runScannerTick(): Promise<void> {
    try {
      const configs = await db.select().from(brainScanConfigTable)
        .where(eq(brainScanConfigTable.enabled, true));
      const now = Date.now();
      const due = configs.filter((config) => {
        const cadenceMs = (config.intervalMinutes || 30) * 60 * 1000;
        const last = config.lastRunAt ? new Date(config.lastRunAt).getTime() : 0;
        return now - last >= cadenceMs;
      });

      for (const cfg of due) {
        await scanUser(cfg).catch((err) =>
          logger.warn({ err }, "Brain scan user task failed"),
        );
      }
    } catch (err) {
      logger.error({ err }, "Brain scanner tick failed");
    }
  }

  const task = cron.schedule("* * * * *", () => {
    if (isClosing || activeRun) return;
    activeRun = runScannerTick().finally(() => {
      activeRun = null;
    });
  });

  return {
    async close() {
      isClosing = true;
      task.stop();
      task.destroy();
      if (activeRun) await activeRun;
      logger.info("Autonomous brain scanner stopped");
    },
  };
}
