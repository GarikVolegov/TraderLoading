import {
  boolean,
  index,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adminRoleNames = [
  "super_admin",
  "admin_operator",
  "support_agent",
  "moderator",
  "content_manager",
  "developer_ops",
  "read_only_auditor",
] as const;

export const adminUsersTable = pgTable("admin_users", {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    role: text("role").notNull().default("support_agent"),
    status: text("status").notNull().default("active"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
}, (table) => [
    uniqueIndex("admin_users_user_idx").on(table.userId),
    index("admin_users_role_idx").on(table.role),
    index("admin_users_status_idx").on(table.status),
]);

export const adminUserStatusTable = pgTable("admin_user_status", {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    status: text("status").notNull().default("active"),
    reason: text("reason"),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
}, (table) => [
    uniqueIndex("admin_user_status_user_unique").on(table.userId),
    index("admin_user_status_status_idx").on(table.status),
]);

export const adminUserSubscriptionsTable = pgTable("admin_user_subscriptions", {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    plan: text("plan").notNull().default("free"),
    status: text("status").notNull().default("active"),
    source: text("source").notNull().default("manual"),
    manualOverride: boolean("manual_override").notNull().default(true),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    currentPeriodEnd: timestamp("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    reason: text("reason"),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
}, (table) => [
    uniqueIndex("admin_user_subscriptions_user_unique").on(table.userId),
    index("admin_user_subscriptions_plan_idx").on(table.plan),
    index("admin_user_subscriptions_status_idx").on(table.status),
    index("admin_user_subscriptions_customer_idx").on(table.stripeCustomerId),
    index("admin_user_subscriptions_subscription_idx").on(table.stripeSubscriptionId),
]);

export const adminAuditLogsTable = pgTable("admin_audit_logs", {
    id: serial("id").primaryKey(),
    actorUserId: text("actor_user_id").notNull(),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason"),
    before: jsonb("before"),
    after: jsonb("after"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    requestId: text("request_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
    index("admin_audit_logs_actor_idx").on(table.actorUserId, table.createdAt),
    index("admin_audit_logs_target_idx").on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
    index("admin_audit_logs_created_idx").on(table.createdAt),
]);

// Idempotency ledger for Stripe webhook deliveries. The event id is the primary
// key, so inserting it is an atomic "claim": a retried delivery (Stripe retries on
// any non-2xx/timeout) conflicts and is skipped instead of re-applying effects.
export const stripeWebhookEventsTable = pgTable("stripe_webhook_events", {
    eventId: text("event_id").primaryKey(),
    type: text("type").notNull(),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
});

export const insertAdminUserSchema = createInsertSchema(adminUsersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminUserStatusSchema = createInsertSchema(
  adminUserStatusTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminAuditLogSchema = createInsertSchema(
  adminAuditLogsTable,
).omit({
  id: true,
  createdAt: true,
});

export const insertAdminUserSubscriptionSchema = createInsertSchema(
  adminUserSubscriptionsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AdminRoleName = (typeof adminRoleNames)[number];
export type AdminUser = typeof adminUsersTable.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUserStatus = typeof adminUserStatusTable.$inferSelect;
export type InsertAdminUserStatus = z.infer<
  typeof insertAdminUserStatusSchema
>;
export type AdminUserSubscription =
  typeof adminUserSubscriptionsTable.$inferSelect;
export type InsertAdminUserSubscription = z.infer<
  typeof insertAdminUserSubscriptionSchema
>;
export type AdminAuditLog = typeof adminAuditLogsTable.$inferSelect;
export type InsertAdminAuditLog = z.infer<typeof insertAdminAuditLogSchema>;
