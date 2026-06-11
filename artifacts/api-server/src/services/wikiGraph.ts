import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  wikiChunksTable,
  wikiCommunitiesTable,
  wikiGraphEdgesTable,
  wikiGraphNodesTable,
  wikiSavedAnswersTable,
  wikiSourcesTable,
  type WikiSource,
} from "@workspace/db";
import { getTextClient } from "./llmClient.js";
import { chunkWikiText } from "./wikiProcessor.js";
import { capText } from "./knowledgeProcessor.js";

const NODE_TYPES = ["concept", "person", "place", "document", "image", "event", "rule", "strategy", "asset", "task", "quote", "custom"] as const;
const EDGE_CONFIDENCE = ["EXTRACTED", "INFERRED", "AMBIGUOUS"] as const;

const ExtractionSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().min(1),
    type: z.enum(NODE_TYPES).default("concept"),
    label: z.string().min(1).max(160),
    summary: z.string().max(700).optional().default(""),
    weight: z.number().min(0).max(10).optional().default(1),
  })).default([]),
  edges: z.array(z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    relation: z.string().min(1).max(80),
    confidence: z.enum(EDGE_CONFIDENCE).default("EXTRACTED"),
    confidenceScore: z.number().min(0).max(1).default(1),
    weight: z.number().min(0).max(10).optional().default(1),
  })).default([]),
});

const EXTRACT_PROMPT = `Sei un estrattore GraphRAG per una wiki personale utente.
Estrai un grafo compatto dal materiale. Tipi nodo ammessi: concept, person, place,
document, image, event, rule, strategy, asset, task, quote, custom.
Relazioni utili: references, cites, mentions, contradicts, supports, explains,
example_of, semantically_similar_to, source_of.
Ogni edge deve avere confidence: EXTRACTED, INFERRED o AMBIGUOUS.
Rispondi solo JSON: {"nodes":[...],"edges":[...]}.`;

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Nessun JSON trovato nella risposta LLM");
  return JSON.parse(candidate.slice(start, end + 1));
}

function terms(text: string): string[] {
  return [...new Set((text.toLowerCase().match(/[a-zà-ÿ0-9]{4,}/gi) ?? [])
    .map((term) => term.toLowerCase())
    .filter((term) => !["questo", "questa", "della", "delle", "degli", "with", "that", "from", "sono", "come"].includes(term)))]
    .slice(0, 12);
}

function heuristicExtraction(source: WikiSource) {
  const sourceLabel = source.title.trim().slice(0, 160) || "Documento";
  const keywords = terms(`${source.title}\n${source.extractedText}`).slice(0, 8);
  const nodes = [
    { id: "source", type: "document" as const, label: sourceLabel, summary: capText(source.extractedText, 360), weight: 2 },
    ...keywords.map((keyword, index) => ({
      id: `k${index}`,
      type: "concept" as const,
      label: keyword,
      summary: `Concetto ricorrente in ${sourceLabel}.`,
      weight: 1,
    })),
  ];
  const edges = keywords.map((_, index) => ({
    from: "source",
    to: `k${index}`,
    relation: "mentions",
    confidence: "EXTRACTED" as const,
    confidenceScore: 1,
    weight: 1,
  }));
  return { nodes, edges };
}

async function extractGraph(source: WikiSource) {
  const client = getTextClient();
  if (!client || !source.extractedText.trim()) return heuristicExtraction(source);
  try {
    const completion = await client.client.chat.completions.create({
      model: client.model,
      temperature: 0.1,
      max_tokens: 2200,
      messages: [
        { role: "system", content: EXTRACT_PROMPT },
        { role: "user", content: `Titolo: ${source.title}\nTipo: ${source.kind}\n\n${capText(source.extractedText, 16000)}` },
      ],
    });
    return ExtractionSchema.parse(extractJson(completion.choices[0]?.message?.content ?? ""));
  } catch {
    return heuristicExtraction(source);
  }
}

async function rebuildCommunities(userId: string): Promise<void> {
  await db.delete(wikiCommunitiesTable).where(eq(wikiCommunitiesTable.userId, userId));
  const nodes = await db.select().from(wikiGraphNodesTable).where(eq(wikiGraphNodesTable.userId, userId));
  const byType = new Map<string, typeof nodes>();
  for (const node of nodes) {
    const key = node.type || "custom";
    byType.set(key, [...(byType.get(key) ?? []), node]);
  }
  for (const [type, items] of byType) {
    const [community] = await db.insert(wikiCommunitiesTable).values({
      userId,
      label: type,
      summary: `${items.length} nodi di tipo ${type}`,
      nodeCount: items.length,
      cohesion: String(Math.min(1, Math.max(0.1, items.length / Math.max(1, nodes.length)))),
    }).returning();
    await db.update(wikiGraphNodesTable)
      .set({ communityId: community.id, updatedAt: new Date() })
      .where(and(eq(wikiGraphNodesTable.userId, userId), eq(wikiGraphNodesTable.type, type)));
  }
}

export async function ingestWikiSourceGraph(source: WikiSource): Promise<{ nodes: number; edges: number; chunks: number }> {
  await db.delete(wikiChunksTable).where(eq(wikiChunksTable.sourceId, source.id));
  const oldNodes = await db.select({ id: wikiGraphNodesTable.id })
    .from(wikiGraphNodesTable)
    .where(eq(wikiGraphNodesTable.sourceId, source.id));
  if (oldNodes.length) {
    await db.delete(wikiGraphEdgesTable).where(eq(wikiGraphEdgesTable.sourceId, source.id));
    await db.delete(wikiGraphNodesTable).where(eq(wikiGraphNodesTable.sourceId, source.id));
  }

  if (!isQueryableWikiText(source.extractedText)) {
    await rebuildCommunities(source.userId);
    await db.update(wikiSourcesTable)
      .set({ graphifyJson: JSON.stringify({ nodes: [], edges: [] }), updatedAt: new Date() })
      .where(eq(wikiSourcesTable.id, source.id));
    return { nodes: 0, edges: 0, chunks: 0 };
  }

  const chunks = chunkWikiText(source.extractedText);
  if (chunks.length) {
    await db.insert(wikiChunksTable).values(chunks.map((chunk) => ({
      userId: source.userId,
      sourceId: source.id,
      chunkIndex: chunk.index,
      text: chunk.text,
      tokenEstimate: chunk.tokenEstimate,
    })));
  }

  const extraction = await extractGraph(source);
  const idMap = new Map<string, number>();
  for (const node of extraction.nodes.slice(0, 48)) {
    const [inserted] = await db.insert(wikiGraphNodesTable).values({
      userId: source.userId,
      sourceId: source.id,
      type: node.type,
      label: node.label,
      summary: node.summary ?? "",
      weight: String(node.weight ?? 1),
    }).returning({ id: wikiGraphNodesTable.id });
    idMap.set(node.id, inserted.id);
  }

  let edgeCount = 0;
  for (const edge of extraction.edges.slice(0, 80)) {
    const from = idMap.get(edge.from);
    const to = idMap.get(edge.to);
    if (!from || !to || from === to) continue;
    await db.insert(wikiGraphEdgesTable).values({
      userId: source.userId,
      sourceId: source.id,
      fromNodeId: from,
      toNodeId: to,
      relation: edge.relation,
      confidence: edge.confidence,
      confidenceScore: String(edge.confidenceScore),
      weight: String(edge.weight ?? 1),
    });
    edgeCount++;
  }

  await rebuildCommunities(source.userId);
  await db.update(wikiSourcesTable)
    .set({ graphifyJson: JSON.stringify(extraction), updatedAt: new Date() })
    .where(eq(wikiSourcesTable.id, source.id));

  return { nodes: idMap.size, edges: edgeCount, chunks: chunks.length };
}

export async function getWikiGraph(userId: string) {
  const [sources, nodes, edges, communities] = await Promise.all([
    db.select().from(wikiSourcesTable).where(eq(wikiSourcesTable.userId, userId)).orderBy(desc(wikiSourcesTable.createdAt)),
    db.select().from(wikiGraphNodesTable).where(eq(wikiGraphNodesTable.userId, userId)).orderBy(desc(wikiGraphNodesTable.createdAt)),
    db.select().from(wikiGraphEdgesTable).where(eq(wikiGraphEdgesTable.userId, userId)).orderBy(desc(wikiGraphEdgesTable.createdAt)),
    db.select().from(wikiCommunitiesTable).where(eq(wikiCommunitiesTable.userId, userId)).orderBy(desc(wikiCommunitiesTable.nodeCount)),
  ]);
  return {
    stats: { sources: sources.length, nodes: nodes.length, edges: edges.length, communities: communities.length },
    nodes: nodes.slice(0, 200),
    edges: edges.slice(0, 300),
    communities,
  };
}

function scoreText(text: string, queryTerms: string[]): number {
  const hay = text.toLowerCase();
  return queryTerms.reduce((score, term) => score + (hay.includes(term) ? 1 : 0), 0);
}

export function isQueryableWikiText(text: string): boolean {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  return Boolean(trimmed)
    && !lower.startsWith("pending_transcription:")
    && !lower.startsWith("unextractable_pdf:")
    && !lower.startsWith("archived_file:");
}

export async function queryWiki(userId: string, question: string): Promise<{ answer: string; citations: Array<{ sourceId: number; title: string; excerpt: string }>; nodes: Array<{ id: number; label: string; type: string }> }> {
  const queryTerms = terms(question);
  if (queryTerms.length === 0) {
    return { answer: "Fai una domanda più specifica sulla tua wiki.", citations: [], nodes: [] };
  }

  const chunks = await db.select({
    id: wikiChunksTable.id,
    text: wikiChunksTable.text,
    sourceId: wikiChunksTable.sourceId,
    title: wikiSourcesTable.title,
  })
    .from(wikiChunksTable)
    .innerJoin(wikiSourcesTable, eq(wikiSourcesTable.id, wikiChunksTable.sourceId))
    .where(eq(wikiChunksTable.userId, userId));

  const ranked = chunks
    .filter((chunk) => isQueryableWikiText(chunk.text))
    .map((chunk) => ({ ...chunk, score: scoreText(`${chunk.title}\n${chunk.text}`, queryTerms) }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (ranked.length === 0) {
    const sources = await db.select({
      title: wikiSourcesTable.title,
      status: wikiSourcesTable.status,
      error: wikiSourcesTable.error,
      extractedText: wikiSourcesTable.extractedText,
    }).from(wikiSourcesTable).where(eq(wikiSourcesTable.userId, userId));
    const blocked = sources
      .filter((source) => source.status === "error" || source.status === "pending_transcription" || !isQueryableWikiText(source.extractedText ?? ""))
      .slice(0, 5);
    const answer = blocked.length
      ? `Ho trovato fonti nella tua wiki, ma non ho contenuto interrogabile da cui imparare:\n\n${blocked.map((source) => `- ${source.title}: ${source.error || (source.status === "pending_transcription" ? "in attesa di trascrizione" : "archiviato senza testo estraibile")}`).join("\n")}\n\nCarica il documento originale esportato/scaricato localmente oppure aggiungi una nota testuale con il contenuto da memorizzare.`
      : "Non ho abbastanza informazioni nella tua wiki per rispondere con fonti affidabili.";
    await db.insert(wikiSavedAnswersTable).values({ userId, question, answer });
    return { answer, citations: [], nodes: [] };
  }

  const client = getTextClient();
  const context = ranked.map((chunk, index) => `[${index + 1}] ${chunk.title}\n${chunk.text}`).join("\n\n");
  let answer = "";
  if (client) {
    try {
      const completion = await client.client.chat.completions.create({
        model: client.model,
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          { role: "system", content: "Rispondi in italiano usando solo il contesto fornito. Cita le fonti come [1], [2]. Se manca evidenza, dillo chiaramente." },
          { role: "user", content: `Domanda: ${question}\n\nContesto:\n${context}` },
        ],
      });
      answer = completion.choices[0]?.message?.content?.trim() ?? "";
    } catch {
      answer = "";
    }
  }
  if (!answer) {
    answer = `Ho trovato ${ranked.length} fonte/i rilevanti nella tua wiki:\n\n${ranked.map((chunk, index) => `[${index + 1}] ${chunk.title}: ${capText(chunk.text, 320)}`).join("\n\n")}`;
  }

  const sourceIds = [...new Set(ranked.map((chunk) => chunk.sourceId))];
  const nodes = sourceIds.length
    ? await db.select({ id: wikiGraphNodesTable.id, label: wikiGraphNodesTable.label, type: wikiGraphNodesTable.type })
        .from(wikiGraphNodesTable)
        .where(and(eq(wikiGraphNodesTable.userId, userId), inArray(wikiGraphNodesTable.sourceId, sourceIds)))
        .limit(12)
    : [];
  const citations = ranked.map((chunk) => ({ sourceId: chunk.sourceId, title: chunk.title, excerpt: capText(chunk.text, 260) }));
  await db.insert(wikiSavedAnswersTable).values({
    userId,
    question,
    answer,
    citedSources: JSON.stringify(citations.map((citation) => citation.sourceId)),
    citedNodeIds: JSON.stringify(nodes.map((node) => node.id)),
  });
  return { answer, citations, nodes };
}

export async function buildWikiAnalysisContext(userId: string | null, topic: string): Promise<string> {
  if (!userId) return "";
  const queryTerms = terms(topic);
  if (queryTerms.length === 0) return "";
  const rows = await db.select({
    title: wikiSourcesTable.title,
    text: wikiChunksTable.text,
  })
    .from(wikiChunksTable)
    .innerJoin(wikiSourcesTable, eq(wikiSourcesTable.id, wikiChunksTable.sourceId))
    .where(eq(wikiChunksTable.userId, userId))
    .limit(80);

  const ranked = rows
    .filter((row) => isQueryableWikiText(row.text))
    .map((row) => ({ ...row, score: scoreText(`${row.title}\n${row.text}`, queryTerms) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  if (!ranked.length) return "";
  return capText(ranked.map((row) => `- ${row.title}: ${row.text}`).join("\n"), 4000);
}

export async function rebuildAllWikiSources(userId: string): Promise<number> {
  const sources = await db.select().from(wikiSourcesTable)
    .where(and(eq(wikiSourcesTable.userId, userId), sql`${wikiSourcesTable.extractedText} <> ''`));
  for (const source of sources) await ingestWikiSourceGraph(source);
  return sources.length;
}
