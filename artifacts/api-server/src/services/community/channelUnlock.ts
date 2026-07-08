// Atomic "unlock a paid channel" orchestration (sub-project C). One transaction:
// load the channel, guard the purchase, move credits buyer → owner, and upsert the
// buyer's entitlement — so a crash can never charge a buyer without granting access.
import {
  db,
  communitiesTable,
  communityChannelsTable,
  communityChannelEntitlementsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { transferCredits, getBalance } from "../credits/wallet.js";
import { isChannelFree, canPurchase, computeEntitlementExpiry } from "./channelAccess.js";

export class ChannelNotFoundError extends Error {
  constructor() { super("channel_not_found"); this.name = "ChannelNotFoundError"; }
}
export class ChannelFreeError extends Error {
  constructor() { super("channel_free"); this.name = "ChannelFreeError"; }
}
export class AlreadyOwnedError extends Error {
  constructor() { super("already_owned"); this.name = "AlreadyOwnedError"; }
}
export class OwnerCannotBuyError extends Error {
  constructor() { super("owner_cannot_buy"); this.name = "OwnerCannotBuyError"; }
}

export interface UnlockResult {
  balance: number;
  entitlement: { expiresAt: Date | null };
}

/** Purchase (or renew) access to a paid channel for `userId`. Throws typed errors
 *  the route maps to HTTP; InsufficientCreditsError bubbles from transferCredits. */
export async function unlockChannel(userId: string, channelId: number): Promise<UnlockResult> {
  const now = new Date();

  const expiresAt = await db.transaction(async (tx) => {
    const [channel] = await tx
      .select()
      .from(communityChannelsTable)
      .where(eq(communityChannelsTable.id, channelId))
      .limit(1);
    if (!channel) throw new ChannelNotFoundError();
    if (isChannelFree(channel)) throw new ChannelFreeError();

    const [community] = await tx
      .select({ creatorId: communitiesTable.creatorId })
      .from(communitiesTable)
      .where(eq(communitiesTable.id, channel.communityId))
      .limit(1);
    if (!community) throw new ChannelNotFoundError();
    // The owner (and manage roles) already preview paid channels for free.
    if (community.creatorId === userId) throw new OwnerCannotBuyError();

    const [existing] = await tx
      .select({ expiresAt: communityChannelEntitlementsTable.expiresAt })
      .from(communityChannelEntitlementsTable)
      .where(
        and(
          eq(communityChannelEntitlementsTable.channelId, channelId),
          eq(communityChannelEntitlementsTable.userId, userId),
        ),
      )
      .limit(1);

    const accessModel = channel.accessModel ?? "one_time";
    const purchasable = canPurchase({
      isFree: false,
      accessModel,
      entitlement: existing ?? null,
      now,
    });
    if (!purchasable.ok) throw new AlreadyOwnedError();

    // Move credits buyer → owner (throws InsufficientCreditsError, rolling back).
    await transferCredits(
      { fromUserId: userId, toUserId: community.creatorId, amount: channel.priceCredits ?? 0, reason: "channel_sale", refId: String(channelId) },
      tx,
    );

    const newExpiry = computeEntitlementExpiry({
      accessModel,
      subscriptionPeriodDays: channel.subscriptionPeriodDays ?? 0,
      existingExpiry: existing?.expiresAt ?? null,
      now,
    });

    await tx
      .insert(communityChannelEntitlementsTable)
      .values({
        communityId: channel.communityId,
        channelId,
        userId,
        source: "purchase",
        grantedAt: now,
        expiresAt: newExpiry,
      })
      .onConflictDoUpdate({
        target: [communityChannelEntitlementsTable.channelId, communityChannelEntitlementsTable.userId],
        set: { source: "purchase", grantedAt: now, expiresAt: newExpiry },
      });

    return newExpiry;
  });

  return { balance: await getBalance(userId), entitlement: { expiresAt } };
}
