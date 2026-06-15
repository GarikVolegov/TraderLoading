import { useQuery } from "@tanstack/react-query";
import {
  useSearchUsers,
  getSearchUsersQueryKey,
} from "@workspace/api-client-react";
import { apiJSON } from "@/lib/apiFetch";
import {
  fetchLeaderboard,
  leaderboardQueryKey,
  type LeaderboardEntry,
} from "@/lib/leaderboardApi";
import type {
  PostComment,
  CommunityFile,
  Post,
  StoryGroup,
  SocialUser,
  SocialProfileResponse,
  CommunityType,
  CommunityDetail,
  CommunityMsg,
  VoiceParticipant,
} from "./types";

export function usePostComments(postId: number | null) {
  return useQuery<PostComment[]>({
    queryKey: ["post-comments", postId],
    queryFn: () => apiJSON(`social/posts/${postId}/comments`),
    enabled: postId !== null,
    staleTime: 5000,
  });
}

export function useCommunityFiles(channelId: number | null) {
  return useQuery<CommunityFile[]>({
    queryKey: ["communityFiles", channelId],
    queryFn: () => apiJSON(`community/channels/${channelId}/files`),
    enabled: channelId !== null,
    refetchInterval: 10_000,
    staleTime: 0,
  });
}

export function useFeed() {
  return useQuery<(Post & { likedByMe: boolean; isOwnPost: boolean })[]>({
    queryKey: ["social/feed"],
    queryFn: () => apiJSON("social/feed"),
    refetchInterval: 8000,
  });
}

export function useStories() {
  return useQuery<StoryGroup[]>({
    queryKey: ["social/stories"],
    queryFn: () => apiJSON("social/stories"),
    refetchInterval: 30000,
  });
}

export function useMutualFollowers() {
  return useQuery<SocialUser[]>({
    queryKey: ["social/mutual-followers"],
    queryFn: () => apiJSON("social/mutual-followers"),
    refetchInterval: 15000,
  });
}

export function useLeaderboard() {
  return useQuery<LeaderboardEntry[]>({
    queryKey: leaderboardQueryKey,
    queryFn: () => fetchLeaderboard(),
  });
}

export function useFollowStatus(targetId: string | null) {
  return useQuery<{ isFollowing: boolean; isMutual: boolean }>({
    queryKey: ["social/follow-status", targetId],
    queryFn: () => apiJSON(`social/follow-status/${targetId}`),
    enabled: !!targetId,
  });
}

export function useUserProfile(userId: string | null) {
  return useQuery<SocialProfileResponse>({
    queryKey: ["social/profile", userId],
    queryFn: () => apiJSON(`social/profile/${userId}`),
    enabled: !!userId,
  });
}

export function useSocialSearch(q: string) {
  return useQuery<SocialUser[]>({
    queryKey: ["social/search", q],
    queryFn: () => apiJSON(`social/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
  });
}

export function useFriendSearch(q: string) {
  return useSearchUsers(
    { q },
    {
      query: {
        queryKey: getSearchUsersQueryKey({ q }),
        enabled: q.length >= 2,
      },
    },
  );
}

export function useCommunities() {
  return useQuery<CommunityType[]>({
    queryKey: ["communities"],
    queryFn: () => apiJSON("community"),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

export function useCommunityDetail(id: number | null) {
  return useQuery<CommunityDetail>({
    queryKey: ["community", id],
    queryFn: () => apiJSON(`community/${id}`),
    enabled: id !== null,
    staleTime: 10_000,
  });
}

export function useCommunityMessages(channelId: number | null) {
  return useQuery<{ messages: CommunityMsg[]; nextCursor: number | null }>({
    queryKey: ["communityMessages", channelId],
    queryFn: () => apiJSON(`community/channels/${channelId}/messages`),
    enabled: channelId !== null,
    refetchInterval: 3_000,
    staleTime: 0,
  });
}

export function useVoicePresence(channelId: number | null, enabled: boolean) {
  return useQuery<VoiceParticipant[]>({
    queryKey: ["voicePresence", channelId],
    queryFn: () => apiJSON(`community/voice/${channelId}/presence`),
    enabled: channelId !== null && enabled,
    refetchInterval: 5_000,
    staleTime: 0,
  });
}
