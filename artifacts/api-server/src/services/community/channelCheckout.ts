// Paid-channel purchase via Stripe Connect (marketplace model). The buyer pays in real
// currency; Stripe routes the creator's share directly to their connected account and the
// platform's application fee to us — the platform never custodies the funds. Entitlement
// is granted on the webhook (checkout.session.completed), never here.
import type Stripe from "stripe";
import { eq, and } from "drizzle-orm";
import {
  db,
  communitiesTable,
  communityChannelsTable,
  communityChannelEntitlementsTable,
  creatorPayoutAccountsTable,
} from "@workspace/db";
import { getMemberContext, hasPermission } from "../communityPermissions.js";
import { isChannelFree, computeApplicationFee } from "./channelPricing.js";

export class ChannelNotFoundError extends Error { constructor() { super("channel_not_found"); this.name = "ChannelNotFoundError"; } }
export class ChannelFreeError extends Error { constructor() { super("channel_free"); this.name = "ChannelFreeError"; } }
export class OwnerCannotBuyError extends Error { constructor() { super("owner_cannot_buy"); this.name = "OwnerCannotBuyError"; } }
export class NotMemberError extends Error { constructor() { super("not_member"); this.name = "NotMemberError"; } }
export class BannedError extends Error { constructor() { super("banned"); this.name = "BannedError"; } }
export class AlreadyOwnedError extends Error { constructor() { super("already_owned"); this.name = "AlreadyOwnedError"; } }
export class CreatorNotOnboardedError extends Error { constructor() { super("creator_not_onboarded"); this.name = "CreatorNotOnboardedError"; } }

function platformFeeBps(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.PLATFORM_FEE_BPS);
  return Number.isInteger(raw) && raw >= 0 && raw < 10000 ? raw : 0;
}

/** Ensure a reusable Stripe Price exists for a subscription channel; created lazily on the
 *  platform account and persisted so renewals reuse it. */
async function ensureSubscriptionPrice(stripe: Stripe, channel: typeof communityChannelsTable.$inferSelect): Promise<string> {
  if (channel.stripePriceId) return channel.stripePriceId;
  const price = await stripe.prices.create({
    currency: channel.currency,
    unit_amount: channel.priceCents ?? 0,
    recurring: { interval: (channel.subInterval as "month" | "year") ?? "month" },
    product_data: { name: `Canale: ${channel.name}` },
  });
  await db.update(communityChannelsTable).set({ stripePriceId: price.id }).where(eq(communityChannelsTable.id, channel.id));
  return price.id;
}

/** Create a Stripe Checkout session for unlocking a paid channel; returns the hosted URL. */
export async function createChannelCheckout(
  userId: string,
  channelId: number,
  stripe: Stripe,
  appBaseUrl: string,
): Promise<string> {
  const [channel] = await db.select().from(communityChannelsTable).where(eq(communityChannelsTable.id, channelId)).limit(1);
  if (!channel) throw new ChannelNotFoundError();
  if (isChannelFree(channel)) throw new ChannelFreeError();

  const [community] = await db.select({ creatorId: communitiesTable.creatorId }).from(communitiesTable).where(eq(communitiesTable.id, channel.communityId)).limit(1);
  if (!community) throw new ChannelNotFoundError();

  // Buyer eligibility: owner/manage already have free access; non-members/banned can't buy.
  const ctx = await getMemberContext(channel.communityId, userId);
  if (ctx.isOwner || hasPermission(ctx, "channels.manage")) throw new OwnerCannotBuyError();
  if (ctx.isBanned) throw new BannedError();
  if (!ctx.isMember) throw new NotMemberError();

  // Block buying when an active entitlement already grants access.
  const [existing] = await db
    .select({ expiresAt: communityChannelEntitlementsTable.expiresAt })
    .from(communityChannelEntitlementsTable)
    .where(and(eq(communityChannelEntitlementsTable.channelId, channelId), eq(communityChannelEntitlementsTable.userId, userId)))
    .limit(1);
  if (existing && (existing.expiresAt === null || existing.expiresAt.getTime() > Date.now())) throw new AlreadyOwnedError();

  // The creator must have a payouts-enabled Connect account to receive the money.
  const [acct] = await db
    .select({ stripeAccountId: creatorPayoutAccountsTable.stripeAccountId, payoutsEnabled: creatorPayoutAccountsTable.payoutsEnabled })
    .from(creatorPayoutAccountsTable)
    .where(eq(creatorPayoutAccountsTable.userId, community.creatorId))
    .limit(1);
  if (!acct || !acct.payoutsEnabled) throw new CreatorNotOnboardedError();

  const feeBps = platformFeeBps();
  const successUrl = `${appBaseUrl}/?channel=${channelId}&unlock=success`;
  const cancelUrl = `${appBaseUrl}/?channel=${channelId}&unlock=cancel`;
  const priceCents = channel.priceCents ?? 0;

  if (channel.accessModel === "subscription") {
    const priceId = await ensureSubscriptionPrice(stripe, channel);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        application_fee_percent: feeBps / 100,
        transfer_data: { destination: acct.stripeAccountId },
        metadata: { type: "channel_sub", channelId: String(channelId), userId, communityId: String(channel.communityId) },
      },
      metadata: { type: "channel_sub", channelId: String(channelId), userId, communityId: String(channel.communityId) },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    if (!session.url) throw new Error("checkout_session_no_url");
    return session.url;
  }

  // one-time
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: { currency: channel.currency, unit_amount: priceCents, product_data: { name: `Canale: ${channel.name}` } },
      quantity: 1,
    }],
    payment_intent_data: {
      application_fee_amount: computeApplicationFee(priceCents, feeBps),
      transfer_data: { destination: acct.stripeAccountId },
    },
    metadata: { type: "channel_unlock", channelId: String(channelId), userId, communityId: String(channel.communityId) },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  if (!session.url) throw new Error("checkout_session_no_url");
  return session.url;
}
