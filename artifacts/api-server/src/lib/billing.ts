import Stripe from "stripe";
import { db, adminUserSubscriptionsTable, type AdminUserSubscription } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

export type BillingFeature = "backtest" | "leaderboard" | "broker" | "wiki";
export type BillingPlan = "free" | "pro";

export interface StripeBillingConfig {
  configured: boolean;
  missing: string[];
  secretKey?: string;
  webhookSecret?: string;
  priceId?: string;
  appBaseUrl: string;
}

export type SubscriptionEntitlement = Pick<
  AdminUserSubscription,
  "plan" | "status" | "currentPeriodEnd" | "cancelAtPeriodEnd"
> | null;

export type BillingSubscriptionSummary = Pick<
  AdminUserSubscription,
  | "plan"
  | "status"
  | "currentPeriodEnd"
  | "cancelAtPeriodEnd"
  | "stripeCustomerId"
  | "stripeSubscriptionId"
> | null;

export function isProSubscription(subscription: SubscriptionEntitlement): boolean {
  if (!subscription) return false;
  if (subscription.plan !== "pro") return false;
  if (subscription.status !== "active" && subscription.status !== "trialing") return false;
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() < Date.now()) return false;
  return true;
}

export function getPlanFromSubscription(subscription: SubscriptionEntitlement): BillingPlan {
  return isProSubscription(subscription) ? "pro" : "free";
}

export function maskStripeId(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return value;
  const prefix = value.slice(0, value.indexOf("_") > 0 ? value.indexOf("_") + 1 : 4);
  return `${prefix}...${value.slice(-4)}`;
}

export function getBillingCapabilities(subscription: BillingSubscriptionSummary) {
  const hasStripeSubscription = Boolean(subscription?.stripeSubscriptionId);
  const hasStripeCustomer = Boolean(subscription?.stripeCustomerId);
  const pro = isProSubscription(subscription);
  return {
    canCancel: pro && hasStripeSubscription && subscription?.cancelAtPeriodEnd !== true,
    canResume: pro && hasStripeSubscription && subscription?.cancelAtPeriodEnd === true,
    canViewInvoices: hasStripeCustomer,
  };
}

export function paymentRequiredBody(feature: BillingFeature) {
  return {
    error: "pro_required",
    feature,
    message: "Passa a Pro per accedere a questa funzione.",
  };
}

export function getStripeBillingConfig(env: NodeJS.ProcessEnv = process.env): StripeBillingConfig {
  const missing = ["STRIPE_SECRET_KEY", "STRIPE_PRO_MONTHLY_PRICE_ID", "APP_BASE_URL"].filter((key) => !env[key]);
  return {
    configured: missing.length === 0,
    missing,
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    priceId: env.STRIPE_PRO_MONTHLY_PRICE_ID,
    appBaseUrl: (env.APP_BASE_URL || env.PUBLIC_APP_URL || "").replace(/\/$/, ""),
  };
}

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey);
}

export async function getUserSubscription(userId: string): Promise<AdminUserSubscription | null> {
  const [subscription] = await db
    .select()
    .from(adminUserSubscriptionsTable)
    .where(eq(adminUserSubscriptionsTable.userId, userId))
    .limit(1);
  return subscription ?? null;
}

export async function isUserPro(userId: string): Promise<boolean> {
  return isProSubscription(await getUserSubscription(userId));
}

export async function requireProFeature(req: Request, res: Response, feature: BillingFeature): Promise<boolean> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta." });
    return false;
  }

  const subscription = await getUserSubscription(userId);
  if (isProSubscription(subscription)) return true;
  res.status(402).json(paymentRequiredBody(feature));
  return false;
}
