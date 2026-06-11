import path from "node:path";
import { eq } from "drizzle-orm";
import {
  db,
  wikiChunksTable,
  wikiGraphEdgesTable,
  wikiGraphNodesTable,
  wikiIngestJobsTable,
  wikiSourcesTable,
  type WikiSource,
} from "@workspace/db";
import { extractWikiText, type WikiSourceKind } from "./wikiProcessor.js";
import { createWikiStorageFromEnv } from "./wikiStorage.js";
import { ingestWikiSourceGraph } from "./wikiGraph.js";

async function updateJob(sourceId: number, patch: Partial<typeof wikiIngestJobsTable.$inferInsert>) {
  await db.update(wikiIngestJobsTable)
    .set(patch)
    .where(eq(wikiIngestJobsTable.sourceId, sourceId));
}

async function loadSource(sourceId: number): Promise<WikiSource | null> {
  const [source] = await db.select().from(wikiSourcesTable).where(eq(wikiSourcesTable.id, sourceId)).limit(1);
  return source ?? null;
}

async function clearSourceGraphData(sourceId: number): Promise<void> {
  await db.delete(wikiGraphEdgesTable).where(eq(wikiGraphEdgesTable.sourceId, sourceId));
  await db.delete(wikiGraphNodesTable).where(eq(wikiGraphNodesTable.sourceId, sourceId));
  await db.delete(wikiChunksTable).where(eq(wikiChunksTable.sourceId, sourceId));
}

export async function processWikiSourceJob(sourceId: number, buffer?: Buffer): Promise<void> {
  const source = await loadSource(sourceId);
  if (!source) return;

  await updateJob(sourceId, { status: "processing", stage: "extract", startedAt: new Date(), attempts: 1 });
  await db.update(wikiSourcesTable)
    .set({ status: "processing", error: null, updatedAt: new Date() })
    .where(eq(wikiSourcesTable.id, sourceId));

  try {
    let fileBuffer = buffer;
    const storage = createWikiStorageFromEnv();
    if (!fileBuffer && source.storageKey && storage.get) {
      fileBuffer = await storage.get(source.storageKey);
    }

    const localPath = source.storageProvider === "local" && source.storageKey
      ? path.join(process.cwd(), "uploads", "wiki", source.storageKey)
      : undefined;
    const extracted = await extractWikiText({
      kind: source.kind as WikiSourceKind,
      filename: source.fileName ?? source.title,
      mimeType: source.mimeType ?? "text/plain",
      buffer: fileBuffer,
      localPath,
      text: source.extractedText,
    });

    if (extracted.status === "error") {
      await clearSourceGraphData(sourceId);
      await updateJob(sourceId, { status: "error", stage: "extract", error: extracted.error ?? "Estrazione fallita", completedAt: new Date() });
      await db.update(wikiSourcesTable)
        .set({ status: "error", error: extracted.error ?? "Estrazione fallita", extractedText: extracted.text, updatedAt: new Date() })
        .where(eq(wikiSourcesTable.id, sourceId));
      return;
    }

    const [updated] = await db.update(wikiSourcesTable)
      .set({
        extractedText: extracted.text,
        status: extracted.status === "pending_transcription" ? "pending_transcription" : "processing",
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(wikiSourcesTable.id, sourceId))
      .returning();

    if (extracted.status === "pending_transcription") {
      await updateJob(sourceId, { status: "pending_transcription", stage: "transcription", completedAt: new Date() });
      return;
    }

    await updateJob(sourceId, { status: "processing", stage: "graph" });
    await ingestWikiSourceGraph(updated);
    await db.update(wikiSourcesTable)
      .set({ status: "ready", error: null, updatedAt: new Date() })
      .where(eq(wikiSourcesTable.id, sourceId));
    await updateJob(sourceId, { status: "ready", stage: "complete", error: null, completedAt: new Date() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateJob(sourceId, { status: "error", stage: "error", error: message.slice(0, 600), completedAt: new Date() });
    await db.update(wikiSourcesTable)
      .set({ status: "error", error: message.slice(0, 600), updatedAt: new Date() })
      .where(eq(wikiSourcesTable.id, sourceId));
  }
}

export function enqueueWikiSourceProcessing(sourceId: number, buffer?: Buffer): void {
  setTimeout(() => {
    processWikiSourceJob(sourceId, buffer).catch((err) => {
      console.error("[wiki] async ingest failed", err);
    });
  }, 0);
}
