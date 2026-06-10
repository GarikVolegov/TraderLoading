import { Router, type IRouter, type Request, type Response } from "express";
import { db, adminUserSubscriptionsTable } from "@workspace/db";
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

type SubscriptionLike = {
  plan: string;
  status: string;
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
    currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString?.() ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd === true,
    stripeCustomerId: subscription?.stripeCustomerId ?? null,
    stripeSubscriptionId: maskStripeId(subscription?.stripeSubscriptionId),
    ...capabilities,
  };
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
    ui_mode: "embedded" as Stripe.Checkout.SessionCreateParams.UiMode,
    customer: customerId,
    line_items: [{ price: config.priceId, quantity: 1 }],
    return_url: `${config.appBaseUrl}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
    client_reference_id: user.id,
    metadata: { userId: user.id },
    subscription_data: { metadata: { userId: user.id } },
  });

  return { clientSecret: session.client_secret };
}

async function upsertStripeSubscriptionForUser(userId: string, subscription: Stripe.Subscription): Promise<void> {
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
      currentPeriodEnd: toDateFromSeconds((subscription as { current_period_end?: number }).current_period_end),
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
        currentPeriodEnd: toDateFromSeconds((subscription as { current_period_end?: number }).current_period_end),
        cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
        updatedAt: new Date(),
      },
    });
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

function handleStripeRouteError(error: unknown, res: Response): boolean {
  const maybeConfiguredError = error as { code?: string; missing?: string[] };
  if (maybeConfiguredError.code === "stripe_not_configured") {
    res.status(503).json({ error: "stripe_not_configured", missing: maybeConfiguredError.missing ?? [] });
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

  await upsertStripeSubscriptionForUser(userId, subscription);
}

async function handleStripeEvent(event: Stripe.Event, stripe: Stripe): Promise<void> {
  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    await upsertStripeSubscription(event.data.object as Stripe.Subscription);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (typeof session.subscription !== "string") return;
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    await upsertStripeSubscription(subscription);
    return;
  }

  if (event.type === "invoice.payment_failed" || event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
    const subscriptionId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id;
    if (!subscriptionId) return;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await upsertStripeSubscription(subscription);
  }
}

export function createStripeWebhookRouter(): IRouter {
  const router: IRouter = Router();

  router.post("/billing/webhook", async (req, res) => {
    const config = getStripeBillingConfig();
    if (!config.secretKey) {
      res.status(503).json({ error: "stripe_not_configured" });
      return;
    }

    const stripe = createStripeClient(config.secretKey);
    try {
      const signature = req.headers["stripe-signature"];
      const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body ?? ""));
      const event =
        config.webhookSecret && typeof signature === "string"
          ? stripe.webhooks.constructEvent(payload, signature, config.webhookSecret)
          : JSON.parse(payload.toString("utf8"));
      await handleStripeEvent(event as Stripe.Event, stripe);
      res.json({ received: true });
    } catch (error) {
      logger.warn({ err: error }, "Stripe webhook rejected");
      res.status(400).json({ error: "stripe_webhook_invalid" });
    }
  });

  return router;
}

export default createBillingRouter();
