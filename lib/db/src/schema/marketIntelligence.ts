import { pgTable, text, timestamp, jsonb, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { journalEntriesTable } from "./journal";

// Evidence and decisions are append-only. The old news snapshot remains a cache.
export const newsDocumentsTable = pgTable("news_documents", {
  id: text("id").primaryKey(), articleId: text("article_id").notNull(), eventId: text("event_id").notNull(),
  source: text("source").notNull(), publishedAt: timestamp("published_at", { withTimezone: true }),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
  evidenceText: text("evidence_text").notNull(), payload: jsonb("payload").notNull(),
}, t => [index("news_documents_event_time_idx").on(t.eventId, t.firstSeenAt)]);

export const newsCorpusRunsTable = pgTable("news_corpus_runs", {
  id: text("id").primaryKey(), availableAt: timestamp("available_at", {withTimezone:true}).notNull(),
  complete: text("complete").notNull(), payload: jsonb("payload").notNull(),
}, t => [index("news_corpus_runs_time_idx").on(t.availableAt)]);

export const marketObservationsTable = pgTable("market_observations", {
  id: text("id").primaryKey(), pair: text("pair").notNull(), source: text("source").notNull(),
  closeAt: timestamp("close_at", { withTimezone: true }).notNull(),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull(), payload: jsonb("payload").notNull(),
}, t => [index("market_observations_pair_time_idx").on(t.pair, t.closeAt)]);

export const marketSnapshotsTable = pgTable("market_snapshots", {
  id: text("id").primaryKey(), pair: text("pair").notNull(), kind: text("kind").notNull(),
  cutoffAt: timestamp("cutoff_at", { withTimezone: true }).notNull(),
  targetEnd: timestamp("target_end", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, precision:3 }).notNull().defaultNow(),
  payload: jsonb("payload").notNull(),
}, t => [index("market_snapshots_pair_time_idx").on(t.pair, t.cutoffAt)]);

export const marketOutcomesTable = pgTable("market_outcomes", {
  snapshotId: text("snapshot_id").primaryKey().references(() => marketSnapshotsTable.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }).notNull(),
  payload: jsonb("payload").notNull(),
});

export const marketDecisionsTable = pgTable("market_decisions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(),
  snapshotId: text("snapshot_id").notNull().references(() => marketSnapshotsTable.id),
  choice: text("choice").notNull(), note: text("note").notNull().default(""),
  journalEntryId: integer("journal_entry_id").references(()=>journalEntriesTable.id,{onDelete:"set null"}),
  createdAt: timestamp("created_at", { withTimezone: true, precision:3 }).notNull().defaultNow(),
}, t => [index("market_decisions_user_time_idx").on(t.userId, t.createdAt),
  uniqueIndex("market_decisions_retry_idx").on(t.userId, t.snapshotId, t.choice)]);
