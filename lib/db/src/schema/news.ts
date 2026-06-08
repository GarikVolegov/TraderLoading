import { jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
