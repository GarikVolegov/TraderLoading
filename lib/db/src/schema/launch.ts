import { pgTable, text, timestamp, integer, serial, index } from "drizzle-orm/pg-core";

export const launchEmailsTable = pgTable(
  "launch_emails",
  {
    key: text("key").primaryKey(),
    userId: text("user_id"),
    kind: text("kind").notNull(),
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    path: text("path").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("launch_emails_pending_idx").on(t.status, t.availableAt)],
);

export const academyVideosTable = pgTable("academy_videos", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  state: text("state").notNull().default("uploading"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schoolRequestsTable = pgTable("school_requests", {
  id: serial("id").primaryKey(),
  requestKey: text("request_key").notNull().unique(),
  school: text("school").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  currentStudents: integer("current_students").notNull(),
  monthlyEntrants: integer("monthly_entrants").notNull(),
  needs: text("needs").notNull(),
  status: text("status").notNull().default("new"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
