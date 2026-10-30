import type { Request, Response, NextFunction } from "express";
import { honorSealRegistry } from "../services/honorCardVerification.js";
import { renderHonorCardHtml } from "../services/honorCardOgRenderer.js";
import { renderDuelCardHtml } from "../services/duelOgRenderer.js";
import { getCustomLobbyByCode } from "../services/backtestTournaments/store.js";

export const SOCIAL_CRAWLER_REGEX =
  /bot|crawler|spider|telegram|twitter|discord|whatsapp|facebookexternalhit|slackbot|linkedinbot|pinterest/i;

export function resolveTrustedBaseUrl(): string {
  const raw = (process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  try {
    const url = new URL(raw);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol === "https:" || (isLocal && process.env.NODE_ENV !== "production")) {
      return url.origin;
    }
  } catch {
    // fall through
  }
  return "https://aureus-os.app";
}

export function renderArenaSpectatorOgHtml(roomId: string, baseUrl: string): string {
  const pageTitle = `AUREUS PROTOCOL · Arena della Disciplina [${roomId}]`;
  const pageDescription = `Assisti al duello di trading in tempo reale nella Forgia del Passato sul protocollo AUREUS. Due operatori si sfidano ad armi pari sulla disciplina matematica.`;
  const url = `${baseUrl}/duello/${encodeURIComponent(roomId)}`;
  const ogImageUrl = `${baseUrl}/og-image.png`;

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDescription}" />
  <link rel="canonical" href="${url}" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="AUREUS PROTOCOL" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${pageTitle}" />
  <meta property="og:description" content="${pageDescription}" />
  <meta property="og:image" content="${ogImageUrl}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${url}" />
  <meta name="twitter:title" content="${pageTitle}" />
  <meta name="twitter:description" content="${pageDescription}" />
  <meta name="twitter:image" content="${ogImageUrl}" />
  <meta http-equiv="refresh" content="0; url=${url}" />
</head>
<body style="background:#07080b;color:#f4f4f6;font-family:sans-serif;padding:2rem;text-align:center;">
  <p>Reindirizzamento all&apos;Arena della Disciplina: <strong>${roomId}</strong>...</p>
  <p><a href="${url}" style="color:#C5A059;">Accedi al banco spettatori</a></p>
</body>
</html>`;
}

export async function socialCrawlerOgMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    next();
    return;
  }

  const userAgent = (req.headers["user-agent"] || "").toLowerCase();
  const isCrawler =
    req.query.format === "html" ||
    SOCIAL_CRAWLER_REGEX.test(userAgent);

  if (!isCrawler) {
    next();
    return;
  }

  const baseUrl = resolveTrustedBaseUrl();

  if (req.path.startsWith("/verifica/") || req.path.startsWith("/verify/")) {
    const rawHash = req.path.replace(/^\/(?:verifica|verify)\//, "").split("/")[0];
    if (rawHash) {
      try {
        const seal = await honorSealRegistry.getSeal(rawHash);
        const html = renderHonorCardHtml(seal, baseUrl, rawHash);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
        res.send(html);
        return;
      } catch {
        next();
        return;
      }
    }
  }

  if (req.path.startsWith("/duello/") || req.path.startsWith("/battle/")) {
    const rawRoom = req.path.replace(/^\/(?:duello|battle)\//, "").split("/")[0];
    if (rawRoom) {
      const lobby = await getCustomLobbyByCode(rawRoom);
      const html = renderDuelCardHtml(
        {
          code: rawRoom,
          hostName: lobby?.hostDisplayName ?? "Guerriero Aureus",
          pair: lobby?.pair ?? "XAUUSD",
          timeframe: lobby?.timeframe ?? "M5",
          durationMinutes: Math.round((lobby?.timeLimitSeconds ?? 900) / 60),
          status: lobby?.status ?? "active",
        },
        baseUrl,
      );
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
      res.send(html);
      return;
    }
  }

  next();
}
