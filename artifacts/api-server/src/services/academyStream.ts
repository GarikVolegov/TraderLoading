import { LaunchError } from "../lib/launchError.js";
import { getAcademySubscription, isAcademyEntitled } from "./academyBilling.js";
import { eq } from "drizzle-orm";
import { academyVideosTable, db } from "@workspace/db";

const fail = (message: string, status = 503) => new LaunchError(message, status);
export function streamConfig() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  const host = process.env.CLOUDFLARE_STREAM_CUSTOMER_HOST;
  if (
    !account ||
    !/^[a-f0-9]{32}$/i.test(account) ||
    !token ||
    !host ||
    !/^customer-[a-z0-9]+\.cloudflarestream\.com$/.test(host)
  ) {
    throw fail("Video non configurati. Contatta il docente.");
  }
  return { base: `https://api.cloudflare.com/client/v4/accounts/${account}/stream`, token, host };
}
async function streamRequest(path: string, init: RequestInit = {}) {
  const config = streamConfig();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${config.token}`);
  const response = await fetch(`${config.base}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw fail("Servizio video temporaneamente non disponibile.");
  return response;
}
export async function createStreamUpload(ownerId: string, size: number) {
  const metadata = `maxDurationSeconds ${Buffer.from("7200").toString("base64")},requiresignedurls,expiry ${Buffer.from(new Date(Date.now() + 24 * 3600_000).toISOString()).toString("base64")}`;
  const response = await streamRequest("?direct_user=true", {
    method: "POST",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(size),
      "Upload-Metadata": metadata,
    },
  });
  const uploadUrl = response.headers.get("Location");
  const id = response.headers.get("stream-media-id");
  if (!uploadUrl || !id || !/^[a-f0-9]{32}$/.test(id))
    throw fail("Risposta di caricamento non valida.");
  const url = new URL(uploadUrl);
  if (
    url.protocol !== "https:" ||
    !["upload.videodelivery.net", "upload.cloudflarestream.com"].includes(url.hostname)
  )
    throw fail("Destinazione video non valida.");
  await db.insert(academyVideosTable).values({ id, ownerId });
  return { id, uploadUrl };
}
export async function streamVideoState(id: string, persist = true) {
  const body = (await (await streamRequest(`/${encodeURIComponent(id)}`)).json()) as {
    result?: {
      readyToStream?: boolean;
      requireSignedURLs?: boolean;
      status?: { state?: string; errorReasonText?: string };
    };
  };
  const video = body.result;
  // Refuse public videos, even when a provider response reports them ready.
  if (video?.requireSignedURLs !== true) throw fail("La protezione del video non è attiva.");
  const state = video.readyToStream
    ? "ready"
    : video.status?.state === "error"
      ? "error"
      : "processing";
  if (persist)
    await db.update(academyVideosTable).set({ state }).where(eq(academyVideosTable.id, id));
  return {
    state,
    error: state === "error" ? "Elaborazione non riuscita. Carica nuovamente il video." : null,
  };
}
export async function assertReadyStreamVideo(id: string) {
  const [video] = await db.select().from(academyVideosTable).where(eq(academyVideosTable.id, id));
  if (!video || (await streamVideoState(id)).state !== "ready")
    throw fail("Attendi che il video sia pronto prima di salvarlo.", 400);
}
export async function streamPlayback(id: string, paidUserId?: string) {
  const config = streamConfig();
  let expiration = Date.now() + 3 * 3600_000;
  if (paidUserId) {
    const subscription = await getAcademySubscription(paidUserId);
    if (!isAcademyEntitled(subscription))
      throw new LaunchError("Accesso al Protocollo scaduto.", 403);
    expiration = Math.min(expiration, subscription!.paidThrough!.getTime());
  }
  const expiresAt = new Date(expiration);
  const body = (await (
    await streamRequest(`/${encodeURIComponent(id)}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exp: Math.floor(expiresAt.getTime() / 1000) }),
    })
  ).json()) as { result?: { token?: string } };
  if (!body.result?.token) throw fail("Impossibile avviare il video.");
  return {
    url: `https://${config.host}/${body.result.token}/iframe`,
    expiresAt: expiresAt.toISOString(),
  };
}
