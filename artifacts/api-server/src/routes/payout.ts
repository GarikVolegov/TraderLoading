// Creator Stripe Connect account endpoints (marketplace model). Onboarding + status +
// Express dashboard link. No in-house payout — Stripe pays creators out directly.
import { Router, type IRouter, type Request, type Response } from "express";
import { getStripeBillingConfig, createStripeClient } from "../lib/billing.js";
import { createMoneyRateLimiter } from "../lib/moneyRateLimit.js";
import {
  getAccountStatus,
  createOnboardingLink,
  createDashboardLink,
} from "../services/payout/payoutService.js";

const router: IRouter = Router();

const onboardLimiter = createMoneyRateLimiter({ windowMs: 60_000, limit: 5 });

function requireAuth(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return null; }
  return userId;
}

// ─── Viewer's Connect account status ─────────────────────────────────────────
router.get("/payout/account", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const status = await getAccountStatus(userId);
    // available: whether Stripe Connect is configured at all. The FE hides the
    // whole "receive payments" card when false, instead of showing an onboard
    // button that always 402s (Stripe not configured).
    res.json({ ...status, available: Boolean(getStripeBillingConfig().secretKey) });
  } catch (err) {
    console.error("GET /payout/account error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Start / resume Stripe Connect onboarding ────────────────────────────────
router.post("/payout/account/onboard", onboardLimiter, async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const billing = getStripeBillingConfig();
  if (!billing.secretKey) { res.status(402).json({ error: "Pagamenti non disponibili", code: "disabled" }); return; }
  try {
    const url = await createOnboardingLink(userId, createStripeClient(billing.secretKey), billing.appBaseUrl);
    res.json({ url });
  } catch (err) {
    console.error("POST /payout/account/onboard error:", err);
    res.status(502).json({ error: "Onboarding non disponibile" });
  }
});

// ─── Stripe Express dashboard login link (manage payouts on Stripe) ──────────
router.get("/payout/account/dashboard", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const billing = getStripeBillingConfig();
  if (!billing.secretKey) { res.status(402).json({ error: "Non disponibile" }); return; }
  try {
    const url = await createDashboardLink(userId, createStripeClient(billing.secretKey));
    if (!url) { res.status(404).json({ error: "Account non trovato" }); return; }
    res.json({ url });
  } catch (err) {
    console.error("GET /payout/account/dashboard error:", err);
    res.status(502).json({ error: "Non disponibile" });
  }
});

export default router;
