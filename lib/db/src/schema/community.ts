import { pgTable, serial, text, timestamp, integer, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

export const communitiesTable = pgTable("communities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  iconEmoji: text("icon_emoji").notNull().default("🏛️"),
  creatorId: text("creator_id").notNull(),
  isPublic: boolean("is_public").notNull().default(true),
  memberCount: integer("member_count").notNull().default(1),
  // Customization (phase 2): image assets, accent color and editable texts.
  bannerUrl: text("banner_url"),
  avatarUrl: text("avatar_url"),
  accentColor: text("accent_color"),
  rules: text("rules"),
  welcomeMessage: text("welcome_message"),
  // Denormalized review aggregates (phase 3): avg = ratingSum / ratingCount.
  ratingSum: integer("rating_sum").notNull().default(0),
  ratingCount: integer("rating_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("communities_creator_idx").on(t.creatorId),
  index("communities_public_idx").on(t.isPublic),
]);

export const communityMembersTable = pgTable("community_members", {
  id: serial("id").primaryKey(),
  communityId: integer("community_id").notNull(),
  userId: text("user_id").notNull(),
  // Legacy label kept for backward-compat; source of truth is roleId →
  // communityRolesTable.permissions (plus owner via communities.creatorId).
  role: text("role").notNull().default("member"),
  roleId: integer("role_id"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("community_members_pair_idx").on(t.communityId, t.userId),
  index("community_members_community_idx").on(t.communityId),
  index("community_members_user_idx").on(t.userId),
]);

// Custom, per-community granular roles. The community creator (owner) is
// implicit and always has every permission; everyone else derives their
// capabilities from the `permissions` array of their assigned role.
export const communityRolesTable = pgTable("community_roles", {
  id: serial("id").primaryKey(),
  communityId: integer("community_id").notNull(),
  name: text("name").notNull(),
  color: text("color"),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  position: integer("position").notNull().default(0),
  // Role auto-assigned to new joiners (exactly one per community).
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("community_roles_community_idx").on(t.communityId),
]);

export const communityBansTable = pgTable("community_bans", {
  id: serial("id").primaryKey(),
  communityId: integer("community_id").notNull(),
  userId: text("user_id").notNull(),
  bannedBy: text("banned_by").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("community_bans_pair_idx").on(t.communityId, t.userId),
  index("community_bans_community_idx").on(t.communityId),
]);

export const communityMutesTable = pgTable("community_mutes", {
  id: serial("id").primaryKey(),
  communityId: integer("community_id").notNull(),
  userId: text("user_id").notNull(),
  mutedBy: text("muted_by").notNull(),
  // NULL = indefinite mute; otherwise the mute expires at this instant.
  until: timestamp("until"),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("community_mutes_pair_idx").on(t.communityId, t.userId),
  index("community_mutes_community_idx").on(t.communityId),
]);

export const communityChannelsTable = pgTable("community_channels", {
  id: serial("id").primaryKey(),
  communityId: integer("community_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("text"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("community_channels_community_idx").on(t.communityId),
]);

export const communityMessagesTable = pgTable("community_messages", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  avatarUrl: text("avatar_url"),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  // Channel chat is keyset-paginated: WHERE channel_id AND id < cursor
  // ORDER BY id DESC LIMIT n. The composite serves filter + range + sort.
  index("community_messages_channel_id_idx").on(t.channelId, t.id),
  index("community_messages_created_idx").on(t.createdAt),
]);

export const communityFilesTable = pgTable("community_files", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  communityId: integer("community_id").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  avatarUrl: text("avatar_url"),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull().default(0),
  mimeType: text("mime_type").notNull(),
  fileUrl: text("file_url").notNull(),
  downloadable: boolean("downloadable").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("community_files_channel_idx").on(t.channelId),
  index("community_files_community_idx").on(t.communityId),
]);

export const voicePresenceTable = pgTable("voice_presence", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  avatarUrl: text("avatar_url"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  lastPing: timestamp("last_ping").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("voice_presence_pair_idx").on(t.channelId, t.userId),
  index("voice_presence_channel_idx").on(t.channelId),
]);

// Member reviews of a community (one per user) with optional owner reply and
// soft-hide moderation. Aggregates live denormalized on communitiesTable.
export const communityReviewsTable = pgTable("community_reviews", {
  id: serial("id").primaryKey(),
  communityId: integer("community_id").notNull(),
  userId: text("user_id").notNull(),
  rating: integer("rating").notNull(),
  text: text("text").notNull().default(""),
  ownerResponse: text("owner_response"),
  ownerResponseAt: timestamp("owner_response_at"),
  hidden: boolean("hidden").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("community_reviews_pair_idx").on(t.communityId, t.userId),
  index("community_reviews_community_idx").on(t.communityId),
]);

export const communityReviewReportsTable = pgTable("community_review_reports", {
  id: serial("id").primaryKey(),
  reviewId: integer("review_id").notNull(),
  reporterUserId: text("reporter_user_id").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("community_review_reports_pair_idx").on(t.reviewId, t.reporterUserId),
  index("community_review_reports_review_idx").on(t.reviewId),
]);

// Append-only moderation audit trail: who did what to whom, so ban/kick/mute/
// role-change/message-delete actions are accountable. Never updated or deleted
// except when the whole community is removed.
export const communityModerationLogTable = pgTable("community_moderation_log", {
  id: serial("id").primaryKey(),
  communityId: integer("community_id").notNull(),
  actorUserId: text("actor_user_id").notNull(),
  action: text("action").notNull(),
  targetUserId: text("target_user_id"),
  targetId: integer("target_id"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("community_moderation_log_community_idx").on(t.communityId, t.createdAt)]);

export type Community = typeof communitiesTable.$inferSelect;
export type CommunityMember = typeof communityMembersTable.$inferSelect;
export type CommunityRole = typeof communityRolesTable.$inferSelect;
export type CommunityBan = typeof communityBansTable.$inferSelect;
export type CommunityMute = typeof communityMutesTable.$inferSelect;
export type CommunityReview = typeof communityReviewsTable.$inferSelect;
export type CommunityReviewReport = typeof communityReviewReportsTable.$inferSelect;
export type CommunityChannel = typeof communityChannelsTable.$inferSelect;
export type CommunityMessage = typeof communityMessagesTable.$inferSelect;
export type CommunityFile = typeof communityFilesTable.$inferSelect;
export type VoicePresence = typeof voicePresenceTable.$inferSelect;
