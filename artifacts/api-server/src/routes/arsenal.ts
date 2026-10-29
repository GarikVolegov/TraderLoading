import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "node:crypto";
import type Stripe from "stripe";
import { db, arsenalOrdersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { ARSENAL_PRODUCTS } from "../../../../contracts/arsenalProducts.js";
import { type LimenGradeNumber } from "../../../../contracts/limenGrades.js";
import { createStripeClient, getStripeBillingConfig } from "../lib/billing.js";
import { getOperatorIntegrityReport } from "../services/integrityEngine.js";
import { getOrCreateProfile, computeLevel } from "./profile.js";
import { canPublishPlatformContent as isPlatformAdmin } from "../lib/adminAuth.js";
import logger from "../lib/logger.js";
import { dispatchArsenalOrder, updateOrderTracking } from "../services/fulfillment/dispatcher.js";
import { verifyPrintfulStatus } from "../services/fulfillment/printfulClient.js";

const router: IRouter = Router();

function getUserId(req: Request): string | null {
  return req.user?.id ?? null;
}

async function getUserGrade(userId: string | null): Promise<LimenGradeNumber> {
  if (!userId) return 1;
  try {
    const profile = await getOrCreateProfile(userId);
    const { level } = computeLevel(profile.xp);
    const isAdmin = await isPlatformAdmin(userId);
    const report = await getOperatorIntegrityReport({
      userId,
      legacyLevel: level,
      streak: profile.streak,
      isAdmin,
    });
    return report.currentGrade.grade;
  } catch (err) {
    logger.warn({ err, userId }, "Failed to calculate user grade for arsenal, defaulting to 1");
    return 1;
  }
}

// GET /api/arsenal/products
router.get("/arsenal/products", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const userGrade = await getUserGrade(userId);

  const products = ARSENAL_PRODUCTS.map((prod) => ({
    ...prod,
    unlocked: userGrade >= prod.requiredGrade,
  }));

  res.json({
    userGrade,
    products,
  });
});

// POST /api/arsenal/checkout
router.post("/arsenal/checkout", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "auth_required", message: "Autenticazione richiesta per ordinare dotazioni." });
    return;
  }

  const { productId, variantId, colorId } = req.body ?? {};
  if (!productId || typeof productId !== "string") {
    res.status(400).json({ error: "missing_product_id", message: "ID prodotto mancante." });
    return;
  }

  const product = ARSENAL_PRODUCTS.find((p) => p.id === productId);
  if (!product) {
    res.status(404).json({ error: "product_not_found", message: "Dotazione non trovata nell'Arsenale." });
    return;
  }

  if (!product.isPurchasable || product.priceCents <= 0) {
    res.status(400).json({ error: "product_not_purchasable", message: "Questo elemento non è acquistabile direttamente." });
    return;
  }

  const userGrade = await getUserGrade(userId);
  if (userGrade < product.requiredGrade) {
    res.status(403).json({
      error: "grade_locked",
      message: `Dotazione riservata al ${product.requiredLabel}. Avanza di grado per sbloccare l'accesso.`,
      requiredGrade: product.requiredGrade,
      currentGrade: userGrade,
    });
    return;
  }

  const variant = product.variants?.find((v) => v.id === variantId) ?? product.variants?.[0];
  const colorway = product.colorways?.find((c) => c.id === colorId) ?? product.colorways?.[0];
  const variantLabel = [colorway?.name, variant?.label].filter(Boolean).join(" · ") || variant?.label || "";
  const itemTitle = variantLabel ? `${product.title} (${variantLabel})` : product.title;

  const config = getStripeBillingConfig();
  if (!config.secretKey) {
    logger.warn("Stripe secret key missing for arsenal checkout. Returning preview / dev mode.");
    // In local dev without Stripe keys, return simulation url
    res.json({
      demo: true,
      url: `/resources?tab=orders&demo_order=${product.id}&variant=${encodeURIComponent(variantLabel)}`,
      message: "Stripe non configurato localmente; simulazione attivata.",
    });
    return;
  }

  try {
    const stripe = createStripeClient(config.secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: product.currency,
            unit_amount: product.priceCents,
            product_data: {
              name: itemTitle,
              description: product.subtitle,
            },
          },
          quantity: 1,
        },
      ],
      shipping_address_collection: {
        allowed_countries: [
          "IT", "FR", "DE", "ES", "CH", "AT", "BE", "NL", "LU", "PT", "IE", "GB", "US", "CA", "AU"
        ],
      },
      phone_number_collection: {
        enabled: true,
      },
      metadata: {
        type: "arsenal_order",
        userId,
        productId: product.id,
        productTitle: product.title,
        variant: variantLabel,
        variantId: variant?.id ?? "",
        colorId: colorway?.id ?? "",
        fulfillmentProvider: product.fulfillmentProvider,
      },
      success_url: `${config.appBaseUrl || ""}/resources?tab=orders&status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.appBaseUrl || ""}/resources?tab=orders&status=cancelled`,
    });

    res.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    logger.error({ err: error, productId, userId }, "Failed to create Stripe Checkout session for arsenal product");
    res.status(500).json({ error: "checkout_creation_failed", message: "Impossibile avviare il checkout. Riprova più tardi." });
  }
});

// GET /api/arsenal/orders
router.get("/arsenal/orders", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "auth_required" });
    return;
  }

  try {
    const orders = await db
      .select()
      .from(arsenalOrdersTable)
      .where(eq(arsenalOrdersTable.userId, userId))
      .orderBy(desc(arsenalOrdersTable.createdAt));

    res.json({ orders });
  } catch (err) {
    logger.error({ err, userId }, "Failed to fetch arsenal orders");
    res.status(500).json({ error: "failed_to_fetch_orders" });
  }
});

export async function handleArsenalOrderSession(session: Stripe.Checkout.Session): Promise<void> {
  const md = session.metadata ?? {};
  if (md.type !== "arsenal_order" || !md.userId || !md.productId) {
    return;
  }

  // Ensure payment actually succeeded
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    logger.warn({ sessionId: session.id, status: session.payment_status }, "Arsenal checkout session completed but not paid");
    return;
  }

  const shipping = (session as unknown as { shipping_details?: { name?: string; phone?: string; address?: Stripe.Address } }).shipping_details;
  const customer = session.customer_details;
  const address = shipping?.address ?? customer?.address;

  const orderId = `ord_${session.id.replace(/^cs_/, "").slice(0, 16)}`;

  try {
    await db
      .insert(arsenalOrdersTable)
      .values({
        id: orderId,
        userId: md.userId,
        productId: md.productId,
        productTitle: md.productTitle || "Dotazione d'Ordine",
        variant: md.variant || null,
        amountCents: session.amount_total ?? 0,
        currency: session.currency ?? "eur",
        stripeSessionId: session.id,
        stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
        customerName: shipping?.name ?? customer?.name ?? null,
        customerEmail: customer?.email ?? null,
        customerPhone: shipping?.phone ?? customer?.phone ?? null,
        shippingAddressLine1: address?.line1 ?? null,
        shippingAddressLine2: address?.line2 ?? null,
        shippingCity: address?.city ?? null,
        shippingPostalCode: address?.postal_code ?? null,
        shippingCountry: address?.country ?? null,
        fulfillmentStatus: "paid",
        fulfillmentProvider: (md.fulfillmentProvider as "lulu" | "printful" | "dropship_manual") || "dropship_manual",
        metadata: md,
      })
      .onConflictDoNothing();

    logger.info(
      { orderId, userId: md.userId, productId: md.productId, variant: md.variant },
      "Arsenal order successfully created from Stripe checkout session",
    );

    // Inoltro automatico al fornitore (Printful / Lulu)
    void dispatchArsenalOrder(orderId).catch((err) => {
      logger.error({ err, orderId }, "Asynchronous fulfillment dispatch failed");
    });
  } catch (error) {
    logger.error({ err: error, sessionId: session.id, md }, "Failed to record arsenal order from session");
    throw error;
  }
}

function verifyWebhookSecret(req: Request, expectedSecret: string | undefined, headerName: string): boolean {
  const configured = expectedSecret?.trim();
  if (!configured) {
    return process.env.NODE_ENV !== "production";
  }
  const rawHeader = req.headers[headerName] ?? req.headers["authorization"];
  const candidate = (Array.isArray(rawHeader) ? rawHeader[0] : rawHeader ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!candidate || candidate.length !== configured.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(configured));
}

function sanitizeTrackingUrl(url?: string): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  const trimmed = url.trim();
  return /^https:\/\/[^\s<>"]+$/i.test(trimmed) ? trimmed.slice(0, 512) : undefined;
}

// POST /api/arsenal/webhooks/printful
router.post("/arsenal/webhooks/printful", async (req: Request, res: Response) => {
  if (!verifyWebhookSecret(req, process.env.PRINTFUL_WEBHOOK_SECRET, "x-printful-webhook-secret")) {
    res.status(401).json({ error: "Unauthorized webhook" });
    return;
  }
  const body = req.body as {
    type?: string;
    data?: {
      order?: { external_id?: string; id?: number };
      shipment?: { tracking_number?: string; tracking_url?: string; carrier?: string };
    };
  };

  if (body?.type === "package_shipped" && body.data?.order?.external_id) {
    await updateOrderTracking({
      provider: "printful",
      orderId: String(body.data.order.external_id).slice(0, 128),
      providerOrderId: String(body.data.order.id || "").slice(0, 64),
      trackingNumber: String(body.data.shipment?.tracking_number || "TRK-PRINTFUL").slice(0, 128),
      trackingUrl: sanitizeTrackingUrl(body.data.shipment?.tracking_url),
      carrier: body.data.shipment?.carrier ? String(body.data.shipment.carrier).slice(0, 64) : undefined,
    });
  }

  res.json({ received: true });
});

// POST /api/arsenal/webhooks/lulu
router.post("/arsenal/webhooks/lulu", async (req: Request, res: Response) => {
  if (!verifyWebhookSecret(req, process.env.LULU_WEBHOOK_SECRET, "x-lulu-webhook-secret")) {
    res.status(401).json({ error: "Unauthorized webhook" });
    return;
  }
  const body = req.body as {
    topic?: string;
    data?: {
      external_id?: string;
      id?: number;
      status?: { name?: string };
      line_item_statuses?: Array<{ tracking_urls?: string[] }>;
    };
  };

  if (body?.data?.external_id && body.data.status?.name === "SHIPPED") {
    const trackingUrl = sanitizeTrackingUrl(body.data.line_item_statuses?.[0]?.tracking_urls?.[0]);
    await updateOrderTracking({
      provider: "lulu",
      orderId: String(body.data.external_id).slice(0, 128),
      providerOrderId: String(body.data.id || "").slice(0, 64),
      trackingNumber: "TRK-LULU",
      trackingUrl,
      carrier: "Postal Carrier",
    });
  }

  res.json({ received: true });
});

// GET /api/arsenal/admin/printful-status
router.get("/arsenal/admin/printful-status", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId || !(await isPlatformAdmin(userId))) {
    res.status(403).json({ error: "Accesso riservato al Consiglio Direttivo" });
    return;
  }
  const status = await verifyPrintfulStatus();
  res.json(status);
});

export default router;
