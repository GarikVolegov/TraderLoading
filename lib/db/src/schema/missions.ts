import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
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
});

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
});

export const insertMissionTemplateSchema = createInsertSchema(missionTemplatesTable).omit({ id: true, createdAt: true });
export type InsertMissionTemplate = z.infer<typeof insertMissionTemplateSchema>;
export type MissionTemplate = typeof missionTemplatesTable.$inferSelect;
