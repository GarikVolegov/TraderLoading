import logger from "../../lib/logger.js";
import type { DispatchResult, FulfillmentItem, FulfillmentRecipient } from "./types.js";

interface LuluOrderPayload {
  orderId: string;
  recipient: FulfillmentRecipient;
  items: FulfillmentItem[];
}

/**
 * Invia l'ordine di stampa del diario cartaceo a Lulu Direct API (Lulu xPress).
 * Se LULU_CLIENT_KEY non è configurata, entra in modalità simulazione.
 */
export async function sendOrderToLulu(payload: LuluOrderPayload): Promise<DispatchResult> {
  const clientKey = process.env.LULU_CLIENT_KEY;
  const clientSecret = process.env.LULU_CLIENT_SECRET;
  const isProd = process.env.LULU_ENVIRONMENT === "production";
  const baseUrl = isProd ? "https://api.lulu.com" : "https://api.sandbox.lulu.com";

  if (!clientKey || !clientSecret) {
    logger.info(
      { orderId: payload.orderId, recipient: payload.recipient.name },
      "[SIMULAZIONE LULU DIRECT] Chiavi LULU non configurate: ordine del diario cartaceo simulato in stampa con successo",
    );
    return {
      success: true,
      provider: "lulu",
      providerOrderId: `lulu_sim_${payload.orderId.slice(4)}`,
      status: "in_production",
    };
  }

  try {
    // 1. Richiesta Token OAuth2
    const tokenUrl = `${baseUrl}/auth/realms/glasstree/protocol/openid-connect/token`;
    const authHeader = Buffer.from(`${clientKey}:${clientSecret}`).toString("base64");
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const tokenData = (await tokenResponse.json()) as { access_token?: string; error?: string };
    if (!tokenResponse.ok || !tokenData.access_token) {
      logger.error({ status: tokenResponse.status, tokenData }, "Failed to authenticate with Lulu API");
      return {
        success: false,
        provider: "lulu",
        status: "failed",
        error: tokenData.error || "Lulu OAuth token failure",
      };
    }

    const accessToken = tokenData.access_token;

    // 2. Creazione Print Job
    const printJobResponse = await fetch(`${baseUrl}/print-jobs/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_id: payload.orderId,
        contact_email: payload.recipient.email || "ordini@aureusprotocol.com",
        line_items: [
          {
            title: "Il Codice Trimestrale — Diario Operativo AUREUS",
            // Asset PDF ufficiali di stampa (configurabili tramite env o storage)
            cover: process.env.LULU_CODICE_COVER_URL || "https://aureusprotocol.com/assets/print/codice-cover.pdf",
            interior: process.env.LULU_CODICE_INTERIOR_URL || "https://aureusprotocol.com/assets/print/codice-interior-90days.pdf",
            pod_package_id: "0600X0900BWSTDPB060UW444MXX", // Formato A5 Hardcover Casewrap
            quantity: 1,
          },
        ],
        shipping_address: {
          name: payload.recipient.name,
          street1: payload.recipient.address1,
          street2: payload.recipient.address2 ?? undefined,
          city: payload.recipient.city,
          country_code: payload.recipient.countryCode,
          postcode: payload.recipient.postalCode,
          phone_number: payload.recipient.phone ?? "0000000000",
        },
        shipping_level: "MAIL",
      }),
    });

    const printJobData = (await printJobResponse.json()) as {
      id?: number;
      status?: { name: string };
      errors?: unknown;
    };

    if (!printJobResponse.ok || !printJobData.id) {
      logger.error(
        { status: printJobResponse.status, printJobData, orderId: payload.orderId },
        "Lulu print-job creation failed",
      );
      return {
        success: false,
        provider: "lulu",
        status: "failed",
        error: JSON.stringify(printJobData.errors || "Lulu print job creation failed"),
        rawResponse: printJobData,
      };
    }

    logger.info(
      { orderId: payload.orderId, luluJobId: printJobData.id, status: printJobData.status?.name },
      "Lulu print job successfully submitted",
    );

    return {
      success: true,
      provider: "lulu",
      providerOrderId: String(printJobData.id),
      status: "in_production",
      rawResponse: printJobData,
    };
  } catch (error) {
    logger.error({ err: error, orderId: payload.orderId }, "Network error contacting Lulu API");
    return {
      success: false,
      provider: "lulu",
      status: "failed",
      error: error instanceof Error ? error.message : "Lulu network error",
    };
  }
}
