import { boolean, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const ideasTable = pgTable("ideas", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("idea"),
  content: text("content").notNull(),
  completed: boolean("completed").notNull().default(false),
  reminderTime: text("reminder_time"),
  cadence: text("cadence"),
  recurrence: boolean("recurrence").notNull().default(false),
  importance: text("importance").default("medium"),
  deadlineDate: text("deadline_date"),
  userId: text("user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const checklistItemsTable = pgTable("checklist_items", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  completed: boolean("completed").notNull().default(false),
  order: integer("order").notNull().default(0),
  userId: text("user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userSettingsTable = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  backgroundUrl: text("background_url"),
  backgroundType: text("background_type").notNull().default("default"),
  fontChoice: text("font_choice").notNull().default("inter"),
  backgroundDarkness: integer("background_darkness").notNull().default(60),
  userId: text("user_id"),
  tradingSessions: text("trading_sessions"),
  lotDivisor: integer("lot_divisor").notNull().default(11),
  calendarCurrencies: text("calendar_currencies"),
  calendarImpacts: text("calendar_impacts"),
  dailyReminderTime: text("daily_reminder_time"),
  preMacroMinutes: integer("pre_macro_minutes").notNull().default(15),
  maxDailyLoss: integer("max_daily_loss"),
  selectedPairs: text("selected_pairs"),
  notificationPrefs: text("notification_prefs"),
  alarmConfigs: text("alarm_configs"),
});

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("push_sub_endpoint_idx").on(t.endpoint)]);

export const quotesTable = pgTable("quotes", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  author: text("author"),
  userId: text("user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const checkinsTable = pgTable("checkins", {
  id: serial("id").primaryKey(),
  mood: text("mood").notNull(),
  sessionName: text("session_name").notNull(),
  note: text("note"),
  userId: text("user_id"),
  date: text("date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const loginAccessTable = pgTable("login_access", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Idea = typeof ideasTable.$inferSelect;
export type ChecklistItem = typeof checklistItemsTable.$inferSelect;
export type UserSetting = typeof userSettingsTable.$inferSelect;
export type Quote = typeof quotesTable.$inferSelect;
export type Checkin = typeof checkinsTable.$inferSelect;
export type LoginAccess = typeof loginAccessTable.$inferSelect;
