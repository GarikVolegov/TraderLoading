import { Router, type IRouter, type Request, type Response } from "express";
import { requireAdmin } from "../lib/adminAuth.js";
import logger from "../lib/logger.js";

export const INDEXNOW_HOST = "aureus-os.app";
export const INDEXNOW_KEY = "8f7b2c9e4a1d6e3f5b0a7c9d1e4f2a8b";
export const INDEXNOW_KEY_LOCATION = `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`;

// Core canonical routes across 5 languages + gateways
export const CANONICAL_INDEXNOW_URLS = [
  "https://aureus-os.app/",
  "https://aureus-os.app/it",
  "https://aureus-os.app/es",
  "https://aureus-os.app/fr",
  "https://aureus-os.app/de",
  "https://aureus-os.app/trading-journal",
  "https://aureus-os.app/it/diario-trading",
  "https://aureus-os.app/es/diario-de-trading",
  "https://aureus-os.app/fr/journal-de-trading",
  "https://aureus-os.app/de/trading-tagebuch",
  "https://aureus-os.app/backtesting",
  "https://aureus-os.app/it/backtest",
  "https://aureus-os.app/es/backtesting",
  "https://aureus-os.app/fr/backtest",
  "https://aureus-os.app/de/backtesting",
  "https://aureus-os.app/macro-news",
  "https://aureus-os.app/it/notizie-macro",
  "https://aureus-os.app/es/noticias-macro",
  "https://aureus-os.app/fr/actualites-macro",
  "https://aureus-os.app/de/makro-news",
  "https://aureus-os.app/risk-management",
  "https://aureus-os.app/it/gestione-rischio",
  "https://aureus-os.app/es/gestion-riesgo",
  "https://aureus-os.app/fr/gestion-risque",
  "https://aureus-os.app/de/risikomanagement",
  "https://aureus-os.app/pricing",
  "https://aureus-os.app/it/prezzi",
  "https://aureus-os.app/es/precios",
  "https://aureus-os.app/fr/tarifs",
  "https://aureus-os.app/de/preise",
  "https://aureus-os.app/guide",
  "https://aureus-os.app/it/guida",
  "https://aureus-os.app/es/guia",
  "https://aureus-os.app/fr/guide",
  "https://aureus-os.app/de/anleitung",
  "https://aureus-os.app/about",
  "https://aureus-os.app/it/chi-siamo",
  "https://aureus-os.app/es/sobre-nosotros",
  "https://aureus-os.app/fr/a-propos",
  "https://aureus-os.app/de/ueber-uns",
  "https://aureus-os.app/contact",
  "https://aureus-os.app/it/contatti",
  "https://aureus-os.app/es/contacto",
  "https://aureus-os.app/fr/contact",
  "https://aureus-os.app/de/kontakt",
  "https://aureus-os.app/tradezella-alternative",
  "https://aureus-os.app/it/alternativa-tradezella",
  "https://aureus-os.app/edgewonk-alternative",
  "https://aureus-os.app/it/alternativa-edgewonk",
  "https://aureus-os.app/tradersync-alternative",
  "https://aureus-os.app/it/alternativa-tradersync",
  "https://aureus-os.app/fxreplay-alternative",
  "https://aureus-os.app/it/alternativa-fxreplay",
  "https://aureus-os.app/tradingview-alternative",
  "https://aureus-os.app/it/alternativa-tradingview",
  "https://aureus-os.app/tradezella-vs-edgewonk",
  "https://aureus-os.app/it/tradezella-vs-edgewonk",
  "https://aureus-os.app/protocollo",
  "https://aureus-os.app/academy",
  "https://aureus-os.app/verifica",
  "https://aureus-os.app/sign-up",
];

export function createAdminIndexNowRouter(): IRouter {
  const router = Router();

  // Trigger manual push to IndexNow from Admin Console
  router.post("/admin/indexnow/push", requireAdmin("dashboard.read"), async (_req: Request, res: Response) => {
    try {
      const response = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "User-Agent": "AUREUS-IndexNow-Admin/1.0 (+https://aureus-os.app)",
        },
        body: JSON.stringify({
          host: INDEXNOW_HOST,
          key: INDEXNOW_KEY,
          keyLocation: INDEXNOW_KEY_LOCATION,
          urlList: CANONICAL_INDEXNOW_URLS,
        }),
      });

      logger.info({ status: response.status, count: CANONICAL_INDEXNOW_URLS.length }, "[IndexNow] Admin push triggered");

      res.json({
        ok: true,
        status: response.status,
        statusText: response.statusText,
        urlsSubmitted: CANONICAL_INDEXNOW_URLS.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error({ err }, "[IndexNow] Admin push error");
      res.status(500).json({
        ok: false,
        error: (err as Error).message || "IndexNow push failed",
      });
    }
  });

  return router;
}
