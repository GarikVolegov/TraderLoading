import { pgTable, serial, text, timestamp, integer, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";

export const followsTable = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: text("follower_id").notNull(),
  followingId: text("following_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("follows_pair_idx").on(t.followerId, t.followingId),
  index("follows_follower_idx").on(t.followerId),
  index("follows_following_idx").on(t.followingId),
]);

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  avatarUrl: text("avatar_url"),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  isStory: boolean("is_story").notNull().default(false),
  expiresAt: timestamp("expires_at"),
  likesCount: integer("likes_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("posts_user_idx").on(t.userId),
  index("posts_created_idx").on(t.createdAt),
  index("posts_story_idx").on(t.isStory, t.expiresAt),
]);

export const postLikesTable = pgTable("post_likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("post_likes_pair_idx").on(t.postId, t.userId),
  index("post_likes_post_idx").on(t.postId),
]);

export const postCommentsTable = pgTable("post_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  avatarUrl: text("avatar_url"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("post_comments_post_idx").on(t.postId),
  index("post_comments_created_idx").on(t.createdAt),
]);

export type Follow = typeof followsTable.$inferSelect;
export type Post = typeof postsTable.$inferSelect;
export type PostLike = typeof postLikesTable.$inferSelect;
export type PostComment = typeof postCommentsTable.$inferSelect;
