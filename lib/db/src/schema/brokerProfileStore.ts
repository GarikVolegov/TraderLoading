import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const brokerProfileStoreTable = pgTable("broker_profile_store", {
  storeKey: text("store_key").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
