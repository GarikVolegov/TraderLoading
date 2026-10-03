import path from "node:path";
import { eq } from "drizzle-orm";
import {
  db,
  wikiIngestJobsTable,
  wikiSourcesTable,
  type WikiSource,
} from "@workspace/db";
import { extractWikiText, type WikiSourceKind } from "./wikiProcessor.js";
import { createWikiStorageFromEnv } from "./wikiStorage.js";
import { captureError } from "../lib/observability.js";

async function updateJob(sourceId: number, patch: Partial<typeof wikiIngestJobsTable.$inferInsert>) {
  await db.update(wikiIngestJobsTable)
    .set(patch)
    .where(eq(wikiIngestJobsTable.sourceId, sourceId));
}

async function loadSource(sourceId: number): Promise<WikiSource | null> {
  const [source] = await db.select().from(wikiSourcesTable).where(eq(wikiSourcesTable.id, sourceId)).limit(1);
  return source ?? null;
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
      await updateJob(sourceId, { status: "error", stage: "extract", error: extracted.error ?? "Estrazione fallita", completedAt: new Date() });
      await db.update(wikiSourcesTable)
        .set({ status: "error", error: extracted.error ?? "Estrazione fallita", extractedText: extracted.text, updatedAt: new Date() })
        .where(eq(wikiSourcesTable.id, sourceId));
      return;
    }

    if (extracted.status === "pending_transcription") {
      await db.update(wikiSourcesTable)
        .set({ extractedText: extracted.text, status: "pending_transcription", error: null, updatedAt: new Date() })
        .where(eq(wikiSourcesTable.id, sourceId));
      await updateJob(sourceId, { status: "pending_transcription", stage: "transcription", completedAt: new Date() });
      return;
    }

    // Pure archive: extracted text is stored for search, no graph/embedding stage.
    await db.update(wikiSourcesTable)
      .set({ extractedText: extracted.text, status: "ready", error: null, updatedAt: new Date() })
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
      // Detached background job: report so a user's upload silently failing to
      // extract is visible in Sentry, not just the local console.
      console.error("[wiki] async ingest failed", err);
      captureError(err, { surface: "background", job: "wiki-ingest", sourceId });
    });
  }, 0);
}
