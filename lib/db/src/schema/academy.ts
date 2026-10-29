import {
  date,
  primaryKey,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const academyLessonsTable = pgTable(
  "academy_lessons",
  {
    id: text("id").primaryKey(),
    moduleId: text("module_id").notNull(),
    syllabusId: text("syllabus_id"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    videoUrl: text("video_url"),
    streamVideoId: text("stream_video_id"),
    accessLevel: text("access_level").notNull().default("protocol"),
    contentKind: text("content_kind").notNull().default("lesson"),
    introductionSlot: text("introduction_slot"),
    bodyMarkdown: text("body_markdown").notNull().default(""),
    exercisePrompt: text("exercise_prompt").notNull().default(""),
    orderIndex: integer("order_index").notNull().default(0),
    published: boolean("published").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("academy_lessons_catalog_idx").on(table.published, table.moduleId, table.orderIndex),
    index("academy_lessons_module_idx").on(table.moduleId, table.orderIndex),
  ],
);

export const academyProgressTable = pgTable(
  "academy_progress",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => academyLessonsTable.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    exerciseResponse: text("exercise_response").notNull().default(""),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    feedback: text("feedback").notNull().default(""),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("academy_progress_owner_lesson_idx").on(table.userId, table.lessonId),
    index("academy_progress_submitted_idx").on(table.submittedAt),
  ],
);

export const academyWeeklySubmissionsTable = pgTable(
  "academy_weekly_submissions",
  {
    userId: text("user_id").notNull(),
    weekStart: date("week_start").notNull(),
    lessonId: text("lesson_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.weekStart] })],
);
