// Pure access decisions for paid channels (marketplace model). No I/O — routes resolve
// the viewer's entitlement + owner/manage status from the DB and delegate here. Pricing
// itself lives in channelPricing.ts; this is only the read choke point.

export interface Entitlement {
  expiresAt: Date | null; // null ⇒ permanent
}

/** An entitlement grants access iff it exists and is not expired at `now`
 *  (a null expiry is permanent; the expiry instant itself counts as expired). */
export function isEntitlementActive(ent: Entitlement | null, now: Date): boolean {
  if (!ent) return false;
  if (ent.expiresAt == null) return true;
  return ent.expiresAt.getTime() > now.getTime();
}

/** The single read choke point: free, or the owner, or a channels.manage holder, or an
 *  active entitlement. Owner/manage preview their own paid channels. */
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
