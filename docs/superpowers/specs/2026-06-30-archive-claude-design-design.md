# Archive (Archivio) — Claude Design implementation

**Date:** 2026-06-30
**Status:** Approved (design phase)
**Branch:** `feat/community-management` (long-lived multi-feature branch; coordinate before merge)

## 1. Goal

Reimplement the Archive page (`/wiki`, internally still named `wiki`) to match the
Claude Design `templates/archivio/` template — fully wired to the **existing** wiki
backend, with no dead controls, good performance, and the project's i18n / test gates green.

"Archivio" is the user-facing name; route, endpoints, i18n keys, and table names keep the
internal `wiki` identifier (no rename — avoids churn and keeps `Wiki.static.test.ts`/billing
feature flag `feature="wiki"` intact).

## 2. Source of truth

- **Target design:** Claude Design project "TraderLoading Design System"
  (`831a2631-…`), `templates/archivio/Archivio.dc.html` + `data.js`.
- **Existing backend:** [artifacts/api-server/src/routes/wiki.ts](../../../artifacts/api-server/src/routes/wiki.ts),
  `services/wiki*.ts`, schema [lib/db/src/schema/](../../../lib/db/src/schema/) (`wikiSourcesTable`,
  `wikiFoldersTable`, `wikiIngestJobsTable`).
- **Existing page:** [artifacts/trader-dashboard/src/pages/Wiki.tsx](../../../artifacts/trader-dashboard/src/pages/Wiki.tsx)
  (485 lines) + [components/WikiFolderTree.tsx](../../../artifacts/trader-dashboard/src/components/WikiFolderTree.tsx).

The wiki endpoints use **direct `apiFetch`/`apiUpload`** (NOT the Orval contract), so backend
changes here require **no `pnpm codegen`**.

## 3. Approved decisions

| Decision | Choice |
|---|---|
| **Collezioni** | = existing user **folders**, restyled (no migration). Nested folders shown flat as collections. |
| **Layout** | **Libreria**: left collections rail + tag cloud; main area = toolbar + views. Add (file/note/URL) via an "Aggiungi" dialog + a page-level drop target. |
| **Extras (all included)** | Board view (kanban by collection), density toggle (comoda/compatta), tag editing in the detail modal, tag cloud as a filter. |
| **Styling** | Port the template's *structure* onto the app's design system: existing `components/ui/*` primitives, Tailwind, and tokens. Map the template's raw `hsl(142 71% 45%)` → `--primary`/jade and `--tl-*` → app tokens/glass tiers. |

## 4. Architecture

### 4.1 `lib/archive.ts` — pure helpers (unit-tested)

- `archiveTypeOf(kind): ArchiveType` — maps backend `kind` → one of
  `image | video | audio | pdf | link | note`:
  - `image→image`, `video→video`, `audio→audio`, `pdf→pdf`,
  - `office→pdf`, `url→link`, `text→note`, `unknown→note`.
- `TYPE_META: Record<ArchiveType, { labelKey; icon; accentClass }>` — label (i18n key),
  Lucide icon, and an accent class. Type accents are **functional category colors**
  (image=jade, video=violet, pdf=red, audio=amber, link=blue, note=slate) — allowed by the
  design system (vivid semantics kept functional).
- `collectionsFromFolders(folders, sources): Collection[]` — flatten folders → collections
  `{ id, name, count, accent }`. Accent = `folder.color` if set, else a deterministic palette
  entry keyed by folder id. Plus the synthetic `all` and `unfiled` collections.
- `tagCloud(sources, limit=12): { tag; count }[]` — top tags by frequency (parses the `tags`
  JSON string defensively, as today's `parseTags`).
- `filterSources(sources, { search, type, collection, tag }): WikiSource[]` — pure predicate
  over title / extractedText / tags / fileName (preserves today's search semantics) plus
  type/collection/tag facets.

These are the only places business logic lives; components stay presentational.

### 4.2 `pages/Wiki.tsx` — orchestrator

Owns:
- Queries: `["wiki","sources"]`, `["wiki","folders"]` (preserve `refetchInterval` ⇒ poll
  every 2.5s **only while** an item is `queued`/`processing`).
- Filter/view state: `search`, `typeFilter`, `collectionFilter` (`all | "root" | folderId`),
  `tagFilter`, `view` (`grid|list|board`), `density` (`comoda|compatta`), `selectedId` (modal),
  `addOpen` (add dialog).
- Mutations: text / upload / url / delete / move-to-collection / **edit-tags**.
- Derived (all `useMemo`): collections, tag cloud, filtered items, board columns.
- Composition: `<ArchiveRail>` + main (`<ArchiveToolbar>`, `<TypeChips>`, view component, empty
  / no-results states) + `<ArchiveDetailModal>` + `<ArchiveAddDialog>` + page drop target.

### 4.3 `components/archive/`

- **`ArchiveRail`** — `Collezioni` (Tutti / Senza collezione / folders flat, each with accent dot
  + count) with folder CRUD (new/rename/delete) and drag-source-onto-collection (reuses
  `PATCH /wiki/sources/:id { folderId }`); `Tag` cloud (click to filter). Reuses the folder
  mutation logic from `WikiFolderTree` (refactor/extract as needed; flat presentation).
- **`ArchiveToolbar`** — search input, "Azzera" (visible when any filter active), live count,
  grid/list/board view switch, density toggle.
- **`TypeChips`** — the 6 type filters + "Tutti".
- **`ArchiveGrid` / `ArchiveList` / `ArchiveBoard`** — the three views. Board groups items by
  collection into columns.
- **`ArchiveCard` / `ArchiveRow` / `ArchiveMiniCard`** — item presentations; `draggable`
  (sets the existing `WIKI_SOURCE_DND_TYPE`), open detail on click, show type accent + collection
  + date + short tags + `StatusPill` for non-ready items.
- **`ArchiveDetailModal`** — cover, type chip, title, collection, note/extracted snippet,
  metadata grid (type, kind, file/size, created), **tag editor** (add/remove chips → edit-tags
  mutation), "Apri" (file/URL via `fileUrl`/`originalUrl`), "Elimina". Closes on backdrop/Esc.
- **`ArchiveAddDialog`** — file dropzone (`useDropzone`, `noClick`, explicit "Scegli file"),
  quick-note (title + textarea), URL import. Mirrors today's mutations.

## 5. Backend change (only one)

Extend `PATCH /wiki/sources/:id` to accept an optional `tags` field alongside `folderId`:

```ts
const { folderId, tags } = req.body as { folderId?: number | null; tags?: unknown };
// existing folderId validation stays; build patch incrementally:
if (tags !== undefined) patch.tags = parseTags(tags); // reuse existing parseTags
if (folderId !== undefined) { /* existing validation + patch.folderId */ }
```

- `tags` accepts a string[] or comma string (as the create endpoints already do via `parseTags`).
- When neither `folderId` nor `tags` is provided → 400 `"nessun campo da aggiornare"`.
- No contract/codegen impact (direct fetch).

## 6. States & interactions

- **Empty** (zero sources): centered "Inizia il tuo archivio" with dropzone CTA opening the add dialog.
- **No results** (filters exclude all): "Nessun risultato" + "Azzera filtri".
- **Loading**: skeletons in the active view.
- **Errors**: mutation errors surface as the existing inline error banner pattern.
- **Drag & drop**: dragging an item onto a collection in the rail moves it (existing PATCH);
  dropping files anywhere on the page uploads them.

## 7. Quality gates

- **i18n**: every string via `uiText()`; new keys added to **all 5 languages** in
  [lib/i18n.ts](../../../artifacts/trader-dashboard/src/lib/i18n.ts). No mojibake chars
  (`Ã/â/Â/ð`) — rephrase if needed (parity test). Preserve existing `wiki.*` keys the static
  test asserts (`wiki.title`, `wiki.upload.drop_title`, `wiki.sources.subtitle`,
  `wiki.search.placeholder`, …).
- **`Wiki.static.test.ts`**: rewrite to match the new structure. Keep route/nav/endpoint and
  "Brain removed" assertions; update implementation-specific assertions (dropzone wiring, filters,
  i18n keys) to the new components.
- **Unit tests**: `lib/archive.test.ts` for `archiveTypeOf`, `collectionsFromFolders`,
  `tagCloud`, `filterSources`. Backend test for the `tags` PATCH path.
- **Gate**: `pnpm verify` (install → codegen → typecheck → test → build) green before done.
- **Lint**: no `any` in non-test source; semantic commit scopes (`feat(ui):`, `feat(api):`).

## 8. Efficiency

- One `sources` + one `folders` fetch; all collections / tag-cloud / filtering / board grouping
  derived via `useMemo`. Polling only while processing. Client-side filtering (per-user datasets
  are small). Detail modal mounted only when open.

## 9. Out of scope (YAGNI)

- No new "collection" table / fixed taxonomy / migration.
- No server-side search/pagination (datasets are small).
- No collection icons in the backend (rail uses a generic folder glyph + accent).
- No rename of the `wiki` route/endpoints/feature flag.
- No changes to ingestion / text-extraction pipeline.
