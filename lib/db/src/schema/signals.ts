import { index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Ephemeral WebRTC signaling (SDP offer/answer + ICE candidates) exchanged via
// HTTP polling. Stored in Postgres — NOT in process memory — so the sender and
// the polling recipient can land on different serverless instances and still
// see each other's signals. Rows are consumed on read and expire after ~30s.
export const signalsTable = pgTable(
  "signals",
  {
    id: serial("id").primaryKey(),
    // "call" for 1:1 calls, "voice:<channelId>" for community voice channels.
    scope: text("scope").notNull(),
    // The recipient user id (the `to`).
    recipientId: text("recipient_id").notNull(),
    fromId: text("from_id").notNull(),
    callId: text("call_id"),
    type: text("type").notNull(),
    data: text("data").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("signals_recipient_scope_idx").on(t.recipientId, t.scope)],
);

export type SignalRow = typeof signalsTable.$inferSelect;
