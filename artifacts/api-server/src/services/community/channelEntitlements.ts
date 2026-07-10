// Grant / sync / revoke paid-channel entitlements from Stripe webhooks (marketplace
// model). The entitlement is the source of truth for access; subscription lifecycle and
// refund/dispute events keep it honest.
import { eq, and } from "drizzle-orm";
import { db, communityChannelEntitlementsTable } from "@workspace/db";

/** Permanent access from a one-time purchase (idempotent upsert per channel+user). */
export async function grantOneTimeEntitlement(communityId: number, channelId: number, userId: string): Promise<void> {
  await db
    .insert(communityChannelEntitlementsTable)
    .values({ communityId, channelId, userId, source: "purchase", grantedAt: new Date(), expiresAt: null })
    .onConflictDoUpdate({
      target: [communityChannelEntitlementsTable.channelId, communityChannelEntitlementsTable.userId],
      set: { source: "purchase", grantedAt: new Date(), expiresAt: null, stripeSubscriptionId: null },
    });
}

/** Access from a subscription: expiry tracks the current period; the subscription id links
 *  renew/cancel webhooks back to this row. */
export async function grantSubscriptionEntitlement(
  communityId: number,
  channelId: number,
  userId: string,
  subscriptionId: string,
  expiresAt: Date,
): Promise<void> {
  await db
    .insert(communityChannelEntitlementsTable)
    .values({ communityId, channelId, userId, source: "purchase", grantedAt: new Date(), expiresAt, stripeSubscriptionId: subscriptionId })
    .onConflictDoUpdate({
      target: [communityChannelEntitlementsTable.channelId, communityChannelEntitlementsTable.userId],
      set: { source: "purchase", grantedAt: new Date(), expiresAt, stripeSubscriptionId: subscriptionId },
    });
}

// Stripe subscription statuses that mean "currently paid" — anything else must not extend access.
const PAID_STATUSES = new Set(["active", "trialing"]);

/** Renewal/cancel/failure: for a paid status, extend the entitlement to the period end;
 *  for any non-paying status (past_due, unpaid, canceled, incomplete*) revoke NOW so a
 *  failed renewal can't hand out a free period. Found by the stored subscription id. */
export async function syncSubscriptionEntitlement(subscriptionId: string, periodEnd: Date, status: string): Promise<void> {
  const expiresAt = PAID_STATUSES.has(status) ? periodEnd : new Date();
  await db
    .update(communityChannelEntitlementsTable)
    .set({ expiresAt })
    .where(eq(communityChannelEntitlementsTable.stripeSubscriptionId, subscriptionId));
}

/** Revoke a one-time entitlement (refund/chargeback) — remove access entirely. */
export async function revokeChannelEntitlement(channelId: number, userId: string): Promise<void> {
  await db
    .delete(communityChannelEntitlementsTable)
    .where(and(
      eq(communityChannelEntitlementsTable.channelId, channelId),
      eq(communityChannelEntitlementsTable.userId, userId),
    ));
}
