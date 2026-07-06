import { pgTable, serial, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

// Reverse lookup code → user, so an invite link's code resolves to its referrer.
// Populated lazily the first time a user fetches their referral code.
export const referralCodesTable = pgTable("referral_codes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  code: text("code").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("referral_codes_user_unique").on(t.userId),
  uniqueIndex("referral_codes_code_unique").on(t.code),
]);

// One row per successfully-attributed invitee (unique on the invitee), with the
// idempotent reward marker.
export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerUserId: text("referrer_user_id").notNull(),
  referredUserId: text("referred_user_id").notNull(),
  rewardedAt: timestamp("rewarded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("referrals_referred_unique").on(t.referredUserId),
  index("referrals_referrer_idx").on(t.referrerUserId),
]);

export type ReferralCode = typeof referralCodesTable.$inferSelect;
export type Referral = typeof referralsTable.$inferSelect;
