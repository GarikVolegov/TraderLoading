import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const missionsTable = pgTable("missions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  xpReward: integer("xp_reward").notNull().default(50),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  missionDate: text("mission_date").notNull(),
  userId: text("user_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("missions_user_date_completed_idx").on(table.userId, table.missionDate, table.completed),
]);

export const insertMissionSchema = createInsertSchema(missionsTable).omit({ id: true, createdAt: true });
export type InsertMission = z.infer<typeof insertMissionSchema>;
export type Mission = typeof missionsTable.$inferSelect;

export const missionTemplatesTable = pgTable("mission_templates", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  xpReward: integer("xp_reward").notNull().default(50),
  userId: text("user_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("mission_templates_user_idx").on(table.userId)]);

export const insertMissionTemplateSchema = createInsertSchema(missionTemplatesTable).omit({ id: true, createdAt: true });
export type InsertMissionTemplate = z.infer<typeof insertMissionTemplateSchema>;
export type MissionTemplate = typeof missionTemplatesTable.$inferSelect;
