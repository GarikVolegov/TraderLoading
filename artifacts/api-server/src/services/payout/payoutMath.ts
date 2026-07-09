// Pure payout math (sub-project D). No I/O — the route/service resolve config + balance
// from env/DB and delegate every economic decision here so the money-out arithmetic and
// eligibility rules are unit-tested in one place. Amounts are integer currency cents.

export interface PayoutConfig {
  creditCents: number | null; // payout-currency cents per 1 credit; null ⇒ disabled
  minCredits: number;
  feeBps: number; // platform fee, basis points of gross
  currency: string;
}

// int4 ceiling for the cents columns (gross/fee/net) — reject before a DB overflow.
export const MAX_PAYOUT_CENTS = 2_147_483_647;

// Stripe currencies whose smallest unit is NOT 1/100 of the major unit. Our cents math
// assumes 2 decimals, so any of these must disable payouts rather than mis-scale 100×.
const NON_TWO_DECIMAL_CURRENCIES = new Set([
  // zero-decimal
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
  // three-decimal
  "bhd", "jod", "kwd", "omr", "tnd",
]);

function isPositiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

/** Payouts are configured (and thus enabled) only when a positive integer credit
 *  value is set — otherwise the whole feature stays dark. */
export function isPayoutConfigured(c: PayoutConfig): boolean {
  return isPositiveInt(c.creditCents);
}

/** gross = credits × creditCents; fee = floor(gross × feeBps / 10000); net = gross − fee. */
export function computePayout(args: { credits: number; creditCents: number; feeBps: number }): {
  grossCents: number;
  feeCents: number;
  netCents: number;
} {
  const grossCents = args.credits * args.creditCents;
  const feeCents = Math.floor((grossCents * args.feeBps) / 10000);
  return { grossCents, feeCents, netCents: grossCents - feeCents };
}

/** Eligibility for a payout request. Order: disabled → invalid credits → below min →
 *  insufficient balance → nothing left after fee → ok. */
export function validatePayoutRequest(args: {
  credits: number;
  balance: number;
  config: PayoutConfig;
}):
  | { ok: true }
  | { ok: false; reason: "disabled" | "below_min" | "insufficient" | "invalid" | "zero_net" | "too_large" } {
  const { credits, balance, config } = args;
  if (!isPayoutConfigured(config)) return { ok: false, reason: "disabled" };
  if (!isPositiveInt(credits)) return { ok: false, reason: "invalid" };
  if (credits < config.minCredits) return { ok: false, reason: "below_min" };
  if (credits > balance) return { ok: false, reason: "insufficient" };
  const { grossCents, netCents } = computePayout({ credits, creditCents: config.creditCents as number, feeBps: config.feeBps });
  if (grossCents > MAX_PAYOUT_CENTS) return { ok: false, reason: "too_large" }; // would overflow int4
  if (netCents <= 0) return { ok: false, reason: "zero_net" };
  return { ok: true };
}

/** Thin, non-pure mapper: env → PayoutConfig. Fails SAFE — any unsafe/malformed money
 *  setting disables payouts (creditCents = null ⇒ dark) rather than guessing a value. */
export function readPayoutConfig(env: NodeJS.ProcessEnv = process.env): PayoutConfig {
  const rawMin = Number(env.PAYOUT_MIN_CREDITS);
  const minCredits = Number.isInteger(rawMin) && rawMin > 0 ? rawMin : 1000;

  // Fee: unset ⇒ 0 (fine); present-but-invalid/out-of-range ⇒ DISABLE (never fail-open to 0).
  let feeBps = 0;
  let feeUnsafe = false;
  if (env.PAYOUT_FEE_BPS != null && env.PAYOUT_FEE_BPS !== "") {
    const rawFee = Number(env.PAYOUT_FEE_BPS);
    if (Number.isInteger(rawFee) && rawFee >= 0 && rawFee < 10000) feeBps = rawFee;
    else feeUnsafe = true;
  }

  const currency = (env.PAYOUT_CURRENCY || "eur").toLowerCase();
  const currencyUnsafe = NON_TWO_DECIMAL_CURRENCIES.has(currency);

  const rawCents = Number(env.PAYOUT_CREDIT_CENTS);
  const centsOk = Number.isInteger(rawCents) && rawCents > 0;
  const creditCents = centsOk && !feeUnsafe && !currencyUnsafe ? rawCents : null;

  return { creditCents, minCredits, feeBps, currency };
}
