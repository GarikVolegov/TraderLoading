/** Navigation metadata is only visible to current, non-banned members or owners.
 * Resolving a destination never grants a paid-channel entitlement. */
export async function resolveChannelContext(userId: string, channelId: number, deps: {
  findChannel: (id: number) => Promise<{ id: number; communityId: number } | null>;
  memberContext: (communityId: number, userId: string) => Promise<{ isMember: boolean; isOwner: boolean; isBanned: boolean }>;
}): Promise<{ channelId: number; communityId: number } | null> {
  const channel = await deps.findChannel(channelId);
  if (!channel) return null;
  const ctx = await deps.memberContext(channel.communityId, userId);
  if (ctx.isBanned || (!ctx.isOwner && !ctx.isMember)) return null;
  return { channelId: channel.id, communityId: channel.communityId };
}
