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
