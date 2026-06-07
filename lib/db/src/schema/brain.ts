import { boolean, integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// ─── Strategie (regole testuali che il "cervello" vision deve applicare) ────────
export const brainStrategiesTable = pgTable("brain_strategies", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  rules: text("rules").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Analisi prodotte dal cervello (on-demand o autonome) ───────────────────────
export const brainAnalysesTable = pgTable("brain_analyses", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  strategyId: integer("strategy_id").references(() => brainStrategiesTable.id, { onDelete: "set null" }),
  symbol: text("symbol").notNull(),
  interval: text("interval").notNull().default("H1"),
  mode: text("mode").notNull(), // "on_demand" | "autonomous"
  imageRef: text("image_ref"),  // path PNG relativo sotto uploads/brain/
  direction: text("direction").notNull(), // "long" | "short" | "wait"
  confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull(),
  reasoning: text("reasoning").notNull(),
  entryPrice: numeric("entry_price", { precision: 18, scale: 8 }),
  stopLoss: numeric("stop_loss", { precision: 18, scale: 8 }),
  takeProfit: numeric("take_profit", { precision: 18, scale: 8 }),
  context: text("context"),       // narrativa di contesto (struttura, bias, confluenze)
  zonesJson: text("zones_json"),  // JSON: { entryZone, stopLossZones[], takeProfitZones[] }
  rawModel: text("raw_model"),
  rawJson: text("raw_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Feedback dell'utente sulle analisi (memoria di apprendimento) ──────────────
export const brainFeedbackTable = pgTable("brain_feedback", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  analysisId: integer("analysis_id").notNull().references(() => brainAnalysesTable.id, { onDelete: "cascade" }),
  vote: text("vote").notNull(), // "up" | "down"
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Configurazione della scansione autonoma (una riga per utente) ──────────────
export const brainScanConfigTable = pgTable("brain_scan_config", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  enabled: boolean("enabled").notNull().default(false),
  pairs: text("pairs").notNull().default("[]"),        // JSON string array
  timeframes: text("timeframes").notNull().default("[\"H1\"]"), // JSON string array
  intervalMinutes: integer("interval_minutes").notNull().default(30),
  minConfidence: numeric("min_confidence", { precision: 5, scale: 2 }).notNull().default("70"),
  strategyId: integer("strategy_id").references(() => brainStrategiesTable.id, { onDelete: "set null" }),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Memoria a grafo (GraphRAG): sorgenti di conoscenza caricate dall'utente ─────
// Ogni materiale (testo libero, PDF, immagine) diventa una "sorgente"; il testo
// grezzo estratto viene poi trasformato in nodi/archi del grafo di conoscenza.
export const brainKnowledgeSourcesTable = pgTable("brain_knowledge_sources", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  strategyId: integer("strategy_id").references(() => brainStrategiesTable.id, { onDelete: "cascade" }), // null = generale
  kind: text("kind").notNull(),          // "text" | "pdf" | "image"
  title: text("title").notNull(),
  rawText: text("raw_text").notNull().default(""), // testo libero / estratto PDF / descrizione AI immagine
  fileRef: text("file_ref"),             // path relativo sotto uploads/brain/knowledge (pdf/immagini)
  status: text("status").notNull().default("processing"), // "processing" | "ready" | "error"
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Nodi del grafo di conoscenza ───────────────────────────────────────────────
export const brainGraphNodesTable = pgTable("brain_graph_nodes", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  strategyId: integer("strategy_id").references(() => brainStrategiesTable.id, { onDelete: "cascade" }), // null = generale
  // "concept" | "rule" | "pattern" | "level" | "instrument" | "timeframe" | "setup" | "risk"
  type: text("type").notNull(),
  label: text("label").notNull(),        // nome normalizzato (usato per dedup, case-insensitive)
  summary: text("summary").notNull().default(""),
  attrs: text("attrs"),                  // JSON string opzionale (es. { kind:"resistance", value:1.0950 })
  sourceId: integer("source_id").references(() => brainKnowledgeSourcesTable.id, { onDelete: "cascade" }), // null = derivato da feedback
  weight: numeric("weight", { precision: 6, scale: 3 }).notNull().default("1"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Archi (relazioni) del grafo di conoscenza ──────────────────────────────────
export const brainGraphEdgesTable = pgTable("brain_graph_edges", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  strategyId: integer("strategy_id").references(() => brainStrategiesTable.id, { onDelete: "cascade" }),
  fromNodeId: integer("from_node_id").notNull().references(() => brainGraphNodesTable.id, { onDelete: "cascade" }),
  toNodeId: integer("to_node_id").notNull().references(() => brainGraphNodesTable.id, { onDelete: "cascade" }),
  // "requires" | "on_instrument" | "for_timeframe" | "defines_sl" | "defines_tp"
  // | "confluence_with" | "contradicts" | "example_of" | "from_source"
  relation: text("relation").notNull(),
  weight: numeric("weight", { precision: 6, scale: 3 }).notNull().default("1"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BrainStrategy = typeof brainStrategiesTable.$inferSelect;
export type BrainAnalysis = typeof brainAnalysesTable.$inferSelect;
export type BrainFeedback = typeof brainFeedbackTable.$inferSelect;
export type BrainScanConfig = typeof brainScanConfigTable.$inferSelect;
export type BrainKnowledgeSource = typeof brainKnowledgeSourcesTable.$inferSelect;
export type BrainGraphNode = typeof brainGraphNodesTable.$inferSelect;
export type BrainGraphEdge = typeof brainGraphEdgesTable.$inferSelect;
