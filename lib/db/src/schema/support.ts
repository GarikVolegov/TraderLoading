import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const supportTicketStatuses = ["open", "pending", "closed"] as const;
export const supportTicketAuthorTypes = ["user", "support"] as const;

export const supportTicketsTable = pgTable("support_tickets", {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    subject: text("subject").notNull(),
    status: text("status").notNull().default("open"),
    category: text("category"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
}, (table) => [
    index("support_tickets_user_idx").on(table.userId, table.createdAt),
    index("support_tickets_status_idx").on(table.status),
]);

export const supportTicketMessagesTable = pgTable("support_ticket_messages", {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id").notNull(),
    authorType: text("author_type").notNull(),
    authorId: text("author_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
    index("support_ticket_messages_ticket_idx").on(table.ticketId, table.createdAt),
]);

export const insertSupportTicketSchema = createInsertSchema(
  supportTicketsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSupportTicketMessageSchema = createInsertSchema(
  supportTicketMessagesTable,
).omit({
  id: true,
  createdAt: true,
});

export type SupportTicketStatus = (typeof supportTicketStatuses)[number];
export type SupportTicketAuthorType = (typeof supportTicketAuthorTypes)[number];
export type SupportTicketRow = typeof supportTicketsTable.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicketMessageRow =
  typeof supportTicketMessagesTable.$inferSelect;
export type InsertSupportTicketMessage = z.infer<
  typeof insertSupportTicketMessageSchema
>;
