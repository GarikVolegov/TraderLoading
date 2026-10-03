# Public Blog + Library Cross-Link (Phase 2a — engine)

## Context

Phase 1 (`docs/superpowers/specs/2026-07-10-seo-geo-technical-hardening-design.md`)
hardened the existing SEO/GEO machinery (prerendering, static serving,
`robots.txt`) but didn't add content depth. `docs/seo/keyword-strategy.md`
already flags a real blog as the natural next step for long-tail/GEO
coverage — the 8 existing marketing pages (`trading-journal`, `backtest`,
`macro-news`, `risk-tools`, `pricing`, `guide`, `about`, `contact`) are
single feature-overview pages, not the deep how-to content LLMs cite when
someone asks "how do I start trading."

The user asked for the blog to be "connected to the app's Library" — the
existing in-app **Library** (`routes/library.ts`, `lib/db/src/schema/library.ts`)
is an admin-curated, XP-level-gated educational content feed
(`library_collections` / `library_contents`, types `document`/`mindmap`/`video`,
`bodyMarkdown` field already present), reachable only at the authenticated
`/library` route, currently empty (no seed data), with no public route and
no per-item deep link (stable numeric IDs only).

**Scope decomposition:** building the blog *engine* (schema, admin authoring,
public routes, sitemap/prerender integration, cross-linking) is ordinary
TDD-able engineering. Writing the actual 3-5 pillar articles in 5 languages
is editorial content work, different in kind. This spec covers **Phase 2a:
the engine only** — it ships fully functional with zero or one test post.
Phase 2b (writing the real articles) is a separate follow-up, not blocked by
anything in this spec.

## Decisions (locked)

| Aspect | Decision |
|---|---|
| Data model | Two new tables: `blog_posts` (language-neutral) + `blog_post_translations` (one row per post × language). Kept **separate from `library_contents`** — mixing public crawlable content with XP-gated in-app content in one table risks a gating bug leaking paid/gated Library content publicly. |
| URL scheme | `/blog` (index) + `/blog/:slug` (article) in English at root; `/{lang}/blog` + `/{lang}/blog/:slug` for it/es/fr/de — same convention as the existing marketing pages. **Same slug across all 5 languages** (language-neutral, admin picks it once) — avoids inventing 5 translated slugs per post like the static `SEO_SLUGS` table does. |
| Languages | All 5 (en/it/es/fr/de) from the start, one `blog_post_translations` row each. A post can be `published` per-language independently (a translation missing/unpublished falls back to 404 for that language, not a broken page). |
| Authoring | New admin-only inline panel on the `/blog` page (same pattern as Library's admin `ContentForm`, shown only to `isPlatformAdmin` users) — not a new `/admin/*` route. |
| Admin gating | Reuse the exact `PLATFORM_ADMIN_IDS` env-allowlist pattern from `routes/library.ts` (`isPlatformAdmin`/`requireAdmin`). |
| Cross-link: blog → Library | A post can set `relatedLibraryContentId` (nullable FK to `library_contents.id`). Rendered as a CTA card at the end of the article, linking to `/library?open=<id>` — a small addition to `Library.tsx` auto-opens that item's existing `ContentViewer` dialog on load. |
| Cross-link: Library → blog | Reciprocal — no new column needed. The Library page already fetches the public post list to build the CTA; it derives a `libraryContentId → slug` map client-side from that same response and shows a "Read the full article" link on any matching item. |
| Sitemap / prerendering | `scripts/build-sitemap.ts` and `scripts/prerender.ts` (already tsx build steps) query `blog_posts`/`blog_post_translations` directly via `@workspace/db` (same package `api-server` uses) to discover published slugs at build time. If `DATABASE_URL` is unset, blog paths are skipped with a warning — **not** a hard failure (unlike Phase 1's static-page validation, which must never silently degrade; blog content is additive, and a dev machine without a DB is a normal case). |
| Public API | Off-contract (`apiJSON`, not in `openapi.yaml`) — same precedent as `tornei`/journal recaps: `GET /api/blog/posts?lang=xx` (published list), `GET /api/blog/posts/:slug?lang=xx` (one post + translation). |
| i18n | Page **chrome** (buttons, "Read more", "Published on", empty states) goes through `t()` with dict keys in all 5 languages, enforced by the existing `production-copy.static.test.ts`. Article **content** (title/body) is admin-authored DB data, not source code — not subject to that static check. |
| Migration | `lib/db/drizzle/0035_blog.sql` (next after `0034_drop_credit_wallet.sql`). |

## Components

### 1. Database schema — `lib/db/src/schema/blog.ts`

```ts
export const blogPostsTable = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
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
    lang: text("lang").notNull(), // "en" | "it" | "es" | "fr" | "de"
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
```

Exported from `lib/db/src/schema/index.ts` (`export * from "./blog";`), same
pattern as every other schema file.

Migration `lib/db/drizzle/0035_blog.sql` — hand-authored (per
`docs/superpowers/...migrations-hand-authored` convention), creates both
tables + the two indexes, `--> statement-breakpoint`-separated.

### 2. Backend — `artifacts/api-server/src/routes/blog.ts`

Mirrors `routes/library.ts`'s structure exactly (same `isPlatformAdmin`
helper duplicated or extracted — extract to `lib/security.ts` or a shared
`lib/platformAdmin.ts` since it'll now be used in two route files; DRY over
copy-paste for a security check specifically):

- `GET /blog/admin/status` — `{ isAdmin: boolean }`, same as Library's.
- `GET /blog/posts?lang=xx` — published posts for `lang`, joined
  `blog_posts` + `blog_post_translations`, ordered by `orderIndex`; admins
  also see unpublished. Response includes `relatedLibraryContentId` per post
  (needed for the reciprocal Library→blog link, see Components §5).
- `GET /blog/posts/:slug?lang=xx` — single post; 404 if no published
  translation for that `lang` (admins bypass the published check).
- `POST /blog/posts` (admin) — creates `blog_posts` row + one
  `blog_post_translations` row per submitted language.
- `PATCH /blog/posts/:id` (admin) — updates `relatedLibraryContentId`/
  `orderIndex` and any submitted translation rows (upsert per language).
- `DELETE /blog/posts/:id` (admin) — cascades to translations.

Mounted in `routes/index.ts` (`import blogRouter from "./blog.js"` +
`router.use(blogRouter)`), same as `library.ts`.

### 3. Frontend public pages

- `artifacts/trader-dashboard/src/pages/blog/BlogIndexPage.tsx` — list of
  published posts for the current language (title + meta description +
  link), plus the admin-only inline authoring panel (new-post form, edit
  existing, publish/unpublish per language) when `/blog/admin/status`
  reports `isAdmin: true` — same conditional-admin-UI pattern as
  `Library.tsx`.
- `artifacts/trader-dashboard/src/pages/blog/BlogArticlePage.tsx` — renders
  one post's markdown body, `<Seo>` head tags (title/description/canonical/
  hreflang across all 5 languages sharing the same slug, `Article`/
  `BlogPosting` JSON-LD via a new `articleJsonLd()` helper in `lib/seo.ts`,
  following the existing `faqJsonLd`/`breadcrumbJsonLd` pattern), and — if
  `relatedLibraryContentId` is set — the "Approfondisci nella Libreria" CTA
  card linking to `/library?open=<id>`.
- Wired into `App.tsx` next to the existing `marketingRoutes` array: a
  `/blog/:slug?` route (English) + `/{lang}/blog/:slug?` per language,
  resolving via the new `GET /blog/posts[/:slug]` endpoint instead of the
  static `seoPageFromSlug` lookup (since content is DB-driven, not compile-time
  known) — renders `BlogIndexPage` when `:slug` is absent, `BlogArticlePage`
  otherwise, `NotFound` on a 404 from the API.

### 4. Library cross-link additions

- `artifacts/trader-dashboard/src/pages/Library.tsx`: read `?open=<id>` from
  the URL (`useSearch` from `wouter`) in a `useEffect` once `contents` has
  loaded; if a matching item exists, call the existing `setViewing(item)` —
  no new dialog/component, reuses `ContentViewer` as-is.
- Same file: fetch `GET /blog/posts?lang=<current>` (public, no auth
  needed) alongside the existing content fetch; build a
  `Map<libraryContentId, slug>` from the response; when rendering a content
  row/card whose `id` is a key in that map, show a small "Leggi l'articolo
  completo" link to `/blog/<slug>` (or the localized equivalent).

### 5. Sitemap / prerender dynamic path discovery

- New `artifacts/trader-dashboard/scripts/blogPaths.ts`: exports
  `async function allBlogPaths(): Promise<string[]>` — if
  `process.env.DATABASE_URL` is unset, returns `[]` with a `console.warn`;
  otherwise queries `@workspace/db` for published translations and returns
  `/blog/<slug>` + `/{lang}/blog/<slug>` for each.
- `scripts/build-sitemap.ts` and `scripts/prerender.ts` both call
  `await allBlogPaths()` and merge the result into their existing path list
  (`allMarketingPaths()` stays purely static/sync; the blog paths are
  appended separately so a DB failure can't affect the static pages' hard-fail
  guarantee from Phase 1).

## Testing

- **Pure logic**: a `lib/seo.ts` addition (`articleJsonLd`) gets a unit test
  alongside the existing `faqJsonLd`/`breadcrumbJsonLd` tests.
- **Backend**: `routes/library.ts` itself has **no route-level test file** —
  this codebase's convention for admin-CRUD-style routes is to extract the
  non-trivial logic into pure, unit-tested functions and leave the thin
  Express glue (auth check, `db` call, `res.json`) unverified by automated
  tests, relying on manual/e2e checks instead (same as `tornei`/journal
  recaps). Phase 2a follows the same shape: pure helpers —
  `resolvePublishedTranslation(translations, lang, isAdmin)` (which
  translation, if any, a given request is allowed to see) and
  `buildBlogPostUpsert(input)` (validates/shapes a create-or-update payload)
  — get `routes/blogLogic.test.ts`; `routes/blog.ts` itself calls them and
  stays thin, verified manually.
- **Frontend**: static tests for the new dict keys (i18n parity, matching
  `i18n-enforced-new-ui` convention) + a `BlogIndexPage`/`BlogArticlePage`
  static test asserting the JSON-LD/canonical/hreflang markers exist, same
  style as other `*.static.test.ts` files.
- **`allBlogPaths()`**: unit-testable by pointing `DATABASE_URL` at a test
  DB or by mocking the db import — exact approach decided at plan time
  based on how other DB-touching pure functions in this repo are tested.
- **Manual verification**: after seeding one test post, rebuild locally with
  a valid `DATABASE_URL` + Clerk key and confirm `dist/public/blog/<slug>/index.html`
  is prerendered with real content (same check as Phase 1's `about` page).

## Out of scope (explicitly)

- **Phase 2b**: writing the real 3-5 pillar articles (all 5 languages) —
  separate follow-up once this engine ships.
- Full per-item public deep-linking for Library content beyond the
  `?open=<id>` query-param trick (e.g. a dedicated `/library/:id` route with
  its own SEO) — not needed for this cross-link to work, and Library items
  stay behind auth/XP-gating regardless.
- Any editorial/CMS polish beyond a plain markdown textarea (rich text
  editor, image uploads inside articles, scheduling) — matches Library's
  current authoring UX, not a regression.
- Comments, related-posts recommendations, RSS feed, author bylines.
