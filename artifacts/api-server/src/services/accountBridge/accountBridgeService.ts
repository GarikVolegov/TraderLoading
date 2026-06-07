import { createDemoAccountAdapter } from "./demoAdapter.js";
import { buildJournalEntryFromAccountTrade } from "./journalImport.js";
import { createMt5LocalSocketAdapter } from "./mt5LocalSocketAdapter.js";
import { validateOrderRequest } from "./validation.js";
import type {
  AccountAdapter,
  AccountBridgeConfig,
  AccountBridgeEvent,
  AccountOrderResult,
  AccountSnapshot,
  AccountTrade,
} from "./types.js";

type Listener = (event: AccountBridgeEvent) => void;

export interface AccountBridgeService {
  start(): Promise<void>;
  stop(): Promise<void>;
  getSnapshot(): Promise<AccountSnapshot>;
  placeOrder(raw: unknown, requestId?: string): Promise<AccountOrderResult>;
  onEvent(listener: Listener): () => void;
}

function cloneTrade(trade: AccountTrade): AccountTrade {
  return { ...trade };
}

function cloneSnapshot(snapshot: AccountSnapshot): AccountSnapshot {
  return {
    ...snapshot,
    metrics: { ...snapshot.metrics },
    openTrades: snapshot.openTrades.map(cloneTrade),
    closedTrades: snapshot.closedTrades.map(cloneTrade),
  };
}

function cloneEvent(event: AccountBridgeEvent): AccountBridgeEvent {
  switch (event.type) {
    case "snapshot":
      return { type: "snapshot", snapshot: cloneSnapshot(event.snapshot) };
    case "account_update":
      return { type: "account_update", metrics: { ...event.metrics } };
    case "positions_update":
      return { type: "positions_update", openTrades: event.openTrades.map(cloneTrade) };
    case "trade_closed":
      return { type: "trade_closed", trade: cloneTrade(event.trade) };
    case "order_ack":
      return { ...event, result: { ...event.result } };
    default:
      return event;
  }
}

function createAdapter(config: AccountBridgeConfig): AccountAdapter {
  if (config.adapter === "mt5-local-socket") {
    return createMt5LocalSocketAdapter(config);
  }

  return createDemoAccountAdapter();
}

function decimal(value: number | undefined): string | null {
  return value == null ? null : String(value);
}

async function persistClosedTrade(config: AccountBridgeConfig, trade: AccountTrade): Promise<number | null> {
  if (!config.importJournal || trade.status !== "closed" || !process.env.DATABASE_URL) {
    return null;
  }

  try {
    const { db, accountTradesTable, journalEntriesTable } = await import("@workspace/db");
    const { and, eq } = await import("drizzle-orm");
    const userId = "guest";

    const [accountRow] = await db
      .insert(accountTradesTable)
      .values({
        ticket: trade.ticket,
        source: trade.source,
        symbol: trade.symbol,
        direction: trade.direction,
        volume: String(trade.volume),
        openTime: trade.openTime,
        closeTime: trade.closeTime ?? null,
        entryPrice: String(trade.entryPrice),
        exitPrice: decimal(trade.exitPrice),
        stopLoss: decimal(trade.stopLoss),
        takeProfit: decimal(trade.takeProfit),
        profit: decimal(trade.profit),
        commission: decimal(trade.commission),
        swap: decimal(trade.swap),
        status: trade.status,
        userId,
      })
      .onConflictDoNothing()
      .returning({ id: accountTradesTable.id });

    if (!accountRow) return null;

    const draft = buildJournalEntryFromAccountTrade(trade);
    const [journalRow] = await db
      .insert(journalEntriesTable)
      .values({
        title: draft.title,
        content: draft.content,
        tradeDate: draft.tradeDate,
        result: draft.result,
        tags: draft.tags,
        userId: null,
      })
      .returning({ id: journalEntriesTable.id });

    if (!journalRow) return null;

    await db
      .update(accountTradesTable)
      .set({ journalEntryId: journalRow.id, updatedAt: new Date() })
      .where(
        and(
          eq(accountTradesTable.source, trade.source),
          eq(accountTradesTable.ticket, trade.ticket),
          eq(accountTradesTable.userId, userId),
        ),
      );

    return journalRow.id;
  } catch (error) {
    console.error("[accountBridge] failed to persist closed trade", error);
    return null;
  }
}

export function createAccountBridgeService(config: AccountBridgeConfig): AccountBridgeService {
  const adapter = createAdapter(config);
  const listeners = new Set<Listener>();
  const importedTickets = new Set<string>();
  let unsubscribeAdapter: (() => void) | null = null;
  let started = false;

  function emit(event: AccountBridgeEvent): void {
    for (const listener of Array.from(listeners)) {
      try {
        listener(cloneEvent(event));
      } catch (error) {
        console.error("[accountBridge] listener error", error);
      }
    }
  }

  async function maybeImportTrade(trade: AccountTrade): Promise<void> {
    const key = `${trade.source}:${trade.ticket}`;
    if (importedTickets.has(key)) return;
    const journalEntryId = await persistClosedTrade(config, trade);
    if (!journalEntryId) return;
    importedTickets.add(key);
    emit({ type: "journal_imported", ticket: trade.ticket, journalEntryId });
  }

  function handleAdapterEvent(event: AccountBridgeEvent): void {
    if (event.type === "order_ack") return;

    emit(event);

    if (event.type === "trade_closed") {
      void maybeImportTrade(event.trade);
    }

    if (event.type === "snapshot") {
      for (const trade of event.snapshot.closedTrades) {
        void maybeImportTrade(trade);
      }
    }
  }

  return {
    async start(): Promise<void> {
      if (started) return;
      started = true;
      unsubscribeAdapter = adapter.onEvent(handleAdapterEvent);
      await adapter.connect();
      emit({ type: "snapshot", snapshot: await adapter.getSnapshot() });
    },

    async stop(): Promise<void> {
      started = false;
      unsubscribeAdapter?.();
      unsubscribeAdapter = null;
      await adapter.disconnect();
    },

    async getSnapshot(): Promise<AccountSnapshot> {
      return adapter.getSnapshot();
    },

    async placeOrder(raw: unknown, requestId?: string): Promise<AccountOrderResult> {
      const snapshot = await adapter.getSnapshot();
      const validation = validateOrderRequest(raw, {
        mode: snapshot.mode,
        orderEnabled: snapshot.orderEnabled,
      });

      if (!validation.ok) {
        const result = { accepted: false, reason: validation.reason };
        emit({ type: "order_rejected", requestId, reason: validation.reason });
        return result;
      }

      const result = await adapter.placeOrder(validation.order);
      emit({ type: "order_ack", requestId, result });
      return result;
    },

    onEvent(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
