// Atomic "unlock a paid channel" orchestration (sub-project C). One transaction:
// take a per-(channel,user) advisory lock, load the channel FOR UPDATE, authorize the
// buyer (member, not banned, not owner/manager), guard the purchase, move credits
// buyer → owner, and upsert the entitlement — so no crash or concurrent double-click
// can charge a buyer without granting access, or charge twice for one unlock.
import {
  db,
  communitiesTable,
  communityChannelsTable,
  communityChannelEntitlementsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { transferCredits, getBalance } from "../credits/wallet.js";
import { getMemberContext, hasPermission } from "../communityPermissions.js";
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
export class NotMemberError extends Error {
  constructor() { super("not_member"); this.name = "NotMemberError"; }
}
export class BannedError extends Error {
  constructor() { super("banned"); this.name = "BannedError"; }
}
export class PriceChangedError extends Error {
  constructor(public currentPrice: number) { super("price_changed"); this.name = "PriceChangedError"; }
}

export interface UnlockResult {
  balance: number;
  entitlement: { expiresAt: Date | null };
}

/** Purchase (or renew) access to a paid channel for `userId`. Throws typed errors
 *  the route maps to HTTP; InsufficientCreditsError bubbles from transferCredits.
 *  If `expectedPriceCredits` is given, a mismatch with the live price throws
 *  PriceChangedError (so a buyer is never silently charged a price they didn't see). */
export async function unlockChannel(
  userId: string,
  channelId: number,
  expectedPriceCredits?: number,
): Promise<UnlockResult> {
  const now = new Date();

  const expiresAt = await db.transaction(async (tx) => {
    // Serialize concurrent unlocks of THIS channel by THIS user (the double-click /
    // client-retry TOCTOU): the second waits, then reads the first's committed
    // entitlement and is rejected instead of charging twice.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`chan:${channelId}:user:${userId}`}))`);

    // FOR UPDATE so a concurrent channel delete/price change serializes against us.
    const [channel] = await tx
      .select()
      .from(communityChannelsTable)
      .where(eq(communityChannelsTable.id, channelId))
      .for("update")
      .limit(1);
    if (!channel) throw new ChannelNotFoundError();
    if (isChannelFree(channel)) throw new ChannelFreeError();

    // Consent guard: charge only the price the buyer actually saw.
    if (expectedPriceCredits != null && (channel.priceCredits ?? 0) !== expectedPriceCredits) {
      throw new PriceChangedError(channel.priceCredits ?? 0);
    }

    const [community] = await tx
      .select({ creatorId: communitiesTable.creatorId })
      .from(communitiesTable)
      .where(eq(communitiesTable.id, channel.communityId))
      .limit(1);
    if (!community) throw new ChannelNotFoundError();

    // Authorize the buyer: owners and channels.manage holders already preview paid
    // channels for free (don't charge them); non-members and banned users can't buy.
    const ctx = await getMemberContext(channel.communityId, userId);
    if (ctx.isOwner || hasPermission(ctx, "channels.manage")) throw new OwnerCannotBuyError();
    if (ctx.isBanned) throw new BannedError();
    if (!ctx.isMember) throw new NotMemberError();

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

    // A permanent (one-time) grant is never re-charged, even if the creator later
    // switched the model to subscription — the buyer keeps what they paid for.
    if (existing && existing.expiresAt === null) throw new AlreadyOwnedError();

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
