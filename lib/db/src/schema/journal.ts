import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const journalEntriesTable = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  tradeDate: text("trade_date").notNull(),
  result: text("result").notNull().default("none"),
  tags: text("tags"),
  userId: text("user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const journalImagesTable = pgTable("journal_images", {
  id: serial("id").primaryKey(),
  entryId: serial("entry_id").notNull().references(() => journalEntriesTable.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntriesTable.$inferSelect;

export const insertJournalImageSchema = createInsertSchema(journalImagesTable).omit({ id: true, createdAt: true });
export type InsertJournalImage = z.infer<typeof insertJournalImageSchema>;
export type JournalImage = typeof journalImagesTable.$inferSelect;
