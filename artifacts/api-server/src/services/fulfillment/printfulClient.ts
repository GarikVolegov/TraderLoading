import logger from "../../lib/logger.js";
import type { DispatchResult, FulfillmentItem, FulfillmentRecipient } from "./types.js";

/**
 * Matrice Ufficiale dei Variant ID da Catalogo Printful per Gildan 18500 Unisex Heavy Blend Hoodie (Product ID 146).
 * Dati verificati direttamente da Printful API Catalog:
 * - Sport Grey: 5610 (S), 5611 (M), 5612 (L), 5613 (XL), 5614 (2XL)
 * - Black: 5530 (S), 5531 (M), 5532 (L), 5533 (XL), 5534 (2XL)
 * - Dark Heather: 10806 (S), 10807 (M), 10808 (L), 10809 (XL), 10810 (2XL)
 */
export const PRINTFUL_HOODIE_CATALOG_VARIANTS: Record<string, Record<string, number>> = {
  "sport-grey": {
    "size-s": 5610,
    "size-m": 5611,
    "size-l": 5612,
    "size-xl": 5613,
    "size-xxl": 5614,
  },
  "obsidian-black": {
    "size-s": 5530,
    "size-m": 5531,
    "size-l": 5532,
    "size-xl": 5533,
    "size-xxl": 5534,
  },
  "dark-heather": {
    "size-s": 10806,
    "size-m": 10807,
    "size-l": 10808,
    "size-xl": 10809,
    "size-xxl": 10810,
  },
};

/**
 * Matrice Variant ID da Catalogo Printful per Fleece Relaxed Pants (Cotton Heritage M7580 / Bella + Canvas):
 * - Sport Grey / Carbon Grey: 11278 (S), 11279 (M), 11280 (L), 11281 (XL), 11282 (2XL)
 * - Black: 11266 (S), 11267 (M), 11268 (L), 11269 (XL), 11270 (2XL)
 * - Charcoal Heather / Dark Heather: 11284 (S), 11285 (M), 11286 (L), 11287 (XL), 11288 (2XL)
 */
export const PRINTFUL_PANTS_CATALOG_VARIANTS: Record<string, Record<string, number>> = {
  "sport-grey": {
    "size-s": 11278,
    "size-m": 11279,
    "size-l": 11280,
    "size-xl": 11281,
    "size-xxl": 11282,
  },
  "obsidian-black": {
    "size-s": 11266,
    "size-m": 11267,
    "size-l": 11268,
    "size-xl": 11269,
    "size-xxl": 11270,
  },
  "dark-heather": {
    "size-s": 11284,
    "size-m": 11285,
    "size-l": 11286,
    "size-xl": 11287,
    "size-xxl": 11288,
  },
};

export function resolvePantVariantId(item: FulfillmentItem): number {
  const color = (item.colorId || "sport-grey").toLowerCase();
  const variant = (item.variantId || "size-m").toLowerCase();

  const colorMap =
    PRINTFUL_PANTS_CATALOG_VARIANTS[color] ||
    (color.includes("black")
      ? PRINTFUL_PANTS_CATALOG_VARIANTS["obsidian-black"]
      : color.includes("heather")
      ? PRINTFUL_PANTS_CATALOG_VARIANTS["dark-heather"]
      : PRINTFUL_PANTS_CATALOG_VARIANTS["sport-grey"]);

  if (colorMap) {
    if (colorMap[variant]) return colorMap[variant];
    if (variant.includes("xxl") || variant.includes("2xl")) return colorMap["size-xxl"];
    if (variant.includes("xl")) return colorMap["size-xl"];
    if (variant.includes("l")) return colorMap["size-l"];
    if (variant.includes("m")) return colorMap["size-m"];
    if (variant.includes("s")) return colorMap["size-s"];
  }

  const numeric = Number(item.variantId);
  if (!isNaN(numeric) && numeric > 0) return numeric;
  return 11278; // Default S
}

export interface PrintfulOrderPayload {
  orderId: string;
  recipient: FulfillmentRecipient;
  items: FulfillmentItem[];
}

export function getPrintfulHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };
  const storeId = process.env.PRINTFUL_STORE_ID;
  if (storeId && storeId.trim()) {
    headers["X-PF-Store-Id"] = storeId.trim();
  }
  return headers;
}

/**
 * Risolve il variant ID numerico da catalogo Printful per la felpa Gildan 18500.
 */
export function resolveCatalogVariantId(item: FulfillmentItem): number | null {
  const color = (item.colorId || "sport-grey").toLowerCase();
  const variant = (item.variantId || "size-m").toLowerCase();

  // 1. Corrispondenza diretta per ID normalizzato
  const colorMap =
    PRINTFUL_HOODIE_CATALOG_VARIANTS[color] ||
    (color.includes("black")
      ? PRINTFUL_HOODIE_CATALOG_VARIANTS["obsidian-black"]
      : color.includes("heather")
      ? PRINTFUL_HOODIE_CATALOG_VARIANTS["dark-heather"]
      : PRINTFUL_HOODIE_CATALOG_VARIANTS["sport-grey"]);

  if (colorMap) {
    if (colorMap[variant]) return colorMap[variant];
    if (variant.includes("xxl") || variant.includes("2xl")) return colorMap["size-xxl"];
    if (variant.includes("xl")) return colorMap["size-xl"];
    if (variant.includes("l")) return colorMap["size-l"];
    if (variant.includes("m")) return colorMap["size-m"];
    if (variant.includes("s")) return colorMap["size-s"];
  }

  // 2. Fallback: se è già un numero valido
  const numeric = Number(item.variantId);
  if (!isNaN(numeric) && numeric > 0) {
    return numeric;
  }

  return 5610; // Default Sport Grey Taglia S
}

/**
 * Genera l'array di file di ricamo industriali pronti per Printful API.
 */
export function getHoodiePrintFiles(publicBaseUrl: string) {
  const base = publicBaseUrl.replace(/\/+$/, "");
  return [
    {
      type: "embroidery_chest_left",
      url: `${base}/images/merch/limen_signature_gold_300dpi.png`,
    },
    {
      type: "embroidery_wrist_left",
      url: `${base}/images/merch/limen_wrist_roman_aureus_300dpi.png`,
    },
    {
      type: "back",
      url: `${base}/images/merch/limen_back_trajan_column_300dpi.png`,
    },
  ];
}

/**
 * Verifica lo stato della connessione API con Printful.
 */
export async function verifyPrintfulStatus(): Promise<{
  configured: boolean;
  apiKeySet: boolean;
  storeIdSet: boolean;
  connected: boolean;
  store?: { id: number; name: string; type: string };
  error?: string;
}> {
  const apiKey = process.env.PRINTFUL_API_KEY;
  const storeId = process.env.PRINTFUL_STORE_ID;

  if (!apiKey) {
    return {
      configured: false,
      apiKeySet: false,
      storeIdSet: Boolean(storeId),
      connected: false,
      error: "PRINTFUL_API_KEY non configurata nelle variabili d'ambiente (.env)",
    };
  }

  try {
    const res = await fetch("https://api.printful.com/stores", {
      headers: getPrintfulHeaders(apiKey),
    });

    const data = (await res.json()) as {
      code: number;
      result?: Array<{ id: number; name: string; type: string }>;
      error?: { message: string };
    };

    if (!res.ok || data.code >= 400) {
      return {
        configured: true,
        apiKeySet: true,
        storeIdSet: Boolean(storeId),
        connected: false,
        error: data.error?.message || `Printful API HTTP ${res.status}`,
      };
    }

    const firstStore = data.result?.[0];
    return {
      configured: true,
      apiKeySet: true,
      storeIdSet: Boolean(storeId),
      connected: true,
      store: firstStore,
    };
  } catch (err) {
    return {
      configured: true,
      apiKeySet: true,
      storeIdSet: Boolean(storeId),
      connected: false,
      error: err instanceof Error ? err.message : "Errore di connessione a Printful",
    };
  }
}

/**
 * Invia l'ordine a Printful API per abbigliamento, hoodie e t-shirt d'Ordine.
 * Se PRINTFUL_API_KEY non è configurata, entra in modalità simulazione per local dev & test.
 */
export async function sendOrderToPrintful(payload: PrintfulOrderPayload): Promise<DispatchResult> {
  const apiKey = process.env.PRINTFUL_API_KEY;

  if (!apiKey) {
    logger.info(
      { orderId: payload.orderId, recipient: payload.recipient.name },
      "[SIMULAZIONE PRINTFUL] Chiave PRINTFUL_API_KEY non rilevata: ordine simulato in produzione con successo",
    );
    return {
      success: true,
      provider: "printful",
      providerOrderId: `pf_sim_${payload.orderId.slice(4)}`,
      status: "in_production",
    };
  }

  try {
    const publicBaseUrl =
      process.env.PUBLIC_ASSETS_BASE_URL ||
      process.env.APP_BASE_URL ||
      "https://app.limenprotocol.com";

    const printfulItems = payload.items.map((item) => {
      const isHoodie =
        item.productId === "uniforme-hoodie" ||
        item.productTitle.toLowerCase().includes("hoodie") ||
        item.productTitle.toLowerCase().includes("felpa");

      if (isHoodie) {
        const catalogVariantId = resolveCatalogVariantId(item);
        return {
          name: item.productTitle,
          quantity: item.quantity,
          retail_price: (item.priceCents / 100).toFixed(2),
          variant_id: catalogVariantId,
          files: getHoodiePrintFiles(publicBaseUrl),
          options: [
            {
              id: "thread_colors_front_large",
              value: ["#C5A059", "#111111"],
            },
          ],
        };
      }

      const isPant =
        item.productId === "uniforme-pantalone" ||
        item.productTitle.toLowerCase().includes("pant") ||
        item.productTitle.toLowerCase().includes("pantalone");

      if (isPant) {
        const catalogVariantId = resolvePantVariantId(item);
        return {
          name: item.productTitle,
          quantity: item.quantity,
          retail_price: (item.priceCents / 100).toFixed(2),
          variant_id: catalogVariantId,
          files: [
            {
              type: "embroidery_front_left",
              url: `${publicBaseUrl.replace(/\/+$/, "")}/images/merch/limen_pant_ordo_geometrico_300dpi.png`,
            },
          ],
          options: [
            {
              id: "thread_colors_front_large",
              value: ["#C5A059", "#111111"],
            },
          ],
        };
      }

      // Default generico se non è la felpa principale
      return {
        name: item.productTitle,
        quantity: item.quantity,
        retail_price: (item.priceCents / 100).toFixed(2),
        ...(item.variantId && !isNaN(Number(item.variantId))
          ? { sync_variant_id: Number(item.variantId) }
          : { sku: item.sku || `LIMEN-${item.productTitle.slice(0, 10).toUpperCase()}` }),
      };
    });

    const orderPayload = {
      external_id: payload.orderId,
      recipient: {
        name: payload.recipient.name,
        address1: payload.recipient.address1,
        address2: payload.recipient.address2 ?? undefined,
        city: payload.recipient.city,
        country_code: payload.recipient.countryCode,
        zip: payload.recipient.postalCode,
        phone: payload.recipient.phone ?? undefined,
        email: payload.recipient.email ?? undefined,
      },
      items: printfulItems,
      packing_slip: {
        message: "LIMEN PROTOCOL // Dotazione d'Ordine Ufficiale — Zero Rumore Cognitivo.",
      },
    };

    logger.info(
      { orderId: payload.orderId, recipient: payload.recipient.name, itemsCount: printfulItems.length },
      "Inoltro ordine live a Printful API...",
    );

    const response = await fetch("https://api.printful.com/orders", {
      method: "POST",
      headers: getPrintfulHeaders(apiKey),
      body: JSON.stringify(orderPayload),
    });

    const data = (await response.json()) as {
      code: number;
      result?: { id: number; status: string };
      error?: { message: string };
    };

    if (!response.ok || data.code >= 400 || !data.result) {
      logger.error(
        { status: response.status, data, orderId: payload.orderId },
        "Printful API error creating order",
      );
      return {
        success: false,
        provider: "printful",
        status: "failed",
        error: data.error?.message || "Printful rejected order creation",
        rawResponse: data,
      };
    }

    logger.info(
      { orderId: payload.orderId, printfulId: data.result.id, status: data.result.status },
      "Printful order successfully created & submitted for production",
    );

    return {
      success: true,
      provider: "printful",
      providerOrderId: String(data.result.id),
      status: "in_production",
      rawResponse: data.result,
    };
  } catch (error) {
    logger.error({ err: error, orderId: payload.orderId }, "Network error contacting Printful API");
    return {
      success: false,
      provider: "printful",
      status: "failed",
      error: error instanceof Error ? error.message : "Printful network error",
    };
  }
}
