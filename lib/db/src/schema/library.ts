import { boolean, integer, jsonb, pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

// ─── Biblioteca: curated high-value content (documents, mind maps, videos) ────
// Admin-curated. Collections group contents; contents carry type-specific data.

export const libraryCollectionsTable = pgTable(
  "library_collections",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    coverImageUrl: text("cover_image_url"),
    category: text("category").notNull().default(""),
    // 0 = always available; otherwise unlocked at this trader level.
    requiredLevel: integer("required_level").notNull().default(0),
    orderIndex: integer("order_index").notNull().default(0),
    published: boolean("published").notNull().default(false),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("library_collections_order_idx").on(t.orderIndex)],
);

export const libraryContentsTable = pgTable(
  "library_contents",
  {
    id: serial("id").primaryKey(),
    collectionId: integer("collection_id"),
    // "document" | "mindmap" | "video"
    type: text("type").notNull().default("document"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    bodyMarkdown: text("body_markdown").notNull().default(""),
    // document
    fileUrl: text("file_url"),
    fileName: text("file_name"),
    fileSize: integer("file_size").notNull().default(0),
    mimeType: text("mime_type"),
    // video (YouTube/Vimeo URL)
    embedUrl: text("embed_url"),
    // mindmap (react-flow nodes/edges)
    mindmap: jsonb("mindmap"),
    // JSON array of strings
    tags: text("tags").notNull().default("[]"),
    requiredLevel: integer("required_level").notNull().default(0),
    orderIndex: integer("order_index").notNull().default(0),
    published: boolean("published").notNull().default(false),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("library_contents_collection_idx").on(t.collectionId),
    index("library_contents_order_idx").on(t.orderIndex),
  ],
);

export type LibraryCollection = typeof libraryCollectionsTable.$inferSelect;
export type LibraryContent = typeof libraryContentsTable.$inferSelect;
