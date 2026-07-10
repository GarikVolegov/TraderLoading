// Off-contract client for paid-channel access (marketplace model — Stripe Connect).
import { apiJSON } from "./apiFetch";
import type { ChannelAccessState } from "@/components/social/types";

export const channelAccessKey = (channelId: number) => ["community/channel-access", channelId] as const;

export function fetchChannelAccess(channelId: number): Promise<ChannelAccessState> {
  return apiJSON(`community/channels/${channelId}/access`);
}

/** Start a Stripe Checkout to buy access to a paid channel; returns the hosted URL to
 *  redirect to. The entitlement is granted server-side on the webhook, not here. */
export function startChannelCheckout(channelId: number): Promise<{ url: string | null }> {
  return apiJSON(`community/channels/${channelId}/checkout`, { method: "POST" });
}

export interface ChannelPricingInput {
  priceCents: number | null;
  accessModel: "one_time" | "subscription" | null;
  subInterval: "month" | "year" | null;
}

/** Set / clear a channel's price (requires the channels.manage permission). */
export function updateChannelPricing(channelId: number, pricing: ChannelPricingInput): Promise<ChannelPricingInput> {
  return apiJSON(`community/channels/${channelId}/pricing`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pricing),
  });
}
