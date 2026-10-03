// Pure pricing decisions for paid channels in the marketplace model (Stripe Connect
// direct charges). Prices are in real-currency minor units (cents). No I/O.

export const MIN_PRICE_CENTS = 50; // Stripe's smallest chargeable amount (~€0.50)
export const MAX_PRICE_CENTS = 99_999_999; // per-charge sanity ceiling

export interface ChannelPrice {
  priceCents: number | null;
  accessModel: string | null; // 'one_time' | 'subscription' | null
  subInterval: string | null; // 'month' | 'year' (subscription only)
}

/** A channel is free unless it carries a positive price. */
export function isChannelFree(c: Pick<ChannelPrice, "priceCents">): boolean {
  return c.priceCents == null || c.priceCents <= 0;
}

/** Platform application fee = floor(price × feeBps / 10000). */
export function computeApplicationFee(priceCents: number, feeBps: number): number {
  return Math.floor((priceCents * feeBps) / 10000);
}

function isPositiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

/** Validate a creator's price edit; returns the normalized row (free clears model/interval;
 *  one-time clears interval; subscription requires a valid interval). */
export function validateChannelPrice(
  p: ChannelPrice,
): { ok: true; normalized: ChannelPrice } | { ok: false; reason: string } {
  if (p.priceCents == null || p.priceCents <= 0) {
    return { ok: true, normalized: { priceCents: null, accessModel: null, subInterval: null } };
  }
  if (!isPositiveInt(p.priceCents) || p.priceCents < MIN_PRICE_CENTS || p.priceCents > MAX_PRICE_CENTS) {
    return { ok: false, reason: "invalid_price" };
  }
  if (p.accessModel !== "one_time" && p.accessModel !== "subscription") {
    return { ok: false, reason: "invalid_access_model" };
  }
  if (p.accessModel === "one_time") {
    return { ok: true, normalized: { priceCents: p.priceCents, accessModel: "one_time", subInterval: null } };
  }
  if (p.subInterval !== "month" && p.subInterval !== "year") {
    return { ok: false, reason: "invalid_interval" };
  }
  return { ok: true, normalized: { priceCents: p.priceCents, accessModel: "subscription", subInterval: p.subInterval } };
}
