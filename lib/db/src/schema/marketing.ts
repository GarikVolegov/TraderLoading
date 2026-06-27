import { boolean, index, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

// Real testimonials shown on the public marketing landing. Empty by default —
// the landing hides the section until real, published entries exist (no fabricated
// social proof). Populate via SQL/admin; only `published` rows are served publicly.
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    publishedSortIdx: index("testimonials_published_sort_idx").on(table.published, table.sortOrder),
  }),
);

export type Testimonial = typeof testimonialsTable.$inferSelect;
export type InsertTestimonial = typeof testimonialsTable.$inferInsert;
