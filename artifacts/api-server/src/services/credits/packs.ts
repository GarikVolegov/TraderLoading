// Credit packs (sub-project B). Server constant, not a table. Each pack's Stripe
// Price id comes from env (mode=payment), so packs stay dark until configured.
export interface CreditPack {
  id: string;
  credits: number;
  /** Env var holding the Stripe Price id for this pack (one-time payment). */
  priceEnv: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "starter", credits: 100, priceEnv: "STRIPE_CREDIT_PRICE_STARTER" },
  { id: "plus", credits: 500, priceEnv: "STRIPE_CREDIT_PRICE_PLUS" },
  { id: "pro", credits: 1200, priceEnv: "STRIPE_CREDIT_PRICE_PRO" },
];

export function creditPackFor(id: unknown): CreditPack | null {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null;
}

export function packCredits(id: unknown): number | null {
  return creditPackFor(id)?.credits ?? null;
}

/** The configured Stripe Price id for a pack, or null if the env var is unset. */
export function packPriceId(pack: CreditPack): string | null {
  const value = process.env[pack.priceEnv];
  return value && value.trim() ? value.trim() : null;
}
