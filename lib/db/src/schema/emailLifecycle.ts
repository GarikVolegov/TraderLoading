import { pgTable, serial, text, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";

// One row per user tracking when each lifecycle email last went out, so the
// audience selector (services/email/lifecycleAudience.ts) can dedupe and respect
// the digest interval / win-back cooldown. `optOut` silences every lifecycle
// email for that user. Written by the daily lifecycle cron; purged on account
// deletion (GDPR).
export const emailLifecycleStateTable = pgTable("email_lifecycle_state", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  welcomeSentAt: timestamp("welcome_sent_at"),
  lastDigestAt: timestamp("last_digest_at"),
  lastWinbackAt: timestamp("last_winback_at"),
  optOut: boolean("opt_out").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("email_lifecycle_state_user_unique").on(t.userId),
]);

export type EmailLifecycleState = typeof emailLifecycleStateTable.$inferSelect;
