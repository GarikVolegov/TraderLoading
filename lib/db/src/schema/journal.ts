import { pgTable, serial, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
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
}, (table) => [
  index("journal_entries_user_created_idx").on(table.userId, table.createdAt),
]);

export const journalTagsTable = pgTable("journal_tags", {
  id: serial("id").primaryKey(),
  tag: text("tag").notNull(),
  tagKey: text("tag_key").notNull(),
  userId: text("user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("journal_tags_user_tag_key_idx").on(table.userId, table.tagKey),
]);

export const journalImagesTable = pgTable("journal_images", {
  id: serial("id").primaryKey(),
  entryId: serial("entry_id").notNull().references(() => journalEntriesTable.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("journal_images_entry_idx").on(table.entryId)]);

export const journalRecapsTable = pgTable("journal_recaps", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  overallJudgment: text("overall_judgment").notNull().default(""),
  wentWell: text("went_well").notNull().default(""),
  wentWrong: text("went_wrong").notNull().default(""),
  improvements: text("improvements").notNull().default(""),
  patterns: text("patterns").notNull().default(""),
  focusAreas: text("focus_areas").notNull().default(""),
  nextPeriodExpectations: text("next_period_expectations").notNull().default(""),
  nextPeriodGoals: text("next_period_goals").notNull().default(""),
  userId: text("user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("journal_recaps_user_kind_period_idx").on(table.userId, table.kind, table.periodStart, table.periodEnd),
]);

export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntriesTable.$inferSelect;

export const insertJournalTagSchema = createInsertSchema(journalTagsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJournalTag = z.infer<typeof insertJournalTagSchema>;
export type JournalTag = typeof journalTagsTable.$inferSelect;

export type JournalRecap = typeof journalRecapsTable.$inferSelect;

export const insertJournalImageSchema = createInsertSchema(journalImagesTable).omit({ id: true, createdAt: true });
export type InsertJournalImage = z.infer<typeof insertJournalImageSchema>;
export type JournalImage = typeof journalImagesTable.$inferSelect;
