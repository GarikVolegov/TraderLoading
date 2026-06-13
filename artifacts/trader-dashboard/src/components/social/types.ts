import type { UserSearchResult } from "@workspace/api-client-react";

export interface DecryptedMsg {
  id: number;
  senderId: string;
  type: "text" | "image" | "voice" | "video" | "file";
  content: string;
  createdAt: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
}

export interface Post {
  id: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  content: string;
  imageUrl: string | null;
  isStory: boolean;
  expiresAt: string | null;
  likesCount: number;
  createdAt: string;
  likedByMe?: boolean;
  isOwnPost?: boolean;
}

export interface StoryGroup {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  stories: Post[];
  isOwn: boolean;
}

export interface SocialUser {
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  level?: number;
  xp?: number;
  isFollowing?: boolean;
  isMutual?: boolean;
  hasKey?: boolean;
}

export interface PostComment {
  id: number;
  postId: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  content: string;
  createdAt: string;
}

export interface CommunityFile {
  id: number;
  channelId: number;
  communityId: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  downloadable: boolean;
  createdAt: string;
}

export interface SocialProfileResponse {
  profile: SocialUser;
  posts: Post[];
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isMutual: boolean;
  isOwnProfile: boolean;
}

export interface CallSignal {
  callId: string;
  from: string;
  type: "offer" | "answer" | "ice" | "hangup";
  data: string;
}

export interface VoiceSignal {
  from: string;
  type: "offer" | "answer" | "ice";
  data: string;
}

export type FriendRelationshipStatus =
  | "none"
  | "pending_sent"
  | "pending_received"
  | "accepted";

export type FriendSearchResult = UserSearchResult & {
  relationshipStatus?: FriendRelationshipStatus;
};
