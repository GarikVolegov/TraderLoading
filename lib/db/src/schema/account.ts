import { integer, numeric, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { journalEntriesTable } from "./journal";

export const accountTradesTable = pgTable(
  "account_trades",
  {
    id: serial("id").primaryKey(),
    ticket: text("ticket").notNull(),
    source: text("source").notNull(),
    symbol: text("symbol").notNull(),
    direction: text("direction").notNull(),
    volume: numeric("volume", { precision: 12, scale: 2 }).notNull(),
    openTime: text("open_time").notNull(),
    closeTime: text("close_time"),
    entryPrice: numeric("entry_price", { precision: 14, scale: 5 }).notNull(),
    exitPrice: numeric("exit_price", { precision: 14, scale: 5 }),
    stopLoss: numeric("stop_loss", { precision: 14, scale: 5 }),
    takeProfit: numeric("take_profit", { precision: 14, scale: 5 }),
    profit: numeric("profit", { precision: 14, scale: 2 }),
    commission: numeric("commission", { precision: 14, scale: 2 }),
    swap: numeric("swap", { precision: 14, scale: 2 }),
    status: text("status").notNull().default("open"),
    brokerProfileId: text("broker_profile_id"),
    brokerAccountId: text("broker_account_id"),
    riskPriceDistance: numeric("risk_price_distance", { precision: 14, scale: 5 }),
    returnPct: numeric("return_pct", { precision: 12, scale: 4 }),
    journalEntryId: integer("journal_entry_id").references(() => journalEntriesTable.id, { onDelete: "set null" }),
    userId: text("user_id").notNull().default("guest"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    accountTradeUnique: uniqueIndex("account_trades_source_ticket_user_unique").on(
      table.source,
      table.ticket,
      table.userId,
    ),
  }),
);

export type AccountTradeRecord = typeof accountTradesTable.$inferSelect;
export type InsertAccountTradeRecord = typeof accountTradesTable.$inferInsert;
