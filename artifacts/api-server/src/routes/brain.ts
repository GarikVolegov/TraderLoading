import { Router, type IRouter } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import {
  db,
  brainStrategiesTable,
  brainAnalysesTable,
  brainFeedbackTable,
  brainScanConfigTable,
  brainKnowledgeSourcesTable,
} from "@workspace/db";
import { getUserId } from "./profile.js";
import { getCandles, isSupportedSymbol, SUPPORTED_SYMBOLS } from "../services/candles.js";
import { renderCandleChartPng, bufferToDataUrl } from "../services/chartImage.js";
import { analyzeChart, representativeLevels, type FewShotExample } from "../services/brainAnalyst.js";
import { isBrainConfigured } from "../services/llmClient.js";
import {
  extractTextFromPdf,
  describeImage,
  bufferToDataUrl as fileToDataUrl,
  capText,
} from "../services/knowledgeProcessor.js";
import { ingestSource, buildAnalysisContext, graphStats } from "../services/knowledgeGraph.js";

const router: IRouter = Router();

const BRAIN_UPLOADS_DIR = path.join(process.cwd(), "uploads", "brain");
const KNOWLEDGE_DIR = path.join(BRAIN_UPLOADS_DIR, "knowledge");
for (const dir of [BRAIN_UPLOADS_DIR, KNOWLEDGE_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Upload multipart per i materiali di conoscenza (immagini + PDF)
const knowledgeUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, KNOWLEDGE_DIR),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Solo immagini o PDF sono ammessi"));
  },
});

function userScope(userId: string | null) {
  return userId ? eq(brainStrategiesTable.userId, userId) : isNull(brainStrategiesTable.userId);
}

function num(v: number | null | undefined): string | null {
  return v == null ? null : String(v);
}

// ─── Strategie ──────────────────────────────────────────────────────────────────

router.get("/brain/strategies", async (req, res) => {
  const userId = getUserId(req);
  const rows = await db.select().from(brainStrategiesTable)
    .where(userScope(userId))
    .orderBy(desc(brainStrategiesTable.updatedAt));
  res.json(rows);
});

router.post("/brain/strategies", async (req, res) => {
  const userId = getUserId(req);
  const { name, rules, active } = req.body as { name?: string; rules?: string; active?: boolean };
  if (!name || !rules) {
    res.status(400).json({ error: "name e rules sono obbligatori" });
    return;
  }
  const [row] = await db.insert(brainStrategiesTable)
    .values({ userId, name, rules, active: active ?? true })
    .returning();
  res.json(row);
});

router.put("/brain/strategies/:id", async (req, res) => {
  const userId = getUserId(req);
  const id = Number(req.params.id);
  const { name, rules, active } = req.body as { name?: string; rules?: string; active?: boolean };
  const [row] = await db.update(brainStrategiesTable)
    .set({
      ...(name != null ? { name } : {}),
      ...(rules != null ? { rules } : {}),
      ...(active != null ? { active } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(brainStrategiesTable.id, id), userScope(userId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Strategia non trovata" }); return; }
  res.json(row);
});

router.delete("/brain/strategies/:id", async (req, res) => {
  const userId = getUserId(req);
  const id = Number(req.params.id);
  await db.delete(brainStrategiesTable)
    .where(and(eq(brainStrategiesTable.id, id), userScope(userId)));
  res.json({ ok: true });
});

// ─── Helper: risolve la strategia da usare ──────────────────────────────────────

async function resolveStrategy(userId: string | null, strategyId?: number) {
  const scope = userId ? eq(brainStrategiesTable.userId, userId) : isNull(brainStrategiesTable.userId);
  if (strategyId) {
    const [s] = await db.select().from(brainStrategiesTable)
      .where(and(eq(brainStrategiesTable.id, strategyId), scope)).limit(1);
    if (s) return s;
  }
  const [active] = await db.select().from(brainStrategiesTable)
    .where(and(scope, eq(brainStrategiesTable.active, true)))
    .orderBy(desc(brainStrategiesTable.updatedAt)).limit(1);
  return active ?? null;
}

// ─── Helper: raccoglie memoria di apprendimento (feedback + esempi) ─────────────

async function gatherLearningMemory(userId: string | null, symbol: string): Promise<{
  feedbackMemory: string[];
  fewShotExamples: FewShotExample[];
}> {
  const aScope = userId ? eq(brainAnalysesTable.userId, userId) : isNull(brainAnalysesTable.userId);

  // Esempi few-shot: analisi votate "up"
  const upvoted = await db.select({
    symbol: brainAnalysesTable.symbol,
    interval: brainAnalysesTable.interval,
    direction: brainAnalysesTable.direction,
    reasoning: brainAnalysesTable.reasoning,
  })
    .from(brainAnalysesTable)
    .innerJoin(brainFeedbackTable, eq(brainFeedbackTable.analysisId, brainAnalysesTable.id))
    .where(and(aScope, eq(brainFeedbackTable.vote, "up")))
    .orderBy(desc(brainFeedbackTable.createdAt))
    .limit(3);

  // Memoria correzioni: note dei feedback "down"
  const fScope = userId ? eq(brainFeedbackTable.userId, userId) : isNull(brainFeedbackTable.userId);
  const corrections = await db.select({ note: brainFeedbackTable.note })
    .from(brainFeedbackTable)
    .where(and(fScope, eq(brainFeedbackTable.vote, "down")))
    .orderBy(desc(brainFeedbackTable.createdAt))
    .limit(5);

  return {
    fewShotExamples: upvoted,
    feedbackMemory: corrections.map((c) => c.note).filter((n): n is string => Boolean(n)),
  };
}

// ─── Analisi on-demand ──────────────────────────────────────────────────────────

router.post("/brain/analyze", async (req, res) => {
  const userId = getUserId(req);
  const symbolRaw = (req.body?.symbol as string | undefined) ?? "EURUSD";
  const symbol = symbolRaw.toUpperCase().replace("/", "");
  const interval = (req.body?.interval as string | undefined) ?? "H1";
  const strategyId = req.body?.strategyId ? Number(req.body.strategyId) : undefined;

  if (!isBrainConfigured()) {
    res.status(503).json({ error: "Cervello vision non configurato. Imposta BRAIN_LLM_PROVIDER e la chiave (es. OPENROUTER_API_KEY)." });
    return;
  }
  if (!isSupportedSymbol(symbol)) {
    res.status(400).json({ error: `Simbolo ${symbol} non supportato. Disponibili: ${SUPPORTED_SYMBOLS.join(", ")}` });
    return;
  }

  const strategy = await resolveStrategy(userId, strategyId);
  if (!strategy) {
    res.status(400).json({ error: "Nessuna strategia disponibile. Creane una prima di analizzare." });
    return;
  }

  try {
    const { candles } = await getCandles(symbol, interval);
    const png = renderCandleChartPng({ symbol, interval, candles });
    const recent = candles.slice(-120);
    const meta = {
      lastClose: recent[recent.length - 1]?.close ?? 0,
      recentHigh: Math.max(...recent.map((c) => c.high)),
      recentLow: Math.min(...recent.map((c) => c.low)),
      count: recent.length,
    };
    const { fewShotExamples, feedbackMemory } = await gatherLearningMemory(userId, symbol);
    const graphContext = await buildAnalysisContext(userId, strategy.id, symbol, interval);

    const signal = await analyzeChart({
      imageDataUrl: bufferToDataUrl(png),
      symbol, interval,
      strategyRules: strategy.rules,
      graphContext,
      fewShotExamples, feedbackMemory,
      candleMeta: meta,
    });

    // Salva l'immagine del grafico
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    fs.writeFileSync(path.join(BRAIN_UPLOADS_DIR, filename), png);
    const imageRef = `/api/uploads/brain/${filename}`;

    const rep = representativeLevels(signal);
    const zonesJson = JSON.stringify({
      entryZone: signal.entryZone ?? null,
      stopLossZones: signal.stopLossZones,
      takeProfitZones: signal.takeProfitZones,
    });

    const [row] = await db.insert(brainAnalysesTable).values({
      userId,
      strategyId: strategy.id,
      symbol, interval,
      mode: "on_demand",
      imageRef,
      direction: signal.direction,
      confidence: String(signal.confidence),
      reasoning: signal.reasoning || signal.context || "—",
      entryPrice: num(rep.entry),
      stopLoss: num(rep.stopLoss),
      takeProfit: num(rep.takeProfit),
      context: signal.context || null,
      zonesJson,
      rawModel: signal.model,
      rawJson: signal.raw,
    }).returning();

    res.json(row);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[brain] analyze error:", msg);
    res.status(502).json({ error: msg });
  }
});

// ─── Storico analisi ──────────────────────────────────────────────────────────

router.get("/brain/analyses", async (req, res) => {
  const userId = getUserId(req);
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const symbol = req.query.symbol as string | undefined;
  const scope = userId ? eq(brainAnalysesTable.userId, userId) : isNull(brainAnalysesTable.userId);
  const where = symbol
    ? and(scope, eq(brainAnalysesTable.symbol, symbol.toUpperCase().replace("/", "")))
    : scope;
  const rows = await db.select().from(brainAnalysesTable)
    .where(where)
    .orderBy(desc(brainAnalysesTable.createdAt))
    .limit(limit);
  res.json(rows);
});

router.get("/brain/analyses/:id", async (req, res) => {
  const userId = getUserId(req);
  const id = Number(req.params.id);
  const scope = userId ? eq(brainAnalysesTable.userId, userId) : isNull(brainAnalysesTable.userId);
  const [row] = await db.select().from(brainAnalysesTable)
    .where(and(eq(brainAnalysesTable.id, id), scope)).limit(1);
  if (!row) { res.status(404).json({ error: "Analisi non trovata" }); return; }
  res.json(row);
});

// ─── Feedback ───────────────────────────────────────────────────────────────────

router.post("/brain/feedback", async (req, res) => {
  const userId = getUserId(req);
  const { analysisId, vote, note } = req.body as { analysisId?: number; vote?: string; note?: string };
  if (!analysisId || (vote !== "up" && vote !== "down")) {
    res.status(400).json({ error: "analysisId e vote ('up'|'down') obbligatori" });
    return;
  }
  const [row] = await db.insert(brainFeedbackTable)
    .values({ userId, analysisId: Number(analysisId), vote, note: note ?? null })
    .returning();
  res.json(row);
});

// ─── Configurazione scansione autonoma ──────────────────────────────────────────

const SCAN_DEFAULTS = {
  enabled: false,
  pairs: "[]",
  timeframes: "[\"H1\"]",
  intervalMinutes: 30,
  minConfidence: "70",
};

router.get("/brain/scan-config", async (req, res) => {
  const userId = getUserId(req);
  const scope = userId ? eq(brainScanConfigTable.userId, userId) : isNull(brainScanConfigTable.userId);
  const [row] = await db.select().from(brainScanConfigTable).where(scope).limit(1);
  res.json(row ?? { ...SCAN_DEFAULTS, userId });
});

router.put("/brain/scan-config", async (req, res) => {
  const userId = getUserId(req);
  const body = req.body as {
    enabled?: boolean; pairs?: string[]; timeframes?: string[];
    intervalMinutes?: number; minConfidence?: number; strategyId?: number | null;
  };

  const values = {
    ...(body.enabled != null ? { enabled: body.enabled } : {}),
    ...(body.pairs != null ? { pairs: JSON.stringify(body.pairs) } : {}),
    ...(body.timeframes != null ? { timeframes: JSON.stringify(body.timeframes) } : {}),
    ...(body.intervalMinutes != null ? { intervalMinutes: body.intervalMinutes } : {}),
    ...(body.minConfidence != null ? { minConfidence: String(body.minConfidence) } : {}),
    ...(body.strategyId !== undefined ? { strategyId: body.strategyId } : {}),
    updatedAt: new Date(),
  };

  const scope = userId ? eq(brainScanConfigTable.userId, userId) : isNull(brainScanConfigTable.userId);
  const [existing] = await db.select({ id: brainScanConfigTable.id })
    .from(brainScanConfigTable).where(scope).limit(1);

  if (existing) {
    const [row] = await db.update(brainScanConfigTable)
      .set(values).where(eq(brainScanConfigTable.id, existing.id)).returning();
    res.json(row);
  } else {
    const [row] = await db.insert(brainScanConfigTable)
      .values({ userId, ...values }).returning();
    res.json(row);
  }
});

// ─── Memoria a grafo: materiali di addestramento (testo/PDF/immagini) ───────────

function parseStrategyId(v: unknown): number | null {
  if (v == null || v === "" || v === "null" || v === "general") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function knowledgeScope(userId: string | null) {
  return userId ? eq(brainKnowledgeSourcesTable.userId, userId) : isNull(brainKnowledgeSourcesTable.userId);
}

/** Esegue l'ingest del grafo e ritorna la sorgente aggiornata (status ready/error). */
async function safeIngest(src: typeof brainKnowledgeSourcesTable.$inferSelect) {
  try {
    await ingestSource(src);
  } catch (err) {
    // ingestSource ha già impostato status="error" sulla sorgente
    console.error("[brain] ingest error:", err instanceof Error ? err.message : err);
  }
  const [row] = await db.select().from(brainKnowledgeSourcesTable)
    .where(eq(brainKnowledgeSourcesTable.id, src.id)).limit(1);
  return row;
}

// Lista delle sorgenti (strategia attiva + generali)
router.get("/brain/knowledge", async (req, res) => {
  const userId = getUserId(req);
  const sid = parseStrategyId(req.query.strategyId);
  const u = knowledgeScope(userId);
  const where = sid == null
    ? and(u, isNull(brainKnowledgeSourcesTable.strategyId))
    : and(u, or(eq(brainKnowledgeSourcesTable.strategyId, sid), isNull(brainKnowledgeSourcesTable.strategyId)));
  const rows = await db.select().from(brainKnowledgeSourcesTable)
    .where(where)
    .orderBy(desc(brainKnowledgeSourcesTable.createdAt));
  res.json(rows);
});

// Aggiunta di testo libero
router.post("/brain/knowledge", async (req, res) => {
  const userId = getUserId(req);
  const { strategyId, title, content } = req.body as { strategyId?: unknown; title?: string; content?: string };
  if (!content || !content.trim()) { res.status(400).json({ error: "content obbligatorio" }); return; }
  if (!isBrainConfigured()) {
    res.status(503).json({ error: "Cervello LLM non configurato: impossibile costruire il grafo." });
    return;
  }
  const [src] = await db.insert(brainKnowledgeSourcesTable).values({
    userId,
    strategyId: parseStrategyId(strategyId),
    kind: "text",
    title: (title && title.trim()) || "Nota di testo",
    rawText: capText(content),
    status: "processing",
  }).returning();
  res.json(await safeIngest(src));
});

// Upload di file (immagine o PDF)
router.post("/brain/knowledge/upload", knowledgeUpload.single("file"), async (req, res) => {
  const userId = getUserId(req);
  if (!req.file) { res.status(400).json({ error: "Nessun file caricato" }); return; }
  if (!isBrainConfigured()) {
    res.status(503).json({ error: "Cervello LLM non configurato: impossibile costruire il grafo." });
    return;
  }

  const sid = parseStrategyId(req.body?.strategyId);
  const title = (req.body?.title && String(req.body.title).trim()) || req.file.originalname;
  const isPdf = req.file.mimetype === "application/pdf";
  const kind: "pdf" | "image" = isPdf ? "pdf" : "image";
  const fileRef = `/api/uploads/brain/knowledge/${req.file.filename}`;

  let rawText = "";
  let extractError: string | null = null;
  try {
    const buf = fs.readFileSync(req.file.path);
    rawText = isPdf ? await extractTextFromPdf(buf) : await describeImage(fileToDataUrl(buf, req.file.mimetype));
  } catch (err) {
    extractError = err instanceof Error ? err.message : String(err);
  }

  const [src] = await db.insert(brainKnowledgeSourcesTable).values({
    userId, strategyId: sid, kind, title, rawText, fileRef,
    status: rawText.trim() ? "processing" : "error",
    error: rawText.trim() ? null : (extractError ?? "Nessun testo estraibile dal file"),
  }).returning();

  if (!rawText.trim()) { res.json(src); return; }
  res.json(await safeIngest(src));
});

// Eliminazione di una sorgente (cascade rimuove nodi/archi e l'eventuale file)
router.delete("/brain/knowledge/:id", async (req, res) => {
  const userId = getUserId(req);
  const id = Number(req.params.id);
  const [src] = await db.select().from(brainKnowledgeSourcesTable)
    .where(and(eq(brainKnowledgeSourcesTable.id, id), knowledgeScope(userId))).limit(1);
  if (!src) { res.status(404).json({ error: "Sorgente non trovata" }); return; }

  if (src.fileRef) {
    const fp = path.join(KNOWLEDGE_DIR, path.basename(src.fileRef));
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  await db.delete(brainKnowledgeSourcesTable).where(eq(brainKnowledgeSourcesTable.id, id));
  res.json({ ok: true });
});

// Statistiche del grafo (mini-mappa del cervello)
router.get("/brain/graph", async (req, res) => {
  const userId = getUserId(req);
  const sid = parseStrategyId(req.query.strategyId);
  res.json(await graphStats(userId, sid));
});

export default router;
