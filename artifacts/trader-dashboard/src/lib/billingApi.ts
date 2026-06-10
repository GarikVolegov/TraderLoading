import { apiJSON, type RelativeApiOptions } from "./apiFetch";

export interface BillingStatus {
  plan: "free" | "pro";
  pro: boolean;
  status: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
}

export interface CheckoutSessionResponse {
  clientSecret: string;
}

export const billingQueryKey = ["/api/billing/me"] as const;

export function fetchBillingStatus(options?: RelativeApiOptions): Promise<BillingStatus> {
  return apiJSON<BillingStatus>("billing/me", undefined, options);
}

export function createCheckoutSession(options?: RelativeApiOptions): Promise<CheckoutSessionResponse> {
  return apiJSON<CheckoutSessionResponse>("billing/checkout-session", { method: "POST" }, options);
}
