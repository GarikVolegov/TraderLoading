import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const instant = (name: string) => timestamp(name, { withTimezone: true });

export const arsenalOrdersTable = pgTable(
  "arsenal_orders",
  {
    id: text("id").primaryKey(), // es. "ord_limen_abc123"
    userId: text("user_id").notNull(),
    productId: text("product_id").notNull(),
    productTitle: text("product_title").notNull(),
    variant: text("variant"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("eur"),
    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    customerName: text("customer_name"),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    shippingAddressLine1: text("shipping_address_line1"),
    shippingAddressLine2: text("shipping_address_line2"),
    shippingCity: text("shipping_city"),
    shippingPostalCode: text("shipping_postal_code"),
    shippingCountry: text("shipping_country"),
    fulfillmentStatus: text("fulfillment_status").notNull().default("paid"), // "paid" | "processing" | "in_production" | "shipped" | "delivered" | "cancelled"
    fulfillmentProvider: text("fulfillment_provider").notNull().default("dropship_manual"), // "lulu" | "printful" | "dropship_manual"
    providerOrderId: text("provider_order_id"),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    carrier: text("carrier"),
    metadata: jsonb("metadata"),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("arsenal_orders_user_idx").on(t.userId),
    index("arsenal_orders_stripe_session_idx").on(t.stripeSessionId),
    index("arsenal_orders_status_idx").on(t.fulfillmentStatus),
  ],
);

export type ArsenalOrderDbRecord = typeof arsenalOrdersTable.$inferSelect;
export type InsertArsenalOrderDbRecord = typeof arsenalOrdersTable.$inferInsert;
