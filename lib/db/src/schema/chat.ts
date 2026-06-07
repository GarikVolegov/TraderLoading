import { index, pgTable, serial, text, timestamp, uniqueIndex, integer } from "drizzle-orm/pg-core";

export const friendshipsTable = pgTable("friendships", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  friendId: text("friend_id").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_friendships_user").on(table.userId),
  index("idx_friendships_friend").on(table.friendId),
  uniqueIndex("idx_friendships_pair").on(table.userId, table.friendId),
]);

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  senderId: text("sender_id").notNull(),
  receiverId: text("receiver_id").notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  read: text("read").notNull().default("false"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_chat_sender_receiver").on(table.senderId, table.receiverId),
  index("idx_chat_receiver_read").on(table.receiverId, table.read),
]);

export const userPublicKeysTable = pgTable("user_public_keys", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  publicKeyJwk: text("public_key_jwk").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_user_public_keys_user").on(table.userId),
]);

export const globalChatMessagesTable = pgTable("global_chat_messages", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  avatarUrl: text("avatar_url"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_global_chat_created").on(table.createdAt),
]);

export type Friendship = typeof friendshipsTable.$inferSelect;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
export type UserPublicKey = typeof userPublicKeysTable.$inferSelect;
export type GlobalChatMessage = typeof globalChatMessagesTable.$inferSelect;
