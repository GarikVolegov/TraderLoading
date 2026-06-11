import { integer, numeric, pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

export const WIKI_EDGE_CONFIDENCE_VALUES = ["EXTRACTED", "INFERRED", "AMBIGUOUS"] as const;

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
  extractedText: text("extracted_text").notNull().default(""),
  tags: text("tags").notNull().default("[]"),
  graphifyJson: text("graphify_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("wiki_sources_user_status_idx").on(table.userId, table.status),
  index("wiki_sources_user_created_idx").on(table.userId, table.createdAt),
]);

export const wikiChunksTable = pgTable("wiki_chunks", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  sourceId: integer("source_id").notNull().references(() => wikiSourcesTable.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  text: text("text").notNull(),
  tokenEstimate: integer("token_estimate").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("wiki_chunks_source_idx").on(table.sourceId, table.chunkIndex),
  index("wiki_chunks_user_idx").on(table.userId),
]);

export const wikiGraphNodesTable = pgTable("wiki_graph_nodes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  sourceId: integer("source_id").references(() => wikiSourcesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  label: text("label").notNull(),
  summary: text("summary").notNull().default(""),
  attrs: text("attrs"),
  weight: numeric("weight", { precision: 6, scale: 3 }).notNull().default("1"),
  communityId: integer("community_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("wiki_graph_nodes_user_label_idx").on(table.userId, table.label),
  index("wiki_graph_nodes_source_idx").on(table.sourceId),
  index("wiki_graph_nodes_user_community_idx").on(table.userId, table.communityId),
]);

export const wikiGraphEdgesTable = pgTable("wiki_graph_edges", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  sourceId: integer("source_id").references(() => wikiSourcesTable.id, { onDelete: "cascade" }),
  fromNodeId: integer("from_node_id").notNull().references(() => wikiGraphNodesTable.id, { onDelete: "cascade" }),
  toNodeId: integer("to_node_id").notNull().references(() => wikiGraphNodesTable.id, { onDelete: "cascade" }),
  relation: text("relation").notNull(),
  // confidence values: EXTRACTED | INFERRED | AMBIGUOUS
  confidence: text("confidence").notNull().default("EXTRACTED"),
  confidenceScore: numeric("confidence_score", { precision: 4, scale: 3 }).notNull().default("1"),
  weight: numeric("weight", { precision: 6, scale: 3 }).notNull().default("1"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("wiki_graph_edges_user_from_idx").on(table.userId, table.fromNodeId),
  index("wiki_graph_edges_user_to_idx").on(table.userId, table.toNodeId),
  index("wiki_graph_edges_source_idx").on(table.sourceId),
]);

export const wikiCommunitiesTable = pgTable("wiki_communities", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  label: text("label").notNull(),
  summary: text("summary").notNull().default(""),
  nodeCount: integer("node_count").notNull().default(0),
  cohesion: numeric("cohesion", { precision: 5, scale: 3 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [index("wiki_communities_user_idx").on(table.userId)]);

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

export const wikiSavedAnswersTable = pgTable("wiki_saved_answers", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  citedSources: text("cited_sources").notNull().default("[]"),
  citedNodeIds: text("cited_node_ids").notNull().default("[]"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("wiki_saved_answers_user_idx").on(table.userId, table.createdAt)]);

export type WikiSource = typeof wikiSourcesTable.$inferSelect;
export type WikiChunk = typeof wikiChunksTable.$inferSelect;
export type WikiGraphNode = typeof wikiGraphNodesTable.$inferSelect;
export type WikiGraphEdge = typeof wikiGraphEdgesTable.$inferSelect;
export type WikiCommunity = typeof wikiCommunitiesTable.$inferSelect;
export type WikiIngestJob = typeof wikiIngestJobsTable.$inferSelect;
export type WikiSavedAnswer = typeof wikiSavedAnswersTable.$inferSelect;
