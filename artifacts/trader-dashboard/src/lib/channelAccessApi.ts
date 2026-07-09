// Off-contract client for paid-channel access (sub-project C).
import { apiJSON } from "./apiFetch";
import type { ChannelAccessState } from "@/components/social/types";

export const channelAccessKey = (channelId: number) => ["community/channel-access", channelId] as const;

export function fetchChannelAccess(channelId: number): Promise<ChannelAccessState> {
  return apiJSON(`community/channels/${channelId}/access`);
}

export interface UnlockResult {
  balance: number;
  entitlement: { expiresAt: string | null };
}

/** Purchase / renew access to a paid channel (spends credits → owner's wallet).
 *  Pass the price the user saw; the server rejects (409) if it changed meanwhile. */
export function unlockChannel(channelId: number, expectedPriceCredits?: number): Promise<UnlockResult> {
  return apiJSON(`community/channels/${channelId}/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(expectedPriceCredits != null ? { expectedPriceCredits } : {}),
  });
}

export interface ChannelPricingInput {
  priceCredits: number | null;
  accessModel: "one_time" | "subscription" | null;
  subscriptionPeriodDays: number | null;
}

/** Set / clear a channel's price (requires the channels.manage permission). */
export function updateChannelPricing(channelId: number, pricing: ChannelPricingInput): Promise<ChannelPricingInput> {
  return apiJSON(`community/channels/${channelId}/pricing`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pricing),
  });
}
