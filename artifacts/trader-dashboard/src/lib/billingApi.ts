import { useQuery } from "@tanstack/react-query";
import { apiJSON, type RelativeApiOptions } from "./apiFetch";

export interface BillingStatus {
  plan: "free" | "pro";
  pro: boolean;
  status: string;
  source?: string | null;
  manualOverride?: boolean;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  canCancel?: boolean;
  canResume?: boolean;
  canViewInvoices?: boolean;
  // Whether POST /billing/checkout-session can succeed (Stripe env configured
  // server-side). When false, upgrade CTAs show an honest notice instead of a
  // dialog that always 503s.
  checkoutAvailable?: boolean;
}

export interface CheckoutSessionResponse {
  clientSecret: string;
}

export interface BillingInvoice {
  id: string;
  number: string | null;
  status: string | null;
  amountPaid: number;
  currency: string;
  hostedInvoiceUrl: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface BillingInvoicesResponse {
  invoices: BillingInvoice[];
}

export const billingQueryKey = ["/api/billing/me"] as const;

export function fetchBillingStatus(options?: RelativeApiOptions): Promise<BillingStatus> {
  return apiJSON<BillingStatus>("billing/me", undefined, options);
}

export function billingStatusQueryOptions(options?: RelativeApiOptions) {
  return {
    queryKey: billingQueryKey,
    queryFn: () => fetchBillingStatus(options),
    staleTime: 0,
    refetchOnMount: "always" as const,
    refetchOnReconnect: "always" as const,
    refetchOnWindowFocus: "always" as const,
  };
}

export function useBillingStatus(options?: RelativeApiOptions) {
  return useQuery<BillingStatus>(billingStatusQueryOptions(options));
}

export function createCheckoutSession(options?: RelativeApiOptions): Promise<CheckoutSessionResponse> {
  return apiJSON<CheckoutSessionResponse>("billing/checkout-session", { method: "POST" }, options);
}

export function confirmCheckoutSession(
  sessionId: string,
  options?: RelativeApiOptions,
): Promise<BillingStatus> {
  return apiJSON<BillingStatus>(
    "billing/confirm-session",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    },
    options,
  );
}

export function cancelSubscription(options?: RelativeApiOptions): Promise<BillingStatus> {
  return apiJSON<BillingStatus>("billing/cancel", { method: "POST" }, options);
}

export function resumeSubscription(options?: RelativeApiOptions): Promise<BillingStatus> {
  return apiJSON<BillingStatus>("billing/resume", { method: "POST" }, options);
}

export function fetchBillingInvoices(options?: RelativeApiOptions): Promise<BillingInvoicesResponse> {
  return apiJSON<BillingInvoicesResponse>("billing/invoices", undefined, options);
}
