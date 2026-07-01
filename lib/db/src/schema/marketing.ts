import { boolean, index, integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Moderation lifecycle for a testimonial. Editorial rows (userId NULL) default to
// "approved". User submissions arrive "pending" and only become public once an admin
// approves (which also flips `published` to true). Withdraw/reject are terminal-ish
// states that keep the row (audit + the per-user unique index) but hide it.
export type ReviewStatus = "pending" | "approved" | "rejected" | "withdrawn";

// Testimonials shown on the public marketing landing. Two sources share this table:
// (a) editorial rows (userId NULL, seeded via SQL/admin) and (b) real user reviews
// (userId set, submitted in-app, moderated before publishing). Only `published` rows
// are served publicly — so `/public/stats` and `/public/testimonials` are unchanged.
export const testimonialsTable = pgTable(
  "testimonials",
  {
    id: serial("id").primaryKey(),
    name: varchar("name").notNull(),
    role: varchar("role"),
    text: text("text").notNull(),
    rating: integer("rating").notNull().default(5),
    locale: varchar("locale"),
    published: boolean("published").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    // Real-user review fields (NULL/default for editorial rows):
    userId: text("user_id"),
    status: varchar("status").notNull().default("approved").$type<ReviewStatus>(),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    moderatedBy: text("moderated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    publishedSortIdx: index("testimonials_published_sort_idx").on(table.published, table.sortOrder),
    statusIdx: index("testimonials_status_idx").on(table.status),
    // One live review per authenticated user (editorial rows keep userId NULL → not constrained).
    userUnique: uniqueIndex("testimonials_user_unique")
      .on(table.userId)
      .where(sql`${table.userId} IS NOT NULL`),
  }),
);

export type Testimonial = typeof testimonialsTable.$inferSelect;
export type InsertTestimonial = typeof testimonialsTable.$inferInsert;

// Per-user state for the in-app "leave a review" prompt, so we never nag: a user can
// snooze (temporary) or opt out (permanent). `lastShownAt` supports future frequency caps.
export const reviewPromptStateTable = pgTable("review_prompt_state", {
  userId: text("user_id").primaryKey(),
  snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
  optedOut: boolean("opted_out").notNull().default(false),
  lastShownAt: timestamp("last_shown_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ReviewPromptState = typeof reviewPromptStateTable.$inferSelect;
export type InsertReviewPromptState = typeof reviewPromptStateTable.$inferInsert;
