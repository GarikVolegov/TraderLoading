import { index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// Precomputed news feed snapshot, shared across serverless invocations.
// `/api/news` reads the latest snapshot for a given cacheKey instead of running
// the heavy RSS + translation + LLM pipeline inline (which timed out on Vercel).
// Refreshed lazily (stale-while-revalidate) by the request itself.
export const newsSnapshotsTable = pgTable(
  "news_snapshots",
  {
    id: serial("id").primaryKey(),
    // `${currencies}:${lang}` e.g. "all:it" or "USD,XAU:en"
    cacheKey: text("cache_key").notNull(),
    // Full NewsResponse (corpus of up to ~80 articles + metadata).
    payload: jsonb("payload").notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("news_snapshots_cache_key_idx").on(t.cacheKey)],
);

export type NewsSnapshotRow = typeof newsSnapshotsTable.$inferSelect;

// ─── Per-user feed personalization ("train the feed with my info") ────────────
// Re-ranking inputs stored per user; applied on top of the shared corpus.
export const newsPreferencesTable = pgTable(
  "news_preferences",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    keywords: text("keywords").notNull().default("[]"), // JSON array of strings
    profile: text("profile").notNull().default(""),     // free-text trading style/strategy
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("news_preferences_user_idx").on(t.userId)],
);

export const newsFeedbackTable = pgTable(
  "news_feedback",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    articleKey: text("article_key").notNull(), // url:<url> or title:<slug>
    source: text("source").notNull().default(""),
    vote: integer("vote").notNull().default(0), // 1 (👍) or -1 (👎)
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("news_feedback_user_article_idx").on(t.userId, t.articleKey),
    index("news_feedback_user_idx").on(t.userId),
  ],
);

export type NewsPreferencesRow = typeof newsPreferencesTable.$inferSelect;
export type NewsFeedbackRow = typeof newsFeedbackTable.$inferSelect;
