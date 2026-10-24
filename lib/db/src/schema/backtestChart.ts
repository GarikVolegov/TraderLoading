import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const backtestChartPreferencesTable = pgTable("backtest_chart_preferences", {
  userId: text("user_id").primaryKey(),
  revision: integer("revision").notNull().default(1),
  preferences: jsonb("preferences").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
