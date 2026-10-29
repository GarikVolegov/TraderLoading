import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const instant = (name: string) => timestamp(name, { withTimezone: true });

/** Academy entitlements never share the platform Pro subscription table. */
export const academySubscriptionsTable = pgTable("academy_subscriptions", {
  userId: text("user_id").primaryKey(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  status: text("status").notNull().default("none"),
  currentPeriodEnd: instant("current_period_end"),
  paidThrough: instant("paid_through"),
  latestPaidInvoiceId: text("latest_paid_invoice_id"),
  paymentRevoked: boolean("payment_revoked").notNull().default(false),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  checkoutSessionId: text("checkout_session_id"),
  checkoutAttemptId: text("checkout_attempt_id"),
  createdAt: instant("created_at").notNull().defaultNow(),
  updatedAt: instant("updated_at").notNull().defaultNow(),
}, t => [uniqueIndex("academy_subscription_stripe_idx").on(t.stripeSubscriptionId)]);

export const academyAffiliatesTable = pgTable("academy_affiliates", {
  userId: text("user_id").primaryKey(),
  code: text("code").notNull(),
  termsVersion: text("terms_version").notNull(),
  acceptedAt: instant("accepted_at").notNull().defaultNow(),
}, t => [uniqueIndex("academy_affiliate_code_idx").on(t.code)]);

/** A null affiliate is also a permanent snapshot: no retroactive attribution. */
export const academyAttributionsTable = pgTable("academy_attributions", {
  buyerUserId: text("buyer_user_id").primaryKey(),
  affiliateUserId: text("affiliate_user_id"),
  code: text("code"),
  termsVersion: text("terms_version"),
  createdAt: instant("created_at").notNull().defaultNow(),
});

/** Every settled invoice is recorded, including sales without an affiliate. */
export const academyCommissionsTable = pgTable("academy_commissions", {
  id: text("id").primaryKey(),
  stripeInvoiceId: text("stripe_invoice_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeChargeId: text("stripe_charge_id").notNull(),
  buyerUserId: text("buyer_user_id").notNull(),
  affiliateUserId: text("affiliate_user_id"),
  grossPaidCents: integer("gross_paid_cents").notNull(),
  amountCents: integer("amount_cents").notNull(),
  reversedCents: integer("reversed_cents").notNull().default(0),
  refundedGrossCents: integer("refunded_gross_cents").notNull().default(0),
  disputed: boolean("disputed").notNull().default(false),
  currency: text("currency").notNull().default("eur"),
  rateBps: integer("rate_bps").notNull().default(2000),
  availableAt: instant("available_at").notNull(),
  periodEnd: instant("period_end").notNull(),
  createdAt: instant("created_at").notNull().defaultNow(),
}, t => [
  uniqueIndex("academy_commission_invoice_idx").on(t.stripeInvoiceId),
  index("academy_commission_charge_idx").on(t.stripeChargeId),
  index("academy_commission_affiliate_idx").on(t.affiliateUserId, t.availableAt),
]);

/** Durable intent is committed before Stripe is called; one transfer per invoice. */
export const academyPayoutsTable = pgTable("academy_payouts", {
  id: text("id").primaryKey(),
  commissionId: text("commission_id").notNull().references(() => academyCommissionsTable.id),
  affiliateUserId: text("affiliate_user_id").notNull(),
  stripeAccountId: text("stripe_account_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  stripeTransferId: text("stripe_transfer_id"),
  transferReversedCents: integer("transfer_reversed_cents").notNull().default(0),
  status: text("status").notNull().default("pending"),
  requestedBy: text("requested_by").notNull(),
  lastError: text("last_error"),
  createdAt: instant("created_at").notNull().defaultNow(),
  updatedAt: instant("updated_at").notNull().defaultNow(),
}, t => [
  uniqueIndex("academy_payout_commission_idx").on(t.commissionId),
  index("academy_payout_affiliate_idx").on(t.affiliateUserId),
]);

export type AcademySubscription = typeof academySubscriptionsTable.$inferSelect;
export type AcademyCommission = typeof academyCommissionsTable.$inferSelect;
