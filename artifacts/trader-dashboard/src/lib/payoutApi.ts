// Off-contract client for creator payout (sub-project D).
import { apiJSON } from "./apiFetch";

export interface PayoutConfig {
  enabled: boolean;
  creditCents: number | null;
  minCredits: number;
  feeBps: number;
  currency: string;
}
export interface PayoutAccount {
  onboarded: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  status: string;
}

export const payoutConfigKey = () => ["payout/config"] as const;
export const payoutAccountKey = () => ["payout/account"] as const;

export function fetchPayoutConfig(): Promise<PayoutConfig> {
  return apiJSON("payout/config");
}
export function fetchPayoutAccount(): Promise<PayoutAccount> {
  return apiJSON("payout/account");
}

/** Begin/resume Stripe Connect onboarding; returns the hosted onboarding URL. */
export function startPayoutOnboarding(): Promise<{ url: string }> {
  return apiJSON("payout/account/onboard", { method: "POST" });
}

export interface PayoutResult {
  id: number;
  credits: number;
  netCents: number;
  currency: string;
  status: string;
}
export function requestPayout(credits: number): Promise<PayoutResult> {
  return apiJSON("payout/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credits }),
  });
}

/** Net payout in currency units after the platform fee (mirrors server computePayout). */
export function estimateNet(credits: number, cfg: PayoutConfig): number {
  if (!cfg.creditCents) return 0;
  const gross = credits * cfg.creditCents;
  const fee = Math.floor((gross * cfg.feeBps) / 10000);
  return (gross - fee) / 100;
}
