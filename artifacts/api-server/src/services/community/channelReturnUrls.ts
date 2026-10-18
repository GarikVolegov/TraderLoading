/** Return to the exact channel; entitlement still comes only from Stripe's webhook. */
export function channelReturnUrls(appBaseUrl: string, communityId: number, channelId: number) {
  const target = `${appBaseUrl.replace(/\/$/, "")}/chat?t=conversazioni&community=${communityId}&channel=${channelId}`;
  return { successUrl: `${target}&unlock=success`, cancelUrl: `${target}&unlock=cancel` };
}
