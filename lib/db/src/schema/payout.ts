import { pgTable, serial, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// Creator Stripe Connect account (marketplace model). Buyers pay via Connect and Stripe
// pays creators out directly — the platform never holds funds. This row is the connected
// account + its capability state (kept in step by the account.updated webhook).
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
  // One row per Stripe account — the account.updated webhook maps by this id.
  uniqueIndex("creator_payout_accounts_stripe_unique").on(t.stripeAccountId),
]);

export type CreatorPayoutAccount = typeof creatorPayoutAccountsTable.$inferSelect;
