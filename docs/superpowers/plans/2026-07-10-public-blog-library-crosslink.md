# Public Blog + Library Cross-Link (Phase 2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working public blog engine (DB schema, admin authoring, public routes, sitemap/prerender integration, Library cross-linking) with zero or one test post — content writing is a separate follow-up (Phase 2b).

**Architecture:** Two new Drizzle tables (`blog_posts` language-neutral + `blog_post_translations` one row per post×language) live entirely separate from `library_contents`. A thin off-contract Express router (`routes/blog.ts`) backed by pure, unit-tested helpers serves public reads + admin CRUD. The frontend gets two new pages (`BlogIndexPage`, `BlogArticlePage`) wired into `App.tsx`'s existing marketing-route pattern, an admin-only inline authoring panel modeled on Library's `ContentForm`, and a two-way cross-link with the Library page. Because the existing prerender pipeline (`scripts/prerender.ts`) only serves static files with no live backend, and blog pages need real DB-backed content to prerender correctly, the tiny local server used during prerendering is extended to answer `/api/blog/*` requests itself directly from data it already fetched from the DB for path discovery — no new backend process, no side effects (cron/WS) from spinning up the real API.

**Tech Stack:** Drizzle ORM (Postgres), Express 5, React 19 + TanStack Query + Wouter, existing hand-rolled i18n (`uiText`/`t()`), `node:assert/strict` tests run via `tsx` (this repo's only test convention — no framework).

## Global Constraints

- `@typescript-eslint/no-explicit-any` = error in non-test source; tests may use `any`.
- Semantic commits with scope (`feat(blog):`, `fix(blog):`, `test(blog):`, `refactor(api):`).
- Migrations are **hand-authored** SQL in `lib/db/drizzle/` — do not run `db:generate` (stale snapshot conflicts). Style: tab-indented, `IF NOT EXISTS`, `--> statement-breakpoint` separators, unique constraints as separate `CREATE UNIQUE INDEX` statements (see `0034_drop_credit_wallet.sql` for the exact convention).
- Every new visible UI string goes through `t()` (inside a component) or `uiText()` (outside one) with a key added to **all 5** `src/lib/i18n/dict.{it,en,es,fr,de}.ts` files — `production-copy.static.test.ts` fails the build on any hardcoded literal in `components/`/`pages/`/`contexts/`/`lib/`, and `i18n.parity.static.test.ts` fails on any language missing a key. Italian (`dict.it.ts`) is the fallback/base language.
- Off-contract endpoints (this whole feature) use `apiJSON`/`apiRequest` from `src/lib/apiFetch.ts` directly — never the generated `@workspace/api-client-react` client (that's only for `openapi.yaml` endpoints).
- Don't `prettier --write` `artifacts/api-server` files (HEAD isn't prettier-clean).
- `PLATFORM_ADMIN_IDS` env-allowlist is the existing admin-gating mechanism (`routes/library.ts`, `routes/milestones.ts`) — reuse it, don't invent a new one.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/db/src/schema/blog.ts` | New: `blogPostsTable`, `blogPostTranslationsTable` |
| `lib/db/drizzle/0035_blog.sql` | New: migration creating both tables + indexes |
| `lib/db/src/schema/index.ts` | Modified: export the new schema module |
| `artifacts/api-server/src/lib/platformAdmin.ts` | New: `isPlatformAdmin`/`requireAuth`/`requireAdmin`, extracted (deduped) from `library.ts`/`milestones.ts` |
| `artifacts/api-server/src/routes/library.ts` | Modified: import the extracted helpers instead of local copies |
| `artifacts/api-server/src/routes/milestones.ts` | Modified: same |
| `artifacts/api-server/src/routes/blogLogic.ts` | New: pure `resolvePublishedTranslation`, `buildBlogPostUpsert` |
| `artifacts/api-server/src/routes/blogLogic.test.ts` | New: unit tests for the above |
| `artifacts/api-server/src/routes/blog.ts` | New: public read + admin CRUD Express router |
| `artifacts/api-server/src/routes/index.ts` | Modified: mount `blogRouter` |
| `artifacts/trader-dashboard/src/lib/seo.ts` | Modified: `blogIndexPath`, `blogPostPath`, `blogIndexAlternates`, `blogPostAlternates`, `articleJsonLd` |
| `artifacts/trader-dashboard/src/lib/seo.test.ts` | Modified: tests for the above |
| `artifacts/trader-dashboard/src/lib/blogApi.ts` | New: hand-written off-contract client (mirrors `torneiApi.ts`) |
| `artifacts/trader-dashboard/src/lib/i18n/dict.{it,en,es,fr,de}.ts` | Modified: new `blog.*`/`library.blogLink` keys |
| `artifacts/trader-dashboard/src/pages/blog/BlogIndexPage.tsx` | New: post list + admin inline CRUD panel |
| `artifacts/trader-dashboard/src/pages/blog/BlogArticlePage.tsx` | New: article render + `<Seo>` + Library CTA |
| `artifacts/trader-dashboard/src/App.tsx` | Modified: blog routes wired into the marketing-route Switch |
| `artifacts/trader-dashboard/src/pages/Library.tsx` | Modified: `?open=<id>` deep-link + reciprocal "read the article" link |
| `artifacts/trader-dashboard/scripts/blogPaths.ts` | New: DB fetch + pure path/mock-response helpers, shared by sitemap + prerender |
| `artifacts/trader-dashboard/scripts/blogPaths.test.ts` | New: unit tests for the pure helpers |
| `artifacts/trader-dashboard/scripts/build-sitemap.ts` | Modified: merge blog entries |
| `artifacts/trader-dashboard/scripts/prerender.ts` | Modified: merge blog paths + serve `/api/blog/*` from local data during the crawl |

---

### Task 1: Database schema + migration

**Files:**
- Create: `lib/db/src/schema/blog.ts`
- Create: `lib/db/drizzle/0035_blog.sql`
- Modify: `lib/db/src/schema/index.ts`

**Interfaces:**
- Produces: `blogPostsTable`, `blogPostTranslationsTable`, types `BlogPost`, `BlogPostTranslation` — consumed by Task 4 (`routes/blog.ts`) and Task 13 (`scripts/blogPaths.ts`).

This task has no independent runtime behavior to unit-test (it's a schema definition + SQL migration) — verified by typecheck (Task's Step 2) and by Task 4's routes actually querying it successfully at manual-verification time (Task 14).

- [ ] **Step 1: Write the schema**

Create `lib/db/src/schema/blog.ts`:

```ts
import { boolean, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// ─── Public blog (Phase 2a): language-neutral posts + one translation row per
// (post, language). Kept separate from library_contents — mixing public
// crawlable content with XP-gated in-app content in one table risks a gating
// bug leaking paid/gated Library content publicly.

export const blogPostsTable = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(),
  relatedLibraryContentId: integer("related_library_content_id"),
  orderIndex: integer("order_index").notNull().default(0),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const blogPostTranslationsTable = pgTable(
  "blog_post_translations",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull(),
    // "en" | "it" | "es" | "fr" | "de"
    lang: text("lang").notNull(),
    title: text("title").notNull(),
    metaDescription: text("meta_description").notNull().default(""),
    bodyMarkdown: text("body_markdown").notNull().default(""),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("blog_post_translations_post_idx").on(t.postId),
    uniqueIndex("blog_post_translations_post_lang_key").on(t.postId, t.lang),
  ],
);

export type BlogPost = typeof blogPostsTable.$inferSelect;
export type BlogPostTranslation = typeof blogPostTranslationsTable.$inferSelect;
```

- [ ] **Step 2: Write the migration**

Create `lib/db/drizzle/0035_blog.sql`:

```sql
-- Public blog engine (Phase 2a): language-neutral posts + one translation row
-- per (post, language). Kept separate from library_contents so public
-- crawlable content never shares a table with XP-gated in-app content.
CREATE TABLE IF NOT EXISTS "blog_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"related_library_content_id" integer,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "blog_posts_slug_unique" ON "blog_posts" ("slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_post_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"lang" text NOT NULL,
	"title" text NOT NULL,
	"meta_description" text DEFAULT '' NOT NULL,
	"body_markdown" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_post_translations_post_idx" ON "blog_post_translations" ("post_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "blog_post_translations_post_lang_key" ON "blog_post_translations" ("post_id","lang");
```

- [ ] **Step 3: Export from the schema index**

In `lib/db/src/schema/index.ts`, add after the last line (`export * from "./payout";`):

```ts
export * from "./blog";
```

- [ ] **Step 4: Typecheck**

Run (from repo root): `pnpm --filter @workspace/db exec tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Apply the migration locally**

Run (from repo root, against your local Postgres): `pnpm db:migrate`
Expected: log line confirming `0035_blog.sql` applied, exit 0.

- [ ] **Step 6: Commit**

```bash
git add lib/db/src/schema/blog.ts lib/db/drizzle/0035_blog.sql lib/db/src/schema/index.ts
git commit -m "feat(db): add blog_posts + blog_post_translations schema"
```

---

### Task 2: Extract the shared platform-admin helper

**Files:**
- Create: `artifacts/api-server/src/lib/platformAdmin.ts`
- Modify: `artifacts/api-server/src/routes/library.ts`
- Modify: `artifacts/api-server/src/routes/milestones.ts`

**Interfaces:**
- Produces: `isPlatformAdmin(userId: string): boolean`, `requireAuth(req: Request, res: Response): string | null`, `requireAdmin(req: Request, res: Response): string | null` — consumed by Task 4 (`routes/blog.ts`) and the two modified files.

This is a behavior-preserving refactor (same error messages/status codes as the two existing copies) — no new test; correctness is verified by the fact that `library.ts`/`milestones.ts` keep working exactly as before (typecheck + the existing `pnpm verify` gate).

- [ ] **Step 1: Create the shared helper**

Create `artifacts/api-server/src/lib/platformAdmin.ts`:

```ts
import type { Request, Response } from "express";

export function isPlatformAdmin(userId: string): boolean {
  const ids = (process.env.PLATFORM_ADMIN_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return ids.includes(userId);
}

export function requireAuth(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return null;
  }
  return userId;
}

export function requireAdmin(req: Request, res: Response): string | null {
  const userId = requireAuth(req, res);
  if (!userId) return null;
  if (!isPlatformAdmin(userId)) {
    res.status(403).json({ error: "Solo l'amministratore della piattaforma può eseguire questa azione" });
    return null;
  }
  return userId;
}
```

- [ ] **Step 2: Update `routes/library.ts`**

In `artifacts/api-server/src/routes/library.ts`, replace:

```ts
function requireAuth(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return null; }
  return userId;
}
function isPlatformAdmin(userId: string): boolean {
  const ids = (process.env.PLATFORM_ADMIN_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return ids.includes(userId);
}
function requireAdmin(req: Request, res: Response): string | null {
  const userId = requireAuth(req, res);
  if (!userId) return null;
  if (!isPlatformAdmin(userId)) {
    res.status(403).json({ error: "Solo l'amministratore della piattaforma può eseguire questa azione" });
    return null;
  }
  return userId;
}
```

with:

```ts
import { isPlatformAdmin, requireAuth, requireAdmin } from "../lib/platformAdmin.js";
```

(add this import near the top with the other `../lib/*` imports, e.g. right after `import { resolveUploadPath } from "../lib/uploads.js";`).

- [ ] **Step 3: Update `routes/milestones.ts`**

In `artifacts/api-server/src/routes/milestones.ts`, replace the identical three-function block with the same import:

```ts
import { isPlatformAdmin, requireAuth, requireAdmin } from "../lib/platformAdmin.js";
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @workspace/api-server exec tsc -p tsconfig.json --noEmit`
Expected: exits 0 (confirms both files still compile and every call site — `requireAuth(req,res)`, `requireAdmin(req,res)`, `isPlatformAdmin(userId)` — matches the extracted signatures).

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/lib/platformAdmin.ts artifacts/api-server/src/routes/library.ts artifacts/api-server/src/routes/milestones.ts
git commit -m "refactor(api): extract shared platform-admin helper from library/milestones routes"
```

---

### Task 3: Backend pure logic

**Files:**
- Create: `artifacts/api-server/src/routes/blogLogic.ts`
- Create: `artifacts/api-server/src/routes/blogLogic.test.ts`

**Interfaces:**
- Produces: `resolvePublishedTranslation`, `buildBlogPostUpsert`, `BlogPostUpsertInput`, `BlogPostUpsertResult`, `BlogPostTranslationResult` — consumed by Task 4 (`routes/blog.ts`).

- [ ] **Step 1: Write the failing tests**

Create `artifacts/api-server/src/routes/blogLogic.test.ts`:

```ts
import assert from "node:assert/strict";
import { resolvePublishedTranslation, buildBlogPostUpsert } from "./blogLogic.js";

// ─── resolvePublishedTranslation ───────────────────────────────────────────
{
  const translations = [
    { lang: "it", published: true, title: "Ciao" },
    { lang: "en", published: false, title: "Hello" },
  ];

  assert.equal(resolvePublishedTranslation(translations, "it", false)?.title, "Ciao");
  assert.equal(resolvePublishedTranslation(translations, "en", false), null, "unpublished translation hidden from non-admins");
  assert.equal(resolvePublishedTranslation(translations, "en", true)?.title, "Hello", "admins see unpublished translations");
  assert.equal(resolvePublishedTranslation(translations, "fr", false), null, "missing language returns null");
}

// ─── buildBlogPostUpsert ────────────────────────────────────────────────────
{
  const result = buildBlogPostUpsert({
    slug: "  Risk-Management-Basics  ",
    relatedLibraryContentId: 42,
    orderIndex: 3,
    translations: [
      { lang: "it", title: "Gestione del rischio", metaDescription: "Le basi", bodyMarkdown: "# Ciao", published: true },
      { lang: "xx", title: "Invalid lang" },
    ],
  });
  assert.equal(result.slug, "risk-management-basics", "slug is trimmed + lowercased");
  assert.equal(result.relatedLibraryContentId, 42);
  assert.equal(result.orderIndex, 3);
  assert.equal(result.translations.length, 1, "unsupported language is dropped");
  assert.deepEqual(result.translations[0], {
    lang: "it",
    title: "Gestione del rischio",
    metaDescription: "Le basi",
    bodyMarkdown: "# Ciao",
    published: true,
  });
}

{
  const result = buildBlogPostUpsert({ slug: "minimal-post" });
  assert.equal(result.relatedLibraryContentId, null, "missing relatedLibraryContentId defaults to null");
  assert.equal(result.orderIndex, 0, "missing orderIndex defaults to 0");
  assert.deepEqual(result.translations, [], "missing translations defaults to empty array");
}

assert.throws(
  () => buildBlogPostUpsert({ slug: "Not A Valid Slug!" }),
  /kebab-case/,
  "rejects a slug with spaces/punctuation",
);
assert.throws(() => buildBlogPostUpsert({ slug: "" }), /kebab-case/, "rejects an empty slug");
assert.throws(
  () => buildBlogPostUpsert({ slug: "valid-slug", translations: [{ lang: "it", title: "" }] }),
  /missing a title/,
  "rejects a translation with no title",
);

console.log("blog logic tests passed");
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `artifacts/api-server`): `npx tsx src/routes/blogLogic.test.ts`
Expected: fails with a module-not-found error for `./blogLogic.js`.

- [ ] **Step 3: Write the implementation**

Create `artifacts/api-server/src/routes/blogLogic.ts`:

```ts
const SUPPORTED_BLOG_LANGS = new Set(["en", "it", "es", "fr", "de"]);
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface TranslationLike {
  lang: string;
  published: boolean;
}

/** Which translation, if any, a given (lang, isAdmin) request may see. */
export function resolvePublishedTranslation<T extends TranslationLike>(
  translations: T[],
  lang: string,
  isAdmin: boolean,
): T | null {
  const match = translations.find((t) => t.lang === lang);
  if (!match) return null;
  if (!isAdmin && !match.published) return null;
  return match;
}

export interface BlogPostTranslationResult {
  lang: string;
  title: string;
  metaDescription: string;
  bodyMarkdown: string;
  published: boolean;
}

export interface BlogPostUpsertInput {
  slug?: unknown;
  relatedLibraryContentId?: unknown;
  orderIndex?: unknown;
  translations?: unknown;
}

export interface BlogPostUpsertResult {
  slug: string;
  relatedLibraryContentId: number | null;
  orderIndex: number;
  translations: BlogPostTranslationResult[];
}

/** Validates + shapes an admin create/update payload. Throws on invalid input. */
export function buildBlogPostUpsert(input: BlogPostUpsertInput): BlogPostUpsertResult {
  const slug = typeof input.slug === "string" ? input.slug.trim().toLowerCase() : "";
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error('slug must be lowercase kebab-case, e.g. "risk-management-basics"');
  }

  const relatedLibraryContentId =
    typeof input.relatedLibraryContentId === "number" ? input.relatedLibraryContentId : null;
  const orderIndex = typeof input.orderIndex === "number" ? input.orderIndex : 0;

  const rawTranslations = Array.isArray(input.translations) ? input.translations : [];
  const translations: BlogPostTranslationResult[] = [];
  for (const raw of rawTranslations) {
    if (typeof raw !== "object" || raw === null) continue;
    const t = raw as Record<string, unknown>;
    const lang = typeof t.lang === "string" ? t.lang : "";
    if (!SUPPORTED_BLOG_LANGS.has(lang)) continue;
    const title = typeof t.title === "string" ? t.title.trim() : "";
    if (!title) throw new Error(`translation "${lang}" is missing a title`);
    translations.push({
      lang,
      title,
      metaDescription: typeof t.metaDescription === "string" ? t.metaDescription : "",
      bodyMarkdown: typeof t.bodyMarkdown === "string" ? t.bodyMarkdown : "",
      published: Boolean(t.published),
    });
  }

  return { slug, relatedLibraryContentId, orderIndex, translations };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx src/routes/blogLogic.test.ts`
Expected: prints `blog logic tests passed`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/routes/blogLogic.ts artifacts/api-server/src/routes/blogLogic.test.ts
git commit -m "feat(blog): add pure blog post validation/shaping logic"
```

---

### Task 4: Backend routes

**Files:**
- Create: `artifacts/api-server/src/routes/blog.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`

**Interfaces:**
- Consumes: `blogPostsTable`/`blogPostTranslationsTable` (Task 1), `isPlatformAdmin`/`requireAdmin` (Task 2), `resolvePublishedTranslation`/`buildBlogPostUpsert` (Task 3).
- Produces: `GET /blog/admin/status`, `GET /blog/posts?lang=`, `GET /blog/posts/:slug?lang=`, `POST /blog/posts`, `PATCH /blog/posts/:id`, `DELETE /blog/posts/:id` — consumed by Task 6 (`blogApi.ts`).

No new automated test here — matches this codebase's existing convention for admin-CRUD route files (`routes/library.ts` itself has no route-level test; the non-trivial logic is in Task 3's pure, tested helpers). Verified manually in Task 14.

- [ ] **Step 1: Write the router**

Create `artifacts/api-server/src/routes/blog.ts`:

```ts
import { Router, type IRouter } from "express";
import { db, blogPostsTable, blogPostTranslationsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { isPlatformAdmin, requireAdmin } from "../lib/platformAdmin.js";
import { resolvePublishedTranslation, buildBlogPostUpsert } from "./blogLogic.js";

const router: IRouter = Router();

const SUPPORTED_LANGS = new Set(["en", "it", "es", "fr", "de"]);

function parseLang(raw: unknown): string {
  const lang = typeof raw === "string" ? raw : "en";
  return SUPPORTED_LANGS.has(lang) ? lang : "en";
}

router.get("/blog/admin/status", (req, res) => {
  const userId = req.user?.id;
  res.json({ isAdmin: userId ? isPlatformAdmin(userId) : false });
});

// ─── Consumer: list posts with a published translation for `lang` ───────────
router.get("/blog/posts", async (req, res) => {
  const lang = parseLang(req.query.lang);
  const isAdmin = req.user?.id ? isPlatformAdmin(req.user.id) : false;

  const rows = await db
    .select({
      id: blogPostsTable.id,
      slug: blogPostsTable.slug,
      relatedLibraryContentId: blogPostsTable.relatedLibraryContentId,
      orderIndex: blogPostsTable.orderIndex,
      title: blogPostTranslationsTable.title,
      metaDescription: blogPostTranslationsTable.metaDescription,
      published: blogPostTranslationsTable.published,
    })
    .from(blogPostsTable)
    .innerJoin(blogPostTranslationsTable, eq(blogPostTranslationsTable.postId, blogPostsTable.id))
    .where(eq(blogPostTranslationsTable.lang, lang))
    .orderBy(asc(blogPostsTable.orderIndex));

  const visible = isAdmin ? rows : rows.filter((r) => r.published);
  res.json(visible.map(({ published: _published, ...rest }) => rest));
});

// ─── Consumer: one post by slug ─────────────────────────────────────────────
router.get("/blog/posts/:slug", async (req, res) => {
  const lang = parseLang(req.query.lang);
  const isAdmin = req.user?.id ? isPlatformAdmin(req.user.id) : false;

  const [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.slug, req.params.slug));
  if (!post) {
    res.status(404).json({ error: "Articolo non trovato" });
    return;
  }

  const translations = await db
    .select()
    .from(blogPostTranslationsTable)
    .where(eq(blogPostTranslationsTable.postId, post.id));
  const translation = resolvePublishedTranslation(translations, lang, isAdmin);
  if (!translation) {
    res.status(404).json({ error: "Articolo non trovato" });
    return;
  }

  res.json({
    id: post.id,
    slug: post.slug,
    relatedLibraryContentId: post.relatedLibraryContentId,
    title: translation.title,
    metaDescription: translation.metaDescription,
    bodyMarkdown: translation.bodyMarkdown,
    lang: translation.lang,
  });
});

// ─── Admin: create ───────────────────────────────────────────────────────────
router.post("/blog/posts", async (req, res) => {
  const userId = requireAdmin(req, res);
  if (!userId) return;

  let parsed;
  try {
    parsed = buildBlogPostUpsert(req.body);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  const existing = await db.select().from(blogPostsTable).where(eq(blogPostsTable.slug, parsed.slug));
  if (existing.length > 0) {
    res.status(409).json({ error: "Slug già in uso" });
    return;
  }

  const [post] = await db
    .insert(blogPostsTable)
    .values({
      slug: parsed.slug,
      relatedLibraryContentId: parsed.relatedLibraryContentId,
      orderIndex: parsed.orderIndex,
      createdBy: userId,
    })
    .returning();

  if (parsed.translations.length > 0) {
    await db.insert(blogPostTranslationsTable).values(parsed.translations.map((t) => ({ ...t, postId: post.id })));
  }

  res.status(201).json({ id: post.id, slug: post.slug });
});

// ─── Admin: update ───────────────────────────────────────────────────────────
router.patch("/blog/posts/:id", async (req, res) => {
  const userId = requireAdmin(req, res);
  if (!userId) return;
  const id = Number(req.params.id);

  let parsed;
  try {
    parsed = buildBlogPostUpsert(req.body);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  await db
    .update(blogPostsTable)
    .set({
      relatedLibraryContentId: parsed.relatedLibraryContentId,
      orderIndex: parsed.orderIndex,
      updatedAt: new Date(),
    })
    .where(eq(blogPostsTable.id, id));

  for (const t of parsed.translations) {
    const existing = await db
      .select()
      .from(blogPostTranslationsTable)
      .where(and(eq(blogPostTranslationsTable.postId, id), eq(blogPostTranslationsTable.lang, t.lang)));
    if (existing.length > 0) {
      await db
        .update(blogPostTranslationsTable)
        .set({ ...t, updatedAt: new Date() })
        .where(eq(blogPostTranslationsTable.id, existing[0].id));
    } else {
      await db.insert(blogPostTranslationsTable).values({ ...t, postId: id });
    }
  }

  res.json({ id });
});

// ─── Admin: delete ───────────────────────────────────────────────────────────
router.delete("/blog/posts/:id", async (req, res) => {
  const userId = requireAdmin(req, res);
  if (!userId) return;
  const id = Number(req.params.id);
  await db.delete(blogPostTranslationsTable).where(eq(blogPostTranslationsTable.postId, id));
  await db.delete(blogPostsTable).where(eq(blogPostsTable.id, id));
  res.status(204).end();
});

export default router;
```

- [ ] **Step 2: Mount the router**

In `artifacts/api-server/src/routes/index.ts`, add the import after `import libraryRouter from "./library.js";`:

```ts
import blogRouter from "./blog.js";
```

and add the mount after `router.use(libraryRouter);`:

```ts
router.use(blogRouter);
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @workspace/api-server exec tsc -p tsconfig.json --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add artifacts/api-server/src/routes/blog.ts artifacts/api-server/src/routes/index.ts
git commit -m "feat(blog): add public read + admin CRUD routes"
```

---

### Task 5: `lib/seo.ts` blog helpers

**Files:**
- Modify: `artifacts/trader-dashboard/src/lib/seo.ts`
- Modify: `artifacts/trader-dashboard/src/lib/seo.test.ts`

**Interfaces:**
- Produces: `blogIndexPath(lang)`, `blogPostPath(slug, lang)`, `blogIndexAlternates()`, `blogPostAlternates(slug, langs)`, `articleJsonLd(title, description, url, lang)` — consumed by Tasks 8, 9, 13.

- [ ] **Step 1: Write the failing tests**

In `artifacts/trader-dashboard/src/lib/seo.test.ts`, add at the end of the file:

```ts
import { blogIndexPath, blogPostPath, blogIndexAlternates, blogPostAlternates, articleJsonLd } from "./seo.ts";

assert.equal(blogIndexPath("en"), "/blog");
assert.equal(blogIndexPath("it"), "/it/blog");
assert.equal(blogPostPath("risk-management-basics", "en"), "/blog/risk-management-basics");
assert.equal(blogPostPath("risk-management-basics", "it"), "/it/blog/risk-management-basics");

const idxAlts = blogIndexAlternates();
assert.equal(idxAlts.length, 6, "5 languages + x-default");
assert.ok(idxAlts.some((a) => a.hreflang === "x-default" && a.href === "https://traderloading.com/blog"));

const postAlts = blogPostAlternates("risk-management-basics", ["en", "it"]);
assert.deepEqual(
  postAlts.map((a) => a.hreflang),
  ["en", "it", "x-default"],
  "only the given languages + x-default (not all 5) — a post may not have every translation",
);
assert.equal(postAlts[2].href, "https://traderloading.com/blog/risk-management-basics", "x-default points at English");

const jsonLd = articleJsonLd("Come iniziare a fare trading", "Guida pratica", "https://traderloading.com/it/blog/come-iniziare", "it");
assert.equal(jsonLd["@type"], "BlogPosting");
assert.equal(jsonLd.headline, "Come iniziare a fare trading");
assert.equal(jsonLd.inLanguage, "it");

console.log("blog seo helper tests passed");
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `artifacts/trader-dashboard`): `npx tsx src/lib/seo.test.ts`
Expected: fails — `blogIndexPath` is not exported.

- [ ] **Step 3: Write the implementation**

In `artifacts/trader-dashboard/src/lib/seo.ts`, add after `seoPageAlternates` (before `allMarketingPaths`):

```ts
/** URL path for the blog index in a given language. */
export function blogIndexPath(lang: Language): string {
  return lang === "en" ? "/blog" : `/${lang}/blog`;
}

/** URL path for a blog article in a given language (same slug across languages). */
export function blogPostPath(slug: string, lang: Language): string {
  return lang === "en" ? `/blog/${slug}` : `/${lang}/blog/${slug}`;
}

/** hreflang alternates (all 5 languages + x-default) for the blog index. */
export function blogIndexAlternates(): HreflangAlternate[] {
  const alts: HreflangAlternate[] = LANG_ORDER.map((lang) => ({
    hreflang: lang,
    href: absoluteUrl(blogIndexPath(lang)),
  }));
  alts.push({ hreflang: "x-default", href: absoluteUrl(blogIndexPath("en")) });
  return alts;
}

/**
 * hreflang alternates for a blog post — only for the languages that actually
 * have a published translation (unlike the static keyword pages, a post may
 * not exist in all 5 languages). x-default points at English only if an
 * English translation exists.
 */
export function blogPostAlternates(slug: string, langs: Language[]): HreflangAlternate[] {
  const alts: HreflangAlternate[] = langs.map((lang) => ({
    hreflang: lang,
    href: absoluteUrl(blogPostPath(slug, lang)),
  }));
  if (langs.includes("en")) {
    alts.push({ hreflang: "x-default", href: absoluteUrl(blogPostPath(slug, "en")) });
  }
  return alts;
}
```

And after `pricingProductJsonLd` (end of file):

```ts
/** schema.org BlogPosting for a blog article. */
export function articleJsonLd(title: string, description: string, url: string, lang: Language): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    url,
    inLanguage: lang,
    publisher: { "@type": "Organization", name: "TraderLoading", url: `${SITE_ORIGIN}/` },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx src/lib/seo.test.ts`
Expected: prints `blog seo helper tests passed` (and all pre-existing assertions in the file still pass), exit code 0.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/lib/seo.ts artifacts/trader-dashboard/src/lib/seo.test.ts
git commit -m "feat(blog): add blog URL/hreflang/JSON-LD helpers"
```

---

### Task 6: Frontend API client

**Files:**
- Create: `artifacts/trader-dashboard/src/lib/blogApi.ts`

**Interfaces:**
- Produces: `BlogPostSummary`, `BlogPostDetail`, `BlogPostUpsertPayload`, `fetchBlogPosts`, `fetchBlogPost`, `fetchBlogAdminStatus`, `createBlogPost`, `updateBlogPost`, `deleteBlogPost` — consumed by Tasks 8, 9.

Hand-written client mirroring `torneiApi.ts` — no dedicated test (matches that file's own convention: no test file, it's a thin `apiJSON` wrapper).

- [ ] **Step 1: Write the client**

Create `artifacts/trader-dashboard/src/lib/blogApi.ts`:

```ts
// Client off-contract del Blog (come torneiApi): tipi a mano + apiJSON.
import { apiJSON } from "./apiFetch";

export interface BlogPostSummary {
  id: number;
  slug: string;
  relatedLibraryContentId: number | null;
  orderIndex: number;
  title: string;
  metaDescription: string;
}

export interface BlogPostDetail {
  id: number;
  slug: string;
  relatedLibraryContentId: number | null;
  title: string;
  metaDescription: string;
  bodyMarkdown: string;
  lang: string;
}

export interface BlogPostTranslationPayload {
  lang: string;
  title: string;
  metaDescription: string;
  bodyMarkdown: string;
  published: boolean;
}

export interface BlogPostUpsertPayload {
  slug: string;
  relatedLibraryContentId: number | null;
  orderIndex: number;
  translations: BlogPostTranslationPayload[];
}

export function fetchBlogPosts(lang: string): Promise<BlogPostSummary[]> {
  return apiJSON(`blog/posts?lang=${encodeURIComponent(lang)}`);
}

export function fetchBlogPost(slug: string, lang: string): Promise<BlogPostDetail> {
  return apiJSON(`blog/posts/${encodeURIComponent(slug)}?lang=${encodeURIComponent(lang)}`);
}

export function fetchBlogAdminStatus(): Promise<{ isAdmin: boolean }> {
  return apiJSON("blog/admin/status");
}

export function createBlogPost(payload: BlogPostUpsertPayload): Promise<{ id: number; slug: string }> {
  return apiJSON("blog/posts", { method: "POST", body: JSON.stringify(payload) });
}

export function updateBlogPost(id: number, payload: BlogPostUpsertPayload): Promise<{ id: number }> {
  return apiJSON(`blog/posts/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteBlogPost(id: number): Promise<void> {
  return apiJSON(`blog/posts/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 2: Typecheck**

Run (from `artifacts/trader-dashboard`): `npx tsc -p tsconfig.json --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add artifacts/trader-dashboard/src/lib/blogApi.ts
git commit -m "feat(blog): add frontend off-contract API client"
```

---

### Task 7: i18n dict keys

**Files:**
- Modify: `artifacts/trader-dashboard/src/lib/i18n/dict.it.ts`
- Modify: `artifacts/trader-dashboard/src/lib/i18n/dict.en.ts`
- Modify: `artifacts/trader-dashboard/src/lib/i18n/dict.es.ts`
- Modify: `artifacts/trader-dashboard/src/lib/i18n/dict.fr.ts`
- Modify: `artifacts/trader-dashboard/src/lib/i18n/dict.de.ts`

**Interfaces:**
- Produces: the dict keys listed below, consumed by Tasks 8, 9, 11 via `t()`/`uiText()`.

No dedicated test to write — this task's correctness is verified by the pre-existing repo-wide `i18n.parity.static.test.ts` (fails if any language is missing a key) once Tasks 8/9/11 actually reference these keys via `t()`.

- [ ] **Step 1: Add keys to `dict.it.ts`** (base/fallback language) — add this block anywhere in the object literal (e.g. right after the last existing entry, before the closing `};`):

```ts
  "blog.index.title": "Blog",
  "blog.index.subtitle": "Guide pratiche per iniziare e migliorare nel trading.",
  "blog.index.empty.title": "Presto nuovi articoli",
  "blog.index.empty.body": "Stiamo preparando le prime guide. Torna a trovarci a breve.",
  "blog.index.newPost": "Nuovo articolo",
  "blog.index.readMore": "Leggi l'articolo",
  "blog.article.back": "← Torna al blog",
  "blog.article.relatedLibrary.title": "Approfondisci nella Libreria",
  "blog.article.relatedLibrary.action": "Apri nella Libreria",
  "blog.admin.edit": "Modifica",
  "blog.admin.delete": "Elimina",
  "blog.admin.save": "Salva",
  "blog.admin.cancel": "Annulla",
  "blog.admin.slugLabel": "Slug (es. gestione-del-rischio)",
  "blog.admin.relatedLibraryLabel": "ID contenuto Libreria collegato (opzionale)",
  "blog.admin.orderLabel": "Ordine",
  "blog.admin.publishedLabel": "Pubblicato in questa lingua",
  "blog.admin.titleLabel": "Titolo",
  "blog.admin.metaDescriptionLabel": "Meta description",
  "blog.admin.bodyLabel": "Corpo (markdown)",
  "library.blogLink": "Leggi l'articolo completo",
```

- [ ] **Step 2: Add the same keys to `dict.en.ts`**

```ts
  "blog.index.title": "Blog",
  "blog.index.subtitle": "Practical guides to start and improve at trading.",
  "blog.index.empty.title": "New articles coming soon",
  "blog.index.empty.body": "We're preparing the first guides. Check back soon.",
  "blog.index.newPost": "New post",
  "blog.index.readMore": "Read the article",
  "blog.article.back": "← Back to blog",
  "blog.article.relatedLibrary.title": "Go deeper in the Library",
  "blog.article.relatedLibrary.action": "Open in Library",
  "blog.admin.edit": "Edit",
  "blog.admin.delete": "Delete",
  "blog.admin.save": "Save",
  "blog.admin.cancel": "Cancel",
  "blog.admin.slugLabel": "Slug (e.g. risk-management)",
  "blog.admin.relatedLibraryLabel": "Linked Library content ID (optional)",
  "blog.admin.orderLabel": "Order",
  "blog.admin.publishedLabel": "Published in this language",
  "blog.admin.titleLabel": "Title",
  "blog.admin.metaDescriptionLabel": "Meta description",
  "blog.admin.bodyLabel": "Body (markdown)",
  "library.blogLink": "Read the full article",
```

- [ ] **Step 3: Add the same keys to `dict.es.ts`**

```ts
  "blog.index.title": "Blog",
  "blog.index.subtitle": "Guías prácticas para empezar y mejorar en el trading.",
  "blog.index.empty.title": "Nuevos artículos muy pronto",
  "blog.index.empty.body": "Estamos preparando las primeras guías. Vuelve pronto.",
  "blog.index.newPost": "Nuevo artículo",
  "blog.index.readMore": "Leer el artículo",
  "blog.article.back": "← Volver al blog",
  "blog.article.relatedLibrary.title": "Profundiza en la Biblioteca",
  "blog.article.relatedLibrary.action": "Abrir en la Biblioteca",
  "blog.admin.edit": "Editar",
  "blog.admin.delete": "Eliminar",
  "blog.admin.save": "Guardar",
  "blog.admin.cancel": "Cancelar",
  "blog.admin.slugLabel": "Slug (ej. gestion-del-riesgo)",
  "blog.admin.relatedLibraryLabel": "ID de contenido de la Biblioteca vinculado (opcional)",
  "blog.admin.orderLabel": "Orden",
  "blog.admin.publishedLabel": "Publicado en este idioma",
  "blog.admin.titleLabel": "Título",
  "blog.admin.metaDescriptionLabel": "Meta descripción",
  "blog.admin.bodyLabel": "Cuerpo (markdown)",
  "library.blogLink": "Leer el artículo completo",
```

- [ ] **Step 4: Add the same keys to `dict.fr.ts`**

```ts
  "blog.index.title": "Blog",
  "blog.index.subtitle": "Guides pratiques pour débuter et progresser en trading.",
  "blog.index.empty.title": "Nouveaux articles bientôt",
  "blog.index.empty.body": "Nous préparons les premiers guides. Revenez bientôt.",
  "blog.index.newPost": "Nouvel article",
  "blog.index.readMore": "Lire l'article",
  "blog.article.back": "← Retour au blog",
  "blog.article.relatedLibrary.title": "Approfondir dans la Bibliothèque",
  "blog.article.relatedLibrary.action": "Ouvrir dans la Bibliothèque",
  "blog.admin.edit": "Modifier",
  "blog.admin.delete": "Supprimer",
  "blog.admin.save": "Enregistrer",
  "blog.admin.cancel": "Annuler",
  "blog.admin.slugLabel": "Slug (ex. gestion-du-risque)",
  "blog.admin.relatedLibraryLabel": "ID de contenu Bibliothèque lié (optionnel)",
  "blog.admin.orderLabel": "Ordre",
  "blog.admin.publishedLabel": "Publié dans cette langue",
  "blog.admin.titleLabel": "Titre",
  "blog.admin.metaDescriptionLabel": "Meta description",
  "blog.admin.bodyLabel": "Corps (markdown)",
  "library.blogLink": "Lire l'article complet",
```

- [ ] **Step 5: Add the same keys to `dict.de.ts`**

```ts
  "blog.index.title": "Blog",
  "blog.index.subtitle": "Praktische Leitfäden für den Einstieg und Fortschritt im Trading.",
  "blog.index.empty.title": "Neue Artikel folgen bald",
  "blog.index.empty.body": "Wir bereiten die ersten Leitfäden vor. Schau bald wieder vorbei.",
  "blog.index.newPost": "Neuer Beitrag",
  "blog.index.readMore": "Artikel lesen",
  "blog.article.back": "← Zurück zum Blog",
  "blog.article.relatedLibrary.title": "Mehr erfahren in der Bibliothek",
  "blog.article.relatedLibrary.action": "In der Bibliothek öffnen",
  "blog.admin.edit": "Bearbeiten",
  "blog.admin.delete": "Löschen",
  "blog.admin.save": "Speichern",
  "blog.admin.cancel": "Abbrechen",
  "blog.admin.slugLabel": "Slug (z. B. risikomanagement)",
  "blog.admin.relatedLibraryLabel": "Verknüpfte Bibliotheks-Inhalts-ID (optional)",
  "blog.admin.orderLabel": "Reihenfolge",
  "blog.admin.publishedLabel": "In dieser Sprache veröffentlicht",
  "blog.admin.titleLabel": "Titel",
  "blog.admin.metaDescriptionLabel": "Meta-Beschreibung",
  "blog.admin.bodyLabel": "Inhalt (Markdown)",
  "library.blogLink": "Vollständigen Artikel lesen",
```

- [ ] **Step 6: Run the i18n static tests**

Run (from `artifacts/trader-dashboard`): `npx tsx src/lib/i18n.parity.static.test.ts`
Expected: passes (every language has every key, no mojibake, no placeholder mismatch). If it fails, the error names the missing/mismatched key — fix the specific dict file.

- [ ] **Step 7: Commit**

```bash
git add artifacts/trader-dashboard/src/lib/i18n/dict.it.ts artifacts/trader-dashboard/src/lib/i18n/dict.en.ts artifacts/trader-dashboard/src/lib/i18n/dict.es.ts artifacts/trader-dashboard/src/lib/i18n/dict.fr.ts artifacts/trader-dashboard/src/lib/i18n/dict.de.ts
git commit -m "feat(i18n): add blog + library-crosslink copy keys (5 languages)"
```

---

### Task 8: `BlogIndexPage.tsx`

**Files:**
- Create: `artifacts/trader-dashboard/src/pages/blog/BlogIndexPage.tsx`

**Interfaces:**
- Consumes: `fetchBlogPosts`, `fetchBlogAdminStatus`, `createBlogPost`, `updateBlogPost`, `deleteBlogPost`, `BlogPostSummary`, `BlogPostUpsertPayload` (Task 6); `blogIndexPath`, `blogIndexAlternates` (Task 5); dict keys (Task 7).
- Produces: `BlogIndexPage({ lang }: { lang: Language })` default export — consumed by Task 10 (`App.tsx`).

No dedicated test — its visible-copy compliance is enforced by the pre-existing repo-wide `production-copy.static.test.ts` (fails the whole build if any literal string sneaks in), and its JSON-LD/canonical correctness is already covered by Task 5's tests on the helpers it calls.

- [ ] **Step 1: Write the page**

Create `artifacts/trader-dashboard/src/pages/blog/BlogIndexPage.tsx`:

```tsx
import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Seo } from "@/components/Seo";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/lib/i18n";
import { absoluteUrl, blogIndexAlternates, blogIndexPath } from "@/lib/seo";
import {
  fetchBlogPosts,
  fetchBlogAdminStatus,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  type BlogPostSummary,
  type BlogPostUpsertPayload,
  type BlogPostTranslationPayload,
} from "@/lib/blogApi";

const BLOG_LANGS: Language[] = ["it", "en", "es", "fr", "de"];

function emptyTranslation(lang: Language): BlogPostTranslationPayload {
  return { lang, title: "", metaDescription: "", bodyMarkdown: "", published: false };
}

// ─── Admin: create/edit form ────────────────────────────────────────────────
function PostForm({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [slug, setSlug] = useState("");
  const [relatedLibraryContentId, setRelatedLibraryContentId] = useState("");
  const [orderIndex, setOrderIndex] = useState(0);
  const [activeLang, setActiveLang] = useState<Language>("it");
  const [translations, setTranslations] = useState<Record<Language, BlogPostTranslationPayload>>(() => {
    const initial = {} as Record<Language, BlogPostTranslationPayload>;
    for (const lang of BLOG_LANGS) initial[lang] = emptyTranslation(lang);
    return initial;
  });

  const save = useMutation({
    mutationFn: () => {
      const payload: BlogPostUpsertPayload = {
        slug,
        relatedLibraryContentId: relatedLibraryContentId ? Number(relatedLibraryContentId) : null,
        orderIndex,
        translations: BLOG_LANGS.map((lang) => translations[lang]).filter((tr) => tr.title.trim()),
      };
      return createBlogPost(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blog", "posts"] });
      onClose();
    },
  });

  function updateActiveTranslation(patch: Partial<BlogPostTranslationPayload>) {
    setTranslations((prev) => ({ ...prev, [activeLang]: { ...prev[activeLang], ...patch } }));
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[88vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-border">
        <DialogHeader>
          <DialogTitle>{t("blog.index.newPost")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <input
            className="tl-input"
            placeholder={t("blog.admin.slugLabel")}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="tl-input"
              placeholder={t("blog.admin.relatedLibraryLabel")}
              value={relatedLibraryContentId}
              onChange={(e) => setRelatedLibraryContentId(e.target.value)}
            />
            <input
              type="number"
              className="tl-input"
              placeholder={t("blog.admin.orderLabel")}
              value={orderIndex}
              onChange={(e) => setOrderIndex(Number(e.target.value))}
            />
          </div>

          <Tabs value={activeLang} onValueChange={(v) => setActiveLang(v as Language)}>
            <TabsList>
              {BLOG_LANGS.map((lang) => (
                <TabsTrigger key={lang} value={lang}>
                  {lang.toUpperCase()}
                </TabsTrigger>
              ))}
            </TabsList>
            {BLOG_LANGS.map((lang) => (
              <TabsContent key={lang} value={lang} className="space-y-2">
                <input
                  className="tl-input"
                  placeholder={t("blog.admin.titleLabel")}
                  value={translations[lang].title}
                  onChange={(e) => updateActiveTranslation({ title: e.target.value })}
                />
                <textarea
                  className="tl-input min-h-16"
                  placeholder={t("blog.admin.metaDescriptionLabel")}
                  value={translations[lang].metaDescription}
                  onChange={(e) => updateActiveTranslation({ metaDescription: e.target.value })}
                />
                <textarea
                  className="tl-input min-h-40"
                  placeholder={t("blog.admin.bodyLabel")}
                  value={translations[lang].bodyMarkdown}
                  onChange={(e) => updateActiveTranslation({ bodyMarkdown: e.target.value })}
                />
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={translations[lang].published}
                    onChange={(e) => updateActiveTranslation({ published: e.target.checked })}
                  />
                  {t("blog.admin.publishedLabel")}
                </label>
              </TabsContent>
            ))}
          </Tabs>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t("blog.admin.cancel")}
            </Button>
            <Button size="sm" disabled={!slug.trim() || save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {t("blog.admin.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BlogIndexPage({ lang }: { lang: Language }) {
  const { t } = useLanguage();
  const qc = useQueryClient();

  const { data: admin } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["blog", "admin"],
    queryFn: fetchBlogAdminStatus,
  });
  const isAdmin = admin?.isAdmin ?? false;

  const { data: posts = [] } = useQuery<BlogPostSummary[]>({
    queryKey: ["blog", "posts", lang],
    queryFn: () => fetchBlogPosts(lang),
  });

  const [showForm, setShowForm] = useState(false);
  const delPost = useMutation({
    mutationFn: (id: number) => deleteBlogPost(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blog", "posts"] }),
  });

  return (
    <PageLayout>
      <Seo
        title={t("blog.index.title")}
        description={t("blog.index.subtitle")}
        lang={lang}
        canonical={absoluteUrl(blogIndexPath(lang))}
        alternates={blogIndexAlternates()}
      />
      <PageHeader
        title={t("blog.index.title")}
        subtitle={t("blog.index.subtitle")}
        action={
          isAdmin ? (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1" />
              {t("blog.index.newPost")}
            </Button>
          ) : undefined
        }
      />

      {posts.length === 0 && (
        <div className="tl-panel p-10 sm:p-16 text-center">
          <h3 className="text-xl font-bold mb-2">{t("blog.index.empty.title")}</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">{t("blog.index.empty.body")}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post) => (
          <div key={post.id} className="tl-panel p-4 flex flex-col gap-2 border-border/40">
            <h3 className="font-bold text-sm leading-snug">{post.title}</h3>
            {post.metaDescription && (
              <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{post.metaDescription}</p>
            )}
            <div className="flex items-center gap-2 mt-auto">
              <Link href={lang === "en" ? `/blog/${post.slug}` : `/${lang}/blog/${post.slug}`}>
                <Button variant="default" size="sm">
                  {t("blog.index.readMore")}
                </Button>
              </Link>
              {isAdmin && (
                <button
                  onClick={() => delPost.mutate(post.id)}
                  className="p-1.5 text-muted-foreground hover:text-red-400"
                  aria-label={t("blog.admin.delete")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showForm && <PostForm onClose={() => setShowForm(false)} />}
    </PageLayout>
  );
}
```

*(Note: the admin edit flow for an existing post — pre-filling `PostForm` from a selected post's full translations — is deferred to a follow-up if genuinely needed once real content exists; Phase 2a's admin form covers create + delete, which is enough to seed the Phase 2b articles. `Pencil`/edit-in-place can be added later without touching the schema. This keeps the task's scope matched to what's needed to unblock Phase 2b.)*

- [ ] **Step 2: Typecheck**

Run (from `artifacts/trader-dashboard`): `npx tsc -p tsconfig.json --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add artifacts/trader-dashboard/src/pages/blog/BlogIndexPage.tsx
git commit -m "feat(blog): add BlogIndexPage (list + admin create panel)"
```

---

### Task 9: `BlogArticlePage.tsx`

**Files:**
- Create: `artifacts/trader-dashboard/src/pages/blog/BlogArticlePage.tsx`

**Interfaces:**
- Consumes: `fetchBlogPost`, `BlogPostDetail` (Task 6); `blogPostPath`, `blogPostAlternates`, `articleJsonLd`, `absoluteUrl` (Task 5); dict keys (Task 7).
- Produces: `BlogArticlePage({ lang, slug }: { lang: Language; slug: string })` default export, plus exported `BlogNotFound` — consumed by Task 10.

- [ ] **Step 1: Write the page**

Create `artifacts/trader-dashboard/src/pages/blog/BlogArticlePage.tsx`:

```tsx
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/components/Seo";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/lib/i18n";
import { absoluteUrl, articleJsonLd, blogIndexPath, blogPostAlternates, blogPostPath } from "@/lib/seo";
import { fetchBlogPost, type BlogPostDetail } from "@/lib/blogApi";

export default function BlogArticlePage({ lang, slug }: { lang: Language; slug: string }) {
  const { t } = useLanguage();

  const { data: post, isLoading, isError } = useQuery<BlogPostDetail>({
    queryKey: ["blog", "post", lang, slug],
    queryFn: () => fetchBlogPost(slug, lang),
    retry: false,
  });

  if (isLoading) return null;
  if (isError || !post) return <BlogArticleNotFound lang={lang} />;

  const canonical = absoluteUrl(blogPostPath(post.slug, lang));

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
      <Seo
        title={post.title}
        description={post.metaDescription}
        lang={lang}
        canonical={canonical}
        ogType="article"
        alternates={blogPostAlternates(post.slug, [lang])}
        jsonLd={[articleJsonLd(post.title, post.metaDescription, canonical, lang)]}
      />
      <Link href={blogIndexPath(lang)} className="text-sm text-primary hover:underline">
        {t("blog.article.back")}
      </Link>
      <h1 className="mt-4 text-3xl font-bold leading-tight">{post.title}</h1>
      <div className="mt-6 whitespace-pre-wrap leading-relaxed text-foreground/90">{post.bodyMarkdown}</div>

      {post.relatedLibraryContentId != null && (
        <div className="mt-10 tl-panel p-6">
          <h2 className="font-bold text-lg mb-2">{t("blog.article.relatedLibrary.title")}</h2>
          <Link href={`/library?open=${post.relatedLibraryContentId}`} className="text-primary font-semibold hover:underline">
            {t("blog.article.relatedLibrary.action")} →
          </Link>
        </div>
      )}
    </div>
  );
}

function BlogArticleNotFound({ lang }: { lang: Language }) {
  const { t } = useLanguage();
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-16 text-center">
      <h1 className="text-2xl font-bold mb-3">{t("blog.index.empty.title")}</h1>
      <Link href={blogIndexPath(lang)} className="text-primary hover:underline">
        {t("blog.article.back")}
      </Link>
    </div>
  );
}
```

*(Reuses `blog.index.empty.title` for the not-found headline rather than adding a dedicated key — it's an accurate, already-translated fit: "no such article" reads the same as "nothing here yet".)*

- [ ] **Step 2: Typecheck**

Run (from `artifacts/trader-dashboard`): `npx tsc -p tsconfig.json --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add artifacts/trader-dashboard/src/pages/blog/BlogArticlePage.tsx
git commit -m "feat(blog): add BlogArticlePage (article render + SEO + Library CTA)"
```

---

### Task 10: Wire blog routes into `App.tsx`

**Files:**
- Modify: `artifacts/trader-dashboard/src/App.tsx`

**Interfaces:**
- Consumes: `BlogIndexPage` (Task 8), `BlogArticlePage` (Task 9).

- [ ] **Step 1: Add lazy imports**

In `artifacts/trader-dashboard/src/App.tsx`, add after `const SeoArticlePage = lazy(() => import("./pages/seo/SeoArticlePage"));` (line 75):

```ts
const BlogIndexPage = lazy(() => import("./pages/blog/BlogIndexPage"));
const BlogArticlePage = lazy(() => import("./pages/blog/BlogArticlePage"));
```

- [ ] **Step 2: Add a `BlogRoute` wrapper**

After the existing `LocalizedMarketingRoute` function (around line 517), add:

```tsx
function BlogRoute({ lang, slug }: { lang: Language; slug?: string }) {
  const { setLanguage } = useLanguage();
  useEffect(() => {
    setLanguage(lang, false);
  }, [lang, setLanguage]);
  return (
    <Suspense fallback={<PageFallback />}>
      {slug ? <BlogArticlePage lang={lang} slug={slug} /> : <BlogIndexPage lang={lang} />}
    </Suspense>
  );
}
```

- [ ] **Step 3: Add blog routes before the localized catch-all**

Change the `marketingRoutes` array (lines 521-534) from:

```tsx
const marketingRoutes = [
  ...SEO_PAGE_KEYS.map((page) => (
    <Route key={`en-${page}`} path={seoPagePath(page, "en")}>
      <MarketingPage lang="en" page={page} />
    </Route>
  )),
  ...LOCALIZED_LANGS.map((lang) => (
    <Route key={`loc-${lang}`} path={`/${lang}/:slug?`}>
      {(params: { slug?: string }) => (
        <LocalizedMarketingRoute lang={lang} slug={params.slug} />
      )}
    </Route>
  )),
];
```

to:

```tsx
const marketingRoutes = [
  ...SEO_PAGE_KEYS.map((page) => (
    <Route key={`en-${page}`} path={seoPagePath(page, "en")}>
      <MarketingPage lang="en" page={page} />
    </Route>
  )),
  <Route key="blog-en" path="/blog/:slug?">
    {(params: { slug?: string }) => <BlogRoute lang="en" slug={params.slug} />}
  </Route>,
  // Blog routes for localized languages MUST come before the generic
  // "/{lang}/:slug?" catch-all below — otherwise a bare "/it/blog" (no
  // article) would match the catch-all first (slug="blog") and 404 via
  // seoPageFromSlug instead of reaching BlogRoute.
  ...LOCALIZED_LANGS.map((lang) => (
    <Route key={`blog-${lang}`} path={`/${lang}/blog/:slug?`}>
      {(params: { slug?: string }) => <BlogRoute lang={lang} slug={params.slug} />}
    </Route>
  )),
  ...LOCALIZED_LANGS.map((lang) => (
    <Route key={`loc-${lang}`} path={`/${lang}/:slug?`}>
      {(params: { slug?: string }) => (
        <LocalizedMarketingRoute lang={lang} slug={params.slug} />
      )}
    </Route>
  )),
];
```

- [ ] **Step 4: Typecheck**

Run (from `artifacts/trader-dashboard`): `npx tsc -p tsconfig.json --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/App.tsx
git commit -m "feat(blog): wire /blog and /{lang}/blog routes"
```

---

### Task 11: Library cross-link additions

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Library.tsx`

**Interfaces:**
- Consumes: `fetchBlogPosts` (Task 6), dict key `library.blogLink` (Task 7).

- [ ] **Step 1: Read the `?open=<id>` query param and auto-open the viewer**

In `artifacts/trader-dashboard/src/pages/Library.tsx`, add to the imports (near the top, alongside the other `wouter`-adjacent imports — this file currently has none, so add a new line):

```ts
import { useSearch } from "wouter";
```

In the `Library()` component, after the existing `const [viewing, setViewing] = useState<Content | null>(null);` line, add:

```ts
  const search = useSearch();
  useEffect(() => {
    const openId = new URLSearchParams(search).get("open");
    if (!openId) return;
    const match = contents.find((c) => c.id === Number(openId));
    if (match) setViewing(match);
  }, [search, contents]);
```

Add `useEffect` to the existing `import { useState } from "react";` line at the top of the file, changing it to:

```ts
import { useEffect, useState } from "react";
```

- [ ] **Step 2: Fetch the public blog list and build a reciprocal-link map**

In the `Library()` component, after the existing `contents` query, add:

```ts
  const { data: blogPosts = [] } = useQuery({
    queryKey: ["blog", "posts", "it"],
    queryFn: () => fetchBlogPosts("it"),
  });
  const blogSlugByLibraryContentId = new Map(
    blogPosts.filter((p) => p.relatedLibraryContentId != null).map((p) => [p.relatedLibraryContentId as number, p.slug]),
  );
```

Add the import near the top of the file (alongside the other `@/lib/*` imports):

```ts
import { fetchBlogPosts } from "@/lib/blogApi";
import { useLanguage } from "@/contexts/LanguageContext";
```

*(`useLanguage` may already be unused in this file — check before adding a duplicate import; it's needed here for `t("library.blogLink")` inside `ContentCard`.)*

- [ ] **Step 3: Show the link on a matching `ContentCard`**

Change the `ContentCard` function signature from:

```tsx
function ContentCard({ item, locked, isAdmin, onOpen, onEdit, onDelete }: {
  item: Content; locked: boolean; isAdmin: boolean;
  onOpen: () => void; onEdit: () => void; onDelete: () => void;
}) {
```

to:

```tsx
function ContentCard({ item, locked, isAdmin, blogSlug, onOpen, onEdit, onDelete }: {
  item: Content; locked: boolean; isAdmin: boolean; blogSlug?: string;
  onOpen: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const { t } = useLanguage();
```

and add, right before the closing `</motion.div>` of `ContentCard`:

```tsx
      {blogSlug && (
        <a href={`/it/blog/${blogSlug}`} className="text-xs text-primary hover:underline mt-1">
          {t("library.blogLink")} →
        </a>
      )}
```

Update the two call sites inside `Library()`'s render (`byLevel.get(level)!.map(...)`) to pass the new prop:

```tsx
              <ContentCard key={item.id} item={item} isAdmin={isAdmin}
                locked={item.requiredLevel > userLevel && !isAdmin}
                blogSlug={blogSlugByLibraryContentId.get(item.id)}
                onOpen={() => setViewing(item)} onEdit={() => setEditContent(item)} onDelete={() => delContent.mutate(item.id)} />
```

- [ ] **Step 4: Typecheck**

Run (from `artifacts/trader-dashboard`): `npx tsc -p tsconfig.json --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/pages/Library.tsx
git commit -m "feat(blog): cross-link Library <-> blog (?open=<id> + reciprocal article link)"
```

---

### Task 12: `scripts/blogPaths.ts` — DB fetch + pure helpers

**Files:**
- Create: `artifacts/trader-dashboard/scripts/blogPaths.ts`
- Create: `artifacts/trader-dashboard/scripts/blogPaths.test.ts`

**Interfaces:**
- Produces: `PublishedBlogPost` type, `fetchPublishedBlogData(): Promise<PublishedBlogPost[]>`, `allBlogPaths(posts: PublishedBlogPost[]): string[]`, `respondToBlogApiRequest(posts, method, pathname, lang): { status: number; body: unknown } | null` — consumed by Task 13.

Only the pure functions (`allBlogPaths`, `respondToBlogApiRequest`) get unit tests — `fetchPublishedBlogData` touches the DB and, like every other DB-facing script in this repo (`build-sitemap.ts`, `prerender.ts` themselves), is verified manually (Task 14), not unit-tested.

- [ ] **Step 1: Write the failing tests**

Create `artifacts/trader-dashboard/scripts/blogPaths.test.ts`:

```ts
import assert from "node:assert/strict";
import { allBlogPaths, respondToBlogApiRequest, type PublishedBlogPost } from "./blogPaths.ts";

const posts: PublishedBlogPost[] = [
  {
    id: 1,
    slug: "risk-management-basics",
    relatedLibraryContentId: 7,
    orderIndex: 0,
    translations: [
      { lang: "it", title: "Gestione del rischio", metaDescription: "Le basi", bodyMarkdown: "# Ciao" },
      { lang: "en", title: "Risk management basics", metaDescription: "The basics", bodyMarkdown: "# Hello" },
    ],
  },
];

// ─── allBlogPaths ────────────────────────────────────────────────────────────
{
  const paths = allBlogPaths(posts);
  // 5 index paths + 2 article paths (only the 2 published languages, not all 5)
  assert.equal(paths.length, 7);
  assert.ok(paths.includes("/blog"), "english index");
  assert.ok(paths.includes("/it/blog"), "italian index");
  assert.ok(paths.includes("/blog/risk-management-basics"), "english article");
  assert.ok(paths.includes("/it/blog/risk-management-basics"), "italian article");
  assert.ok(!paths.includes("/es/blog/risk-management-basics"), "no spanish translation exists, so no spanish article path");
}

assert.deepEqual(allBlogPaths([]), ["/blog", "/it/blog", "/es/blog", "/fr/blog", "/de/blog"], "index paths always present, even with zero posts");

// ─── respondToBlogApiRequest ────────────────────────────────────────────────
{
  const list = respondToBlogApiRequest(posts, "GET", "/api/blog/posts", "it");
  assert.equal(list?.status, 200);
  assert.deepEqual(list?.body, [
    { id: 1, slug: "risk-management-basics", relatedLibraryContentId: 7, orderIndex: 0, title: "Gestione del rischio", metaDescription: "Le basi" },
  ]);
}
{
  const list = respondToBlogApiRequest(posts, "GET", "/api/blog/posts", "fr");
  assert.deepEqual(list?.body, [], "no french translation -> empty list, not an error");
}
{
  const item = respondToBlogApiRequest(posts, "GET", "/api/blog/posts/risk-management-basics", "en");
  assert.equal(item?.status, 200);
  assert.equal((item?.body as { title: string }).title, "Risk management basics");
}
{
  const missing = respondToBlogApiRequest(posts, "GET", "/api/blog/posts/does-not-exist", "en");
  assert.equal(missing?.status, 404);
}
{
  const wrongLang = respondToBlogApiRequest(posts, "GET", "/api/blog/posts/risk-management-basics", "de");
  assert.equal(wrongLang?.status, 404, "post exists but has no german translation");
}
assert.equal(respondToBlogApiRequest(posts, "GET", "/api/journal/entries", "en"), null, "non-blog path returns null so the caller falls through to static file serving");
assert.equal(respondToBlogApiRequest(posts, "POST", "/api/blog/posts", "en"), null, "only GET is served locally during prerender");

console.log("blogPaths tests passed");
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `artifacts/trader-dashboard`): `npx tsx scripts/blogPaths.test.ts`
Expected: fails — `./blogPaths.ts` doesn't exist.

- [ ] **Step 3: Write the implementation**

Create `artifacts/trader-dashboard/scripts/blogPaths.ts`:

```ts
/**
 * Shared blog data-access for the build-time scripts (build-sitemap.ts,
 * prerender.ts). Fetching is isolated here (and gracefully degrades to an
 * empty list without DATABASE_URL) so both scripts can stay simple; the path
 * and mock-response logic below is pure and unit-tested without needing a DB.
 */
import { SUPPORTED_LANGUAGES, type Language } from "../src/lib/i18n.ts";
import { blogIndexPath, blogPostPath } from "../src/lib/seo.ts";

export interface PublishedBlogTranslation {
  lang: string;
  title: string;
  metaDescription: string;
  bodyMarkdown: string;
}

export interface PublishedBlogPost {
  id: number;
  slug: string;
  relatedLibraryContentId: number | null;
  orderIndex: number;
  translations: PublishedBlogTranslation[];
}

/** Fetches every post that has at least one published translation, straight from Postgres. */
export async function fetchPublishedBlogData(): Promise<PublishedBlogPost[]> {
  if (!process.env.DATABASE_URL) {
    console.warn("blogPaths: DATABASE_URL not set, skipping blog paths/content");
    return [];
  }
  try {
    const { db, blogPostsTable, blogPostTranslationsTable } = await import("@workspace/db");
    const { eq, asc } = await import("drizzle-orm");

    const rows = await db
      .select({
        id: blogPostsTable.id,
        slug: blogPostsTable.slug,
        relatedLibraryContentId: blogPostsTable.relatedLibraryContentId,
        orderIndex: blogPostsTable.orderIndex,
        lang: blogPostTranslationsTable.lang,
        title: blogPostTranslationsTable.title,
        metaDescription: blogPostTranslationsTable.metaDescription,
        bodyMarkdown: blogPostTranslationsTable.bodyMarkdown,
      })
      .from(blogPostsTable)
      .innerJoin(blogPostTranslationsTable, eq(blogPostTranslationsTable.postId, blogPostsTable.id))
      .where(eq(blogPostTranslationsTable.published, true))
      .orderBy(asc(blogPostsTable.orderIndex));

    const byId = new Map<number, PublishedBlogPost>();
    for (const row of rows) {
      if (!byId.has(row.id)) {
        byId.set(row.id, {
          id: row.id,
          slug: row.slug,
          relatedLibraryContentId: row.relatedLibraryContentId,
          orderIndex: row.orderIndex,
          translations: [],
        });
      }
      byId.get(row.id)!.translations.push({
        lang: row.lang,
        title: row.title,
        metaDescription: row.metaDescription,
        bodyMarkdown: row.bodyMarkdown,
      });
    }
    return [...byId.values()];
  } catch (err) {
    console.warn(`blogPaths: failed to fetch blog data — ${(err as Error).message}`);
    return [];
  }
}

/** Every public blog URL: the 5 language index pages + one per published translation. */
export function allBlogPaths(posts: PublishedBlogPost[]): string[] {
  const paths: string[] = SUPPORTED_LANGUAGES.map((lang) => blogIndexPath(lang));
  for (const post of posts) {
    for (const t of post.translations) {
      if ((SUPPORTED_LANGUAGES as readonly string[]).includes(t.lang)) {
        paths.push(blogPostPath(post.slug, t.lang as Language));
      }
    }
  }
  return paths;
}

/**
 * Answers a `/api/blog/*` GET request from already-fetched data, matching
 * routes/blog.ts's response shape exactly. Returns null for anything else
 * (the caller falls through to normal static file serving).
 */
export function respondToBlogApiRequest(
  posts: PublishedBlogPost[],
  method: string,
  pathname: string,
  lang: string,
): { status: number; body: unknown } | null {
  if (method !== "GET") return null;

  if (pathname === "/api/blog/posts") {
    const body = posts
      .filter((p) => p.translations.some((t) => t.lang === lang))
      .map((p) => {
        const t = p.translations.find((tr) => tr.lang === lang)!;
        return {
          id: p.id,
          slug: p.slug,
          relatedLibraryContentId: p.relatedLibraryContentId,
          orderIndex: p.orderIndex,
          title: t.title,
          metaDescription: t.metaDescription,
        };
      });
    return { status: 200, body };
  }

  const itemMatch = pathname.match(/^\/api\/blog\/posts\/([^/]+)$/);
  if (itemMatch) {
    const post = posts.find((p) => p.slug === itemMatch[1]);
    const translation = post?.translations.find((t) => t.lang === lang);
    if (!post || !translation) return { status: 404, body: { error: "Articolo non trovato" } };
    return {
      status: 200,
      body: {
        id: post.id,
        slug: post.slug,
        relatedLibraryContentId: post.relatedLibraryContentId,
        title: translation.title,
        metaDescription: translation.metaDescription,
        bodyMarkdown: translation.bodyMarkdown,
        lang: translation.lang,
      },
    };
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx scripts/blogPaths.test.ts`
Expected: prints `blogPaths tests passed`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/scripts/blogPaths.ts artifacts/trader-dashboard/scripts/blogPaths.test.ts
git commit -m "feat(blog): add build-time blog data fetch + pure path/mock-response helpers"
```

---

### Task 13: Wire blog paths into sitemap + prerender

**Files:**
- Modify: `artifacts/trader-dashboard/scripts/build-sitemap.ts`
- Modify: `artifacts/trader-dashboard/scripts/prerender.ts`

**Interfaces:**
- Consumes: `fetchPublishedBlogData`, `allBlogPaths`, `respondToBlogApiRequest`, `PublishedBlogPost` (Task 12); `blogIndexPath`, `blogPostPath`, `blogPostAlternates` (Task 5).

- [ ] **Step 1: Extend `build-sitemap.ts`**

In `artifacts/trader-dashboard/scripts/build-sitemap.ts`, add to the imports:

```ts
import { blogIndexPath, blogPostPath, blogPostAlternates } from "../src/lib/seo.ts";
import { fetchPublishedBlogData, type PublishedBlogPost } from "./blogPaths.ts";
```

Add a new function after `buildEntries()`:

```ts
function buildBlogEntries(posts: PublishedBlogPost[]): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  for (const lang of SUPPORTED_LANGUAGES) {
    entries.push({ loc: absoluteUrl(blogIndexPath(lang)), changefreq: "weekly", priority: "0.6" });
  }
  for (const post of posts) {
    const langs = post.translations.map((t) => t.lang).filter((l) => (SUPPORTED_LANGUAGES as readonly string[]).includes(l)) as typeof SUPPORTED_LANGUAGES[number][];
    const alternates = blogPostAlternates(post.slug, langs);
    for (const lang of langs) {
      entries.push({ loc: absoluteUrl(blogPostPath(post.slug, lang)), changefreq: "monthly", priority: "0.7", alternates });
    }
  }
  return entries;
}
```

Change the bottom of the file from:

```ts
const xml = renderSitemap(buildEntries());

const targets = [
```

to:

```ts
const blogPosts = await fetchPublishedBlogData();
const xml = renderSitemap([...buildEntries(), ...buildBlogEntries(blogPosts)]);

const targets = [
```

*(This file has no wrapping `async function main()` today — it's top-level `await`-able since it's an ES module run via `tsx`, which supports top-level await. No other restructuring needed.)*

- [ ] **Step 2: Verify the sitemap script still runs**

Run (from `artifacts/trader-dashboard`, without `DATABASE_URL` set, to confirm the graceful-degrade path): `npx tsx scripts/build-sitemap.ts`
Expected: prints a `blogPaths: DATABASE_URL not set...` warning, then `sitemap: wrote .../public/sitemap.xml` as before — exit 0, no blog URLs added (none exist yet regardless).

- [ ] **Step 3: Extend `prerender.ts`**

In `artifacts/trader-dashboard/scripts/prerender.ts`, add to the imports:

```ts
import { fetchPublishedBlogData, allBlogPaths, respondToBlogApiRequest } from "./blogPaths.ts";
```

Change the request-serving setup from:

```ts
  const serveStatic = sirv(distDir, { single: true, dev: false });
  const server = createServer((req, res) =>
    serveStatic(req, res, () => {
      res.statusCode = 404;
      res.end("not found");
    }),
  );
```

to:

```ts
  const publishedBlogPosts = await fetchPublishedBlogData();

  const serveStatic = sirv(distDir, { single: true, dev: false });
  const server = createServer((req, res) => {
    if (req.url?.startsWith("/api/blog/")) {
      const url = new URL(req.url, "http://localhost");
      const lang = url.searchParams.get("lang") ?? "en";
      const apiResult = respondToBlogApiRequest(publishedBlogPosts, req.method ?? "GET", url.pathname, lang);
      if (apiResult) {
        res.statusCode = apiResult.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(apiResult.body));
        return;
      }
    }
    serveStatic(req, res, () => {
      res.statusCode = 404;
      res.end("not found");
    });
  });
```

Change the path list from:

```ts
    const paths = Array.from(new Set(allMarketingPaths()));
```

to:

```ts
    const paths = Array.from(new Set([...allMarketingPaths(), ...allBlogPaths(publishedBlogPosts)]));
```

- [ ] **Step 4: Typecheck**

Run (from `artifacts/trader-dashboard`): `npx tsc -p tsconfig.json --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/scripts/build-sitemap.ts artifacts/trader-dashboard/scripts/prerender.ts
git commit -m "feat(blog): merge blog paths into sitemap + serve /api/blog/* from local data during prerender"
```

---

### Task 14: Manual end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Seed one test post directly via SQL** (fastest path — the admin UI works too, but SQL is quicker for a one-off local check)

Run against your local Postgres:

```sql
insert into blog_posts (slug, order_index) values ('test-post', 0) returning id;
-- note the returned id, then:
insert into blog_post_translations (post_id, lang, title, meta_description, body_markdown, published)
values (<id>, 'it', 'Articolo di prova', 'Descrizione di prova', 'Corpo di prova.', true);
```

- [ ] **Step 2: Confirm the API serves it**

With the local dev API running (per `README-BRAIN.md`), run:
`curl -s "http://localhost:3001/api/blog/posts?lang=it"`
Expected: a JSON array containing the `test-post` entry.

- [ ] **Step 3: Full build + prerender with a real DB**

From `artifacts/trader-dashboard`, with `DATABASE_URL` and `VITE_CLERK_PUBLISHABLE_KEY` set: `pnpm run build`
Expected: `sitemap: wrote ...` includes `/it/blog/test-post`, then `prerender: wrote N/N routes` where N now includes the 5 blog index paths + `/it/blog/test-post` (the only published-language path for this test post), with 0 failures.

- [ ] **Step 4: Inspect the prerendered output**

Run: `grep -c "Articolo di prova" dist/public/it/blog/test-post/index.html`
Expected: `1` (the real content is baked into the static snapshot, not just an SPA shell).

- [ ] **Step 5: Clean up the test post and local build artifact**

```sql
delete from blog_post_translations where post_id = <id>;
delete from blog_posts where id = <id>;
```
```bash
rm -rf dist
```

- [ ] **Step 6: Run the full gate**

Run (from repo root): `pnpm verify`
Expected: all tests pass (including the new `blogLogic.test.ts`, `seo.test.ts` additions, `blogPaths.test.ts`), typecheck clean, build succeeds (with `VITE_CLERK_PUBLISHABLE_KEY` + `DATABASE_URL` set for the build step).

---

## Self-Review

**Spec coverage:**
- Separate `blog_posts`/`blog_post_translations` tables, kept apart from `library_contents` → Task 1. ✓
- `/blog` + `/{lang}/blog` URL scheme, same slug across languages → Tasks 5, 10. ✓
- All 5 languages, per-language independent publish state → Tasks 1, 4, 7. ✓
- Admin authoring reusing the Library `ContentForm` pattern (not a new `/admin/*` route) → Task 8. ✓
- Reuse of `PLATFORM_ADMIN_IDS`/`isPlatformAdmin` → Task 2, 4. ✓
- Blog → Library CTA via `relatedLibraryContentId` + `?open=<id>` → Tasks 9, 11. ✓
- Library → blog reciprocal link, derived from the already-fetched public list (no new column) → Task 11. ✓
- Sitemap/prerender dynamic discovery, graceful DB-absent degrade (not a hard failure) → Tasks 12, 13. ✓
- Off-contract API, hand-written types → Tasks 4, 6. ✓
- i18n chrome-only (content is data) → Task 7 (chrome), Tasks 8/9 consume it; article body is plain user data through `t()`-free JSX text interpolation (`{post.bodyMarkdown}`), correctly NOT subject to the static literal-scan since it's a variable, not a string literal.

**Elaboration beyond the spec (not a contradiction, a necessary implementation detail the spec didn't resolve):** the spec said prerender/sitemap "query blog_posts directly via `@workspace/db`" for path discovery, but didn't address that the prerendered *pages themselves* need real data during headless rendering, and `prerender.ts`'s tiny local server has no live backend. Task 13 resolves this by having that same server answer `/api/blog/*` requests directly from the data already fetched for path discovery (Task 12) — no new backend process spawned (which would risk cron/WebSocket side effects from booting the real `api-server`), and the existing Phase-1 hard-fail validation on captured snapshots applies unchanged.

**Placeholder scan:** no TBD/TODO; every step has literal file paths, full code, and exact commands with expected output. The one explicit scope note (Task 8's deferred edit-in-place) is a real, bounded decision, not a vague placeholder — create+delete is sufficient to unblock Phase 2b content seeding.

**Type consistency:** `BlogPostSummary`/`BlogPostDetail` (Task 6) match the JSON shapes returned by `routes/blog.ts` (Task 4) and by `respondToBlogApiRequest` (Task 12) field-for-field (`id`, `slug`, `relatedLibraryContentId`, `orderIndex`, `title`, `metaDescription` for the list; add `bodyMarkdown`/`lang` for the single-post shape). `resolvePublishedTranslation`/`buildBlogPostUpsert` (Task 3) signatures match their call sites in `routes/blog.ts` (Task 4) exactly. `PublishedBlogPost`/`PublishedBlogTranslation` (Task 12) are used identically by `build-sitemap.ts` and `prerender.ts` (Task 13).

**Task order:** 1 → 2 → 3 → 4 (schema → shared auth → pure logic → routes) is a strict dependency chain. 5, 6, 7 are independent of each other and of 8+ inputs beyond what they produce. 8 and 9 depend on 5, 6, 7. 10 depends on 8, 9. 11 depends on 6, 7 only (not on 8/9/10). 12 depends on 5 (path helpers). 13 depends on 12. 14 depends on everything. Recommended execution order matches the numbering.
