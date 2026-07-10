// Grant / sync paid-channel entitlements from Stripe webhooks (marketplace model). The
// entitlement is the source of truth for access; subscription lifecycle events keep its
// expiry in step with Stripe.
import { eq } from "drizzle-orm";
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

/** Renewal/cancel: set the entitlement's expiry to the subscription's period end (or the
 *  cancel instant), found by the stored subscription id. No-op if we don't track it. */
export async function syncSubscriptionEntitlement(subscriptionId: string, expiresAt: Date): Promise<void> {
  await db
    .update(communityChannelEntitlementsTable)
    .set({ expiresAt })
    .where(eq(communityChannelEntitlementsTable.stripeSubscriptionId, subscriptionId));
}
