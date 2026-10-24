export interface FulfillmentRecipient {
  name: string;
  address1: string;
  address2?: string | null;
  city: string;
  postalCode: string;
  countryCode: string; // ISO 2-letter (es. "IT", "FR", "DE", "US")
  phone?: string | null;
  email?: string | null;
}

export interface FulfillmentItem {
  sku?: string;
  variantId?: string;
  productId?: string;
  colorId?: string;
  productTitle: string;
  quantity: number;
  priceCents: number;
}

export interface DispatchResult {
  success: boolean;
  provider: "printful" | "lulu" | "manual";
  providerOrderId?: string;
  status: "in_production" | "processing" | "shipped" | "failed";
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  carrier?: string | null;
  error?: string;
  rawResponse?: unknown;
}

export interface WebhookShipmentUpdate {
  provider: "printful" | "lulu";
  orderId: string; // External order id (ord_...)
  providerOrderId: string;
  trackingNumber: string;
  trackingUrl?: string | null;
  carrier?: string | null;
  shippedAt?: string;
}
