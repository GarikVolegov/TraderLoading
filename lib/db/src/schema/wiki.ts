import { integer, pgTable, serial, text, timestamp, index, type AnyPgColumn } from "drizzle-orm/pg-core";

// Hierarchical folders for organizing wiki sources (Obsidian-style "vault"
// folders). `parentId` is a self-FK; deleting a folder re-homes its sources to
// the root (folderId -> null) instead of cascade-deleting the user's documents.
export const wikiFoldersTable = pgTable("wiki_folders", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  parentId: integer("parent_id").references((): AnyPgColumn => wikiFoldersTable.id, { onDelete: "set null" }),
  color: text("color"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [index("wiki_folders_user_parent_idx").on(table.userId, table.parentId)]);

export const wikiSourcesTable = pgTable("wiki_sources", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("queued"),
  error: text("error"),
  originalUrl: text("original_url"),
  storageProvider: text("storage_provider"),
  storageKey: text("storage_key"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size").notNull().default(0),
  mimeType: text("mime_type"),
  folderId: integer("folder_id").references((): AnyPgColumn => wikiFoldersTable.id, { onDelete: "set null" }),
  // Plain-text extracted from the source; powers the archive's text search.
  extractedText: text("extracted_text").notNull().default(""),
  tags: text("tags").notNull().default("[]"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("wiki_sources_user_status_idx").on(table.userId, table.status),
  index("wiki_sources_user_created_idx").on(table.userId, table.createdAt),
  index("wiki_sources_user_folder_idx").on(table.userId, table.folderId),
]);

// Tracks async text extraction for uploaded files / imported URLs so the
// archive can show per-source processing status.
export const wikiIngestJobsTable = pgTable("wiki_ingest_jobs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  sourceId: integer("source_id").notNull().references(() => wikiSourcesTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("queued"),
  stage: text("stage").notNull().default("queued"),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("wiki_ingest_jobs_user_status_idx").on(table.userId, table.status),
  index("wiki_ingest_jobs_source_idx").on(table.sourceId),
]);

export type WikiFolder = typeof wikiFoldersTable.$inferSelect;
export type WikiSource = typeof wikiSourcesTable.$inferSelect;
export type WikiIngestJob = typeof wikiIngestJobsTable.$inferSelect;
