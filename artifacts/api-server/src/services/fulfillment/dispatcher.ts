import { db, arsenalOrdersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import logger from "../../lib/logger.js";
import { sendOrderToPrintful } from "./printfulClient.js";
import { sendOrderToLulu } from "./luluClient.js";
import type { DispatchResult, FulfillmentItem, FulfillmentRecipient, WebhookShipmentUpdate } from "./types.js";

/**
 * Invia automaticamente un ordine al fornitore corrispondente (Printful / Lulu)
 * e aggiorna il record del database con l'ID dell'ordine del fornitore.
 */
export async function dispatchArsenalOrder(orderId: string): Promise<DispatchResult> {
  const [order] = await db
    .select()
    .from(arsenalOrdersTable)
    .where(eq(arsenalOrdersTable.id, orderId))
    .limit(1);

  if (!order) {
    logger.warn({ orderId }, "Cannot dispatch non-existent arsenal order");
    return { success: false, provider: "manual", status: "failed", error: "Order not found" };
  }

  // Se già inoltrato, evita duplicazioni
  if (order.providerOrderId && order.fulfillmentStatus !== "paid") {
    logger.info({ orderId, providerOrderId: order.providerOrderId }, "Order already dispatched");
    return {
      success: true,
      provider: (order.fulfillmentProvider as "printful" | "lulu") || "manual",
      providerOrderId: order.providerOrderId,
      status: order.fulfillmentStatus as "in_production" | "processing" | "shipped",
    };
  }

  const recipient: FulfillmentRecipient = {
    name: order.customerName || "Operatore AUREUS",
    address1: order.shippingAddressLine1 || "",
    address2: order.shippingAddressLine2,
    city: order.shippingCity || "",
    postalCode: order.shippingPostalCode || "",
    countryCode: (order.shippingCountry || "IT").toUpperCase(),
    phone: order.customerPhone,
    email: order.customerEmail,
  };

  const orderMetadata = (order.metadata as { variantId?: string; colorId?: string } | null) ?? {};

  const items: FulfillmentItem[] = [
    {
      productId: order.productId,
      productTitle: order.productTitle,
      quantity: 1,
      priceCents: order.amountCents,
      variantId: orderMetadata.variantId || order.variant || undefined,
      colorId: orderMetadata.colorId || undefined,
    },
  ];

  let result: DispatchResult;

  if (order.fulfillmentProvider === "printful") {
    result = await sendOrderToPrintful({ orderId, recipient, items });
  } else if (order.fulfillmentProvider === "lulu") {
    result = await sendOrderToLulu({ orderId, recipient, items });
  } else {
    // Evasione manuale o protocollo digitale
    logger.info({ orderId, provider: order.fulfillmentProvider }, "Order marked for manual fulfillment or direct vault");
    return { success: true, provider: "manual", status: "processing" };
  }

  if (result.success && result.providerOrderId) {
    await db
      .update(arsenalOrdersTable)
      .set({
        providerOrderId: result.providerOrderId,
        fulfillmentStatus: result.status,
        updatedAt: new Date(),
      })
      .where(eq(arsenalOrdersTable.id, orderId));
  }

  return result;
}

/**
 * Aggiorna l'ordine quando il fornitore notifica la spedizione e il tracking.
 */
export async function updateOrderTracking(update: WebhookShipmentUpdate): Promise<boolean> {
  try {
    const [existing] = await db
      .select()
      .from(arsenalOrdersTable)
      .where(eq(arsenalOrdersTable.id, update.orderId))
      .limit(1);

    if (!existing) {
      logger.warn({ update }, "Shipment update received for unknown order");
      return false;
    }

    await db
      .update(arsenalOrdersTable)
      .set({
        fulfillmentStatus: "shipped",
        trackingNumber: update.trackingNumber,
        trackingUrl: update.trackingUrl || null,
        carrier: update.carrier || null,
        updatedAt: new Date(),
      })
      .where(eq(arsenalOrdersTable.id, update.orderId));

    logger.info(
      { orderId: update.orderId, trackingNumber: update.trackingNumber, carrier: update.carrier },
      "Order marked as shipped with tracking info",
    );

    return true;
  } catch (err) {
    logger.error({ err, update }, "Failed to update order tracking in database");
    return false;
  }
}
