import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const routineCompletionsTable = pgTable("routine_completions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  routineId: text("routine_id").notNull(),
  routineTitle: text("routine_title").notNull(),
  template: text("template").notNull(),
  answersJson: text("answers_json").notNull().default("{}"),
  qualityScore: integer("quality_score").notNull().default(0),
  completionDate: text("completion_date").notNull(),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
}, (table) => [
  index("routine_completions_user_idx").on(table.userId),
  index("routine_completions_date_idx").on(table.completionDate),
]);

export type RoutineCompletion = typeof routineCompletionsTable.$inferSelect;
