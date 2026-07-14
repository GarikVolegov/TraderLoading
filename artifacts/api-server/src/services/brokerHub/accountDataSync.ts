import type { BrokerAccountProfile, BrokerDeal, BrokerSnapshot } from "./types.js";
import { accountTradeChanged, toComparableTrade } from "./accountTradeDiff.js";

export interface BrokerAccountDataSyncInput {
  profile: BrokerAccountProfile;
  snapshot: BrokerSnapshot;
  deals: BrokerDeal[];
}

export interface BrokerAccountDataSyncResult {
  imported: number;
  journalCreated: number;
  updated: number;
  skipped: number;
  reason?: string;
}

type JournalTradeResult = "win" | "loss" | "breakeven";

function numeric(value: number | undefined): string | null {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

function money(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "-";
}

function price(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(5) : "-";
}

function volume(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "-";
}

export function resultFromTradeNet(deal: Pick<BrokerDeal, "profit" | "commission" | "swap">): JournalTradeResult {
  const profit = typeof deal.profit === "number" && Number.isFinite(deal.profit) ? deal.profit : 0;
  const commission = typeof deal.commission === "number" && Number.isFinite(deal.commission) ? deal.commission : 0;
  const swap = typeof deal.swap === "number" && Number.isFinite(deal.swap) ? deal.swap : 0;
  const netProfit = profit + commission + swap;

  if (netProfit > 0) return "win";
  if (netProfit < 0) return "loss";
  return "breakeven";
}

function parseBrokerDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function tradeDateFor(deal: BrokerDeal): string {
  const parsed = parseBrokerDate(deal.closedAt) ?? parseBrokerDate(deal.openedAt);
  if (parsed) return parsed.toISOString().slice(0, 10);
  const raw = deal.closedAt || deal.openedAt || new Date().toISOString();
  const match = raw.match(/\b(20\d{2})[-/ ](\d{1,2})[-/ ](\d{1,2})\b/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function riskPriceDistance(deal: BrokerDeal): number | undefined {
  if (typeof deal.entryPrice !== "number" || typeof deal.stopLoss !== "number" || deal.stopLoss <= 0) return undefined;
  const distance = Math.abs(deal.entryPrice - deal.stopLoss);
  return Number.isFinite(distance) && distance > 0 ? Number(distance.toFixed(5)) : undefined;
}

function returnPct(deal: BrokerDeal, snapshot: BrokerSnapshot): number | undefined {
  const balance = snapshot.metrics.balance;
  if (typeof deal.profit !== "number" || !Number.isFinite(deal.profit) || !Number.isFinite(balance) || balance <= 0) {
    return undefined;
  }
  return Number(((deal.profit / balance) * 100).toFixed(4));
}

function journalContent(profile: BrokerAccountProfile, snapshot: BrokerSnapshot, deal: BrokerDeal): string {
  const riskDistance = riskPriceDistance(deal);
  const tradeReturnPct = returnPct(deal, snapshot);
  const currency = snapshot.metrics.currency || "USD";

  return [
    `Ticket: ${deal.id}`,
    `Source: FX Blue Account Sync`,
    `Broker: ${profile.brokerName}`,
    `Account: ${profile.accountId || snapshot.accounts[0]?.id || "-"}`,
    `Symbol: ${deal.symbol}`,
    `Direction: ${deal.side.toUpperCase()}`,
    `Volume: ${volume(deal.volume)}`,
    `Open Time: ${deal.openedAt ?? "-"}`,
    `Close Time: ${deal.closedAt ?? "-"}`,
    `Entry Price: ${price(deal.entryPrice)}`,
    `Exit Price: ${price(deal.exitPrice)}`,
    `Stop Loss: ${price(deal.stopLoss)}`,
    `Take Profit: ${price(deal.takeProfit)}`,
    `Profit: ${money(deal.profit)} ${currency}`,
    `Commission: ${money(deal.commission)} ${currency}`,
    `Swap: ${money(deal.swap)} ${currency}`,
    `Rischio prezzo: ${riskDistance == null ? "non disponibile" : riskDistance.toFixed(5)}`,
    `Rendimento conto: ${tradeReturnPct == null ? "non disponibile" : `${tradeReturnPct.toFixed(4)}%`}`,
  ].join("\n");
}

function journalTitle(deal: BrokerDeal): string {
  return `${deal.symbol} ${deal.side.toUpperCase()} #${deal.id}`;
}

function journalTags(profile: BrokerAccountProfile, deal: BrokerDeal): string {
  return [
    "account-import",
    "fxblue",
    profile.brokerName,
    deal.symbol,
    deal.side,
  ].filter(Boolean).join(", ");
}

export async function importBrokerAccountData(input: BrokerAccountDataSyncInput): Promise<BrokerAccountDataSyncResult> {
  if (!process.env.DATABASE_URL) {
    return { imported: 0, journalCreated: 0, updated: 0, skipped: input.deals.length, reason: "DATABASE_URL not configured" };
  }

  const closedDeals = input.deals.filter((deal) => deal.id && deal.symbol && deal.closedAt);
  if (closedDeals.length === 0) {
    return { imported: 0, journalCreated: 0, updated: 0, skipped: input.deals.length };
  }

  const { db, accountTradesTable, journalEntriesTable } = await import("@workspace/db");
  const { and, eq } = await import("drizzle-orm");

  const journalUserId = input.profile.ownerUserId ?? null;
  const tradeUserId = input.profile.ownerUserId ?? "guest";
  let imported = 0;
  let updated = 0;
  let journalCreated = 0;

  for (const deal of closedDeals) {
    const riskDistance = riskPriceDistance(deal);
    const tradeReturnPct = returnPct(deal, input.snapshot);
    const uniqueTradeWhere = and(
      eq(accountTradesTable.source, deal.source),
      eq(accountTradesTable.ticket, deal.id),
      eq(accountTradesTable.userId, tradeUserId),
    );

    const values = {
      ticket: deal.id,
      source: deal.source,
      symbol: deal.symbol,
      direction: deal.side,
      volume: String(deal.volume),
      openTime: deal.openedAt ?? deal.closedAt ?? "",
      closeTime: deal.closedAt ?? null,
      entryPrice: String(deal.entryPrice ?? 0),
      exitPrice: numeric(deal.exitPrice),
      stopLoss: numeric(deal.stopLoss),
      takeProfit: numeric(deal.takeProfit),
      profit: numeric(deal.profit),
      commission: numeric(deal.commission),
      swap: numeric(deal.swap),
      status: "closed",
      brokerProfileId: input.profile.id,
      brokerAccountId: input.profile.accountId || input.snapshot.accounts[0]?.id || null,
      riskPriceDistance: numeric(riskDistance),
      returnPct: numeric(tradeReturnPct),
      userId: tradeUserId,
      updatedAt: new Date(),
    };

    const [inserted] = await db
      .insert(accountTradesTable)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: accountTradesTable.id });

    let accountTradeId = inserted?.id;
    let journalEntryId: number | null = null;
    const shouldCreateJournal = Boolean(inserted);

    if (inserted) {
      accountTradeId = inserted?.id;
      imported += 1;
    } else {
      const [current] = await db
        .select()
        .from(accountTradesTable)
        .where(uniqueTradeWhere)
        .limit(1);

      if (!current) continue;
      accountTradeId = current.id;
      journalEntryId = current.journalEntryId;
      // A closed deal re-imports identically every cycle; skip the no-op UPDATE
      // (this was the bulk of the broker write load). Only write on a real change.
      if (accountTradeChanged(toComparableTrade(current), toComparableTrade(values))) {
        await db.update(accountTradesTable).set(values).where(eq(accountTradesTable.id, current.id));
        updated += 1;
      }
    }

    if (!accountTradeId || journalEntryId || !shouldCreateJournal) continue;

    // Dedup diario: lo stesso ticket può arrivare da una riconnessione del
    // profilo (nuova riga account_trades) — riaggancia l'entry esistente
    // invece di crearne un duplicato.
    const [journal] = await db
      .insert(journalEntriesTable)
      .values({
        title: journalTitle(deal),
        content: journalContent(input.profile, input.snapshot, deal),
        tradeDate: tradeDateFor(deal),
        result: resultFromTradeNet(deal),
        tags: journalTags(input.profile, deal),
        userId: journalUserId,
      })
      .returning({ id: journalEntriesTable.id });

    if (!journal) continue;
    journalEntryId = journal.id;
    journalCreated += 1;
    await db
      .update(accountTradesTable)
      .set({ journalEntryId, updatedAt: new Date() })
      .where(eq(accountTradesTable.id, accountTradeId));
  }

  // If the new trade(s) tripped a risk-guard breaker, push the trader. Isolated:
  // a notification failure must never break the sync.
  if (imported > 0 && input.profile.ownerUserId) {
    try {
      const { notifyRiskGuardBreaches } = await import("../riskGuardPush.js");
      await notifyRiskGuardBreaches(input.profile.ownerUserId);
    } catch (err) {
      console.warn("[riskGuard] push notify failed", err);
    }
  }

  // Aggiorna (debounced) la classifica del torneo se l'utente è iscritto.
  // Best-effort: non deve mai rompere il sync.
  if ((imported > 0 || updated > 0) && input.profile.ownerUserId) {
    try {
      const { scheduleStandingsRefresh } = await import("../tornei/refreshHook.js");
      await scheduleStandingsRefresh(input.profile.ownerUserId);
    } catch (err) {
      console.warn("[tornei] standings refresh schedule failed", err);
    }
  }

  return {
    imported,
    journalCreated,
    updated,
    skipped: input.deals.length - closedDeals.length,
  };
}
