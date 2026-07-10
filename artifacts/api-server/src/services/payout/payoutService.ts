// Creator Stripe Connect account: onboarding + capability status (marketplace model).
// The platform never holds funds — buyers pay via Connect and Stripe pays creators out —
// so this only manages the connected account, not any in-house payout.
import type Stripe from "stripe";
import { sql, eq } from "drizzle-orm";
import { db, creatorPayoutAccountsTable } from "@workspace/db";

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

/** Stripe onboarding Account Link the creator opens to finish KYC/bank setup. */
export async function createOnboardingLink(userId: string, stripe: Stripe, appBaseUrl: string): Promise<string> {
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

/** Express-dashboard login link so an onboarded creator manages payouts/details at Stripe. */
export async function createDashboardLink(userId: string, stripe: Stripe): Promise<string | null> {
  const [acct] = await db
    .select({ stripeAccountId: creatorPayoutAccountsTable.stripeAccountId })
    .from(creatorPayoutAccountsTable)
    .where(eq(creatorPayoutAccountsTable.userId, userId))
    .limit(1);
  if (!acct) return null;
  const link = await stripe.accounts.createLoginLink(acct.stripeAccountId);
  return link.url;
}
