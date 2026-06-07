import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

export const levelMilestonesTable = pgTable("level_milestones", {
  id: serial("id").primaryKey(),
  level: integer("level").notNull(),
  title: text("title").notNull().default(""),
  description: text("description").notNull().default(""),
  skills: text("skills").notNull().default("[]"),
  badgeEmoji: text("badge_emoji").notNull().default("🏆"),
  badgeColor: text("badge_color").notNull().default("#22c55e"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("level_milestones_level_idx").on(t.level),
]);

export const levelMilestoneFilesTable = pgTable("level_milestone_files", {
  id: serial("id").primaryKey(),
  level: integer("level").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size").notNull().default(0),
  mimeType: text("mime_type").notNull(),
  downloadable: boolean("downloadable").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("level_milestone_files_level_idx").on(t.level),
]);

export const levelCertificatesTable = pgTable("level_certificates", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  avatarUrl: text("avatar_url"),
  level: integer("level").notNull(),
  levelName: text("level_name").notNull(),
  milestoneTitle: text("milestone_title").notNull().default(""),
  awardedAt: timestamp("awarded_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("level_certificates_user_level_idx").on(t.userId, t.level),
  index("level_certificates_user_idx").on(t.userId),
]);

export type LevelMilestone = typeof levelMilestonesTable.$inferSelect;
export type LevelMilestoneFile = typeof levelMilestoneFilesTable.$inferSelect;
export type LevelCertificate = typeof levelCertificatesTable.$inferSelect;
