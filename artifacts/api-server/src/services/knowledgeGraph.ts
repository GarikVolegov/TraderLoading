import { z } from "zod";
import { and, eq, isNull, or, inArray, sql } from "drizzle-orm";
import {
  db,
  brainKnowledgeSourcesTable,
  brainGraphNodesTable,
  brainGraphEdgesTable,
  type BrainKnowledgeSource,
} from "@workspace/db";
import { getTextClient } from "./llmClient.js";
import { capText } from "./knowledgeProcessor.js";
import { buildWikiAnalysisContext } from "./wikiGraph.js";

// ─── Knowledge graph (GraphRAG in-app) ──────────────────────────────────────────
// 1) ingestSource: trasforma il testo di una sorgente in nodi/archi via LLM.
// 2) buildAnalysisContext: recupera il sottografo rilevante e lo rende come testo
//    da iniettare nel prompt del cervello vision.

const NODE_TYPES = ["concept", "rule", "pattern", "level", "instrument", "timeframe", "setup", "risk"] as const;
const REL_TYPES = [
  "requires", "on_instrument", "for_timeframe", "defines_sl", "defines_tp",
  "confluence_with", "contradicts", "example_of", "from_source",
] as const;

const ExtractionSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().min(1),
    type: z.enum(NODE_TYPES),
    label: z.string().min(1).max(160),
    summary: z.string().max(600).optional().default(""),
    attrs: z.record(z.any()).optional(),
    weight: z.number().min(0).max(10).optional(),
  })).default([]),
  edges: z.array(z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    relation: z.enum(REL_TYPES),
    weight: z.number().min(0).max(10).optional(),
  })).default([]),
});

const EXTRACT_SYSTEM = `Sei un estrattore di conoscenza di trading. Dato il MATERIALE fornito,
estrai un grafo di conoscenza utile ad analizzare i grafici e a decidere entry, stop loss e take profit.

Tipi di nodo ammessi: concept, rule, pattern, level, instrument, timeframe, setup, risk.
Relazioni ammesse: requires, on_instrument, for_timeframe, defines_sl, defines_tp, confluence_with, contradicts, example_of, from_source.

Rispondi ESCLUSIVAMENTE con un JSON valido con questo schema:
{
  "nodes": [
    { "id": "n1", "type": "<tipo>", "label": "<nome breve e normalizzato>", "summary": "<spiegazione concisa>", "attrs": { }, "weight": 1 }
  ],
  "edges": [
    { "from": "n1", "to": "n2", "relation": "<relazione>", "weight": 1 }
  ]
}

Regole:
- "label": nome breve e canonico (es. "Fair Value Gap", "Order Block", "EURUSD", "H1", "Stop sotto order block").
- Per i livelli/prezzi usa attrs come { "kind": "resistance|support|fvg|ob", "value": 1.0950 }.
- weight 1-10 = importanza del nodo/relazione per le decisioni operative.
- Massimo 25 nodi. Concentrati su regole operative, setup, pattern, livelli e gestione SL/TP.
- Tutto in italiano. Nessun testo fuori dal JSON, nessun disclaimer.`;

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Nessun JSON trovato nella risposta del modello");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * ingestSource(source)
 * --------------------
 * Estrae il grafo dal testo della sorgente e lo salva (upsert nodi con dedup per
 * label, insert archi). Aggiorna lo status della sorgente a "ready" o "error".
 */
export async function ingestSource(source: BrainKnowledgeSource): Promise<{ nodes: number; edges: number }> {
  const tc = getTextClient();
  if (!tc) {
    await db.update(brainKnowledgeSourcesTable)
      .set({ status: "error", error: "Cervello LLM non configurato (BRAIN_LLM_PROVIDER/chiave)." })
      .where(eq(brainKnowledgeSourcesTable.id, source.id));
    throw new Error("Cervello LLM non configurato: impossibile costruire il grafo.");
  }

  const material = capText(`Titolo: ${source.title}\nTipo: ${source.kind}\n\n${source.rawText}`, 14000);

  let parsed: z.infer<typeof ExtractionSchema>;
  try {
    const completion = await tc.client.chat.completions.create({
      model: tc.model,
      temperature: 0.1,
      max_tokens: 1800,
      messages: [
        { role: "system", content: EXTRACT_SYSTEM },
        { role: "user", content: `=== MATERIALE ===\n${material}\n\nEstrai il grafo di conoscenza in JSON.` },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    parsed = ExtractionSchema.parse(extractJson(raw));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(brainKnowledgeSourcesTable)
      .set({ status: "error", error: `Estrazione grafo fallita: ${msg}`.slice(0, 480) })
      .where(eq(brainKnowledgeSourcesTable.id, source.id));
    throw new Error(`Estrazione grafo fallita: ${msg}`);
  }

  const { userId, strategyId } = source;
  const uNodes = userId ? eq(brainGraphNodesTable.userId, userId) : isNull(brainGraphNodesTable.userId);
  const sNodes = strategyId == null ? isNull(brainGraphNodesTable.strategyId) : eq(brainGraphNodesTable.strategyId, strategyId);

  // Upsert nodi (dedup per userId+strategyId+type+lower(label)); mappa id-locale → id-DB
  const idMap = new Map<string, number>();
  for (const n of parsed.nodes) {
    const [existing] = await db.select({ id: brainGraphNodesTable.id })
      .from(brainGraphNodesTable)
      .where(and(uNodes, sNodes, eq(brainGraphNodesTable.type, n.type),
        sql`lower(${brainGraphNodesTable.label}) = lower(${n.label})`))
      .limit(1);

    if (existing) {
      idMap.set(n.id, existing.id);
      // Rinforza il nodo esistente con il nuovo summary se più ricco
      if (n.summary) {
        await db.update(brainGraphNodesTable)
          .set({ summary: n.summary })
          .where(and(eq(brainGraphNodesTable.id, existing.id), sql`length(${brainGraphNodesTable.summary}) < ${n.summary.length}`));
      }
      continue;
    }
    const [row] = await db.insert(brainGraphNodesTable).values({
      userId, strategyId,
      type: n.type,
      label: n.label,
      summary: n.summary ?? "",
      attrs: n.attrs ? JSON.stringify(n.attrs) : null,
      sourceId: source.id,
      weight: String(n.weight ?? 1),
    }).returning({ id: brainGraphNodesTable.id });
    idMap.set(n.id, row.id);
  }

  // Insert archi (risolti via idMap, dedup leggero per from+to+relation)
  let edgeCount = 0;
  for (const e of parsed.edges) {
    const from = idMap.get(e.from);
    const to = idMap.get(e.to);
    if (!from || !to || from === to) continue;
    const [dup] = await db.select({ id: brainGraphEdgesTable.id })
      .from(brainGraphEdgesTable)
      .where(and(
        eq(brainGraphEdgesTable.fromNodeId, from),
        eq(brainGraphEdgesTable.toNodeId, to),
        eq(brainGraphEdgesTable.relation, e.relation),
      )).limit(1);
    if (dup) continue;
    await db.insert(brainGraphEdgesTable).values({
      userId, strategyId, fromNodeId: from, toNodeId: to, relation: e.relation, weight: String(e.weight ?? 1),
    });
    edgeCount++;
  }

  await db.update(brainKnowledgeSourcesTable)
    .set({ status: "ready", error: null })
    .where(eq(brainKnowledgeSourcesTable.id, source.id));

  return { nodes: idMap.size, edges: edgeCount };
}

const TYPE_PRIORITY: Record<string, number> = {
  rule: 3, risk: 3, setup: 3, pattern: 2, level: 2, instrument: 1, timeframe: 1, concept: 1,
};

function norm(s: string): string {
  return (s || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
}

/**
 * buildAnalysisContext(userId, strategyId, instrument, timeframe)
 * --------------------------------------------------------------
 * Seleziona il sottografo più rilevante per (strumento, timeframe, strategia) e
 * lo rende come testo strutturato da iniettare nel prompt del cervello.
 * Include sia i nodi della strategia che quelli "generali" (strategyId null).
 */
export async function buildAnalysisContext(
  userId: string | null,
  strategyId: number | null,
  instrument: string,
  timeframe: string,
): Promise<string> {
  const u = userId ? eq(brainGraphNodesTable.userId, userId) : isNull(brainGraphNodesTable.userId);
  const s = strategyId == null
    ? isNull(brainGraphNodesTable.strategyId)
    : or(eq(brainGraphNodesTable.strategyId, strategyId), isNull(brainGraphNodesTable.strategyId));

  const nodes = await db.select().from(brainGraphNodesTable).where(and(u, s));
  if (nodes.length === 0) return await buildWikiAnalysisContext(userId, `${instrument} ${timeframe}`);

  const inst = norm(instrument);
  const tf = norm(timeframe);

  const scored = nodes.map((n) => {
    const hay = norm(`${n.label} ${n.summary} ${n.attrs ?? ""}`);
    let score = TYPE_PRIORITY[n.type] ?? 1;
    score += Number(n.weight) || 0;
    if (inst && hay.includes(inst)) score += 5;
    if (tf && hay.includes(tf)) score += 3;
    // regole/risk/setup sono sempre pertinenti anche senza match diretto
    if (n.type === "rule" || n.type === "risk" || n.type === "setup") score += 1;
    return { n, score };
  }).sort((a, b) => b.score - a.score);

  const TOP = 25;
  const selected = scored.slice(0, TOP).map((x) => x.n);
  const selectedIds = new Set(selected.map((n) => n.id));

  // Archi tra i nodi selezionati
  const nodeIds = selected.map((n) => n.id);
  const edges = nodeIds.length
    ? await db.select().from(brainGraphEdgesTable).where(and(
        inArray(brainGraphEdgesTable.fromNodeId, nodeIds),
        inArray(brainGraphEdgesTable.toNodeId, nodeIds),
      ))
    : [];

  const labelById = new Map(selected.map((n) => [n.id, n.label]));
  const byType = (types: string[]) => selected.filter((n) => types.includes(n.type));

  const lines: string[] = [];
  const section = (title: string, items: typeof selected) => {
    if (items.length === 0) return;
    lines.push(`[${title}]`);
    for (const n of items) {
      const attr = n.attrs ? ` ${n.attrs}` : "";
      lines.push(`- (${n.type}) ${n.label}${n.summary ? `: ${n.summary}` : ""}${attr}`);
    }
  };

  section("Regole & gestione del rischio", byType(["rule", "risk"]));
  section("Setup & pattern", byType(["setup", "pattern"]));
  section("Livelli & zone note", byType(["level"]));
  section("Strumenti & timeframe", byType(["instrument", "timeframe"]));
  section("Concetti", byType(["concept"]));

  const relLines = edges
    .filter((e) => selectedIds.has(e.fromNodeId) && selectedIds.has(e.toNodeId))
    .slice(0, 30)
    .map((e) => `- "${labelById.get(e.fromNodeId)}" --${e.relation}--> "${labelById.get(e.toNodeId)}"`);
  if (relLines.length) {
    lines.push("[Relazioni]");
    lines.push(...relLines);
  }

  const wikiContext = await buildWikiAnalysisContext(userId, `${instrument} ${timeframe}`);
  if (wikiContext) {
    lines.push("[Wiki personale utente]");
    lines.push(wikiContext);
  }

  return capText(lines.join("\n"), 8000);
}

/** Conteggi del grafo per tipo (per la mini-mappa del cervello in UI). */
export async function graphStats(userId: string | null, strategyId: number | null): Promise<{
  nodesByType: Record<string, number>;
  totalNodes: number;
  totalEdges: number;
}> {
  const u = userId ? eq(brainGraphNodesTable.userId, userId) : isNull(brainGraphNodesTable.userId);
  const s = strategyId == null
    ? isNull(brainGraphNodesTable.strategyId)
    : or(eq(brainGraphNodesTable.strategyId, strategyId), isNull(brainGraphNodesTable.strategyId));

  const rows = await db.select({ type: brainGraphNodesTable.type, id: brainGraphNodesTable.id })
    .from(brainGraphNodesTable).where(and(u, s));

  const nodesByType: Record<string, number> = {};
  for (const r of rows) nodesByType[r.type] = (nodesByType[r.type] ?? 0) + 1;

  const ue = userId ? eq(brainGraphEdgesTable.userId, userId) : isNull(brainGraphEdgesTable.userId);
  const se = strategyId == null
    ? isNull(brainGraphEdgesTable.strategyId)
    : or(eq(brainGraphEdgesTable.strategyId, strategyId), isNull(brainGraphEdgesTable.strategyId));
  const edgeRows = await db.select({ id: brainGraphEdgesTable.id }).from(brainGraphEdgesTable).where(and(ue, se));

  return { nodesByType, totalNodes: rows.length, totalEdges: edgeRows.length };
}
