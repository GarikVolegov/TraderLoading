# Archive (Archivio) — Claude Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reimplement the Archive page (`/wiki`) to match the Claude Design `templates/archivio/` template — Libreria layout (collections rail + tag cloud), grid/list/board views, density toggle, type filters, search, detail modal with tag editing, and an Add dialog — fully wired to the existing `wiki` backend.

**Architecture:** Pure logic lives in `lib/archive.ts` (frontend) and `services/wikiSourceUpdate.ts` (backend), both unit-tested. `pages/Wiki.tsx` is a thin orchestrator composing presentational components in `components/archive/*`. "Collezioni" map to the existing user **folders** (no migration). One small backend change adds `tags` support to `PATCH /wiki/sources/:id`.

**Tech Stack:** React 19 + Vite + Wouter, TanStack Query, Tailwind 4, lucide-react, react-dropzone, existing `components/ui/*` primitives; Express 5 + Drizzle backend. Tests run via `node --import tsx <file>` (node:assert), discovered by `pnpm test`.

## Global Constraints

- **Branch:** `feat/community-management` (long-lived, multi-agent — do NOT merge to main; coordinate).
- **No rename:** route `/wiki`, endpoints `/wiki/*`, table names, i18n `wiki.*` keys, and Pro feature flag `feature="wiki"` stay. New copy uses a new `archive.*` namespace.
- **Wiki uses direct `apiFetch`/`apiUpload`** (NOT Orval) → no `pnpm codegen` needed for backend changes.
- **i18n parity (hard gate):** every key in `DICT.it` must exist in ALL of `["it","en","es","fr","de"]` with non-empty values, identical key sets (no extra keys), identical `{placeholders}`, and NO mojibake chars `Ã â Â ð`. Add every new `archive.*` key to all 5 languages.
- **Production-copy gate:** files under `components/pages/contexts/lib` (except `ui/`, tests, `i18n.ts`) must not contain hardcoded visible copy — route all visible text/`aria-label`/`placeholder`/`title`/`confirm()` through `uiText()`.
- **Lint:** `@typescript-eslint/no-explicit-any` = error in non-test source. TS strict. No `prettier --write` on api-server files.
- **Commits:** semantic with scope (`feat(ui):`, `feat(api):`, `test:`).
- **Gate before done:** `pnpm verify` green.

**Shared accent palettes** (used by `lib/archive.ts`, referenced by several tasks):
```ts
// Functional type-category colors (vivid semantics kept functional).
const TYPE_ACCENT = {
  image: "hsl(142 71% 45%)",
  video: "hsl(262 83% 66%)",
  pdf:   "hsl(0 84% 62%)",
  audio: "hsl(38 92% 52%)",
  link:  "hsl(217 91% 62%)",
  note:  "hsl(214 26% 74%)",
} as const;
// Deterministic accents for folders without an explicit color.
const COLLECTION_PALETTE = [
  "hsl(142 71% 45%)", "hsl(217 91% 62%)", "hsl(262 83% 66%)",
  "hsl(38 92% 52%)", "hsl(35 100% 56%)", "hsl(150 100% 42%)",
  "hsl(0 84% 62%)", "hsl(190 90% 50%)",
] as const;
```

---

### Task 1: Backend — `tags` on `PATCH /wiki/sources/:id`

**Files:**
- Create: `artifacts/api-server/src/services/wikiSourceUpdate.ts`
- Create: `artifacts/api-server/src/services/wikiSourceUpdate.test.ts`
- Modify: `artifacts/api-server/src/routes/wiki.ts` (replace local `parseTags`; rewrite the `PATCH /wiki/sources/:id` body-handling at lines ~177-208)

**Interfaces:**
- Produces: `parseTags(input: unknown): string` and
  `buildSourceUpdate(body, folderValid, now?): SourceUpdateOutcome` where
  `SourceUpdateOutcome = { ok: true; patch: { updatedAt: Date; folderId?: number | null; tags?: string } } | { ok: false; status: number; error: string }`.

- [ ] **Step 1: Write the failing test**

Create `artifacts/api-server/src/services/wikiSourceUpdate.test.ts`:
```ts
import assert from "node:assert/strict";
const { parseTags, buildSourceUpdate } = await import("./wikiSourceUpdate.js");

// parseTags
assert.equal(parseTags(["a", "b"]), JSON.stringify(["a", "b"]));
assert.equal(parseTags("a, b ,, c"), JSON.stringify(["a", "b", "c"]));
assert.equal(parseTags(""), "[]");
assert.equal(parseTags(undefined), "[]");
assert.equal(parseTags([1, "x", ""]), JSON.stringify(["1", "x"]));

const NOW = new Date("2026-06-30T00:00:00.000Z");

// no updatable field -> 400
assert.deepEqual(buildSourceUpdate({}, true, NOW), {
  ok: false, status: 400, error: "nessun campo da aggiornare",
});

// tags only
assert.deepEqual(buildSourceUpdate({ tags: ["x"] }, true, NOW), {
  ok: true, patch: { updatedAt: NOW, tags: JSON.stringify(["x"]) },
});

// move to root (folderId null) needs no folder check
assert.deepEqual(buildSourceUpdate({ folderId: null }, false, NOW), {
  ok: true, patch: { updatedAt: NOW, folderId: null },
});

// folderId provided but invalid
assert.deepEqual(buildSourceUpdate({ folderId: 5 }, false, NOW), {
  ok: false, status: 400, error: "Cartella non trovata",
});

// folderId valid + tags together
assert.deepEqual(buildSourceUpdate({ folderId: 5, tags: "a,b" }, true, NOW), {
  ok: true, patch: { updatedAt: NOW, folderId: 5, tags: JSON.stringify(["a", "b"]) },
});

console.log("wikiSourceUpdate checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test` (or `cd artifacts/api-server && node --import tsx src/services/wikiSourceUpdate.test.ts`)
Expected: FAIL — `Cannot find module './wikiSourceUpdate.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `artifacts/api-server/src/services/wikiSourceUpdate.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd artifacts/api-server && node --import tsx src/services/wikiSourceUpdate.test.ts`
Expected: PASS — `wikiSourceUpdate checks passed`.

- [ ] **Step 5: Wire the route**

In `artifacts/api-server/src/routes/wiki.ts`:
1. Add import near the other service imports:
   ```ts
   import { buildSourceUpdate, parseTags } from "../services/wikiSourceUpdate.js";
   ```
2. Delete the local `function parseTags(input: unknown): string { ... }` (lines ~37-43) — now imported.
3. Replace the body of `router.patch("/wiki/sources/:id", ...)` from the existing-source 404 check onward. Keep the source-exists lookup; replace the folder validation + update block (the part after the `if (!source) { ... }` guard) with:
   ```ts
     const { folderId, tags } = req.body as { folderId?: number | null; tags?: unknown };
     let folderValid = true;
     if (folderId != null) {
       const [folder] = await db
         .select({ id: wikiFoldersTable.id })
         .from(wikiFoldersTable)
         .where(and(eq(wikiFoldersTable.id, Number(folderId)), eq(wikiFoldersTable.userId, userId)))
         .limit(1);
       folderValid = Boolean(folder);
     }
     const outcome = buildSourceUpdate({ folderId, tags }, folderValid);
     if (!outcome.ok) {
       res.status(outcome.status).json({ error: outcome.error });
       return;
     }
     const [updated] = await db
       .update(wikiSourcesTable)
       .set(outcome.patch)
       .where(and(eq(wikiSourcesTable.id, id), eq(wikiSourcesTable.userId, userId)))
       .returning();
     res.json(updated);
   ```

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.
```bash
git add artifacts/api-server/src/services/wikiSourceUpdate.ts artifacts/api-server/src/services/wikiSourceUpdate.test.ts artifacts/api-server/src/routes/wiki.ts
git commit -m "feat(api): support tag editing on PATCH /wiki/sources/:id

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Frontend pure core — `lib/archive.ts`

**Files:**
- Create: `artifacts/trader-dashboard/src/lib/archive.ts`
- Create: `artifacts/trader-dashboard/src/lib/archive.test.ts`

**Interfaces:**
- Produces (consumed by every frontend task):
  - Types: `WikiStatus`, `WikiKind`, `WikiSource`, `ArchiveFolder`, `ArchiveType`, `Collection`, `TagCount`, `ArchiveFilter`.
  - `archiveTypeOf(kind: WikiKind): ArchiveType`
  - `ARCHIVE_TYPES: ArchiveType[]` (chip order)
  - `TYPE_ACCENT: Record<ArchiveType, string>`; `TYPE_LABEL_KEY: Record<ArchiveType, string>`
  - `parseTags(raw: string): string[]`
  - `collectionAccent(folder: { id: number; color: string | null }): string`
  - `collectionsFromFolders(folders: ArchiveFolder[], sources: WikiSource[]): Collection[]`
  - `tagCloud(sources: WikiSource[], limit?: number): TagCount[]`
  - `filterSources(sources: WikiSource[], filter: ArchiveFilter): WikiSource[]`

- [ ] **Step 1: Write the failing test**

Create `artifacts/trader-dashboard/src/lib/archive.test.ts`:
```ts
import assert from "node:assert/strict";
import {
  archiveTypeOf,
  parseTags,
  collectionsFromFolders,
  collectionAccent,
  tagCloud,
  filterSources,
  type WikiSource,
  type ArchiveFolder,
} from "./archive.ts";

// kind -> archive type mapping
assert.equal(archiveTypeOf("image"), "image");
assert.equal(archiveTypeOf("office"), "pdf");
assert.equal(archiveTypeOf("url"), "link");
assert.equal(archiveTypeOf("text"), "note");
assert.equal(archiveTypeOf("unknown"), "note");

// parseTags is defensive over the JSON string column
assert.deepEqual(parseTags('["a","b"]'), ["a", "b"]);
assert.deepEqual(parseTags("not json"), []);
assert.deepEqual(parseTags("[1,2]"), ["1", "2"]);

function src(p: Partial<WikiSource>): WikiSource {
  return {
    id: 1, kind: "text", title: "t", status: "ready", error: null, fileUrl: null,
    fileName: null, mimeType: null, folderId: null, extractedText: "", tags: "[]",
    originalUrl: null, fileSize: 0, createdAt: "2026-06-30T00:00:00Z", ...p,
  };
}

const folders: ArchiveFolder[] = [
  { id: 10, name: "Setup", parentId: null, color: null, position: 0 },
  { id: 11, name: "Strategie", parentId: null, color: "#ff0000", position: 1 },
];
const sources: WikiSource[] = [
  src({ id: 1, folderId: 10, tags: '["a","b"]' }),
  src({ id: 2, folderId: 10, tags: '["a"]' }),
  src({ id: 3, folderId: null, tags: "[]" }),
];

const colls = collectionsFromFolders(folders, sources);
assert.equal(colls.length, 2);
assert.equal(colls[0].id, 10);
assert.equal(colls[0].count, 2);
assert.equal(colls[1].count, 0);
// explicit color wins; missing color -> deterministic palette entry
assert.equal(colls[1].accent, "#ff0000");
assert.equal(collectionAccent({ id: 10, color: null }).startsWith("hsl"), true);

// tag cloud sorted by frequency then alpha
const cloud = tagCloud(sources);
assert.deepEqual(cloud, [{ tag: "a", count: 2 }, { tag: "b", count: 1 }]);

// filtering: type
assert.deepEqual(
  filterSources(sources, { search: "", type: "note", collection: "all", tag: null }).map((s) => s.id),
  [1, 2, 3],
);
// filtering: collection root (unfiled)
assert.deepEqual(
  filterSources(sources, { search: "", type: "all", collection: "root", tag: null }).map((s) => s.id),
  [3],
);
// filtering: collection by folder id
assert.deepEqual(
  filterSources(sources, { search: "", type: "all", collection: 10, tag: null }).map((s) => s.id),
  [1, 2],
);
// filtering: tag
assert.deepEqual(
  filterSources(sources, { search: "", type: "all", collection: "all", tag: "b" }).map((s) => s.id),
  [1],
);
// filtering: search over title + extractedText + tags
assert.deepEqual(
  filterSources([src({ id: 9, title: "EURUSD breakout", tags: '["fx"]' })],
    { search: "breakout", type: "all", collection: "all", tag: null }).map((s) => s.id),
  [9],
);

console.log("archive lib checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd artifacts/trader-dashboard && node --import tsx src/lib/archive.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `artifacts/trader-dashboard/src/lib/archive.ts`:
```ts
// Pure logic for the Archive page: type mapping, collection/tag derivation, and
// filtering. No React, no i18n — components resolve display strings via uiText.

export type WikiStatus = "queued" | "processing" | "ready" | "error" | "pending_transcription";
export type WikiKind = "text" | "pdf" | "image" | "office" | "audio" | "video" | "url" | "unknown";

export interface WikiSource {
  id: number;
  kind: WikiKind;
  title: string;
  status: WikiStatus;
  error: string | null;
  fileUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  folderId: number | null;
  extractedText: string;
  tags: string;
  originalUrl: string | null;
  fileSize: number;
  createdAt: string;
}

export interface ArchiveFolder {
  id: number;
  name: string;
  parentId: number | null;
  color: string | null;
  position: number;
}

export type ArchiveType = "image" | "video" | "audio" | "pdf" | "link" | "note";

export interface Collection {
  id: number;
  name: string;
  count: number;
  accent: string;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface ArchiveFilter {
  search: string;
  type: ArchiveType | "all";
  collection: "all" | "root" | number;
  tag: string | null;
}

export const ARCHIVE_TYPES: ArchiveType[] = ["image", "pdf", "video", "audio", "link", "note"];

export const TYPE_ACCENT: Record<ArchiveType, string> = {
  image: "hsl(142 71% 45%)",
  video: "hsl(262 83% 66%)",
  pdf: "hsl(0 84% 62%)",
  audio: "hsl(38 92% 52%)",
  link: "hsl(217 91% 62%)",
  note: "hsl(214 26% 74%)",
};

export const TYPE_LABEL_KEY: Record<ArchiveType, string> = {
  image: "archive.type.image",
  video: "archive.type.video",
  pdf: "archive.type.pdf",
  audio: "archive.type.audio",
  link: "archive.type.link",
  note: "archive.type.note",
};

export function archiveTypeOf(kind: WikiKind): ArchiveType {
  switch (kind) {
    case "image": return "image";
    case "video": return "video";
    case "audio": return "audio";
    case "pdf": return "pdf";
    case "office": return "pdf";
    case "url": return "link";
    default: return "note"; // text, unknown
  }
}

const COLLECTION_PALETTE = [
  "hsl(142 71% 45%)", "hsl(217 91% 62%)", "hsl(262 83% 66%)",
  "hsl(38 92% 52%)", "hsl(35 100% 56%)", "hsl(150 100% 42%)",
  "hsl(0 84% 62%)", "hsl(190 90% 50%)",
];

export function collectionAccent(folder: { id: number; color: string | null }): string {
  if (folder.color && folder.color.trim()) return folder.color;
  return COLLECTION_PALETTE[folder.id % COLLECTION_PALETTE.length];
}

export function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function collectionsFromFolders(folders: ArchiveFolder[], sources: WikiSource[]): Collection[] {
  const counts = new Map<number, number>();
  for (const s of sources) {
    if (s.folderId != null) counts.set(s.folderId, (counts.get(s.folderId) ?? 0) + 1);
  }
  return [...folders]
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    .map((f) => ({
      id: f.id,
      name: f.name,
      count: counts.get(f.id) ?? 0,
      accent: collectionAccent(f),
    }));
}

export function tagCloud(sources: WikiSource[], limit = 12): TagCount[] {
  const counts = new Map<string, number>();
  for (const s of sources) {
    for (const tag of parseTags(s.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

export function filterSources(sources: WikiSource[], filter: ArchiveFilter): WikiSource[] {
  const needle = filter.search.trim().toLowerCase();
  return sources.filter((s) => {
    if (filter.type !== "all" && archiveTypeOf(s.kind) !== filter.type) return false;
    if (filter.collection === "root") {
      if (s.folderId != null) return false;
    } else if (filter.collection !== "all") {
      if (s.folderId !== filter.collection) return false;
    }
    if (filter.tag && !parseTags(s.tags).includes(filter.tag)) return false;
    if (needle) {
      const haystack = [
        s.title,
        s.extractedText ?? "",
        parseTags(s.tags).join(" "),
        s.fileName ?? "",
      ].join(" ").toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd artifacts/trader-dashboard && node --import tsx src/lib/archive.test.ts`
Expected: PASS — `archive lib checks passed`.

- [ ] **Step 5: Commit**
```bash
git add artifacts/trader-dashboard/src/lib/archive.ts artifacts/trader-dashboard/src/lib/archive.test.ts
git commit -m "feat(ui): pure archive logic (type map, collections, tags, filter)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: i18n — `archive.*` keys in all 5 languages

**Files:**
- Modify: `artifacts/trader-dashboard/src/lib/i18n.ts` (insert an `archive.*` block immediately after the `wiki.folders.cancel` line within EACH of the `it`, `en`, `es`, `fr`, `de` dictionaries — at lines ~4622, ~4753, and the matching points in es/fr/de).

**Interfaces:**
- Produces the i18n keys consumed by Tasks 4–9. The full key set (with all-language values) below is authoritative.

- [ ] **Step 1: Insert the IT block** (after `"wiki.folders.cancel": "Annulla",` in the `it` dict):
```ts
    "archive.eyebrow": "Archivio",
    "archive.title": "Il tuo archivio",
    "archive.subtitle": "Tutto il tuo trading in un unico posto: screenshot, PDF, video, vocali e link, organizzati per collezioni e tag.",
    "archive.stats.items": "{count} elementi",
    "archive.stats.collections": "{count} collezioni",
    "archive.add": "Aggiungi",
    "archive.collections": "Collezioni",
    "archive.collections.all": "Tutti",
    "archive.collections.unfiled": "Senza collezione",
    "archive.collections.new": "Nuova collezione",
    "archive.tags": "Tag",
    "archive.search.placeholder": "Cerca per titolo o #tag…",
    "archive.clear": "Azzera",
    "archive.clear_filters": "Azzera filtri",
    "archive.view.grid": "Griglia",
    "archive.view.list": "Lista",
    "archive.view.board": "Bacheca",
    "archive.density.toggle": "Densità",
    "archive.type.all": "Tutti",
    "archive.type.image": "Immagini",
    "archive.type.pdf": "PDF",
    "archive.type.video": "Video",
    "archive.type.audio": "Audio",
    "archive.type.link": "Link",
    "archive.type.note": "Note",
    "archive.empty.title": "Inizia il tuo archivio",
    "archive.empty.body": "Salva qui screenshot, PDF, video, vocali e link. Organizza tutto per collezioni e tag e ritrova ogni cosa in un attimo.",
    "archive.empty.cta": "Aggiungi contenuto",
    "archive.noresults.title": "Nessun risultato",
    "archive.noresults.body": "Nessun elemento corrisponde ai filtri attivi.",
    "archive.add.title": "Aggiungi all'archivio",
    "archive.add.drop_title": "Trascina qui file, screenshot, PDF o audio",
    "archive.add.browse": "Sfoglia i file",
    "archive.add.note_label": "Nota rapida",
    "archive.add.note_cta": "Salva nota",
    "archive.add.url_cta": "Importa URL",
    "archive.meta.type": "Tipo",
    "archive.meta.collection": "Collezione",
    "archive.meta.date": "Data",
    "archive.meta.file": "File",
    "archive.open": "Apri",
    "archive.delete": "Elimina",
    "archive.delete_confirm": "Eliminare \"{title}\"? L'operazione non è reversibile.",
    "archive.tags.add_placeholder": "Aggiungi tag…",
    "archive.tags.empty": "Nessun tag",
    "archive.close": "Chiudi",
```

- [ ] **Step 2: Insert the EN block** (after `"wiki.folders.cancel": "Cancel",`):
```ts
    "archive.eyebrow": "Archive",
    "archive.title": "Your archive",
    "archive.subtitle": "Your whole trading life in one place: screenshots, PDFs, videos, voice notes and links, organized by collections and tags.",
    "archive.stats.items": "{count} items",
    "archive.stats.collections": "{count} collections",
    "archive.add": "Add",
    "archive.collections": "Collections",
    "archive.collections.all": "All",
    "archive.collections.unfiled": "Uncategorized",
    "archive.collections.new": "New collection",
    "archive.tags": "Tags",
    "archive.search.placeholder": "Search by title or #tag…",
    "archive.clear": "Clear",
    "archive.clear_filters": "Clear filters",
    "archive.view.grid": "Grid",
    "archive.view.list": "List",
    "archive.view.board": "Board",
    "archive.density.toggle": "Density",
    "archive.type.all": "All",
    "archive.type.image": "Images",
    "archive.type.pdf": "PDF",
    "archive.type.video": "Videos",
    "archive.type.audio": "Audio",
    "archive.type.link": "Links",
    "archive.type.note": "Notes",
    "archive.empty.title": "Start your archive",
    "archive.empty.body": "Save screenshots, PDFs, videos, voice notes and links here. Organize everything by collections and tags and find it again in seconds.",
    "archive.empty.cta": "Add content",
    "archive.noresults.title": "No results",
    "archive.noresults.body": "No item matches the active filters.",
    "archive.add.title": "Add to archive",
    "archive.add.drop_title": "Drop files, screenshots, PDFs or audio here",
    "archive.add.browse": "Browse files",
    "archive.add.note_label": "Quick note",
    "archive.add.note_cta": "Save note",
    "archive.add.url_cta": "Import URL",
    "archive.meta.type": "Type",
    "archive.meta.collection": "Collection",
    "archive.meta.date": "Date",
    "archive.meta.file": "File",
    "archive.open": "Open",
    "archive.delete": "Delete",
    "archive.delete_confirm": "Delete \"{title}\"? This cannot be undone.",
    "archive.tags.add_placeholder": "Add tag…",
    "archive.tags.empty": "No tags",
    "archive.close": "Close",
```

- [ ] **Step 3: Insert the ES block** (after the es `wiki.folders.cancel`):
```ts
    "archive.eyebrow": "Archivo",
    "archive.title": "Tu archivo",
    "archive.subtitle": "Todo tu trading en un solo lugar: capturas, PDF, vídeos, notas de voz y enlaces, organizados por colecciones y etiquetas.",
    "archive.stats.items": "{count} elementos",
    "archive.stats.collections": "{count} colecciones",
    "archive.add": "Añadir",
    "archive.collections": "Colecciones",
    "archive.collections.all": "Todos",
    "archive.collections.unfiled": "Sin colección",
    "archive.collections.new": "Nueva colección",
    "archive.tags": "Etiquetas",
    "archive.search.placeholder": "Busca por título o #tag…",
    "archive.clear": "Limpiar",
    "archive.clear_filters": "Limpiar filtros",
    "archive.view.grid": "Cuadrícula",
    "archive.view.list": "Lista",
    "archive.view.board": "Tablero",
    "archive.density.toggle": "Densidad",
    "archive.type.all": "Todos",
    "archive.type.image": "Imágenes",
    "archive.type.pdf": "PDF",
    "archive.type.video": "Vídeos",
    "archive.type.audio": "Audio",
    "archive.type.link": "Enlaces",
    "archive.type.note": "Notas",
    "archive.empty.title": "Empieza tu archivo",
    "archive.empty.body": "Guarda aquí capturas, PDF, vídeos, notas de voz y enlaces. Organiza todo por colecciones y etiquetas y encuéntralo en segundos.",
    "archive.empty.cta": "Añadir contenido",
    "archive.noresults.title": "Sin resultados",
    "archive.noresults.body": "Ningún elemento coincide con los filtros activos.",
    "archive.add.title": "Añadir al archivo",
    "archive.add.drop_title": "Arrastra aquí archivos, capturas, PDF o audio",
    "archive.add.browse": "Explorar archivos",
    "archive.add.note_label": "Nota rápida",
    "archive.add.note_cta": "Guardar nota",
    "archive.add.url_cta": "Importar URL",
    "archive.meta.type": "Tipo",
    "archive.meta.collection": "Colección",
    "archive.meta.date": "Fecha",
    "archive.meta.file": "Archivo",
    "archive.open": "Abrir",
    "archive.delete": "Eliminar",
    "archive.delete_confirm": "¿Eliminar \"{title}\"? No se puede deshacer.",
    "archive.tags.add_placeholder": "Añadir etiqueta…",
    "archive.tags.empty": "Sin etiquetas",
    "archive.close": "Cerrar",
```

- [ ] **Step 4: Insert the FR block** (after the fr `wiki.folders.cancel`). NOTE: avoid mojibake chars `â Â Ã ð` — none used below:
```ts
    "archive.eyebrow": "Archives",
    "archive.title": "Ton archive",
    "archive.subtitle": "Tout ton trading au même endroit : captures, PDF, vidéos, notes vocales et liens, organisés par collections et tags.",
    "archive.stats.items": "{count} éléments",
    "archive.stats.collections": "{count} collections",
    "archive.add": "Ajouter",
    "archive.collections": "Collections",
    "archive.collections.all": "Tous",
    "archive.collections.unfiled": "Sans collection",
    "archive.collections.new": "Nouvelle collection",
    "archive.tags": "Tags",
    "archive.search.placeholder": "Rechercher par titre ou #tag…",
    "archive.clear": "Effacer",
    "archive.clear_filters": "Effacer les filtres",
    "archive.view.grid": "Grille",
    "archive.view.list": "Liste",
    "archive.view.board": "Tableau",
    "archive.density.toggle": "Densité",
    "archive.type.all": "Tous",
    "archive.type.image": "Images",
    "archive.type.pdf": "PDF",
    "archive.type.video": "Vidéos",
    "archive.type.audio": "Audio",
    "archive.type.link": "Liens",
    "archive.type.note": "Notes",
    "archive.empty.title": "Démarre ton archive",
    "archive.empty.body": "Enregistre ici captures, PDF, vidéos, notes vocales et liens. Organise le tout par collections et tags et retrouve chaque chose en un instant.",
    "archive.empty.cta": "Ajouter du contenu",
    "archive.noresults.title": "Aucun résultat",
    "archive.noresults.body": "Aucun élément ne correspond aux filtres actifs.",
    "archive.add.title": "Ajouter à l'archive",
    "archive.add.drop_title": "Dépose ici fichiers, captures, PDF ou audio",
    "archive.add.browse": "Parcourir les fichiers",
    "archive.add.note_label": "Note rapide",
    "archive.add.note_cta": "Enregistrer la note",
    "archive.add.url_cta": "Importer l'URL",
    "archive.meta.type": "Type",
    "archive.meta.collection": "Collection",
    "archive.meta.date": "Date",
    "archive.meta.file": "Fichier",
    "archive.open": "Ouvrir",
    "archive.delete": "Supprimer",
    "archive.delete_confirm": "Supprimer \"{title}\" ? Action irréversible.",
    "archive.tags.add_placeholder": "Ajouter un tag…",
    "archive.tags.empty": "Aucun tag",
    "archive.close": "Fermer",
```

- [ ] **Step 5: Insert the DE block** (after the de `wiki.folders.cancel`):
```ts
    "archive.eyebrow": "Archiv",
    "archive.title": "Dein Archiv",
    "archive.subtitle": "Dein gesamtes Trading an einem Ort: Screenshots, PDFs, Videos, Sprachnotizen und Links, organisiert nach Sammlungen und Tags.",
    "archive.stats.items": "{count} Elemente",
    "archive.stats.collections": "{count} Sammlungen",
    "archive.add": "Hinzufügen",
    "archive.collections": "Sammlungen",
    "archive.collections.all": "Alle",
    "archive.collections.unfiled": "Ohne Sammlung",
    "archive.collections.new": "Neue Sammlung",
    "archive.tags": "Tags",
    "archive.search.placeholder": "Nach Titel oder #Tag suchen…",
    "archive.clear": "Zurücksetzen",
    "archive.clear_filters": "Filter zurücksetzen",
    "archive.view.grid": "Raster",
    "archive.view.list": "Liste",
    "archive.view.board": "Board",
    "archive.density.toggle": "Dichte",
    "archive.type.all": "Alle",
    "archive.type.image": "Bilder",
    "archive.type.pdf": "PDF",
    "archive.type.video": "Videos",
    "archive.type.audio": "Audio",
    "archive.type.link": "Links",
    "archive.type.note": "Notizen",
    "archive.empty.title": "Starte dein Archiv",
    "archive.empty.body": "Speichere hier Screenshots, PDFs, Videos, Sprachnotizen und Links. Organisiere alles nach Sammlungen und Tags und finde es in Sekunden wieder.",
    "archive.empty.cta": "Inhalt hinzufügen",
    "archive.noresults.title": "Keine Ergebnisse",
    "archive.noresults.body": "Kein Element entspricht den aktiven Filtern.",
    "archive.add.title": "Zum Archiv hinzufügen",
    "archive.add.drop_title": "Dateien, Screenshots, PDFs oder Audio hierher ziehen",
    "archive.add.browse": "Dateien durchsuchen",
    "archive.add.note_label": "Schnellnotiz",
    "archive.add.note_cta": "Notiz speichern",
    "archive.add.url_cta": "URL importieren",
    "archive.meta.type": "Typ",
    "archive.meta.collection": "Sammlung",
    "archive.meta.date": "Datum",
    "archive.meta.file": "Datei",
    "archive.open": "Öffnen",
    "archive.delete": "Löschen",
    "archive.delete_confirm": "\"{title}\" löschen? Kann nicht rückgängig gemacht werden.",
    "archive.tags.add_placeholder": "Tag hinzufügen…",
    "archive.tags.empty": "Keine Tags",
    "archive.close": "Schließen",
```

- [ ] **Step 6: Verify parity + commit**

Run: `cd artifacts/trader-dashboard && node --import tsx src/lib/i18n.parity.static.test.ts`
Expected: PASS — `i18n parity checks passed (...)`.
```bash
git add artifacts/trader-dashboard/src/lib/i18n.ts
git commit -m "feat(ui): archive.* i18n keys in all 5 languages

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Presentational leaves — status pill, cards, type chips

**Files:**
- Create: `artifacts/trader-dashboard/src/components/archive/ArchiveStatusPill.tsx`
- Create: `artifacts/trader-dashboard/src/components/archive/typeMeta.tsx`
- Create: `artifacts/trader-dashboard/src/components/archive/ArchiveCard.tsx`
- Create: `artifacts/trader-dashboard/src/components/archive/ArchiveRow.tsx`
- Create: `artifacts/trader-dashboard/src/components/archive/ArchiveMiniCard.tsx`
- Create: `artifacts/trader-dashboard/src/components/archive/TypeChips.tsx`

**Interfaces:**
- Consumes: `WikiSource`, `ArchiveType`, `TYPE_ACCENT`, `TYPE_LABEL_KEY`, `ARCHIVE_TYPES`, `archiveTypeOf`, `parseTags` from `@/lib/archive`.
- Produces:
  - `typeIcon(type: ArchiveType): LucideIcon` and `typeLabel(type): string` (from `typeMeta.tsx`)
  - `<ArchiveStatusPill status={WikiStatus} />`
  - `<ArchiveCard source onOpen onDragStartSource />`
  - `<ArchiveRow source onOpen onDragStartSource />`
  - `<ArchiveMiniCard source onOpen onDragStartSource />`
  - `<TypeChips value onChange />` where `value: ArchiveType | "all"`.

- [ ] **Step 1: `typeMeta.tsx`** (shared type → icon/label helpers, plus the drag payload key):
```tsx
import { FileText, Globe2, Image as ImageIcon, StickyNote, Video, Volume2, type LucideIcon } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import { TYPE_LABEL_KEY, type ArchiveType } from "@/lib/archive";

// Re-export the existing DnD payload key so SourceRow drag stays compatible
// with WikiFolderTree / ArchiveRail drop targets.
export const ARCHIVE_DND_TYPE = "application/x-wiki-source";

const ICONS: Record<ArchiveType, LucideIcon> = {
  image: ImageIcon,
  video: Video,
  pdf: FileText,
  audio: Volume2,
  link: Globe2,
  note: StickyNote,
};

export function typeIcon(type: ArchiveType): LucideIcon {
  return ICONS[type];
}

export function typeLabel(type: ArchiveType): string {
  return uiText(TYPE_LABEL_KEY[type]);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}
```

- [ ] **Step 2: `ArchiveStatusPill.tsx`** (moved/adapted from current Wiki.tsx; non-`ready` statuses only):
```tsx
import { AlertCircle, CheckCircle2, Loader2, Volume2 } from "lucide-react";
import type { WikiStatus } from "@/lib/archive";

const META: Record<WikiStatus, { color: string; spin: boolean; Icon: typeof AlertCircle }> = {
  queued: { color: "text-sky-300", spin: true, Icon: Loader2 },
  processing: { color: "text-amber-300", spin: true, Icon: Loader2 },
  ready: { color: "text-emerald-300", spin: false, Icon: CheckCircle2 },
  error: { color: "text-red-300", spin: false, Icon: AlertCircle },
  pending_transcription: { color: "text-violet-300", spin: false, Icon: Volume2 },
};

export function ArchiveStatusPill({ status }: { status: WikiStatus }) {
  if (status === "ready") return null;
  const { color, spin, Icon } = META[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold ${color}`}>
      <Icon className={`h-3 w-3 ${spin ? "animate-spin" : ""}`} />
    </span>
  );
}
```

- [ ] **Step 3: `ArchiveCard.tsx`** (grid card; draggable; type accent on cover):
```tsx
import { archiveTypeOf, parseTags, TYPE_ACCENT, type WikiSource } from "@/lib/archive";
import { ARCHIVE_DND_TYPE, formatDate, typeIcon, typeLabel } from "./typeMeta";
import { ArchiveStatusPill } from "./ArchiveStatusPill";

interface Props {
  source: WikiSource;
  onOpen: (id: number) => void;
}

export function ArchiveCard({ source, onOpen }: Props) {
  const type = archiveTypeOf(source.kind);
  const accent = TYPE_ACCENT[type];
  const Icon = typeIcon(type);
  const tags = parseTags(source.tags).slice(0, 2);
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ARCHIVE_DND_TYPE, String(source.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpen(source.id)}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border/50 bg-card/65 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
    >
      <div
        className="relative flex h-[var(--arc-cover,150px)] flex-col items-center justify-center gap-2 border-b border-border/35"
        style={{ background: `linear-gradient(155deg, color-mix(in srgb, ${accent} 14%, transparent), hsl(226 43% 10% / .55))` }}
      >
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/65 px-2 py-0.5" style={{ color: accent }}>
          <Icon className="h-3 w-3" />
          <span className="font-mono text-[9px] uppercase tracking-wider">{typeLabel(type)}</span>
        </span>
        <span className="absolute right-2 top-2"><ArchiveStatusPill status={source.status} /></span>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/50 bg-background/50" style={{ color: accent }}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-[var(--arc-pad,13px)]">
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">{source.title}</p>
        <div className="mt-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-mono">{formatDate(source.createdAt)}</span>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <span key={t} className="rounded-md border border-border/35 bg-secondary/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">#{t}</span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 4: `ArchiveRow.tsx`** (list row; draggable):
```tsx
import { archiveTypeOf, parseTags, TYPE_ACCENT, type WikiSource } from "@/lib/archive";
import { ARCHIVE_DND_TYPE, formatDate, typeIcon, typeLabel } from "./typeMeta";
import { ArchiveStatusPill } from "./ArchiveStatusPill";

export function ArchiveRow({ source, onOpen }: { source: WikiSource; onOpen: (id: number) => void }) {
  const type = archiveTypeOf(source.kind);
  const accent = TYPE_ACCENT[type];
  const Icon = typeIcon(type);
  const tags = parseTags(source.tags).slice(0, 2);
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ARCHIVE_DND_TYPE, String(source.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpen(source.id)}
      className="flex w-full items-center gap-3 rounded-lg border border-border/40 bg-card/55 px-3.5 py-[var(--arc-rowpad,11px)] text-left transition-all hover:border-primary/45 hover:bg-card/70"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/45 bg-background/50" style={{ color: accent }}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13.5px] font-semibold text-foreground">{source.title}</p>
          <ArchiveStatusPill status={source.status} />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: accent }}>{typeLabel(type)}</span>
      </div>
      <div className="hidden shrink-0 gap-1 sm:flex">
        {tags.map((t) => (
          <span key={t} className="rounded-md border border-border/35 bg-secondary/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">#{t}</span>
        ))}
      </div>
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{formatDate(source.createdAt)}</span>
    </button>
  );
}
```

- [ ] **Step 5: `ArchiveMiniCard.tsx`** (board mini card):
```tsx
import { archiveTypeOf, TYPE_ACCENT, type WikiSource } from "@/lib/archive";
import { ARCHIVE_DND_TYPE, formatDate, typeIcon, typeLabel } from "./typeMeta";

export function ArchiveMiniCard({ source, onOpen }: { source: WikiSource; onOpen: (id: number) => void }) {
  const type = archiveTypeOf(source.kind);
  const accent = TYPE_ACCENT[type];
  const Icon = typeIcon(type);
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ARCHIVE_DND_TYPE, String(source.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpen(source.id)}
      className="flex flex-col gap-1.5 rounded-lg border border-border/40 bg-secondary/40 p-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/45"
    >
      <span className="flex items-center gap-1.5" style={{ color: accent }}>
        <Icon className="h-3.5 w-3.5" />
        <span className="font-mono text-[9.5px] uppercase tracking-wide">{typeLabel(type)}</span>
      </span>
      <p className="line-clamp-2 text-[12.5px] font-medium leading-snug text-foreground">{source.title}</p>
      <span className="font-mono text-[10px] text-muted-foreground">{formatDate(source.createdAt)}</span>
    </button>
  );
}
```

- [ ] **Step 6: `TypeChips.tsx`**:
```tsx
import { LayoutGrid } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import { ARCHIVE_TYPES, TYPE_ACCENT, type ArchiveType } from "@/lib/archive";
import { typeIcon, typeLabel } from "./typeMeta";

interface Props {
  value: ArchiveType | "all";
  onChange: (value: ArchiveType | "all") => void;
}

export function TypeChips({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange("all")}
        data-active={value === "all" ? "1" : undefined}
        className="inline-flex items-center gap-1.5 rounded-full border border-border/45 bg-card/55 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active]:border-primary/55 data-[active]:bg-primary/15 data-[active]:font-semibold data-[active]:text-primary"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        {uiText("archive.type.all")}
      </button>
      {ARCHIVE_TYPES.map((type) => {
        const Icon = typeIcon(type);
        const active = value === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            data-active={active ? "1" : undefined}
            style={active ? { color: TYPE_ACCENT[type], borderColor: TYPE_ACCENT[type] } : undefined}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/45 bg-card/55 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active]:bg-primary/10 data-[active]:font-semibold"
          >
            <Icon className="h-3.5 w-3.5" />
            {typeLabel(type)}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 7: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.
```bash
git add artifacts/trader-dashboard/src/components/archive/
git commit -m "feat(ui): archive item cards, status pill, type chips

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `ArchiveRail` — collections + tag cloud

**Files:**
- Create: `artifacts/trader-dashboard/src/components/archive/ArchiveRail.tsx`

**Interfaces:**
- Consumes: `Collection`, `TagCount` from `@/lib/archive`; `ARCHIVE_DND_TYPE` from `./typeMeta`.
- Produces: `<ArchiveRail collections collectionFilter onCollectionChange tagCloud tagFilter onTagChange unfiledCount allCount onMoveSource onCreateCollection />`.
  - `collectionFilter: "all" | "root" | number`
  - `onMoveSource: (sourceId: number, folderId: number | null) => void`
  - `onCreateCollection: (name: string) => void`

- [ ] **Step 1: Implement** `ArchiveRail.tsx`:
```tsx
import { useState } from "react";
import { Files, FolderPlus, Inbox, Plus } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import type { Collection, TagCount } from "@/lib/archive";
import { ARCHIVE_DND_TYPE } from "./typeMeta";

interface Props {
  collections: Collection[];
  collectionFilter: "all" | "root" | number;
  onCollectionChange: (value: "all" | "root" | number) => void;
  allCount: number;
  unfiledCount: number;
  tagCloud: TagCount[];
  tagFilter: string | null;
  onTagChange: (tag: string | null) => void;
  onMoveSource: (sourceId: number, folderId: number | null) => void;
  onCreateCollection: (name: string) => void;
}

export function ArchiveRail(props: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [dropTarget, setDropTarget] = useState<"root" | number | null>(null);

  const handleDrop = (folderId: number | null, target: "root" | number, e: React.DragEvent) => {
    e.preventDefault();
    setDropTarget(null);
    const raw = e.dataTransfer.getData(ARCHIVE_DND_TYPE);
    const sourceId = Number(raw);
    if (raw && !Number.isNaN(sourceId)) props.onMoveSource(sourceId, folderId);
  };

  const rowCls = (active: boolean, isDrop: boolean) =>
    `flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-[13px] transition-colors ${
      active ? "border-border/60 bg-secondary/70 text-foreground" : "border-transparent text-muted-foreground hover:bg-secondary/40"
    } ${isDrop ? "ring-1 ring-primary" : ""}`;

  return (
    <aside className="w-full space-y-3.5 xl:w-[248px] xl:shrink-0">
      <div className="tl-panel space-y-1 p-3.5">
        <span className="px-1.5 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{uiText("archive.collections")}</span>

        <button type="button" className={rowCls(props.collectionFilter === "all", false)} onClick={() => props.onCollectionChange("all")}>
          <Files className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{uiText("archive.collections.all")}</span>
          {props.allCount > 0 && <span className="font-mono text-[11px] opacity-70">{props.allCount}</span>}
        </button>

        <button
          type="button"
          className={rowCls(props.collectionFilter === "root", dropTarget === "root")}
          onClick={() => props.onCollectionChange("root")}
          onDragOver={(e) => { e.preventDefault(); setDropTarget("root"); }}
          onDragLeave={() => setDropTarget((c) => (c === "root" ? null : c))}
          onDrop={(e) => handleDrop(null, "root", e)}
        >
          <Inbox className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{uiText("archive.collections.unfiled")}</span>
          {props.unfiledCount > 0 && <span className="font-mono text-[11px] opacity-70">{props.unfiledCount}</span>}
        </button>

        {props.collections.map((c) => (
          <button
            key={c.id}
            type="button"
            className={rowCls(props.collectionFilter === c.id, dropTarget === c.id)}
            onClick={() => props.onCollectionChange(c.id)}
            onDragOver={(e) => { e.preventDefault(); setDropTarget(c.id); }}
            onDragLeave={() => setDropTarget((cur) => (cur === c.id ? null : cur))}
            onDrop={(e) => handleDrop(c.id, c.id, e)}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.accent }} />
            <span className="flex-1 truncate">{c.name}</span>
            <span className="font-mono text-[11px] opacity-70">{c.count}</span>
          </button>
        ))}

        {creating ? (
          <input
            autoFocus
            value={name}
            placeholder={uiText("wiki.folders.name_placeholder")}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) { props.onCreateCollection(name.trim()); setName(""); setCreating(false); }
              if (e.key === "Escape") { setCreating(false); setName(""); }
            }}
            onBlur={() => { setCreating(false); setName(""); }}
            className="mt-1.5 h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
          />
        ) : (
          <button type="button" onClick={() => setCreating(true)} className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border/60 px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
            <FolderPlus className="h-3.5 w-3.5" />
            {uiText("archive.collections.new")}
          </button>
        )}
      </div>

      {props.tagCloud.length > 0 && (
        <div className="tl-panel space-y-2.5 p-3.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{uiText("archive.tags")}</span>
          <div className="flex flex-wrap gap-1.5">
            {props.tagCloud.map((t) => {
              const active = props.tagFilter === t.tag;
              return (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => props.onTagChange(active ? null : t.tag)}
                  data-active={active ? "1" : undefined}
                  className="inline-flex items-center rounded-md border border-border/35 bg-secondary/40 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/45 data-[active]:border-primary/55 data-[active]:bg-primary/15 data-[active]:text-primary"
                >
                  #{t.tag}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
```
(Note: `Plus` import retained for parity with template intent; if unused, ESLint `no-unused-vars` fails — remove the `Plus` import. The implementer must keep imports tight.)

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS. (If `Plus` is unused, delete it from the import.)
```bash
git add artifacts/trader-dashboard/src/components/archive/ArchiveRail.tsx
git commit -m "feat(ui): archive collections rail + tag cloud

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Toolbar + view containers

**Files:**
- Create: `artifacts/trader-dashboard/src/components/archive/ArchiveToolbar.tsx`
- Create: `artifacts/trader-dashboard/src/components/archive/ArchiveGrid.tsx`
- Create: `artifacts/trader-dashboard/src/components/archive/ArchiveList.tsx`
- Create: `artifacts/trader-dashboard/src/components/archive/ArchiveBoard.tsx`

**Interfaces:**
- Consumes: `WikiSource`, `Collection` from `@/lib/archive`; `ArchiveCard`/`ArchiveRow`/`ArchiveMiniCard`.
- Produces:
  - `type ArchiveView = "grid" | "list" | "board"`; `type ArchiveDensity = "comoda" | "compatta"`.
  - `<ArchiveToolbar search onSearch view onViewChange density onDensityChange count filtered onClear />`
  - `<ArchiveGrid items onOpen />`, `<ArchiveList items onOpen />`, `<ArchiveBoard columns onOpen />`
    where `columns: { collection: Collection | null; items: WikiSource[] }[]`.

- [ ] **Step 1: `ArchiveToolbar.tsx`**:
```tsx
import { Columns3, List, LayoutGrid, Search, SlidersHorizontal, X } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";

export type ArchiveView = "grid" | "list" | "board";
export type ArchiveDensity = "comoda" | "compatta";

interface Props {
  search: string;
  onSearch: (value: string) => void;
  view: ArchiveView;
  onViewChange: (view: ArchiveView) => void;
  density: ArchiveDensity;
  onDensityChange: (density: ArchiveDensity) => void;
  count: number;
  filtered: boolean;
  onClear: () => void;
}

const VIEWS: { key: ArchiveView; Icon: typeof List; labelKey: string }[] = [
  { key: "grid", Icon: LayoutGrid, labelKey: "archive.view.grid" },
  { key: "list", Icon: List, labelKey: "archive.view.list" },
  { key: "board", Icon: Columns3, labelKey: "archive.view.board" },
];

export function ArchiveToolbar(props: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[160px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={props.search}
          onChange={(e) => props.onSearch(e.target.value)}
          placeholder={uiText("archive.search.placeholder")}
          className="h-10 w-full rounded-lg border border-border/50 bg-card/60 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary/55 focus:ring-2 focus:ring-primary/15"
        />
      </div>
      {props.filtered && (
        <button type="button" onClick={props.onClear} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/50 px-3 py-1.5 text-[11.5px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
          <X className="h-3 w-3" />
          {uiText("archive.clear")}
        </button>
      )}
      <span className="shrink-0 whitespace-nowrap font-mono text-[11.5px] text-muted-foreground">
        <span className="font-bold text-foreground">{props.count}</span> {uiText("archive.stats.items", { count: props.count }).replace(/^\S+\s/, "")}
      </span>
      <button
        type="button"
        onClick={() => props.onDensityChange(props.density === "comoda" ? "compatta" : "comoda")}
        title={uiText("archive.density.toggle")}
        aria-label={uiText("archive.density.toggle")}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-secondary/50 text-muted-foreground transition-colors hover:text-foreground"
      >
        <SlidersHorizontal className="h-4 w-4" />
      </button>
      <div className="flex shrink-0 gap-0.5 rounded-[10px] border border-border/40 bg-secondary/50 p-0.5">
        {VIEWS.map(({ key, Icon, labelKey }) => (
          <button
            key={key}
            type="button"
            onClick={() => props.onViewChange(key)}
            data-active={props.view === key ? "1" : undefined}
            title={uiText(labelKey)}
            aria-label={uiText(labelKey)}
            className="flex h-[30px] w-9 items-center justify-center rounded-[7px] text-muted-foreground transition-colors hover:text-foreground data-[active]:bg-primary/15 data-[active]:text-primary data-[active]:shadow-[0_0_0_1px_hsl(var(--primary)/.35)]"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
```
(Note: the count label combines a number + the `archive.stats.items` text. To avoid the brittle `.replace`, prefer rendering `{uiText("archive.stats.items", { count: props.count })}` as the whole label and dropping the separate bold number — implementer's choice; keep it i18n-driven and the production-copy gate clean. Simplest compliant form: `<span className="...">{uiText("archive.stats.items", { count: props.count })}</span>`.)

- [ ] **Step 2: `ArchiveGrid.tsx`**:
```tsx
import { ArchiveCard } from "./ArchiveCard";
import type { WikiSource } from "@/lib/archive";

export function ArchiveGrid({ items, onOpen }: { items: WikiSource[]; onOpen: (id: number) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-[var(--arc-gap,16px)] sm:grid-cols-[repeat(auto-fill,minmax(216px,1fr))]">
      {items.map((s) => <ArchiveCard key={s.id} source={s} onOpen={onOpen} />)}
    </div>
  );
}
```

- [ ] **Step 3: `ArchiveList.tsx`**:
```tsx
import { ArchiveRow } from "./ArchiveRow";
import type { WikiSource } from "@/lib/archive";

export function ArchiveList({ items, onOpen }: { items: WikiSource[]; onOpen: (id: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((s) => <ArchiveRow key={s.id} source={s} onOpen={onOpen} />)}
    </div>
  );
}
```

- [ ] **Step 4: `ArchiveBoard.tsx`**:
```tsx
import { uiText } from "@/contexts/LanguageContext";
import { ArchiveMiniCard } from "./ArchiveMiniCard";
import type { Collection, WikiSource } from "@/lib/archive";

export interface BoardColumn {
  collection: Collection | null; // null = unfiled
  items: WikiSource[];
}

export function ArchiveBoard({ columns, onOpen }: { columns: BoardColumn[]; onOpen: (id: number) => void }) {
  return (
    <div className="grid grid-flow-col auto-cols-[minmax(244px,1fr)] gap-3.5 overflow-x-auto pb-2">
      {columns.map((col, i) => {
        const accent = col.collection?.accent ?? "hsl(214 26% 74%)";
        const name = col.collection?.name ?? uiText("archive.collections.unfiled");
        return (
          <div key={col.collection?.id ?? `unfiled-${i}`} className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-border/40 bg-card/50 p-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} />
              <span className="flex-1 truncate font-mono text-xs font-bold text-foreground">{name}</span>
              <span className="shrink-0 rounded-full bg-secondary/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{col.items.length}</span>
            </div>
            {col.items.map((s) => <ArchiveMiniCard key={s.id} source={s} onOpen={onOpen} />)}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.
```bash
git add artifacts/trader-dashboard/src/components/archive/
git commit -m "feat(ui): archive toolbar + grid/list/board views

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: `ArchiveDetailModal` — detail + tag editing

**Files:**
- Create: `artifacts/trader-dashboard/src/components/archive/ArchiveDetailModal.tsx`

**Interfaces:**
- Consumes: `WikiSource`, `Collection`, `archiveTypeOf`, `parseTags`, `TYPE_ACCENT`.
- Produces: `<ArchiveDetailModal source collection onClose onDelete onSaveTags />`
  where `onSaveTags: (id: number, tags: string[]) => void`, `onDelete: (id: number) => void`,
  `collection: Collection | null`.

- [ ] **Step 1: Implement** `ArchiveDetailModal.tsx`:
```tsx
import { useEffect, useState } from "react";
import { ExternalLink, Trash2, X } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import { archiveTypeOf, parseTags, TYPE_ACCENT, type Collection, type WikiSource } from "@/lib/archive";
import { typeIcon, typeLabel } from "./typeMeta";

interface Props {
  source: WikiSource;
  collection: Collection | null;
  onClose: () => void;
  onDelete: (id: number) => void;
  onSaveTags: (id: number, tags: string[]) => void;
}

export function ArchiveDetailModal({ source, collection, onClose, onDelete, onSaveTags }: Props) {
  const type = archiveTypeOf(source.kind);
  const accent = TYPE_ACCENT[type];
  const Icon = typeIcon(type);
  const [tags, setTags] = useState<string[]>(() => parseTags(source.tags));
  const [draft, setDraft] = useState("");
  const href = source.fileUrl ?? source.originalUrl ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const commit = (next: string[]) => { setTags(next); onSaveTags(source.id, next); };
  const addTag = () => {
    const t = draft.trim().replace(/^#/, "");
    if (t && !tags.includes(t)) commit([...tags, t]);
    setDraft("");
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90dvh] w-[min(720px,100%)] overflow-auto rounded-2xl border border-border/60 bg-card shadow-2xl">
        <div className="relative flex h-44 items-center justify-center border-b border-border/40" style={{ background: `linear-gradient(155deg, color-mix(in srgb, ${accent} 16%, transparent), hsl(226 43% 10% / .55))` }}>
          <span className="absolute left-3.5 top-3.5 inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/65 px-2.5 py-1" style={{ color: accent }}>
            <Icon className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px] uppercase tracking-wider">{typeLabel(type)}</span>
          </span>
          <button type="button" onClick={onClose} aria-label={uiText("archive.close")} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-background/60 text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/50 bg-background/55" style={{ color: accent }}>
            <Icon className="h-8 w-8" />
          </span>
        </div>

        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div>
            {collection && (
              <span className="mb-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: collection.accent }} />
                {collection.name}
              </span>
            )}
            <h2 className="text-xl font-semibold leading-tight text-foreground sm:text-2xl">{source.title}</h2>
          </div>

          {source.error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{source.error}</p>}
          {source.extractedText && <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{source.extractedText}</p>}

          <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-px overflow-hidden rounded-lg border border-border/35 bg-border/30">
            <Meta label={uiText("archive.meta.type")} value={typeLabel(type)} />
            <Meta label={uiText("archive.meta.collection")} value={collection?.name ?? uiText("archive.collections.unfiled")} />
            <Meta label={uiText("archive.meta.date")} value={new Date(source.createdAt).toLocaleDateString("it-IT")} />
            {source.fileName && <Meta label={uiText("archive.meta.file")} value={source.fileName} />}
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{uiText("archive.tags")}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.length === 0 && <span className="text-xs text-muted-foreground">{uiText("archive.tags.empty")}</span>}
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-secondary/50 px-2 py-1 font-mono text-[11px] text-foreground">
                  #{t}
                  <button type="button" onClick={() => commit(tags.filter((x) => x !== t))} aria-label={uiText("archive.delete")} className="text-muted-foreground hover:text-red-400">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                onBlur={addTag}
                placeholder={uiText("archive.tags.add_placeholder")}
                className="h-7 w-28 rounded-md border border-border/50 bg-background px-2 font-mono text-[11px] outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            {href ? (
              <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/50 px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-primary/45">
                <ExternalLink className="h-4 w-4" />
                {uiText("archive.open")}
              </a>
            ) : <span />}
            <button
              type="button"
              onClick={() => { if (window.confirm(uiText("archive.delete_confirm", { title: source.title }))) onDelete(source.id); }}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2 text-[13px] font-medium text-red-300 transition-colors hover:bg-red-500/20"
            >
              <Trash2 className="h-4 w-4" />
              {uiText("archive.delete")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card/90 px-3 py-2.5">
      <p className="mb-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="truncate text-[13px] font-medium text-foreground">{value}</p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.
```bash
git add artifacts/trader-dashboard/src/components/archive/ArchiveDetailModal.tsx
git commit -m "feat(ui): archive detail modal with inline tag editing

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: `ArchiveAddDialog` — dropzone + note + URL

**Files:**
- Create: `artifacts/trader-dashboard/src/components/archive/ArchiveAddDialog.tsx`

**Interfaces:**
- Produces: `<ArchiveAddDialog open onClose onUploadFiles onAddNote onAddUrl pending error />`
  - `onUploadFiles: (files: File[]) => void`
  - `onAddNote: (title: string, content: string) => void`
  - `onAddUrl: (url: string) => void`
  - `pending: boolean`, `error: string | null`.

- [ ] **Step 1: Implement** `ArchiveAddDialog.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileText, Globe2, Loader2, Upload, X } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onClose: () => void;
  onUploadFiles: (files: File[]) => void;
  onAddNote: (title: string, content: string) => void;
  onAddUrl: (url: string) => void;
  pending: boolean;
  error: string | null;
}

export function ArchiveAddDialog(props: Props) {
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [url, setUrl] = useState("");

  const { getRootProps, getInputProps, isDragActive, open: openPicker } = useDropzone({
    onDrop: (files) => props.onUploadFiles(files),
    multiple: true,
    noClick: true,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  if (!props.open) return null;

  return (
    <div onClick={props.onClose} className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90dvh] w-[min(560px,100%)] overflow-auto rounded-2xl border border-border/60 bg-card p-5 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{uiText("archive.add.title")}</h2>
          <button type="button" onClick={props.onClose} aria-label={uiText("archive.close")} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {props.error && <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{props.error}</p>}

        <div className="space-y-4">
          <div {...getRootProps()} className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center transition-colors ${isDragActive ? "border-primary bg-primary/10" : "border-border/50 bg-card/40 hover:border-primary/40"}`}>
            <input {...getInputProps()} />
            {props.pending ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <Upload className="h-7 w-7 text-primary" />}
            <p className="text-sm font-medium text-foreground">{uiText("archive.add.drop_title")}</p>
            <Button type="button" variant="outline" size="sm" onClick={openPicker} disabled={props.pending}>{uiText("archive.add.browse")}</Button>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{uiText("archive.add.note_label")}</span>
            <Input placeholder={uiText("wiki.note.title_placeholder")} value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder={uiText("wiki.note.placeholder")} className="min-h-[80px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <Button className="w-full" disabled={!noteText.trim() || props.pending} onClick={() => { props.onAddNote(noteTitle.trim(), noteText.trim()); setNoteTitle(""); setNoteText(""); }}>
              <FileText className="mr-2 h-4 w-4" />
              {uiText("archive.add.note_cta")}
            </Button>
          </div>

          <div className="space-y-2">
            <Input placeholder={uiText("wiki.url.placeholder")} value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button variant="outline" className="w-full" disabled={!url.trim() || props.pending} onClick={() => { props.onAddUrl(url.trim()); setUrl(""); }}>
              <Globe2 className="mr-2 h-4 w-4" />
              {uiText("archive.add.url_cta")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.
```bash
git add artifacts/trader-dashboard/src/components/archive/ArchiveAddDialog.tsx
git commit -m "feat(ui): archive add dialog (file/note/url)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: `pages/Wiki.tsx` — orchestrator rewrite

**Files:**
- Modify (full rewrite): `artifacts/trader-dashboard/src/pages/Wiki.tsx`

**Interfaces:**
- Consumes everything from Tasks 2–8.
- Keeps the page default-exported and the `/wiki` endpoints referenced verbatim (`/wiki/sources`, `/wiki/sources/upload`, `/wiki/sources/text`, `/wiki/sources/url`) so `Wiki.static.test.ts` stays satisfiable.

- [ ] **Step 1: Rewrite** `pages/Wiki.tsx`:
```tsx
import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { ProUpgradeGate } from "@/components/ProUpgradeGate";
import { Button } from "@/components/ui/button";
import { ArchiveRail } from "@/components/archive/ArchiveRail";
import { ArchiveToolbar, type ArchiveDensity, type ArchiveView } from "@/components/archive/ArchiveToolbar";
import { TypeChips } from "@/components/archive/TypeChips";
import { ArchiveGrid } from "@/components/archive/ArchiveGrid";
import { ArchiveList } from "@/components/archive/ArchiveList";
import { ArchiveBoard, type BoardColumn } from "@/components/archive/ArchiveBoard";
import { ArchiveDetailModal } from "@/components/archive/ArchiveDetailModal";
import { ArchiveAddDialog } from "@/components/archive/ArchiveAddDialog";
import { ARCHIVE_DND_TYPE } from "@/components/archive/typeMeta";
import {
  archiveTypeOf,
  collectionsFromFolders,
  filterSources,
  tagCloud,
  type ArchiveFolder,
  type ArchiveType,
  type WikiSource,
} from "@/lib/archive";
import { API_BASE as API, apiFetch, apiUpload } from "@/lib/apiFetch";
import { uiText } from "@/contexts/LanguageContext";

function mutationMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return uiText("archive.noresults.body");
}

export default function Wiki() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ArchiveType | "all">("all");
  const [collectionFilter, setCollectionFilter] = useState<"all" | "root" | number>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [view, setView] = useState<ArchiveView>("grid");
  const [density, setDensity] = useState<ArchiveDensity>("comoda");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: sources = [] } = useQuery({
    queryKey: ["wiki", "sources"],
    queryFn: () => apiFetch<WikiSource[]>(`${API}/wiki/sources`),
    refetchInterval: (query) =>
      (query.state.data as WikiSource[] | undefined)?.some((s) => ["queued", "processing"].includes(s.status))
        ? 2500 : false,
  });
  const { data: folders = [] } = useQuery({
    queryKey: ["wiki", "folders"],
    queryFn: () => apiFetch<ArchiveFolder[]>(`${API}/wiki/folders`),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["wiki", "sources"] });
    qc.invalidateQueries({ queryKey: ["wiki", "folders"] });
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiUpload<WikiSource>(`${API}/wiki/sources/upload`, form);
    },
    onSuccess: invalidate,
  });
  const textMutation = useMutation({
    mutationFn: (input: { title: string; content: string }) =>
      apiFetch<WikiSource>(`${API}/wiki/sources/text`, {
        method: "POST",
        body: JSON.stringify({ title: input.title || undefined, content: input.content }),
      }),
    onSuccess: invalidate,
  });
  const urlMutation = useMutation({
    mutationFn: (url: string) =>
      apiFetch<WikiSource>(`${API}/wiki/sources/url`, { method: "POST", body: JSON.stringify({ url }) }),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`${API}/wiki/sources/${id}`, { method: "DELETE" }),
    onSuccess: () => { setSelectedId(null); invalidate(); },
  });
  const moveMutation = useMutation({
    mutationFn: (input: { id: number; folderId: number | null }) =>
      apiFetch(`${API}/wiki/sources/${input.id}`, { method: "PATCH", body: JSON.stringify({ folderId: input.folderId }) }),
    onSuccess: invalidate,
  });
  const tagsMutation = useMutation({
    mutationFn: (input: { id: number; tags: string[] }) =>
      apiFetch(`${API}/wiki/sources/${input.id}`, { method: "PATCH", body: JSON.stringify({ tags: input.tags }) }),
    onSuccess: invalidate,
  });
  const createCollectionMutation = useMutation({
    mutationFn: (name: string) => apiFetch(`${API}/wiki/folders`, { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: invalidate,
  });

  const collections = useMemo(() => collectionsFromFolders(folders, sources), [folders, sources]);
  const tags = useMemo(() => tagCloud(sources), [sources]);
  const filtered = useMemo(
    () => filterSources(sources, { search, type: typeFilter, collection: collectionFilter, tag: tagFilter }),
    [sources, search, typeFilter, collectionFilter, tagFilter],
  );
  const unfiledCount = useMemo(() => sources.filter((s) => s.folderId == null).length, [sources]);

  const boardColumns = useMemo<BoardColumn[]>(() => {
    const cols: BoardColumn[] = collections.map((c) => ({ collection: c, items: filtered.filter((s) => s.folderId === c.id) }));
    const unfiled = filtered.filter((s) => s.folderId == null);
    if (unfiled.length) cols.push({ collection: null, items: unfiled });
    return cols.filter((c) => c.items.length > 0);
  }, [collections, filtered]);

  const selected = useMemo(() => sources.find((s) => s.id === selectedId) ?? null, [sources, selectedId]);
  const selectedCollection = useMemo(
    () => (selected ? collections.find((c) => c.id === selected.folderId) ?? null : null),
    [selected, collections],
  );

  const isFiltered = search.trim() !== "" || typeFilter !== "all" || collectionFilter !== "all" || tagFilter !== null;
  const clearFilters = () => { setSearch(""); setTypeFilter("all"); setCollectionFilter("all"); setTagFilter(null); };

  // Page-level drop target: dropping files anywhere uploads them.
  const onDrop = useCallback((files: File[]) => { for (const f of files) uploadMutation.mutate(f); }, [uploadMutation]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true, noClick: true });

  const addError = mutationMessage(uploadMutation.error || textMutation.error || urlMutation.error);

  return (
    <PageLayout>
      <ProUpgradeGate feature="wiki" fillViewport>
        <div
          {...getRootProps()}
          style={{ "--arc-gap": density === "compatta" ? "10px" : "16px", "--arc-cover": density === "compatta" ? "118px" : "150px", "--arc-pad": density === "compatta" ? "9px" : "13px", "--arc-rowpad": density === "compatta" ? "7px" : "11px" } as React.CSSProperties}
          className="relative"
        >
          <input {...getInputProps()} />
          {isDragActive && (
            <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 text-sm font-semibold text-primary">
              {uiText("archive.add.drop_title")}
            </div>
          )}

          <PageHeader
            title={uiText("archive.title")}
            subtitle={uiText("archive.subtitle")}
            action={<Button onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />{uiText("archive.add")}</Button>}
          />

          <div className="mt-2 flex flex-col gap-5 xl:flex-row xl:items-start">
            <ArchiveRail
              collections={collections}
              collectionFilter={collectionFilter}
              onCollectionChange={setCollectionFilter}
              allCount={sources.length}
              unfiledCount={unfiledCount}
              tagCloud={tags}
              tagFilter={tagFilter}
              onTagChange={setTagFilter}
              onMoveSource={(id, folderId) => moveMutation.mutate({ id, folderId })}
              onCreateCollection={(name) => createCollectionMutation.mutate(name)}
            />

            <div className="min-w-0 flex-1 space-y-4">
              <ArchiveToolbar
                search={search} onSearch={setSearch}
                view={view} onViewChange={setView}
                density={density} onDensityChange={setDensity}
                count={filtered.length} filtered={isFiltered} onClear={clearFilters}
              />
              <TypeChips value={typeFilter} onChange={setTypeFilter} />

              {sources.length === 0 ? (
                <EmptyState onAdd={() => setAddOpen(true)} />
              ) : filtered.length === 0 ? (
                <NoResults onClear={clearFilters} />
              ) : view === "grid" ? (
                <ArchiveGrid items={filtered} onOpen={setSelectedId} />
              ) : view === "list" ? (
                <ArchiveList items={filtered} onOpen={setSelectedId} />
              ) : (
                <ArchiveBoard columns={boardColumns} onOpen={setSelectedId} />
              )}
            </div>
          </div>
        </div>

        {selected && (
          <ArchiveDetailModal
            source={selected}
            collection={selectedCollection}
            onClose={() => setSelectedId(null)}
            onDelete={(id) => deleteMutation.mutate(id)}
            onSaveTags={(id, t) => tagsMutation.mutate({ id, tags: t })}
          />
        )}

        <ArchiveAddDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onUploadFiles={(files) => files.forEach((f) => uploadMutation.mutate(f))}
          onAddNote={(title, content) => textMutation.mutate({ title, content })}
          onAddUrl={(url) => urlMutation.mutate(url)}
          pending={uploadMutation.isPending}
          error={addError}
        />
      </ProUpgradeGate>
    </PageLayout>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mx-auto flex max-w-[580px] flex-col items-center gap-5 py-10 text-center">
      <h2 className="text-2xl font-semibold text-foreground">{uiText("archive.empty.title")}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{uiText("archive.empty.body")}</p>
      <Button onClick={onAdd}><Plus className="mr-2 h-4 w-4" />{uiText("archive.empty.cta")}</Button>
    </div>
  );
}

function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="mx-auto flex max-w-[420px] flex-col items-center gap-3.5 py-12 text-center">
      <h3 className="text-base font-semibold text-foreground">{uiText("archive.noresults.title")}</h3>
      <p className="text-[13px] leading-relaxed text-muted-foreground">{uiText("archive.noresults.body")}</p>
      <Button variant="outline" size="sm" onClick={onClear}>{uiText("archive.clear_filters")}</Button>
    </div>
  );
}
```
Note: confirm `PageHeader` accepts an `action` prop (it does — see `components/PageHeader.tsx`). The page-level dropzone uses `ARCHIVE_DND_TYPE` only via children; the `getInputProps` is required by react-dropzone even though clicks are disabled.

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS. (Remove the unused `ARCHIVE_DND_TYPE` import if ESLint flags it — the page itself doesn't reference it; children own the drag payload. Delete that import line.)
```bash
git add artifacts/trader-dashboard/src/pages/Wiki.tsx
git commit -m "feat(ui): rebuild Archive page on the Claude Design layout

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Update `Wiki.static.test.ts` + full verify

**Files:**
- Modify (rewrite assertions): `artifacts/trader-dashboard/src/pages/Wiki.static.test.ts`

- [ ] **Step 1: Rewrite the static test** to match the new structure (keep route/nav/endpoint/Brain-removed guards; drop assertions tied to the old single-file dropzone/filters; add archive-specific guards):
```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./Wiki.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const bottomNav = readFileSync(new URL("../components/BottomNav.tsx", import.meta.url), "utf8");
const commandPalette = readFileSync(new URL("../components/CommandPalette.tsx", import.meta.url), "utf8");
const i18n = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");
const addDialog = readFileSync(new URL("../components/archive/ArchiveAddDialog.tsx", import.meta.url), "utf8");

// Route + nav wiring unchanged.
assert.match(app, /const Wiki = lazy\(\(\) => import\("\.\/pages\/Wiki"\)\)/);
assert.match(app, /<Route path="\/wiki" component=\{Wiki\}/);
assert.match(bottomNav, /href: "\/wiki"/);
assert.match(commandPalette, /href: "\/wiki"/);

// Brain AI stays removed.
assert.doesNotMatch(app, /pages\/Brain/);
assert.doesNotMatch(bottomNav, /href: "\/brain"/);
assert.doesNotMatch(commandPalette, /href: "\/brain"/);

// The archive keeps the source CRUD endpoints.
for (const api of ["/wiki/sources", "/wiki/sources/upload", "/wiki/sources/text", "/wiki/sources/url"]) {
  assert.match(page, new RegExp(api.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
// ...and never resurrects the GraphRAG endpoints.
for (const removed of ["/wiki/graph", "/wiki/communities", "/wiki/query", "/wiki/reindex"]) {
  assert.doesNotMatch(page, new RegExp(removed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

// New Archive structure: three views, density, type filter, detail modal, add dialog.
assert.match(page, /ArchiveRail/);
assert.match(page, /ArchiveToolbar/);
assert.match(page, /ArchiveGrid/);
assert.match(page, /ArchiveList/);
assert.match(page, /ArchiveBoard/);
assert.match(page, /ArchiveDetailModal/);
assert.match(page, /ArchiveAddDialog/);
assert.match(page, /collectionsFromFolders/);
assert.match(page, /filterSources/);

// Upload still uses react-dropzone with no click-to-open on the page surface.
assert.match(page, /useDropzone/);
assert.match(page, /noClick:\s*true/);
// The explicit file picker lives in the add dialog.
assert.match(addDialog, /useDropzone/);
assert.match(addDialog, /noClick:\s*true/);
assert.match(addDialog, /openPicker/);

// i18n keys exist.
assert.match(i18n, /"wiki\.title": "Archivio"/);
assert.match(i18n, /"archive\.title": "Il tuo archivio"/);
assert.match(i18n, /"archive\.empty\.title": "Inizia il tuo archivio"/);

console.log("wiki page static checks passed");
```

- [ ] **Step 2: Run the full gate**

Run: `pnpm verify`
Expected: PASS (install → codegen → typecheck → test → build all green). In particular `Wiki.static.test.ts`, `archive.test.ts`, `wikiSourceUpdate.test.ts`, `i18n.parity.static.test.ts`, and `production-copy.static.test.ts` pass.
If `production-copy.static.test.ts` flags a hardcoded string in a new `components/archive/*` file, route that literal through `uiText()` (add a key to all 5 langs if missing) and re-run.

- [ ] **Step 3: Commit**
```bash
git add artifacts/trader-dashboard/src/pages/Wiki.static.test.ts
git commit -m "test(ui): update Archive static guard for the new layout

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4: Push the branch** (per user's standing rule — push finished work):
```bash
git push
```

---

## Self-Review

**Spec coverage:**
- §3 Collezioni = folders → Tasks 2 (`collectionsFromFolders`), 5 (rail), 9 (wiring). ✓
- §3 Libreria layout + add dialog + page drop target → Tasks 5, 8, 9. ✓
- §3 extras: board (Task 6), density (Tasks 6+9 CSS vars), tag editing (Tasks 1+7), tag cloud filter (Tasks 2+5). ✓
- §4.1 lib/archive.ts → Task 2. ✓
- §5 backend tags PATCH → Task 1. ✓
- §6 states (empty/no-results/loading/errors/DnD) → Task 9 (+ rail DnD Task 5). ✓
- §7 i18n all 5 langs (Task 3), Wiki.static.test rewrite (Task 10), unit tests (Tasks 1,2), verify gate (Task 10). ✓
- §8 efficiency (single fetch + useMemo + poll-while-processing) → Task 9. ✓

**Placeholder scan:** No TBD/TODO. Every code step shows complete code. Two implementer notes flag unused-import removal (ESLint) — these are explicit, not placeholders.

**Type consistency:** `WikiSource`/`ArchiveFolder`/`Collection`/`ArchiveType`/`ArchiveFilter` defined in Task 2 and consumed identically downstream. `ARCHIVE_DND_TYPE` defined in Task 4 (`typeMeta.tsx`) and reused by cards + rail. `buildSourceUpdate`/`parseTags` signatures match between Task 1 definition and route wiring. View/density unions (`ArchiveView`/`ArchiveDensity`) defined in Task 6, imported by Task 9.

**Loose end fixed:** Task 6 `ArchiveToolbar` count label — prefer the simple compliant form `{uiText("archive.stats.items", { count })}` rather than the `.replace` hack; noted inline.
