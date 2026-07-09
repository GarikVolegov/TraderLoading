// Creator payout saga (sub-project D). Reserve credits atomically, call Stripe Connect
// to Transfer the equivalent money, and compensate (refund credits) if the Transfer
// fails — so a failed payout never loses a creator's credits. All Stripe calls are
// injected so the service is testable and stays inert when payouts aren't configured.
import type Stripe from "stripe";
import { sql, eq } from "drizzle-orm";
import { db, creatorPayoutAccountsTable, creatorPayoutsTable } from "@workspace/db";
import { getBalance, spendCreditsInTx, grantCredits } from "../credits/wallet.js";
import {
  readPayoutConfig,
  validatePayoutRequest,
  computePayout,
  isPayoutConfigured,
  type PayoutConfig,
} from "./payoutMath.js";

export class PayoutValidationError extends Error {
  constructor(public reason: string) { super(`payout_${reason}`); this.name = "PayoutValidationError"; }
}
export class AccountNotReadyError extends Error {
  constructor() { super("account_not_ready"); this.name = "AccountNotReadyError"; }
}
export class TransferFailedError extends Error {
  constructor() { super("transfer_failed"); this.name = "TransferFailedError"; }
}

export interface PayoutAccountStatus {
  onboarded: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  status: string;
}

export async function getAccountStatus(userId: string): Promise<PayoutAccountStatus> {
  const [row] = await db
    .select()
    .from(creatorPayoutAccountsTable)
    .where(eq(creatorPayoutAccountsTable.userId, userId))
    .limit(1);
  if (!row) return { onboarded: false, payoutsEnabled: false, detailsSubmitted: false, status: "none" };
  return {
    onboarded: true,
    payoutsEnabled: row.payoutsEnabled,
    detailsSubmitted: row.detailsSubmitted,
    status: row.status,
  };
}

/** Reuse the creator's Connect account or create a new Express one, persisting the row. */
async function getOrCreateAccountId(userId: string, stripe: Stripe, config: PayoutConfig): Promise<string> {
  const [existing] = await db
    .select({ stripeAccountId: creatorPayoutAccountsTable.stripeAccountId })
    .from(creatorPayoutAccountsTable)
    .where(eq(creatorPayoutAccountsTable.userId, userId))
    .limit(1);
  if (existing) return existing.stripeAccountId;

  const account = await stripe.accounts.create({
    type: "express",
    // The creator's country/capabilities are collected during Stripe onboarding.
    capabilities: { transfers: { requested: true } },
    metadata: { userId },
  });
  await db
    .insert(creatorPayoutAccountsTable)
    .values({ userId, stripeAccountId: account.id })
    .onConflictDoNothing({ target: creatorPayoutAccountsTable.userId });
  // If a concurrent request already inserted, prefer the stored id.
  const [row] = await db
    .select({ stripeAccountId: creatorPayoutAccountsTable.stripeAccountId })
    .from(creatorPayoutAccountsTable)
    .where(eq(creatorPayoutAccountsTable.userId, userId))
    .limit(1);
  return row?.stripeAccountId ?? account.id;
}

/** Create a Stripe onboarding Account Link the creator opens to finish KYC/bank setup. */
export async function createOnboardingLink(
  userId: string,
  stripe: Stripe,
  appBaseUrl: string,
): Promise<string> {
  const config = readPayoutConfig();
  if (!isPayoutConfigured(config)) throw new PayoutValidationError("disabled");
  const accountId = await getOrCreateAccountId(userId, stripe, config);
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

/** The money-out saga: reserve → transfer → settle/compensate. */
export async function requestPayout(userId: string, credits: number, stripe: Stripe): Promise<PayoutResult> {
  const config = readPayoutConfig();
  const balance = await getBalance(userId);
  const check = validatePayoutRequest({ credits, balance, config });
  if (!check.ok) throw new PayoutValidationError(check.reason);

  const account = await getAccountStatus(userId);
  if (!account.onboarded || !account.payoutsEnabled) throw new AccountNotReadyError();

  const [acctRow] = await db
    .select({ stripeAccountId: creatorPayoutAccountsTable.stripeAccountId })
    .from(creatorPayoutAccountsTable)
    .where(eq(creatorPayoutAccountsTable.userId, userId))
    .limit(1);
  if (!acctRow) throw new AccountNotReadyError();

  const { grossCents, feeCents, netCents } = computePayout({
    credits,
    creditCents: config.creditCents as number,
    feeBps: config.feeBps,
  });

  // ── Reserve: debit credits + write the pending payout row atomically ──────────
  const payoutId = await db.transaction(async (tx) => {
    // Serialize a user's concurrent payout requests so the balance can't be double-spent.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`payout:user:${userId}`}))`);
    const [row] = await tx
      .insert(creatorPayoutsTable)
      .values({ userId, credits, grossCents, feeCents, netCents, currency: config.currency, status: "pending" })
      .returning({ id: creatorPayoutsTable.id });
    const reserve = await spendCreditsInTx(tx, userId, credits, String(row.id));
    if (!reserve.ok) throw new PayoutValidationError("insufficient"); // rolls back the row too
    return row.id;
  });

  // ── Transfer: idempotency key ties the Stripe Transfer to this exact row ──────
  try {
    const transfer = await stripe.transfers.create(
      { amount: netCents, currency: config.currency, destination: acctRow.stripeAccountId, metadata: { userId, payoutId: String(payoutId) } },
      { idempotencyKey: `payout:${payoutId}` },
    );
    await db
      .update(creatorPayoutsTable)
      .set({ status: "paid", stripeTransferId: transfer.id })
      .where(eq(creatorPayoutsTable.id, payoutId));
    return { id: payoutId, credits, netCents, currency: config.currency, status: "paid" };
  } catch (err) {
    // ── Compensate: give the credits back and mark the payout failed ───────────
    await grantCredits(userId, credits, "refund", { refId: String(payoutId) });
    await db
      .update(creatorPayoutsTable)
      .set({ status: "failed" })
      .where(eq(creatorPayoutsTable.id, payoutId));
    console.error("[payout] transfer failed, credits refunded:", err);
    throw new TransferFailedError();
  }
}
