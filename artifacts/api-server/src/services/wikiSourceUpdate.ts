// Pure helpers for updating a wiki source (folder move + tag edit). Folder
// *existence* is checked by the caller (needs DB); this module only shapes and
// validates the patch so it can be unit-tested without a database.

export function parseTags(input: unknown): string {
  if (Array.isArray(input)) return JSON.stringify(input.map(String).filter(Boolean));
  if (typeof input === "string" && input.trim()) {
    return JSON.stringify(input.split(",").map((tag) => tag.trim()).filter(Boolean));
  }
  return "[]";
}

export type SourceUpdateOutcome =
  | { ok: true; patch: { updatedAt: Date; folderId?: number | null; tags?: string } }
  | { ok: false; status: number; error: string };

export function buildSourceUpdate(
  body: { folderId?: number | null; tags?: unknown },
  folderValid: boolean,
  now: Date = new Date(),
): SourceUpdateOutcome {
  const hasFolder = body.folderId !== undefined;
  const hasTags = body.tags !== undefined;
  if (!hasFolder && !hasTags) {
    return { ok: false, status: 400, error: "nessun campo da aggiornare" };
  }
  const patch: { updatedAt: Date; folderId?: number | null; tags?: string } = { updatedAt: now };
  if (hasFolder) {
    const next = body.folderId == null ? null : Number(body.folderId);
    if (next !== null && !folderValid) {
      return { ok: false, status: 400, error: "Cartella non trovata" };
    }
    patch.folderId = next;
  }
  if (hasTags) patch.tags = parseTags(body.tags);
  return { ok: true, patch };
}
