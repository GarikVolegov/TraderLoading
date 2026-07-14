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

export interface CommunityType {
  id: number;
  name: string;
  description: string;
  iconEmoji: string;
  memberCount: number;
  isMember: boolean;
  creatorId: string;
  isPublic: boolean;
  createdAt: string;
  bannerUrl?: string | null;
  avatarUrl?: string | null;
  accentColor?: string | null;
  rules?: string | null;
  welcomeMessage?: string | null;
  ratingAvg?: number;
  ratingCount?: number;
  // Private + non-member: discovery/detail returns a cover only (audit 0.5b).
  locked?: boolean;
}

export interface CommunityReview {
  id: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  rating: number;
  text: string;
  ownerResponse: string | null;
  ownerResponseAt: string | null;
  hidden: boolean;
  createdAt: string;
}

export interface CommunityReviewsResponse {
  reviews: CommunityReview[];
  myReview: CommunityReview | null;
  ratingAvg: number;
  ratingCount: number;
  isMember: boolean;
  canRespond: boolean;
  canModerate: boolean;
}

export interface ChannelType {
  id: number;
  communityId: number;
  name: string;
  type: "text" | "voice";
  position: number;
  // Paid-channel pricing (marketplace). priceCents null/<=0 ⇒ free.
  priceCents?: number | null;
  accessModel?: "one_time" | "subscription" | null;
  subInterval?: "month" | "year" | null;
  currency?: string;
  locked?: boolean; // per-viewer: true when the current user can't yet read it
}

export interface ChannelAccessState {
  isFree: boolean;
  priceCents: number | null;
  accessModel: "one_time" | "subscription" | null;
  subInterval: "month" | "year" | null;
  currency: string;
  locked: boolean;
  entitlement: { expiresAt: string | null } | null;
}

export interface CommunityRole {
  id: number;
  communityId: number;
  name: string;
  color: string | null;
  permissions: string[];
  position: number;
  isDefault: boolean;
}

export interface CommunityMemberRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  roleId: number | null;
  roleName: string | null;
  roleColor: string | null;
  joinedAt: string;
  isOwner: boolean;
}

export interface CommunityBanRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  reason: string | null;
  bannedBy: string;
  createdAt: string;
}

export interface CommunityDetail extends Omit<CommunityType, "creatorId" | "createdAt"> {
  // channels/myRole/myRoleId/myPermissions/roles/creatorId/createdAt are all
  // OMITTED by the server's cover-only payload for a private non-member
  // (GET /community/:id, "never channels/roles/messages" — audit 0.5b) —
  // optional here so every consumer is forced to guard instead of assuming
  // full-detail shape (the CommunityTab.tsx crash this fixed was exactly a
  // consumer that assumed `channels` was always present). creatorId/createdAt
  // are `string` (required) on the base CommunityType, so they're re-declared
  // via Omit rather than a plain override (TS forbids narrowing a required
  // field to optional through plain interface extension).
  channels?: ChannelType[];
  myRole?: string | null;
  isOwner: boolean;
  myRoleId?: number | null;
  myPermissions?: string[];
  roles?: CommunityRole[];
  creatorId?: string;
  createdAt?: string;
  // Present only in the cover-only payload for a private non-member (audit 0.5b).
  joinRequestStatus?: "none" | "pending" | "rejected" | "approved";
}

export interface CommunityMsg {
  id: number;
  channelId: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  content: string;
  imageUrl: string | null;
  createdAt: string;
}

export interface VoiceParticipant {
  userId: string;
  userName: string;
  avatarUrl: string | null;
}
