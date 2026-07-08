// Credit wallet I/O (sub-project B). All balance changes go through `mutate`,
// which locks the wallet row (FOR UPDATE), applies the pure ledger guard, and
// writes the balance + an append-only ledger row atomically. spend/grant wrap it.
import { db, creditWalletsTable, creditTransactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { applyLedger } from "./ledger.js";

export async function getBalance(userId: string): Promise<number> {
  const [w] = await db
    .select({ balance: creditWalletsTable.balance })
    .from(creditWalletsTable)
    .where(eq(creditWalletsTable.userId, userId))
    .limit(1);
  return w?.balance ?? 0;
}

export interface MutateOpts {
  refId?: string | null;
  stripeEventId?: string | null;
}

async function mutate(
  userId: string,
  delta: number,
  reason: "purchase" | "spend" | "grant" | "refund",
  opts: MutateOpts = {},
): Promise<{ ok: boolean; balance: number }> {
  return db.transaction(async (tx) => {
    // Ensure the wallet row exists so FOR UPDATE has a row to lock (serializing
    // concurrent spends/grants for this user).
    await tx
      .insert(creditWalletsTable)
      .values({ userId, balance: 0 })
      .onConflictDoNothing({ target: creditWalletsTable.userId });
    const [w] = await tx
      .select({ balance: creditWalletsTable.balance })
      .from(creditWalletsTable)
      .where(eq(creditWalletsTable.userId, userId))
      .for("update")
      .limit(1);
    const current = w?.balance ?? 0;
    const res = applyLedger(current, delta);
    if (!res.ok) return { ok: false, balance: current };

    await tx
      .update(creditWalletsTable)
      .set({ balance: res.balance, updatedAt: new Date() })
      .where(eq(creditWalletsTable.userId, userId));
    await tx.insert(creditTransactionsTable).values({
      userId,
      delta,
      reason,
      refId: opts.refId ?? null,
      stripeEventId: opts.stripeEventId ?? null,
      balanceAfter: res.balance,
    });
    return { ok: true, balance: res.balance };
  });
}

/** Debit credits (e.g. buying a paid-channel entitlement). ok:false if the
 *  balance is insufficient — no mutation. Amount is coerced to a positive debit. */
export function spendCredits(userId: string, amount: number, refId?: string): Promise<{ ok: boolean; balance: number }> {
  return mutate(userId, -Math.abs(amount), "spend", { refId: refId ?? null });
}

/** Credit the wallet (Stripe purchase or admin grant). For purchases pass the
 *  Stripe event id — its unique ledger index makes a retried webhook a no-op. */
export function grantCredits(
  userId: string,
  amount: number,
  reason: "purchase" | "grant" | "refund",
  opts: MutateOpts = {},
): Promise<{ ok: boolean; balance: number }> {
  return mutate(userId, Math.abs(amount), reason, opts);
}
