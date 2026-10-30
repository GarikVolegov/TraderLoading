import { Router, type IRouter } from "express";
import { count, countDistinct, isNotNull, eq, asc } from "drizzle-orm";
import { db, profileTable, accountTradesTable, testimonialsTable } from "@workspace/db";
import { PAIR_CATALOG } from "@workspace/pair-catalog";
import logger from "../lib/logger.js";
import { summarizeRatings } from "../services/publicStats.js";
import { singleFlight } from "../lib/singleFlight.js";
import {
  honorSealRegistry,
  honorClaimsSchema,
  HonorSealLimitError,
} from "../services/honorCardVerification.js";
import { renderHonorCardSvg, renderHonorCardHtml } from "../services/honorCardOgRenderer.js";
import { renderDuelCardSvg } from "../services/duelOgRenderer.js";
import { getCustomLobbyByCode } from "../services/backtestTournaments/store.js";

const router: IRouter = Router();

function resolveTrustedBaseUrl(): string {
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

interface PublicStatsDto {
  traders: number;
  trades: number;
  pairs: number;
  rating: ReturnType<typeof summarizeRatings>;
}

const statsInFlight = new Map<string, Promise<PublicStatsDto>>();
let cachedStats: { data: PublicStatsDto; expiresAt: number } | null = null;
const STATS_TTL_MS = 30_000;

export function invalidatePublicStatsCache(): void {
  cachedStats = null;
}

// Public, unauthenticated marketing data for the landing page. The `/public`
// prefix is intentionally NOT in ANONYMOUS_FALLBACK_PREFIXES, so it stays
// reachable for signed-out visitors in production. No user-scoped data is read.

router.get("/public/stats", async (_req, res) => {
  try {
    const now = Date.now();
    if (cachedStats && cachedStats.expiresAt > now) {
      res.json(cachedStats.data);
      return;
    }

    const data = await singleFlight(statsInFlight, "public-stats", async () => {
      const freshNow = Date.now();
      if (cachedStats && cachedStats.expiresAt > freshNow) {
        return cachedStats.data;
      }

      const [traderRows, tradeRows, ratingRows] = await Promise.all([
        // Real users are tracked by `profile` (one row per Clerk userId, created
        // on onboarding), not the abandoned Replit-Auth `users` table.
        db
          .select({ value: countDistinct(profileTable.userId) })
          .from(profileTable)
          .where(isNotNull(profileTable.userId)),
        db.select({ value: count() }).from(accountTradesTable),
        db
          .select({ rating: testimonialsTable.rating })
          .from(testimonialsTable)
          .where(eq(testimonialsTable.published, true)),
      ]);

      const result: PublicStatsDto = {
        traders: Number(traderRows[0]?.value ?? 0),
        trades: Number(tradeRows[0]?.value ?? 0),
        pairs: PAIR_CATALOG.length,
        rating: summarizeRatings(ratingRows.map((row) => Number(row.rating))),
      };

      cachedStats = { data: result, expiresAt: Date.now() + STATS_TTL_MS };
      return result;
    });

    res.json(data);
  } catch (error) {
    logger.warn({ err: error }, "public stats unavailable");
    res.status(503).json({ error: "stats unavailable" });
  }
});

router.get("/public/testimonials", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: testimonialsTable.id,
        name: testimonialsTable.name,
        role: testimonialsTable.role,
        text: testimonialsTable.text,
        rating: testimonialsTable.rating,
      })
      .from(testimonialsTable)
      .where(eq(testimonialsTable.published, true))
      .orderBy(asc(testimonialsTable.sortOrder), asc(testimonialsTable.id));
    res.json({ testimonials: rows });
  } catch (error) {
    logger.warn({ err: error }, "public testimonials unavailable");
    res.status(503).json({ error: "testimonials unavailable" });
  }
});

// ── GET /public/og-honor/:hash: Render OpenGraph vettoriale ad alta definizione ──
router.get("/public/og-honor/:hash", async (req, res) => {
  try {
    const rawParam = Array.isArray(req.params.hash) ? req.params.hash[0] : req.params.hash;
    const rawHash = (rawParam || "").replace(/\.(svg|png)$/i, "").trim();
    if (!rawHash) {
      res.status(400).send("Hash mancante");
      return;
    }

    const seal = await honorSealRegistry.getSeal(rawHash);
    const svg = renderHonorCardSvg(seal, rawHash);

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");
    res.send(svg);
  } catch (error) {
    logger.warn({ err: error }, "og-honor svg rendering failed");
    res.status(500).send("Errore durante la generazione della scheda OpenGraph");
  }
});

// ── GET /public/og-duello/:code: Render OpenGraph vettoriale ad alta definizione per le Arene ──
router.get("/public/og-duello/:code", async (req, res) => {
  try {
    const rawParam = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
    const rawCode = (rawParam || "").replace(/\.(svg|png)$/i, "").trim();
    if (!rawCode) {
      res.status(400).send("Codice stanza mancante");
      return;
    }

    const lobby = await getCustomLobbyByCode(rawCode);
    const svg = renderDuelCardSvg({
      code: rawCode,
      hostName: lobby?.hostDisplayName ?? "Guerriero Aureus",
      pair: lobby?.pair ?? "XAUUSD",
      timeframe: lobby?.timeframe ?? "M5",
      durationMinutes: Math.round((lobby?.timeLimitSeconds ?? 900) / 60),
      status: lobby?.status ?? "active",
    });

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
    res.send(svg);
  } catch (error) {
    logger.warn({ err: error }, "og-duello svg rendering failed");
    res.status(500).send("Errore durante la generazione della scheda duello");
  }
});

// ── GET /public/verify-honor/:hash: Verifica pubblica del Sigillo d'Onore ─────────
router.get("/public/verify-honor/:hash", async (req, res) => {
  try {
    const rawHash = Array.isArray(req.params.hash) ? req.params.hash[0] : req.params.hash;
    if (!rawHash || typeof rawHash !== "string") {
      res.status(400).json({ isValid: false, error: "Hash mancante o non valido" });
      return;
    }

    const seal = await honorSealRegistry.getSeal(rawHash);

    // Content negotiation:
    // Se la richiesta proviene da browser o crawler social (Telegram, Twitter, Discord, WhatsApp, etc.)
    const accept = req.headers.accept || "";
    const userAgent = (req.headers["user-agent"] || "").toLowerCase();
    const isBotOrBrowser =
      req.query.format === "html" ||
      (!req.xhr &&
        (accept.includes("text/html") ||
          userAgent.includes("bot") ||
          userAgent.includes("crawler") ||
          userAgent.includes("spider") ||
          userAgent.includes("telegram") ||
          userAgent.includes("twitter") ||
          userAgent.includes("discord") ||
          userAgent.includes("whatsapp") ||
          userAgent.includes("facebookexternalhit")));

    if (isBotOrBrowser && req.query.format !== "json") {
      // Mai derivare la base URL dall'header Host (host-header poisoning con
      // cache pubblica): solo APP_BASE_URL validato.
      const baseUrl = resolveTrustedBaseUrl();
      const html = renderHonorCardHtml(seal, baseUrl, rawHash);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
      res.send(html);
      return;
    }

    // Default: risposta JSON per client API
    if (!seal) {
      res.status(404).json({
        isValid: false,
        status: "SEAL_NOT_FOUND",
        verificationHash: rawHash.toUpperCase(),
        message: "Nessun sigillo d'onore registrato corrisponde all'hash specificato.",
      });
      return;
    }

    res.json({
      isValid: true,
      status: "VERIFIED",
      verificationHash: seal.hash,
      protocol: "AUREUS PROTOCOL · IL CODICE DELLA PRESENZA",
      seal: {
        operatorName: seal.operatorName,
        operatorGrade: seal.operatorGrade,
        tradeType: seal.tradeType,
        symbol: seal.symbol,
        title: seal.title,
        totalProfitFormatted: seal.totalProfitFormatted,
        winRate: seal.winRate,
        integrityScore: seal.integrityScore,
        totalTrades: seal.totalTrades,
        drawdown: seal.drawdown,
        timestamp: seal.timestamp,
      },
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn({ err: error }, "honor verification failed");
    res.status(500).json({ isValid: false, error: "Errore durante la verifica del sigillo" });
  }
});

// ── POST /public/verify-honor: confronto delle metriche con il record firmato ─────
router.post("/public/verify-honor", async (req, res) => {
  try {
    const { hash, claims } = req.body || {};
    const parsed = honorClaimsSchema.safeParse(claims);
    if (!hash || typeof hash !== "string" || hash.length > 80 || !parsed.success) {
      res.status(400).json({
        isValid: false,
        error: "Parametri 'hash' e 'claims' obbligatori",
      });
      return;
    }

    const { isValid, expectedHash } = await honorSealRegistry.verifyClaims(hash, parsed.data);

    if (isValid) {
      res.json({
        isValid: true,
        status: "SIGNATURE_VERIFIED",
        verificationHash: hash.toUpperCase(),
        algorithm: "HMAC-SHA256",
        claims: parsed.data,
        message: "Sigillo integro: metriche conformi al record firmato dal Protocollo.",
      });
    } else {
      res.status(400).json({
        isValid: false,
        status: "HASH_MISMATCH",
        expectedHash,
        providedHash: hash.toUpperCase(),
        message: "Firma non corrispondente ai parametri forniti o sigillo non registrato.",
      });
    }
  } catch (error) {
    logger.warn({ err: error }, "honor claims verification failed");
    res.status(500).json({ isValid: false, error: "Errore verifica claims" });
  }
});

// ── POST /public/register-honor-seal: registrazione autenticata, firmata server-side ──
router.post("/public/register-honor-seal", async (req, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, error: "Autenticazione richiesta." });
      return;
    }
    const parsed = honorClaimsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Payload scheda d'onore non valido" });
      return;
    }

    const registered = await honorSealRegistry.registerSeal(req.user.id, parsed.data);
    res.json({ success: true, hash: registered.hash, seal: registered });
  } catch (error) {
    if (error instanceof HonorSealLimitError) {
      res.status(429).json({ success: false, error: "Limite di sigilli raggiunto" });
      return;
    }
    logger.warn({ err: error }, "honor seal registration failed");
    res.status(500).json({ success: false, error: "Errore registrazione sigillo" });
  }
});

export default router;
