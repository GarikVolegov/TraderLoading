// Credit wallet I/O (sub-project B/C). All balance changes go through `applyMutationTx`,
// which locks the wallet row (FOR UPDATE), applies the pure ledger guard, and writes the
// balance + an append-only ledger row atomically. spend/grant wrap it in their own
// transaction; transferCredits moves credits between two wallets in a single transaction.
import { db, creditWalletsTable, creditTransactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { applyLedger } from "./ledger.js";

// The transaction handle drizzle hands to db.transaction's callback.
export type WalletTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Tx = WalletTx;

export type CreditReason = "purchase" | "spend" | "grant" | "refund" | "channel_sale";

export class InsufficientCreditsError extends Error {
  constructor() {
    super("insufficient_credits");
    this.name = "InsufficientCreditsError";
  }
}

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

// Core ledger step, on a caller-supplied transaction: ensure the wallet exists, lock it,
// apply the pure guard, then move the balance + append the ledger row atomically.
async function applyMutationTx(
  tx: Tx,
  userId: string,
  delta: number,
  reason: CreditReason,
  opts: MutateOpts = {},
): Promise<{ ok: boolean; balance: number }> {
  // Ensure the wallet row exists so FOR UPDATE has a row to lock (serializing
  // concurrent spends/grants/transfers for this user).
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
}

function mutate(
  userId: string,
  delta: number,
  reason: CreditReason,
  opts: MutateOpts = {},
): Promise<{ ok: boolean; balance: number }> {
  return db.transaction((tx) => applyMutationTx(tx, userId, delta, reason, opts));
}

/** Debit credits (e.g. buying a paid-channel entitlement). ok:false if the
 *  balance is insufficient — no mutation. Amount is coerced to a positive debit. */
export function spendCredits(userId: string, amount: number, refId?: string): Promise<{ ok: boolean; balance: number }> {
  return mutate(userId, -Math.abs(amount), "spend", { refId: refId ?? null });
}

/** Spend within a caller-supplied transaction, so the debit and a sibling write (e.g.
 *  the payout ledger row) commit atomically. ok:false if the balance is insufficient. */
export function spendCreditsInTx(
  tx: WalletTx,
  userId: string,
  amount: number,
  refId: string,
): Promise<{ ok: boolean; balance: number }> {
  return applyMutationTx(tx, userId, -Math.abs(amount), "spend", { refId });
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

async function runTransfer(
  tx: Tx,
  fromUserId: string,
  toUserId: string,
  amount: number,
  reason: CreditReason,
  refId?: string | null,
): Promise<void> {
  // Lock the two wallets in a stable (userId-sorted) order so concurrent transfers
  // between the same pair can't deadlock. A failed debit throws → the whole
  // transaction (including any credit already applied) rolls back.
  const debitFirst = fromUserId <= toUserId;
  if (debitFirst) {
    const d = await applyMutationTx(tx, fromUserId, -amount, reason, { refId });
    if (!d.ok) throw new InsufficientCreditsError();
    await applyMutationTx(tx, toUserId, amount, reason, { refId });
  } else {
    await applyMutationTx(tx, toUserId, amount, reason, { refId });
    const d = await applyMutationTx(tx, fromUserId, -amount, reason, { refId });
    if (!d.ok) throw new InsufficientCreditsError();
  }
}

/** Atomically move `amount` credits from one wallet to another, writing a debit
 *  ledger row for the sender and a credit row for the receiver. Throws
 *  InsufficientCreditsError (rolling back) if the sender can't cover it. Pass an
 *  existing `tx` to enlist in a larger transaction (e.g. unlock → entitlement). */
export async function transferCredits(
  args: { fromUserId: string; toUserId: string; amount: number; reason: CreditReason; refId?: string },
  tx?: Tx,
): Promise<void> {
  const { fromUserId, toUserId, amount, reason, refId } = args;
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("transferCredits: amount must be a positive integer");
  }
  if (fromUserId === toUserId) return; // no-op self-transfer
  if (tx) {
    await runTransfer(tx, fromUserId, toUserId, amount, reason, refId);
    return;
  }
  await db.transaction((t) => runTransfer(t, fromUserId, toUserId, amount, reason, refId));
}
