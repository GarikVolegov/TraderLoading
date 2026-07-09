import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

// Creator payout (sub-project D). A creator converts earned in-app credits into real
// money via Stripe Connect Express. `creator_payout_accounts` is the Connect account +
// its capability state; `creator_payouts` is the append-only payout ledger.
export const creatorPayoutAccountsTable = pgTable("creator_payout_accounts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  stripeAccountId: text("stripe_account_id").notNull(),
  payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
  detailsSubmitted: boolean("details_submitted").notNull().default(false),
  status: text("status").notNull().default("pending"), // pending | verified | restricted
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("creator_payout_accounts_user_unique").on(t.userId),
]);

export const creatorPayoutsTable = pgTable("creator_payouts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  credits: integer("credits").notNull(),
  grossCents: integer("gross_cents").notNull(),
  feeCents: integer("fee_cents").notNull(),
  netCents: integer("net_cents").notNull(),
  currency: text("currency").notNull(),
  stripeTransferId: text("stripe_transfer_id"), // set once the Transfer is created
  status: text("status").notNull().default("pending"), // pending | paid | failed | refunded
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("creator_payouts_user_idx").on(t.userId, t.createdAt),
  uniqueIndex("creator_payouts_transfer_unique").on(t.stripeTransferId),
]);

export type CreatorPayoutAccount = typeof creatorPayoutAccountsTable.$inferSelect;
export type CreatorPayout = typeof creatorPayoutsTable.$inferSelect;
