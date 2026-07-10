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
