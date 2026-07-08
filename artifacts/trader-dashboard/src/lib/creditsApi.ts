// Client off-contract del wallet crediti (sub-project B): tipi a mano + apiJSON.
import { apiJSON } from "./apiFetch";

export interface CreditPack {
  id: string;
  credits: number;
  priceConfigured: boolean;
}

export const creditWalletKey = () => ["/api/credits/wallet"] as const;
export const creditPacksKey = () => ["/api/credits/packs"] as const;

export function fetchCreditWallet(): Promise<{ balance: number }> {
  return apiJSON("credits/wallet");
}

export function fetchCreditPacks(): Promise<{ packs: CreditPack[] }> {
  return apiJSON("credits/packs");
}

/** Start a Stripe Checkout for a credit pack; returns the hosted-checkout URL to
 *  redirect to. Credits are granted server-side on the webhook, not here. */
export function startCreditCheckout(packId: string): Promise<{ url: string | null }> {
  return apiJSON("credits/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packId }),
  });
}
