import { pgTable, serial, text, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

// In-app credit wallet (sub-project B). Credits have NO cash value: bought via
// Stripe, spent in-app (paid channels), forfeited on account deletion. The wallet
// holds the spendable balance; credit_transactions is the append-only audit ledger
// (every mutation is a row; balance moves atomically with it in a transaction).
export const creditWalletsTable = pgTable("credit_wallets", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  balance: integer("balance").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("credit_wallets_user_unique").on(t.userId),
]);

export const creditTransactionsTable = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  delta: integer("delta").notNull(), // +purchase/+grant, -spend
  reason: text("reason").notNull(), // purchase | spend | grant | refund
  refId: text("ref_id"), // packId for a purchase, channelId for a spend, etc.
  // Set only on purchases; unique so a retried Stripe webhook can't double-grant
  // (Postgres treats NULLs as distinct, so spend/grant rows with NULL are fine).
  stripeEventId: text("stripe_event_id"),
  balanceAfter: integer("balance_after").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("credit_transactions_stripe_event_unique").on(t.stripeEventId),
  index("credit_transactions_user_idx").on(t.userId, t.createdAt),
]);

export type CreditWallet = typeof creditWalletsTable.$inferSelect;
export type CreditTransaction = typeof creditTransactionsTable.$inferSelect;
