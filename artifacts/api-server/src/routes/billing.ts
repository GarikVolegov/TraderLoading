import { Router, type IRouter, type Request } from "express";
import { db, adminUserSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import {
  createStripeClient,
  getPlanFromSubscription,
  getStripeBillingConfig,
  getUserSubscription,
  isProSubscription,
  type StripeBillingConfig,
} from "../lib/billing.js";
import logger from "../lib/logger.js";

type SubscriptionLike = {
  plan: string;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

export interface BillingRouterOptions {
  config?: StripeBillingConfig;
  getSubscription?: (userId: string) => Promise<SubscriptionLike | null>;
  createCheckoutSession?: (user: NonNullable<Request["user"]>) => Promise<{ clientSecret: string | null }>;
}

function requireBillingUser(req: Request): NonNullable<Request["user"]> | null {
  return req.user ?? null;
}

function toDateFromSeconds(value: unknown): Date | null {
  return typeof value === "number" ? new Date(value * 1000) : null;
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
    const plan = getPlanFromSubscription(subscription);
    res.json({
      plan,
      pro: isProSubscription(subscription),
      status: subscription?.status ?? "free",
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString?.() ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd === true,
    });
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
      const maybeConfiguredError = error as { code?: string; missing?: string[] };
      if (maybeConfiguredError.code === "stripe_not_configured") {
        res.status(503).json({ error: "stripe_not_configured", missing: maybeConfiguredError.missing ?? [] });
        return;
      }
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
