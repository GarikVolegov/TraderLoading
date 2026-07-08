// Pure decisions for per-channel paid access (sub-project C). No I/O — routes resolve
// the channel pricing, the viewer's entitlement, and owner/manage status from the DB and
// delegate every read/write/purchase decision here.

export const MAX_CHANNEL_PRICE = 1_000_000;
export const MAX_SUBSCRIPTION_DAYS = 366;
const DAY_MS = 86_400_000;

export interface ChannelPricing {
  priceCredits: number | null;
  accessModel: string | null; // 'one_time' | 'subscription' | null
  subscriptionPeriodDays: number | null;
}
export interface Entitlement {
  expiresAt: Date | null; // null ⇒ permanent
}

/** A channel is free unless it carries a positive price. */
export function isChannelFree(c: Pick<ChannelPricing, "priceCredits">): boolean {
  return c.priceCredits == null || c.priceCredits <= 0;
}

/** An entitlement grants access iff it exists and is not expired at `now`
 *  (a null expiry is permanent; the expiry instant itself counts as expired). */
export function isEntitlementActive(ent: Entitlement | null, now: Date): boolean {
  if (!ent) return false;
  if (ent.expiresAt == null) return true;
  return ent.expiresAt.getTime() > now.getTime();
}

/** The single read/write choke point: free, or the owner, or a channels.manage
 *  holder, or an active entitlement. Owner/manage preview their own paid channels. */
export function canAccessChannel(args: {
  isFree: boolean;
  isOwner: boolean;
  canManage: boolean;
  entitlement: Entitlement | null;
  now: Date;
}): boolean {
  return (
    args.isFree ||
    args.isOwner ||
    args.canManage ||
    isEntitlementActive(args.entitlement, args.now)
  );
}

/** Expiry after a purchase/renewal. one_time ⇒ null (permanent). subscription ⇒
 *  max(now, existingExpiry) + periodDays, so an active renewal stacks and a lapsed
 *  one restarts from now. */
export function computeEntitlementExpiry(args: {
  accessModel: string;
  subscriptionPeriodDays: number;
  existingExpiry: Date | null;
  now: Date;
}): Date | null {
  if (args.accessModel !== "subscription") return null;
  const anchor =
    args.existingExpiry && args.existingExpiry.getTime() > args.now.getTime()
      ? args.existingExpiry.getTime()
      : args.now.getTime();
  return new Date(anchor + args.subscriptionPeriodDays * DAY_MS);
}

function isPositiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

/** Validate a creator's pricing edit before persisting; returns the normalized row
 *  (free clears model/period; one_time clears period). */
export function validateChannelPricing(
  p: ChannelPricing,
): { ok: true; normalized: ChannelPricing } | { ok: false; error: string } {
  // Free: no positive price ⇒ clear the rest.
  if (p.priceCredits == null || p.priceCredits <= 0) {
    return { ok: true, normalized: { priceCredits: null, accessModel: null, subscriptionPeriodDays: null } };
  }
  if (!isPositiveInt(p.priceCredits) || p.priceCredits > MAX_CHANNEL_PRICE) {
    return { ok: false, error: "invalid_price" };
  }
  if (p.accessModel !== "one_time" && p.accessModel !== "subscription") {
    return { ok: false, error: "invalid_access_model" };
  }
  if (p.accessModel === "one_time") {
    return { ok: true, normalized: { priceCredits: p.priceCredits, accessModel: "one_time", subscriptionPeriodDays: null } };
  }
  // subscription
  if (!isPositiveInt(p.subscriptionPeriodDays) || p.subscriptionPeriodDays > MAX_SUBSCRIPTION_DAYS) {
    return { ok: false, error: "invalid_period" };
  }
  return {
    ok: true,
    normalized: { priceCredits: p.priceCredits, accessModel: "subscription", subscriptionPeriodDays: p.subscriptionPeriodDays },
  };
}

/** Whether a buyer may purchase now. A free channel is not purchasable; an active
 *  one_time unlock cannot be re-bought (already-owned); a subscription may always be
 *  (re)purchased to extend, and a lapsed one_time may be re-bought. */
export function canPurchase(args: {
  isFree: boolean;
  accessModel: string;
  entitlement: Entitlement | null;
  now: Date;
}): { ok: true } | { ok: false; reason: "free" | "already-owned" } {
  if (args.isFree) return { ok: false, reason: "free" };
  if (args.accessModel === "one_time" && isEntitlementActive(args.entitlement, args.now)) {
    return { ok: false, reason: "already-owned" };
  }
  return { ok: true };
}
