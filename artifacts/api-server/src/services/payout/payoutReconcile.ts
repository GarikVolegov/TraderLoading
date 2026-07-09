// Reconcile stuck payouts (sub-project D). If the process dies between the reserve
// transaction committing and the Stripe Transfer, a payout row is left 'pending' with
// the creator's credits already spent. This retries the Transfer with the SAME
// idempotency key — so it either completes the original Transfer (if it had actually
// gone through, Stripe returns the same one) or creates it now, NEVER double-paying.
import type Stripe from "stripe";
import { and, eq, lt, gt } from "drizzle-orm";
import { db, creatorPayoutsTable, creatorPayoutAccountsTable } from "@workspace/db";
import { readPayoutConfig, isPayoutConfigured } from "./payoutMath.js";

// Only retry rows old enough to be genuinely stuck (not an in-flight request) but young
// enough that the Stripe idempotency key (24h TTL) still dedups — older rows are left for
// manual review so a lapsed key can't create a second Transfer.
const MIN_AGE_MS = 10 * 60 * 1000; // 10 min
const MAX_AGE_MS = 23 * 60 * 60 * 1000; // 23 h

export async function reconcilePendingPayouts(
  stripe: Stripe,
  now: number = Date.now(),
): Promise<{ retried: number; paid: number }> {
  if (!isPayoutConfigured(readPayoutConfig())) return { retried: 0, paid: 0 };

  const pending = await db
    .select()
    .from(creatorPayoutsTable)
    .where(and(
      eq(creatorPayoutsTable.status, "pending"),
      lt(creatorPayoutsTable.createdAt, new Date(now - MIN_AGE_MS)),
      gt(creatorPayoutsTable.createdAt, new Date(now - MAX_AGE_MS)),
    ))
    .limit(50);

  let paid = 0;
  for (const p of pending) {
    const [acct] = await db
      .select({ stripeAccountId: creatorPayoutAccountsTable.stripeAccountId })
      .from(creatorPayoutAccountsTable)
      .where(eq(creatorPayoutAccountsTable.userId, p.userId))
      .limit(1);
    if (!acct) continue;
    try {
      const transfer = await stripe.transfers.create(
        { amount: p.netCents, currency: p.currency, destination: acct.stripeAccountId, metadata: { userId: p.userId, payoutId: String(p.id) } },
        { idempotencyKey: `payout:${p.id}` },
      );
      await db
        .update(creatorPayoutsTable)
        .set({ status: "paid", stripeTransferId: transfer.id })
        .where(eq(creatorPayoutsTable.id, p.id));
      paid++;
    } catch (err) {
      // Leave pending for the next cycle / manual review — never blind-refund (the
      // original Transfer may have succeeded), so credits are never double-spent.
      console.error(`[payout] reconcile: payout ${p.id} still failing:`, err);
    }
  }
  return { retried: pending.length, paid };
}
