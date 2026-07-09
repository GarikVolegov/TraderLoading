import { Router, type IRouter, type Request, type Response } from "express";
import { db, adminUserSubscriptionsTable, stripeWebhookEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import {
  createStripeClient,
  getBillingCapabilities,
  getPlanFromSubscription,
  getStripeBillingConfig,
  getUserSubscription,
  isProSubscription,
  maskStripeId,
  type StripeBillingConfig,
} from "../lib/billing.js";
import logger from "../lib/logger.js";
import { grantCredits } from "../services/credits/wallet.js";
import { packCredits } from "../services/credits/packs.js";
import { syncConnectAccount } from "../services/payout/payoutService.js";

type SubscriptionLike = {
  plan: string;
  status: string;
  source?: string | null;
  manualOverride?: boolean | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

export type BillingInvoice = {
  id: string;
  number: string | null;
  status: string | null;
  amountPaid: number;
  currency: string;
  hostedInvoiceUrl: string | null;
  periodStart: string | null;
  periodEnd: string | null;
};

export interface BillingRouterOptions {
  config?: StripeBillingConfig;
  getSubscription?: (userId: string) => Promise<SubscriptionLike | null>;
  createCheckoutSession?: (user: NonNullable<Request["user"]>) => Promise<{ clientSecret: string | null }>;
  confirmCheckoutSession?: (user: NonNullable<Request["user"]>, sessionId: string) => Promise<SubscriptionLike | null>;
  cancelSubscription?: (userId: string, subscriptionId: string) => Promise<SubscriptionLike | null>;
  resumeSubscription?: (userId: string, subscriptionId: string) => Promise<SubscriptionLike | null>;
  listInvoices?: (userId: string, customerId: string) => Promise<BillingInvoice[]>;
}

function requireBillingUser(req: Request): NonNullable<Request["user"]> | null {
  return req.user ?? null;
}

function toDateFromSeconds(value: unknown): Date | null {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

function toIsoFromSeconds(value: unknown): string | null {
  const date = toDateFromSeconds(value);
  return date ? date.toISOString() : null;
}

function serializeBillingStatus(subscription: SubscriptionLike | null) {
  const plan = getPlanFromSubscription(subscription);
  const capabilities = getBillingCapabilities(subscription);
  return {
    plan,
    pro: isProSubscription(subscription),
    status: subscription?.status ?? "free",
    source: subscription?.source ?? null,
    manualOverride: subscription?.manualOverride === true,
    currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString?.() ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd === true,
    stripeCustomerId: subscription?.stripeCustomerId ?? null,
    stripeSubscriptionId: maskStripeId(subscription?.stripeSubscriptionId),
    ...capabilities,
  };
}

export function shouldPreserveManualSubscriptionOverride(
  subscription: Pick<SubscriptionLike, "manualOverride" | "source"> | null | undefined,
): boolean {
  return subscription?.manualOverride === true && subscription.source === "manual";
}

async function defaultCreateCheckoutSession(user: NonNullable<Request["user"]>): Promise<{ clientSecret: string | null }> {
  const config = getStripeBillingConfig();
  if (!config.configured || !config.secretKey || !config.priceId) {
    throw Object.assign(new Error("Stripe is not configured"), {
      code: "stripe_not_configured",
      missing: config.missing,
    });
  }

  const stripe = createStripeClient(config.secretKey);
  const existing = await getUserSubscription(user.id);
  const customerId =
    existing?.stripeCustomerId ||
    (await stripe.customers.create({ email: user.email ?? undefined, metadata: { userId: user.id } })).id;

  await db
    .insert(adminUserSubscriptionsTable)
    .values({
      userId: user.id,
      plan: existing?.plan ?? "free",
      status: existing?.status ?? "active",
      source: existing?.source ?? "stripe",
      manualOverride: existing?.manualOverride ?? false,
      stripeCustomerId: customerId,
    })
    .onConflictDoUpdate({
      target: adminUserSubscriptionsTable.userId,
      set: { stripeCustomerId: customerId, updatedAt: new Date() },
    });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    // "embedded" è stato rinominato "embedded_page" dall'API Stripe corrente
    // (SDK pinnato su 2026-05-27.dahlia); il valore vecchio viene rifiutato con 400.
    ui_mode: "embedded_page",
    customer: customerId,
    line_items: [{ price: config.priceId, quantity: 1 }],
    return_url: `${config.appBaseUrl}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
    client_reference_id: user.id,
    metadata: { userId: user.id },
    subscription_data: { metadata: { userId: user.id } },
  });

  return { clientSecret: session.client_secret };
}

/**
 * The subscription's current period end (unix seconds). In the pinned API
 * (2026-05-27.dahlia) this moved off the Subscription top level onto the
 * SubscriptionItem, so reading `subscription.current_period_end` is always
 * undefined; read it from the first item instead.
 */
export function subscriptionCurrentPeriodEnd(subscription: Stripe.Subscription): number | null {
  const item = subscription.items?.data?.[0] as { current_period_end?: number } | undefined;
  return item?.current_period_end ?? null;
}

/**
 * The subscription id referenced by an invoice. In the pinned API it moved from
 * the top-level `invoice.subscription` to `invoice.parent.subscription_details.subscription`.
 */
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription ?? null;
  if (typeof sub === "string") return sub;
  return sub?.id ?? null;
}

async function upsertStripeSubscriptionForUser(
  userId: string,
  subscription: Stripe.Subscription,
  options: { preserveManualOverride?: boolean } = {},
): Promise<void> {
  if (options.preserveManualOverride) {
    const existing = await getUserSubscription(userId);
    if (shouldPreserveManualSubscriptionOverride(existing)) {
      logger.info({ userId, subscriptionId: subscription.id }, "Stripe subscription event ignored because manual admin override is active");
      return;
    }
  }

  const item = subscription.items.data[0];
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;
  await db
    .insert(adminUserSubscriptionsTable)
    .values({
      userId,
      plan: subscription.status === "active" || subscription.status === "trialing" ? "pro" : "free",
      status: subscription.status,
      source: "stripe",
      manualOverride: false,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: item?.price?.id ?? null,
      currentPeriodEnd: toDateFromSeconds(subscriptionCurrentPeriodEnd(subscription)),
      cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: adminUserSubscriptionsTable.userId,
      set: {
        plan: subscription.status === "active" || subscription.status === "trialing" ? "pro" : "free",
        status: subscription.status,
        source: "stripe",
        manualOverride: false,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: item?.price?.id ?? null,
        currentPeriodEnd: toDateFromSeconds(subscriptionCurrentPeriodEnd(subscription)),
        cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
        updatedAt: new Date(),
      },
    });
}

// Conferma lato server una Checkout Session al ritorno da Stripe. È il
// fallback al webhook: in locale (o se il webhook non è configurato/ritarda)
// è l'unico modo per riflettere subito il pagamento sul piano dell'utente.
async function defaultConfirmCheckoutSession(
  user: NonNullable<Request["user"]>,
  sessionId: string,
): Promise<SubscriptionLike | null> {
  const { stripe } = requireConfiguredStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const sessionUserId = session.client_reference_id ?? session.metadata?.userId ?? null;
  if (sessionUserId !== user.id) {
    throw Object.assign(new Error("Checkout session does not belong to user"), {
      code: "session_user_mismatch",
    });
  }

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await upsertStripeSubscriptionForUser(user.id, subscription);
  }

  return getUserSubscription(user.id);
}

function requireConfiguredStripe() {
  const config = getStripeBillingConfig();
  if (!config.configured || !config.secretKey) {
    throw Object.assign(new Error("Stripe is not configured"), {
      code: "stripe_not_configured",
      missing: config.missing,
    });
  }
  return { config, stripe: createStripeClient(config.secretKey) };
}

async function defaultCancelSubscription(userId: string, subscriptionId: string): Promise<SubscriptionLike | null> {
  const { stripe } = requireConfiguredStripe();
  const subscription = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  await upsertStripeSubscriptionForUser(userId, subscription);
  return getUserSubscription(userId);
}

async function defaultResumeSubscription(userId: string, subscriptionId: string): Promise<SubscriptionLike | null> {
  const { stripe } = requireConfiguredStripe();
  const subscription = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
  await upsertStripeSubscriptionForUser(userId, subscription);
  return getUserSubscription(userId);
}

async function defaultListInvoices(_userId: string, customerId: string): Promise<BillingInvoice[]> {
  const { stripe } = requireConfiguredStripe();
  const invoices = await stripe.invoices.list({ customer: customerId, limit: 12 });
  return invoices.data.map((invoice) => {
    const line = invoice.lines?.data?.[0] as { period?: { start?: number; end?: number } } | undefined;
    return {
      id: invoice.id ?? "",
      number: invoice.number ?? null,
      status: invoice.status ?? null,
      amountPaid: invoice.amount_paid ?? 0,
      currency: invoice.currency ?? "eur",
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      periodStart: toIsoFromSeconds(line?.period?.start),
      periodEnd: toIsoFromSeconds(line?.period?.end),
    };
  });
}

function isStripeApiError(error: unknown): error is Error & { type: string } {
  const type = (error as { type?: unknown }).type;
  return typeof type === "string" && type.startsWith("Stripe");
}

function handleStripeRouteError(error: unknown, res: Response): boolean {
  const maybeConfiguredError = error as { code?: string; missing?: string[] };
  if (maybeConfiguredError.code === "stripe_not_configured") {
    res.status(503).json({ error: "stripe_not_configured", missing: maybeConfiguredError.missing ?? [] });
    return true;
  }
  if (isStripeApiError(error)) {
    // 502: l'upstream Stripe ha rifiutato la chiamata. Il dettaglio resta nei
    // log (può contenere id cliente/sessione), al client va solo il codice.
    logger.error({ err: error }, "Stripe API error");
    console.error("[billing] stripe error:", error.stack ?? error.message);
    res.status(502).json({ error: "stripe_error" });
    return true;
  }
  return false;
}

export function createBillingRouter(options: BillingRouterOptions = {}): IRouter {
  const router: IRouter = Router();
  const getSubscription = options.getSubscription ?? getUserSubscription;

  router.get("/billing/me", async (req, res) => {
    const user = requireBillingUser(req);
    if (!user) {
      res.status(401).json({ error: "Autenticazione richiesta." });
      return;
    }

    const subscription = await getSubscription(user.id);
    res.json(serializeBillingStatus(subscription));
  });

  router.post("/billing/checkout-session", async (req, res) => {
    const user = requireBillingUser(req);
    if (!user) {
      res.status(401).json({ error: "Autenticazione richiesta." });
      return;
    }

    const config = options.config ?? getStripeBillingConfig();
    if (!config.configured) {
      res.status(503).json({ error: "stripe_not_configured", missing: config.missing });
      return;
    }

    try {
      const createSession = options.createCheckoutSession ?? defaultCreateCheckoutSession;
      const session = await createSession(user);
      if (!session.clientSecret) {
        res.status(502).json({ error: "checkout_session_unavailable" });
        return;
      }
      res.json({ clientSecret: session.clientSecret });
    } catch (error) {
      if (handleStripeRouteError(error, res)) return;
      throw error;
    }
  });

  router.post("/billing/confirm-session", async (req, res) => {
    const user = requireBillingUser(req);
    if (!user) {
      res.status(401).json({ error: "Autenticazione richiesta." });
      return;
    }

    const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
    if (!sessionId) {
      res.status(400).json({ error: "invalid_session_id" });
      return;
    }

    try {
      const confirm = options.confirmCheckoutSession ?? defaultConfirmCheckoutSession;
      res.json(serializeBillingStatus(await confirm(user, sessionId)));
    } catch (error) {
      if ((error as { code?: string }).code === "session_user_mismatch") {
        res.status(403).json({ error: "session_user_mismatch" });
        return;
      }
      if (handleStripeRouteError(error, res)) return;
      throw error;
    }
  });

  router.post("/billing/cancel", async (req, res) => {
    const user = requireBillingUser(req);
    if (!user) {
      res.status(401).json({ error: "Autenticazione richiesta." });
      return;
    }

    const subscription = await getSubscription(user.id);
    if (!subscription?.stripeSubscriptionId) {
      res.status(409).json({ error: "subscription_not_found" });
      return;
    }

    try {
      const cancel = options.cancelSubscription ?? defaultCancelSubscription;
      res.json(serializeBillingStatus(await cancel(user.id, subscription.stripeSubscriptionId)));
    } catch (error) {
      if (handleStripeRouteError(error, res)) return;
      throw error;
    }
  });

  router.post("/billing/resume", async (req, res) => {
    const user = requireBillingUser(req);
    if (!user) {
      res.status(401).json({ error: "Autenticazione richiesta." });
      return;
    }

    const subscription = await getSubscription(user.id);
    if (!subscription?.stripeSubscriptionId) {
      res.status(409).json({ error: "subscription_not_found" });
      return;
    }

    try {
      const resume = options.resumeSubscription ?? defaultResumeSubscription;
      res.json(serializeBillingStatus(await resume(user.id, subscription.stripeSubscriptionId)));
    } catch (error) {
      if (handleStripeRouteError(error, res)) return;
      throw error;
    }
  });

  router.get("/billing/invoices", async (req, res) => {
    const user = requireBillingUser(req);
    if (!user) {
      res.status(401).json({ error: "Autenticazione richiesta." });
      return;
    }

    const subscription = await getSubscription(user.id);
    if (!subscription?.stripeCustomerId) {
      res.json({ invoices: [] });
      return;
    }

    try {
      const listInvoices = options.listInvoices ?? defaultListInvoices;
      res.json({ invoices: await listInvoices(user.id, subscription.stripeCustomerId) });
    } catch (error) {
      if (handleStripeRouteError(error, res)) return;
      throw error;
    }
  });

  return router;
}

async function resolveUserIdForStripeSubscription(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const metadataUserId = subscription.metadata?.userId;
  if (metadataUserId) return metadataUserId;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) return null;
  const [row] = await db
    .select({ userId: adminUserSubscriptionsTable.userId })
    .from(adminUserSubscriptionsTable)
    .where(eq(adminUserSubscriptionsTable.stripeCustomerId, customerId))
    .limit(1);
  return row?.userId ?? null;
}

async function upsertStripeSubscription(subscription: Stripe.Subscription): Promise<void> {
  const userId = await resolveUserIdForStripeSubscription(subscription);
  if (!userId) {
    logger.warn({ subscriptionId: subscription.id }, "Stripe subscription event without user id");
    return;
  }

  await upsertStripeSubscriptionForUser(userId, subscription, { preserveManualOverride: true });
}

/**
 * Run a Stripe webhook event's side effects at most once. Stripe retries delivery
 * on any non-2xx response or timeout, so without a dedup guard a retried event
 * would re-apply its effects. `claim` atomically records the event id and returns
 * false if it was already recorded (a duplicate → skip). If handling throws we
 * `release` the claim so the next retry can re-process; otherwise the claim
 * persists and future duplicates short-circuit.
 */
export async function processStripeEventOnce(
  event: { id: string; type: string },
  deps: {
    claim: (eventId: string, type: string) => Promise<boolean>;
    release: (eventId: string) => Promise<void>;
    handle: () => Promise<void>;
  },
): Promise<{ processed: boolean; duplicate: boolean }> {
  const claimed = await deps.claim(event.id, event.type);
  if (!claimed) return { processed: false, duplicate: true };
  try {
    await deps.handle();
  } catch (err) {
    await deps.release(event.id);
    throw err;
  }
  return { processed: true, duplicate: false };
}

async function handleStripeEvent(event: Stripe.Event, stripe: Stripe): Promise<void> {
  // Creator payout (sub-project D): Connect account capability changes (onboarding
  // finished, payouts enabled/restricted) so /payout/account reflects Stripe's truth.
  if (event.type === "account.updated") {
    await syncConnectAccount(event.data.object as Stripe.Account);
    return;
  }

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    await upsertStripeSubscription(event.data.object as Stripe.Subscription);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    // Credit purchase (sub-project B): one-time payment, not a subscription. Grant
    // the pack's credits. processStripeEventOnce already dedupes by event id; the
    // credit_transactions.stripe_event_id unique index is a second backstop.
    if (session.metadata?.type === "credit_purchase") {
      const userId = session.metadata.userId;
      const credits = packCredits(session.metadata.packId);
      if (userId && credits) {
        await grantCredits(userId, credits, "purchase", { refId: session.metadata.packId, stripeEventId: event.id });
      }
      return;
    }
    if (typeof session.subscription !== "string") return;
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    await upsertStripeSubscription(subscription);
    return;
  }

  if (event.type === "invoice.payment_failed" || event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoiceSubscriptionId(invoice);
    if (!subscriptionId) return;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await upsertStripeSubscription(subscription);
    return;
  }

  // A chargeback or refund does NOT cancel the Stripe subscription, so without
  // this the entitlement stays active after the user pulled their money back.
  if (event.type === "charge.dispute.created" || event.type === "charge.refunded") {
    const customerId = await chargeCustomerId(event, stripe);
    if (customerId) await revokeStripeProForCustomer(customerId, event.type);
  }
}

/** Resolve the Stripe customer id behind a charge/dispute event. */
async function chargeCustomerId(event: Stripe.Event, stripe: Stripe): Promise<string | null> {
  const readCustomer = (charge: Stripe.Charge): string | null =>
    typeof charge.customer === "string" ? charge.customer : charge.customer?.id ?? null;

  if (event.type === "charge.refunded") {
    return readCustomer(event.data.object as Stripe.Charge);
  }
  // charge.dispute.created: the object is a Dispute, which carries the charge id
  // but not the customer, so fetch the charge.
  const dispute = event.data.object as Stripe.Dispute;
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
  if (!chargeId) return null;
  const charge = await stripe.charges.retrieve(chargeId);
  return readCustomer(charge);
}

/** Revoke a Stripe-sourced Pro entitlement after a dispute/refund. Leaves manual
 *  admin grants and internal (tornei) entitlements untouched. */
async function revokeStripeProForCustomer(customerId: string, reason: string): Promise<void> {
  const [row] = await db
    .select({
      userId: adminUserSubscriptionsTable.userId,
      source: adminUserSubscriptionsTable.source,
      manualOverride: adminUserSubscriptionsTable.manualOverride,
    })
    .from(adminUserSubscriptionsTable)
    .where(eq(adminUserSubscriptionsTable.stripeCustomerId, customerId))
    .limit(1);
  if (!row || row.source !== "stripe" || row.manualOverride) return;
  await db
    .update(adminUserSubscriptionsTable)
    .set({ plan: "free", status: "canceled", reason, updatedAt: new Date() })
    .where(eq(adminUserSubscriptionsTable.userId, row.userId));
  logger.info({ userId: row.userId, reason }, "Revoked Stripe Pro entitlement after dispute/refund");
}

export function createStripeWebhookRouter(): IRouter {
  const router: IRouter = Router();

  router.post("/", async (req, res) => {
    const config = getStripeBillingConfig();
    // Senza webhookSecret il webhook resta disattivato: accettare eventi non
    // firmati permetterebbe a chiunque di assegnarsi il piano Pro con un POST.
    // L'aggiornamento del piano passa comunque da /billing/confirm-session.
    if (!config.secretKey || !config.webhookSecret) {
      res.status(503).json({ error: "stripe_not_configured" });
      return;
    }

    const stripe = createStripeClient(config.secretKey);
    try {
      const signature = req.headers["stripe-signature"];
      if (typeof signature !== "string") {
        res.status(400).json({ error: "stripe_webhook_invalid" });
        return;
      }
      const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body ?? ""));
      const event = stripe.webhooks.constructEvent(payload, signature, config.webhookSecret);
      const { duplicate } = await processStripeEventOnce(event, {
        // Atomic claim: inserting the event id conflicts (returns no row) when the
        // event was already processed, so a Stripe retry is acked without re-running.
        claim: async (eventId, type) => {
          const inserted = await db
            .insert(stripeWebhookEventsTable)
            .values({ eventId, type })
            .onConflictDoNothing()
            .returning({ eventId: stripeWebhookEventsTable.eventId });
          return inserted.length > 0;
        },
        release: async (eventId) => {
          await db.delete(stripeWebhookEventsTable).where(eq(stripeWebhookEventsTable.eventId, eventId));
        },
        handle: () => handleStripeEvent(event, stripe),
      });
      res.json({ received: true, duplicate });
    } catch (error) {
      logger.warn({ err: error }, "Stripe webhook rejected");
      res.status(400).json({ error: "stripe_webhook_invalid" });
    }
  });

  return router;
}

export default createBillingRouter();
