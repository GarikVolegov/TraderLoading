import { randomUUID, createHash } from "node:crypto";
import type Stripe from "stripe";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import {
  db, academySubscriptionsTable as subscriptions, academyAffiliatesTable as affiliates,
  academyAttributionsTable as attributions, academyCommissionsTable as commissions,
  academyPayoutsTable as payouts, academyLessonsTable, creatorPayoutAccountsTable,
  type AcademySubscription, type AcademyCommission,
} from "@workspace/db";
import { createStripeClient } from "../lib/billing.js";
import { getAdminPrincipalForUser } from "../lib/adminAuth.js";
import { hasAdminPermission } from "../lib/adminPermissions.js";

export const ACADEMY_TERMS_VERSION = "2026-10-17";
export const ACADEMY_PRICE_CENTS = 15000;
export const ACADEMY_RATE_BPS = 2000;
export const ACADEMY_HOLD_DAYS = 30;
const DAY = 86400000;
const objectId = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id ?? null;
const error = (code: string, status = 409) => Object.assign(new Error(code), { code, status });

export function getAcademyConfig(env: NodeJS.ProcessEnv = process.env) {
  const appBaseUrl = (env.APP_BASE_URL ?? "").replace(/\/$/, "");
  const configured = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_ACADEMY_MONTHLY_PRICE_ID && appBaseUrl);
  return { configured, salesEnabled: env.ACADEMY_SALES_ENABLED === "true", secretKey: env.STRIPE_SECRET_KEY, priceId: env.STRIPE_ACADEMY_MONTHLY_PRICE_ID, appBaseUrl };
}

function stripeClient() {
  const config = getAcademyConfig();
  if (!config.secretKey) throw error("academy_billing_unavailable", 503);
  return createStripeClient(config.secretKey);
}

export function isAcademyPrice(price: Pick<Stripe.Price, "active" | "currency" | "unit_amount" | "recurring" | "tax_behavior" | "type">): boolean {
  return price.active && price.currency === "eur" && price.unit_amount === ACADEMY_PRICE_CENTS
    && price.type === "recurring" && price.recurring?.interval === "month"
    && price.recurring.interval_count === 1 && price.recurring.usage_type === "licensed" && price.tax_behavior === "inclusive";
}

export function isAcademySubscription(subscription: Pick<Stripe.Subscription, "metadata" | "items">): boolean {
  return subscription.metadata?.type === "academy" || subscription.items.data.some(item => item.price.id === getAcademyConfig().priceId);
}

export function isAcademyEntitled(subscription: Pick<AcademySubscription, "status" | "paidThrough" | "paymentRevoked"> | null, now = new Date()): boolean {
  return !!subscription && subscription.status === "active" && !subscription.paymentRevoked
    && !!subscription.paidThrough && subscription.paidThrough.getTime() > now.getTime();
}

export function academyCommissionCents(grossPaidCents: number): number {
  if (!Number.isSafeInteger(grossPaidCents) || grossPaidCents < 0) throw error("invalid_gross_amount", 400);
  return Math.floor(grossPaidCents * ACADEMY_RATE_BPS / 10000);
}

export function academyReversedCents(row: Pick<AcademyCommission, "grossPaidCents" | "amountCents" | "reversedCents">, refundedGross: number, disputed: boolean): number {
  if (disputed || refundedGross >= row.grossPaidCents) return row.amountCents;
  return Math.max(row.reversedCents, Math.min(row.amountCents, Math.max(0, row.amountCents - academyCommissionCents(Math.max(0, row.grossPaidCents - refundedGross)))));
}

export async function getAcademySubscription(userId: string): Promise<AcademySubscription | null> {
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  return row ?? null;
}
export async function hasAcademyAccess(userId: string): Promise<boolean> {
  return isAcademyEntitled(await getAcademySubscription(userId));
}

export async function academyCheckoutAvailable(): Promise<boolean> {
  const config = getAcademyConfig();
  if (!config.configured || !config.salesEnabled) return false;
  const [lesson] = await db.select({ id: academyLessonsTable.id }).from(academyLessonsTable)
    .where(and(eq(academyLessonsTable.published, true), isNotNull(academyLessonsTable.videoUrl), sql`length(trim(${academyLessonsTable.videoUrl})) > 0`)).limit(1);
  if (!lesson) return false;
  try { return isAcademyPrice(await stripeClient().prices.retrieve(config.priceId!)); } catch { return false; }
}

export async function enrollAcademyAffiliate(userId: string) {
  // Free enrollment, independent of any Academy or Pro purchase.
  const code = `AC${createHash("sha256").update(userId).digest("hex").slice(0, 16).toUpperCase()}`;
  await db.insert(affiliates).values({ userId, code, termsVersion: ACADEMY_TERMS_VERSION }).onConflictDoNothing({ target: affiliates.userId });
  const [row] = await db.select().from(affiliates).where(eq(affiliates.userId, userId));
  return row;
}

function commissionStatus(row: AcademyCommission, payout: typeof payouts.$inferSelect | null, now = new Date()) {
  if (payout?.stripeTransferId) return payout.transferReversedCents < Math.max(0, payout.amountCents - (row.amountCents - row.reversedCents)) ? "recovery_pending" : row.reversedCents >= row.amountCents ? "reversed" : "paid";
  if (row.reversedCents >= row.amountCents) return "reversed";
  if (payout) return payout.status === "canceled" || payout.lastError ? "requires_review" : "processing";
  return row.availableAt > now ? "pending" : "available";
}

async function commissionRows(userId?: string) {
  const query = db.select({ commission: commissions, payout: payouts }).from(commissions)
    .leftJoin(payouts, eq(payouts.commissionId, commissions.id));
  return userId ? query.where(eq(commissions.affiliateUserId, userId)).orderBy(commissions.createdAt) : query.where(isNotNull(commissions.affiliateUserId)).orderBy(commissions.createdAt);
}

export async function getAcademyCommissions(userId: string) {
  const rows = await commissionRows(userId);
  return { currency: "eur", items: rows.map(({ commission: row, payout }) => ({
    id: row.id, amountCents: row.amountCents, reversedCents: row.reversedCents,
    status: commissionStatus(row, payout), availableAt: row.availableAt.toISOString(), createdAt: row.createdAt.toISOString(),
  })) };
}

export async function getAcademyBillingStatus(userId: string) {
  const [subscription, affiliateRows, list, checkoutAvailable, admin] = await Promise.all([
    getAcademySubscription(userId), db.select().from(affiliates).where(eq(affiliates.userId, userId)).limit(1),
    getAcademyCommissions(userId), academyCheckoutAvailable(), getAdminPrincipalForUser(userId),
  ]);
  const affiliate = affiliateRows.at(0);
  const canManage = !!subscription?.stripeSubscriptionId && !["canceled", "incomplete_expired"].includes(subscription.status);
  const totals = { pendingCents: 0, availableCents: 0, paidCents: 0, currency: "eur" };
  for (const row of list.items) {
    const remaining = row.amountCents - row.reversedCents;
    if (row.status === "paid" || row.status === "recovery_pending") totals.paidCents += remaining;
    else if (row.status === "available") totals.availableCents += remaining;
    else if (row.status !== "reversed") totals.pendingCents += remaining;
  }
  return {
    active: isAcademyEntitled(subscription), status: subscription?.paymentRevoked ? "payment_revoked" : subscription?.status ?? "none",
    currentPeriodEnd: subscription?.paidThrough?.toISOString() ?? subscription?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    salesEnabled: getAcademyConfig().salesEnabled, checkoutAvailable: checkoutAvailable && !canManage,
    canManage, canCancel: canManage && !subscription?.cancelAtPeriodEnd, canResume: canManage && !!subscription?.cancelAtPeriodEnd,
    canManagePayouts: !!admin && hasAdminPermission(admin.role, "billing.subscriptions.write"),
    price: { amountCents: ACADEMY_PRICE_CENTS, currency: "eur", interval: "month" },
    affiliate: { enrolled: !!affiliate, termsVersion: ACADEMY_TERMS_VERSION, rateBps: ACADEMY_RATE_BPS, holdDays: ACADEMY_HOLD_DAYS,
      code: affiliate?.code ?? null, link: affiliate ? `/academy?ref=${affiliate.code}` : null }, commissions: totals,
  };
}

export async function createAcademyCheckout(user: { id: string; email?: string | null }, referralCode?: string) {
  if (!await academyCheckoutAvailable()) throw error("academy_sales_unavailable", 503);
  const stripe = stripeClient();
  const config = getAcademyConfig();
  // Durable attempt and immutable attribution are committed before calling Stripe.
  const attempt = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`academy:checkout:${user.id}`}))`);
    const [existing] = await tx.select().from(subscriptions).where(eq(subscriptions.userId, user.id));
    if (existing?.stripeSubscriptionId && !["canceled", "incomplete_expired", "incomplete"].includes(existing.status)) throw error("academy_subscription_exists");
    const [snapshot] = await tx.select().from(attributions).where(eq(attributions.buyerUserId, user.id));
    if (!snapshot) {
      const code = referralCode?.trim().toUpperCase();
      const [affiliate] = code ? await tx.select().from(affiliates).where(eq(affiliates.code, code)).limit(1) : [];
      if (code && (!affiliate || affiliate.userId === user.id)) throw error("invalid_academy_referral", 400);
      await tx.insert(attributions).values({ buyerUserId: user.id, affiliateUserId: affiliate?.userId ?? null, code: affiliate?.code ?? null, termsVersion: affiliate?.termsVersion ?? null });
    }
    const attemptId = existing?.checkoutAttemptId ?? randomUUID();
    await tx.insert(subscriptions).values({ userId: user.id, checkoutAttemptId: attemptId }).onConflictDoUpdate({ target: subscriptions.userId, set: { checkoutAttemptId: attemptId, updatedAt: new Date() } });
    return { attemptId, sessionId: existing?.checkoutSessionId ?? null, customerId: existing?.stripeCustomerId ?? null };
  });
  if (attempt.sessionId) {
    const session = await stripe.checkout.sessions.retrieve(attempt.sessionId);
    if (session.status === "open" && session.url) return { url: session.url };
    if (session.status === "complete") throw error("academy_payment_processing");
    await db.update(subscriptions).set({ checkoutAttemptId: null, checkoutSessionId: null }).where(and(eq(subscriptions.userId, user.id), eq(subscriptions.checkoutAttemptId, attempt.attemptId)));
    return createAcademyCheckout(user, referralCode);
  }
  // Stable customer key plus the durable attempt prevent two tabs from creating two subscriptions.
  const customerId = attempt.customerId ?? (await stripe.customers.create({ email: user.email ?? undefined, metadata: { userId: user.id, type: "academy" } }, { idempotencyKey: `academy:customer:${user.id}` })).id;
  await db.update(subscriptions).set({ stripeCustomerId: customerId, updatedAt: new Date() }).where(eq(subscriptions.userId, user.id));
  // Recover a session whose Stripe response was lost before local persistence.
  let recovered: Stripe.Checkout.Session | undefined;
  for await (const candidate of stripe.checkout.sessions.list({ customer: customerId, limit: 100 })) {
    if (candidate.metadata?.academyAttemptId === attempt.attemptId) { recovered = candidate; break; }
  }
  const session = recovered ?? await stripe.checkout.sessions.create({
    mode: "subscription", customer: customerId, client_reference_id: user.id,
    line_items: [{ price: config.priceId!, quantity: 1 }], payment_method_types: ["card"],
    consent_collection: { terms_of_service: "required" },
    automatic_tax: { enabled: true }, billing_address_collection: "required", customer_update: { address: "auto", name: "auto" },
    success_url: `${config.appBaseUrl}/academy?checkout=success`, cancel_url: `${config.appBaseUrl}/academy?checkout=cancelled`,
    metadata: { type: "academy", userId: user.id, academyAttemptId: attempt.attemptId }, subscription_data: { metadata: { type: "academy", userId: user.id } },
  }, { idempotencyKey: `academy:checkout:${attempt.attemptId}` });
  await db.update(subscriptions).set({ stripeCustomerId: customerId, checkoutSessionId: session.id, updatedAt: new Date() }).where(and(eq(subscriptions.userId, user.id), eq(subscriptions.checkoutAttemptId, attempt.attemptId)));
  if (session.status === "complete") throw error("academy_payment_processing");
  if (session.status === "expired") {
    await db.update(subscriptions).set({ checkoutAttemptId: null, checkoutSessionId: null }).where(and(eq(subscriptions.userId, user.id), eq(subscriptions.checkoutAttemptId, attempt.attemptId)));
    return createAcademyCheckout(user, referralCode);
  }
  if (!session.url) throw error("academy_checkout_unavailable", 502);
  return { url: session.url };
}

export async function createAcademyPortal(userId: string) {
  const subscription = await getAcademySubscription(userId);
  const config = getAcademyConfig();
  if (!subscription?.stripeCustomerId || !config.appBaseUrl) throw error("academy_subscription_not_found");
  const stripe = stripeClient();
  const customer = await stripe.customers.retrieve(subscription.stripeCustomerId);
  if (customer.deleted || customer.metadata.type !== "academy" || customer.metadata.userId !== userId) throw error("academy_subscription_mismatch", 403);
  const portal = await stripe.billingPortal.sessions.create({ customer: customer.id, return_url: `${config.appBaseUrl}/academy`,
    ...(process.env.STRIPE_ACADEMY_PORTAL_CONFIGURATION_ID ? { configuration: process.env.STRIPE_ACADEMY_PORTAL_CONFIGURATION_ID } : {}),
  });
  return { url: portal.url };
}

export async function updateAcademyCancellation(userId: string, cancelAtPeriodEnd: boolean) {
  const row = await getAcademySubscription(userId);
  if (!row?.stripeSubscriptionId) throw error("academy_subscription_not_found");
  const stripe = stripeClient();
  const existing = await stripe.subscriptions.retrieve(row.stripeSubscriptionId);
  if (!isAcademySubscription(existing) || existing.metadata.userId !== userId) throw error("academy_subscription_mismatch", 403);
  const subscription = await stripe.subscriptions.update(row.stripeSubscriptionId, { cancel_at_period_end: cancelAtPeriodEnd });
  await syncAcademySubscription(subscription);
  return getAcademyBillingStatus(userId);
}

export async function syncAcademySubscription(subscription: Stripe.Subscription) {
  if (!isAcademySubscription(subscription)) return false;
  const userId = subscription.metadata.userId;
  if (!userId) throw error("academy_subscription_user_missing");
  const first = subscription.items.data[0];
  const updates = { stripeSubscriptionId: subscription.id, stripeCustomerId: objectId(subscription.customer), stripePriceId: first?.price.id ?? null,
    status: subscription.status, currentPeriodEnd: first ? new Date(first.current_period_end * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end, updatedAt: new Date(),
    ...(["active", "canceled", "incomplete_expired"].includes(subscription.status) ? { checkoutAttemptId: null, checkoutSessionId: null } : {}),
  };
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`academy:checkout:${userId}`}))`);
    const [existing] = await tx.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    // A canceled, older subscription cannot overwrite a new subscription for the same buyer.
    if (existing?.stripeSubscriptionId && existing.stripeSubscriptionId !== subscription.id && !["canceled", "incomplete_expired"].includes(existing.status)) return;
    const resetPaidPeriod = existing?.stripeSubscriptionId && existing.stripeSubscriptionId !== subscription.id
      ? { paidThrough: null, latestPaidInvoiceId: null, paymentRevoked: false } : {};
    await tx.insert(subscriptions).values({ userId, ...updates }).onConflictDoUpdate({ target: subscriptions.userId, set: { ...updates, ...resetPaidPeriod } });
  });
  return true;
}

export async function recordAcademyInvoice(invoice: Stripe.Invoice, subscription: Stripe.Subscription, stripe: Stripe) {
  if (!isAcademySubscription(subscription) || invoice.status !== "paid" || invoice.currency !== "eur" || invoice.amount_paid <= 0) return;
  const userId = subscription.metadata.userId;
  if (!userId) throw error("academy_subscription_user_missing");
  const item = subscription.items.data[0];
  if (subscription.items.data.length !== 1 || item?.quantity !== 1 || !isAcademyPrice({ ...item.price, active: true })
    || invoice.amount_paid > ACADEMY_PRICE_CENTS) throw error("academy_invoice_price_requires_review");
  // Only settled Stripe card money earns commissions, never a manual paid marker or credit balance.
  const payments = await stripe.invoicePayments.list({ invoice: invoice.id, status: "paid", limit: 100 });
  const payment = payments.data.find(item => item.payment.type === "payment_intent" && item.amount_paid === invoice.amount_paid);
  if (!payment || payments.has_more) throw error("academy_invoice_payment_requires_review");
  const paymentIntentId = objectId(payment.payment.payment_intent);
  if (!paymentIntentId) throw error("academy_invoice_payment_missing");
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const chargeId = objectId(intent.latest_charge);
  if (!chargeId || intent.status !== "succeeded" || intent.currency !== "eur") throw error("academy_invoice_unsettled");
  const charge = await stripe.charges.retrieve(chargeId);
  if (!charge.paid || charge.amount < invoice.amount_paid) throw error("academy_invoice_unsettled");
  const priceId = subscription.items.data[0]?.price.id;
  const relevantLines = invoice.lines.data.filter(line => line.pricing?.price_details?.price === priceId);
  const periodEndSeconds = Math.max(0, ...relevantLines.map(line => line.period.end));
  if (!Number.isSafeInteger(periodEndSeconds) || periodEndSeconds <= 0 || invoice.lines.has_more
    || relevantLines.length !== 1 || invoice.lines.data.length !== 1
    || relevantLines[0].parent?.subscription_item_details?.proration) throw error("academy_invoice_period_missing");
  const periodEnd = new Date(periodEndSeconds * 1000);
  const paidAt = new Date((invoice.status_transitions.paid_at ?? invoice.created) * 1000);
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`academy:invoice:${invoice.id}`}))`);
    const [attribution] = await tx.select().from(attributions).where(eq(attributions.buyerUserId, userId));
    const affiliateUserId = attribution?.affiliateUserId && attribution.affiliateUserId !== userId ? attribution.affiliateUserId : null;
    const amountCents = affiliateUserId ? academyCommissionCents(invoice.amount_paid) : 0;
    const reversedCents = academyReversedCents({ grossPaidCents: invoice.amount_paid, amountCents, reversedCents: 0 }, charge.amount_refunded, charge.disputed);
    await tx.insert(commissions).values({ id: randomUUID(), stripeInvoiceId: invoice.id, stripeSubscriptionId: subscription.id,
      stripePaymentIntentId: paymentIntentId, stripeChargeId: chargeId, buyerUserId: userId, affiliateUserId,
      grossPaidCents: invoice.amount_paid, amountCents, reversedCents, refundedGrossCents: charge.amount_refunded, disputed: charge.disputed,
      availableAt: new Date(paidAt.getTime() + ACADEMY_HOLD_DAYS * DAY), periodEnd,
    }).onConflictDoNothing({ target: commissions.stripeInvoiceId });
    // Duplicated/old paid events cannot undo a refund or regress the current paid period.
    await tx.update(subscriptions).set({ paidThrough: periodEnd, latestPaidInvoiceId: invoice.id,
      paymentRevoked: charge.disputed || charge.amount_refunded >= invoice.amount_paid, updatedAt: new Date(),
    }).where(and(eq(subscriptions.userId, userId), eq(subscriptions.stripeSubscriptionId, subscription.id),
      sql`(${subscriptions.paidThrough} IS NULL OR ${subscriptions.paidThrough} < ${periodEnd})`));
  });
  // Reconcile the latest charge even if a refund arrived before this paid event.
  if (charge.amount_refunded > 0 || charge.disputed) await reconcileAcademyCharge(charge, stripe);
}

export async function reconcileAcademyCharge(charge: Stripe.Charge, stripe: Stripe, disputed = charge.disputed): Promise<boolean> {
  let rows = await db.select().from(commissions).where(eq(commissions.stripeChargeId, charge.id));
  if (rows.length === 0) {
    const piId = objectId(charge.payment_intent);
    if (!piId) return false;
    // A refund can beat invoice.payment_succeeded; use Stripe's current invoice mapping.
    const payments = await stripe.invoicePayments.list({ payment: { type: "payment_intent", payment_intent: piId }, limit: 100 });
    let matched = false;
    for (const payment of payments.data) {
      const invoiceId = objectId(payment.invoice);
      if (!invoiceId) continue;
      const invoice = await stripe.invoices.retrieve(invoiceId);
      const subId = objectId(invoice.parent?.subscription_details?.subscription);
      if (!subId) continue;
      const subscription = await stripe.subscriptions.retrieve(subId);
      if (!isAcademySubscription(subscription)) continue;
      matched = true;
      await syncAcademySubscription(subscription);
      // record reads current charge, so the initial row already includes this reversal.
      await recordAcademyInvoice(invoice, subscription, stripe);
    }
    if (!matched) return false;
    rows = await db.select().from(commissions).where(eq(commissions.stripeChargeId, charge.id));
  }
  for (const row of rows) {
    await db.transaction(async tx => {
      const [locked] = await tx.select().from(commissions).where(eq(commissions.id, row.id)).for("update");
      const refundedGross = Math.max(locked.refundedGrossCents, charge.amount_refunded);
      const isDisputed = locked.disputed || disputed;
      await tx.update(commissions).set({ refundedGrossCents: refundedGross, disputed: isDisputed,
        reversedCents: academyReversedCents(locked, refundedGross, isDisputed),
      }).where(eq(commissions.id, row.id));
      if (isDisputed || refundedGross >= locked.grossPaidCents) {
        await tx.update(subscriptions).set({ paymentRevoked: true, updatedAt: new Date() })
          .where(and(eq(subscriptions.userId, row.buyerUserId), eq(subscriptions.latestPaidInvoiceId, row.stripeInvoiceId)));
      }
    });
    await executeAcademyPayout(row.id, stripe, false);
  }
  return rows.length > 0;
}

/** Dispatch first, before legacy Pro handlers; returning true prevents product leakage. */
export async function handleAcademyStripeEvent(event: Stripe.Event, stripe: Stripe): Promise<boolean> {
  if (event.type.startsWith("customer.subscription.")) {
    const payload = event.data.object as Stripe.Subscription;
    if (!isAcademySubscription(payload)) return false;
    const latest = event.type === "customer.subscription.deleted" ? payload : await stripe.subscriptions.retrieve(payload.id);
    await syncAcademySubscription(latest);
    return true;
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.type !== "academy") return false;
    const subId = objectId(session.subscription);
    if (subId) await syncAcademySubscription(await stripe.subscriptions.retrieve(subId));
    return true;
  }
  if (event.type === "invoice.payment_succeeded" || event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const payload = event.data.object as Stripe.Invoice;
    const subId = objectId(payload.parent?.subscription_details?.subscription);
    if (!subId) return false;
    const subscription = await stripe.subscriptions.retrieve(subId);
    if (!isAcademySubscription(subscription)) return false;
    await syncAcademySubscription(subscription);
    if (event.type !== "invoice.payment_failed") await recordAcademyInvoice(await stripe.invoices.retrieve(payload.id), subscription, stripe);
    return true;
  }
  if (event.type === "charge.refunded" || event.type === "charge.dispute.created" || event.type === "charge.dispute.closed") {
    const object = event.data.object as Stripe.Charge | Stripe.Dispute;
    const chargeId = object.object === "charge" ? object.id : objectId(object.charge);
    if (!chargeId) return false;
    const charge = await stripe.charges.retrieve(chargeId);
    // Disputes conservatively revoke commission; a win requires finance review before reinstatement.
    return reconcileAcademyCharge(charge, stripe, event.type !== "charge.refunded" || charge.disputed);
  }
  return false;
}

export async function listAcademyPayouts() {
  const rows = await commissionRows();
  return { currency: "eur", items: rows.map(({ commission: row, payout }) => ({
    id: row.id, buyerUserId: row.buyerUserId, affiliateUserId: row.affiliateUserId,
    amountCents: row.amountCents, reversedCents: row.reversedCents, availableAt: row.availableAt.toISOString(),
    status: commissionStatus(row, payout), payoutId: payout?.id ?? null, transferId: payout?.stripeTransferId ?? null,
    recoveryPending: !!payout && (payout.status === "canceled" || !!payout.lastError || payout.transferReversedCents < Math.max(0, payout.amountCents - (row.amountCents - row.reversedCents))),
  })) };
}

async function prepareAcademyPayout(commissionId: string, requestedBy: string) {
  await db.transaction(async tx => {
    const [row] = await tx.select().from(commissions).where(eq(commissions.id, commissionId)).for("update");
    if (!row?.affiliateUserId || row.availableAt > new Date()) throw error("academy_commission_not_available");
    const [existing] = await tx.select().from(payouts).where(eq(payouts.commissionId, commissionId));
    if (existing) return;
    const amountCents = row.amountCents - row.reversedCents;
    if (amountCents <= 0) throw error("academy_commission_reversed");
    const [account] = await tx.select().from(creatorPayoutAccountsTable).where(eq(creatorPayoutAccountsTable.userId, row.affiliateUserId));
    if (!account?.payoutsEnabled || !account.detailsSubmitted) throw error("academy_connect_not_ready");
    await tx.insert(payouts).values({ id: randomUUID(), commissionId, affiliateUserId: row.affiliateUserId,
      stripeAccountId: account.stripeAccountId, amountCents, requestedBy });
  });
}

/** Reconcile a durable transfer intent before retrying. No duplicate transfer after Stripe's 24h key window. */
async function executeAcademyPayout(commissionId: string, stripe: Stripe, allowCreate: boolean) {
  return db.transaction(async tx => {
    const [row] = await tx.select().from(commissions).where(eq(commissions.id, commissionId)).for("update");
    const [payout] = await tx.select().from(payouts).where(eq(payouts.commissionId, commissionId)).for("update");
    if (!row || !payout) return;
    const group = `academy:${payout.id}`;
    let transferId = payout.stripeTransferId;
    if (!transferId) {
      const transfers = await stripe.transfers.list({ transfer_group: group, limit: 100 });
      if (transfers.has_more || transfers.data.length > 1) throw error("academy_transfer_requires_review");
      const recovered = transfers.data[0];
      if (recovered) {
        if (recovered.amount !== payout.amountCents || objectId(recovered.destination) !== payout.stripeAccountId || recovered.currency !== "eur") throw error("academy_transfer_mismatch");
        transferId = recovered.id;
      } else if (!allowCreate) return;
      else {
        if (payout.createdAt.getTime() < Date.now() - 23 * 60 * 60 * 1000) throw error("academy_transfer_requires_review");
        if (row.amountCents - row.reversedCents < payout.amountCents) {
          await tx.update(payouts).set({ status: "canceled", lastError: "commission_reversed_before_transfer", updatedAt: new Date() }).where(eq(payouts.id, payout.id));
          throw error("academy_transfer_requires_review");
        }
        const account = await stripe.accounts.retrieve(payout.stripeAccountId);
        if (!account.payouts_enabled || account.capabilities?.transfers !== "active") throw error("academy_connect_not_ready");
        const transfer = await stripe.transfers.create({ amount: payout.amountCents, currency: "eur", destination: payout.stripeAccountId,
          source_transaction: row.stripeChargeId, transfer_group: group,
          metadata: { type: "academy_commission", commissionId, payoutId: payout.id },
        }, { idempotencyKey: `academy:transfer:${payout.id}` });
        transferId = transfer.id;
      }
      await tx.update(payouts).set({ stripeTransferId: transferId, status: "paid", lastError: null, updatedAt: new Date() }).where(eq(payouts.id, payout.id));
    }
    const requiredReversal = Math.max(0, payout.amountCents - (row.amountCents - row.reversedCents));
    if (requiredReversal > payout.transferReversedCents) {
      const transfer = await stripe.transfers.retrieve(transferId);
      if (transfer.amount_reversed < requiredReversal) {
        // Cumulative target in the key makes duplicate/refund deliveries safe, even after a DB crash.
        await stripe.transfers.createReversal(transferId, { amount: requiredReversal - transfer.amount_reversed,
          metadata: { commissionId, targetReversedCents: String(requiredReversal) },
        }, { idempotencyKey: `academy:reverse:${payout.id}:${requiredReversal}` });
      }
      await tx.update(payouts).set({ transferReversedCents: Math.max(requiredReversal, transfer.amount_reversed), lastError: null, updatedAt: new Date() }).where(eq(payouts.id, payout.id));
    }
  });
}

export async function payAcademyCommissions(commissionIds: string[], requestedBy: string, stripe: Stripe = stripeClient()) {
  const items: Array<{ commissionId: string; status: string; error?: string }> = [];
  for (const commissionId of new Set(commissionIds)) {
    try {
      await prepareAcademyPayout(commissionId, requestedBy);
      await executeAcademyPayout(commissionId, stripe, true);
      items.push({ commissionId, status: "processed" });
    } catch (err) {
      const code = err instanceof Error && "code" in err && typeof err.code === "string" ? err.code : "academy_payout_failed";
      await db.update(payouts).set({ lastError: code, updatedAt: new Date() }).where(eq(payouts.commissionId, commissionId));
      items.push({ commissionId, status: "failed", error: code });
    }
  }
  return { items };
}
