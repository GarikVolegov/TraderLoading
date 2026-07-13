// Off-contract client for the creator Stripe Connect account (marketplace model).
import { apiJSON } from "./apiFetch";

export interface PayoutAccount {
  onboarded: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  status: string;
  // Whether Stripe Connect is configured at all (STRIPE_SECRET_KEY present).
  // When false, onboarding always 402s — the FE hides the card instead.
  available: boolean;
}

export const payoutAccountKey = () => ["payout/account"] as const;

export function fetchPayoutAccount(): Promise<PayoutAccount> {
  return apiJSON("payout/account");
}

/** Begin/resume Stripe Connect onboarding; returns the hosted onboarding URL. */
export function startPayoutOnboarding(): Promise<{ url: string }> {
  return apiJSON("payout/account/onboard", { method: "POST" });
}

/** Stripe Express dashboard login link for an onboarded creator. */
export function fetchDashboardLink(): Promise<{ url: string }> {
  return apiJSON("payout/account/dashboard");
}
