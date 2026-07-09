// Creator payout saga (sub-project D). Reserve credits atomically, Transfer the money
// via Stripe Connect, and — ONLY on a deterministic Stripe rejection — compensate. A
// network-ambiguous error (the Transfer may have executed) is left 'pending' for the
// reconcile job, never refunded, so money-out is never doubled. Only EARNED credits are
// cashable, so purchased/granted credits can't be converted to cash (AML).
import Stripe from "stripe";
import { sql, eq, and, gt, inArray } from "drizzle-orm";
import { db, creatorPayoutAccountsTable, creatorPayoutsTable, creditTransactionsTable } from "@workspace/db";
import { getBalance, spendCreditsInTx, grantCredits } from "../credits/wallet.js";
import { readPayoutConfig, validatePayoutRequest, computePayout, isPayoutConfigured, type PayoutConfig } from "./payoutMath.js";

export class PayoutValidationError extends Error {
  constructor(public reason: string) { super(`payout_${reason}`); this.name = "PayoutValidationError"; }
}
export class AccountNotReadyError extends Error {
  constructor() { super("account_not_ready"); this.name = "AccountNotReadyError"; }
}
export class TransferFailedError extends Error {
  constructor() { super("transfer_failed"); this.name = "TransferFailedError"; }
}
// The Transfer may have executed but we couldn't confirm — the reconcile job finalizes it.
export class PayoutPendingError extends Error {
  constructor() { super("payout_pending"); this.name = "PayoutPendingError"; }
}

/** Credits a creator has EARNED from channel sales and not yet cashed out. Purchased or
 *  granted credits are excluded, so they can never be converted to real money. */
export async function getEarnedBalance(userId: string): Promise<number> {
  const [earned] = await db
    .select({ v: sql<string>`COALESCE(SUM(${creditTransactionsTable.delta}), 0)` })
    .from(creditTransactionsTable)
    .where(and(
      eq(creditTransactionsTable.userId, userId),
      eq(creditTransactionsTable.reason, "channel_sale"),
      gt(creditTransactionsTable.delta, 0),
    ));
  const [paid] = await db
    .select({ v: sql<string>`COALESCE(SUM(${creatorPayoutsTable.credits}), 0)` })
    .from(creatorPayoutsTable)
    .where(and(
      eq(creatorPayoutsTable.userId, userId),
      inArray(creatorPayoutsTable.status, ["paid", "pending"]),
    ));
  return Math.max(0, Number(earned?.v ?? 0) - Number(paid?.v ?? 0));
}

/** Credits actually cashable now: earned-and-uncashed, but never more than the wallet holds. */
export async function getCashableCredits(userId: string): Promise<number> {
  const [balance, earned] = await Promise.all([getBalance(userId), getEarnedBalance(userId)]);
  return Math.min(balance, earned);
}

export interface PayoutAccountStatus {
  onboarded: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  status: string;
  cashableCredits: number;
}

export async function getAccountStatus(userId: string): Promise<PayoutAccountStatus> {
  const [row] = await db
    .select()
    .from(creatorPayoutAccountsTable)
    .where(eq(creatorPayoutAccountsTable.userId, userId))
    .limit(1);
  const cashableCredits = await getCashableCredits(userId);
  if (!row) return { onboarded: false, payoutsEnabled: false, detailsSubmitted: false, status: "none", cashableCredits };
  return {
    onboarded: true,
    payoutsEnabled: row.payoutsEnabled,
    detailsSubmitted: row.detailsSubmitted,
    status: row.status,
    cashableCredits,
  };
}

/** Sync a Connect account's capability state from a Stripe `account.updated` webhook. */
export async function syncConnectAccount(account: {
  id: string;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
}): Promise<void> {
  const payoutsEnabled = !!account.payouts_enabled;
  const detailsSubmitted = !!account.details_submitted;
  const status = payoutsEnabled ? "verified" : detailsSubmitted ? "restricted" : "pending";
  await db
    .update(creatorPayoutAccountsTable)
    .set({ payoutsEnabled, detailsSubmitted, status, updatedAt: new Date() })
    .where(eq(creatorPayoutAccountsTable.stripeAccountId, account.id));
}

/** Reuse the creator's Connect account or create a new Express one. Advisory-locked +
 *  idempotency-keyed so concurrent onboards can't mint duplicate/orphaned accounts. */
async function getOrCreateAccountId(userId: string, stripe: Stripe): Promise<string> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`payout:account:${userId}`}))`);
    const [existing] = await tx
      .select({ stripeAccountId: creatorPayoutAccountsTable.stripeAccountId })
      .from(creatorPayoutAccountsTable)
      .where(eq(creatorPayoutAccountsTable.userId, userId))
      .limit(1);
    if (existing) return existing.stripeAccountId;

    const account = await stripe.accounts.create(
      { type: "express", capabilities: { transfers: { requested: true } }, metadata: { userId } },
      { idempotencyKey: `connect:account:${userId}` },
    );
    await tx
      .insert(creatorPayoutAccountsTable)
      .values({ userId, stripeAccountId: account.id })
      .onConflictDoNothing({ target: creatorPayoutAccountsTable.userId });
    return account.id;
  });
}

/** Create a Stripe onboarding Account Link the creator opens to finish KYC/bank setup. */
export async function createOnboardingLink(userId: string, stripe: Stripe, appBaseUrl: string): Promise<string> {
  if (!isPayoutConfigured(readPayoutConfig())) throw new PayoutValidationError("disabled");
  const accountId = await getOrCreateAccountId(userId, stripe);
  const returnUrl = `${appBaseUrl}/settings?section=abbonamento`;
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: returnUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

export interface PayoutResult {
  id: number;
  credits: number;
  netCents: number;
  currency: string;
  status: string;
}

/** The money-out saga: reserve → transfer → settle, compensating ONLY on a Stripe error
 *  that guarantees no money moved. */
export async function requestPayout(userId: string, credits: number, stripe: Stripe): Promise<PayoutResult> {
  const config: PayoutConfig = readPayoutConfig();
  // Cashable = earned-and-uncashed, capped by the wallet — purchased credits excluded.
  const cashable = await getCashableCredits(userId);
  const check = validatePayoutRequest({ credits, balance: cashable, config });
  if (!check.ok) throw new PayoutValidationError(check.reason);

  const account = await getAccountStatus(userId);
  if (!account.onboarded || !account.payoutsEnabled) throw new AccountNotReadyError();
  const [acctRow] = await db
    .select({ stripeAccountId: creatorPayoutAccountsTable.stripeAccountId })
    .from(creatorPayoutAccountsTable)
    .where(eq(creatorPayoutAccountsTable.userId, userId))
    .limit(1);
  if (!acctRow) throw new AccountNotReadyError();

  const { grossCents, feeCents, netCents } = computePayout({ credits, creditCents: config.creditCents as number, feeBps: config.feeBps });

  // ── Reserve: debit credits + write the pending payout row atomically ──────────
  const payoutId = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`payout:user:${userId}`}))`);
    // Authoritative EARNED re-check UNDER the lock. The pre-check above is racy: a
    // concurrent payout's pending row wasn't visible then. Holding the per-user lock, a
    // prior request has committed its pending row, so `earnedNow` already nets it out —
    // two requests can't each cash the same earned credits. (The wallet FOR-UPDATE in
    // spendCreditsInTx alone can't catch this: purchased credits mask the earned cap.)
    const [er] = await tx
      .select({ v: sql<string>`COALESCE(SUM(${creditTransactionsTable.delta}), 0)` })
      .from(creditTransactionsTable)
      .where(and(eq(creditTransactionsTable.userId, userId), eq(creditTransactionsTable.reason, "channel_sale"), gt(creditTransactionsTable.delta, 0)));
    const [pr] = await tx
      .select({ v: sql<string>`COALESCE(SUM(${creatorPayoutsTable.credits}), 0)` })
      .from(creatorPayoutsTable)
      .where(and(eq(creatorPayoutsTable.userId, userId), inArray(creatorPayoutsTable.status, ["paid", "pending"])));
    const earnedNow = Math.max(0, Number(er?.v ?? 0) - Number(pr?.v ?? 0));
    if (credits > earnedNow) throw new PayoutValidationError("insufficient");

    const [row] = await tx
      .insert(creatorPayoutsTable)
      .values({ userId, credits, grossCents, feeCents, netCents, currency: config.currency, status: "pending" })
      .returning({ id: creatorPayoutsTable.id });
    const reserve = await spendCreditsInTx(tx, userId, credits, String(row.id));
    if (!reserve.ok) throw new PayoutValidationError("insufficient"); // rolls back the row too
    return row.id;
  });

  // ── Transfer: ONLY this call is refund-guarded (idempotency-keyed to this row) ──
  let transfer: Stripe.Transfer;
  try {
    transfer = await stripe.transfers.create(
      { amount: netCents, currency: config.currency, destination: acctRow.stripeAccountId, metadata: { userId, payoutId: String(payoutId) } },
      { idempotencyKey: `payout:${payoutId}` },
    );
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      // Deterministic rejection — Stripe created NO Transfer, so refunding is safe.
      const refund = await grantCredits(userId, credits, "refund", { refId: String(payoutId) });
      if (!refund.ok) {
        // Refund itself failed (should be unreachable — we just debited). Don't claim a
        // refund; leave 'pending' for manual review so credits are never lost silently.
        console.error(`[payout] CRITICAL: refund failed for payout ${payoutId}; left pending for manual review`);
        throw new TransferFailedError();
      }
      await db.update(creatorPayoutsTable).set({ status: "failed" }).where(eq(creatorPayoutsTable.id, payoutId));
      console.error("[payout] transfer rejected, credits refunded:", err);
      throw new TransferFailedError();
    }
    // Ambiguous (connection/timeout/5xx/rate-limit): the Transfer MAY have executed.
    // Leave 'pending' — the reconcile scheduler retries with the same idempotency key.
    // NEVER refund here (that would double-pay if the money actually left).
    console.error(`[payout] ambiguous transfer error for payout ${payoutId}; left pending for reconcile:`, err);
    throw new PayoutPendingError();
  }

  // ── Settle: money already left, so a failure here must NEVER refund — the reconcile
  // job (pending rows) or a later account.updated finalizes it. ─────────────────
  try {
    await db.update(creatorPayoutsTable).set({ status: "paid", stripeTransferId: transfer.id }).where(eq(creatorPayoutsTable.id, payoutId));
  } catch (dbErr) {
    console.error(`[payout] settle update failed for payout ${payoutId}; reconcile will finalize:`, dbErr);
  }
  return { id: payoutId, credits, netCents, currency: config.currency, status: "paid" };
}
