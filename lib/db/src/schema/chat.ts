import { index, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
  // Conversation history is keyset-paginated: WHERE sender/receiver AND id < cursor
  // ORDER BY id DESC LIMIT n. Trailing id serves the range + sort in one scan.
  index("idx_chat_sender_receiver_id").on(table.senderId, table.receiverId, table.id),
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

export const userE2eeKeyBackupsTable = pgTable("user_e2ee_key_backups", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  publicKeyJwk: text("public_key_jwk").notNull(),
  privateKeyJwk: text("private_key_jwk").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_user_e2ee_key_backups_user").on(table.userId),
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
export type UserE2eeKeyBackup = typeof userE2eeKeyBackupsTable.$inferSelect;
export type GlobalChatMessage = typeof globalChatMessagesTable.$inferSelect;
