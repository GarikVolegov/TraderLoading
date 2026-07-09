// Creator payout endpoints (sub-project D). Off-contract. Dark by default: without
// PAYOUT_CREDIT_CENTS + a Stripe secret every route reports disabled and the UI hides.
import { Router, type IRouter, type Request, type Response } from "express";
import { db, creatorPayoutsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { getStripeBillingConfig, createStripeClient } from "../lib/billing.js";
import { createMoneyRateLimiter } from "../lib/moneyRateLimit.js";
import { readPayoutConfig, isPayoutConfigured } from "../services/payout/payoutMath.js";
import {
  getAccountStatus,
  createOnboardingLink,
  requestPayout,
  PayoutValidationError,
  AccountNotReadyError,
  TransferFailedError,
  PayoutPendingError,
} from "../services/payout/payoutService.js";

const router: IRouter = Router();

// Money-out + Stripe-Connect-resource endpoints get a tight per-user limit.
const onboardLimiter = createMoneyRateLimiter({ windowMs: 60_000, limit: 5 });
const payoutLimiter = createMoneyRateLimiter({ windowMs: 60_000, limit: 5 });

function requireAuth(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return null; }
  return userId;
}

/** True only when payouts are both economically configured AND Stripe is wired. */
function payoutStripe(): { secretKey: string; appBaseUrl: string } | null {
  const config = readPayoutConfig();
  if (!isPayoutConfigured(config)) return null;
  const billing = getStripeBillingConfig();
  if (!billing.secretKey) return null;
  return { secretKey: billing.secretKey, appBaseUrl: billing.appBaseUrl };
}

// ─── Public rate/config (so the UI can show the conversion + hide when off) ───
router.get("/payout/config", (_req, res) => {
  const config = readPayoutConfig();
  const enabled = isPayoutConfigured(config) && !!getStripeBillingConfig().secretKey;
  res.json({
    enabled,
    creditCents: config.creditCents,
    minCredits: config.minCredits,
    feeBps: config.feeBps,
    currency: config.currency,
  });
});

// ─── The creator's own payout history (transparency) ─────────────────────────
router.get("/payout/history", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const rows = await db
      .select({
        id: creatorPayoutsTable.id,
        credits: creatorPayoutsTable.credits,
        netCents: creatorPayoutsTable.netCents,
        currency: creatorPayoutsTable.currency,
        status: creatorPayoutsTable.status,
        createdAt: creatorPayoutsTable.createdAt,
      })
      .from(creatorPayoutsTable)
      .where(eq(creatorPayoutsTable.userId, userId))
      .orderBy(desc(creatorPayoutsTable.id))
      .limit(50);
    res.json({ payouts: rows });
  } catch (err) {
    console.error("GET /payout/history error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Viewer's Connect account status ─────────────────────────────────────────
router.get("/payout/account", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    res.json(await getAccountStatus(userId));
  } catch (err) {
    console.error("GET /payout/account error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Start / resume Stripe Connect onboarding ────────────────────────────────
router.post("/payout/account/onboard", onboardLimiter, async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const cfg = payoutStripe();
  if (!cfg) { res.status(400).json({ error: "Payout non disponibile", code: "disabled" }); return; }
  try {
    const url = await createOnboardingLink(userId, createStripeClient(cfg.secretKey), cfg.appBaseUrl);
    res.json({ url });
  } catch (err) {
    if (err instanceof PayoutValidationError) { res.status(400).json({ error: "Payout non disponibile", code: err.reason }); return; }
    console.error("POST /payout/account/onboard error:", err);
    res.status(502).json({ error: "Onboarding non disponibile" });
  }
});

// ─── Request a payout (spend credits → Stripe Transfer) ──────────────────────
router.post("/payout/request", payoutLimiter, async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const cfg = payoutStripe();
  if (!cfg) { res.status(400).json({ error: "Payout non disponibile", code: "disabled" }); return; }
  try {
    const credits = Number(req.body?.credits);
    const result = await requestPayout(userId, credits, createStripeClient(cfg.secretKey));
    res.json(result);
  } catch (err) {
    if (err instanceof PayoutValidationError) {
      const status = err.reason === "insufficient" ? 402 : 400;
      res.status(status).json({ error: "Richiesta non valida", code: err.reason });
      return;
    }
    if (err instanceof AccountNotReadyError) { res.status(409).json({ error: "Account non pronto", code: "account_not_ready" }); return; }
    // The Transfer may have executed — tell the client it's processing (reconcile finalizes).
    if (err instanceof PayoutPendingError) { res.status(202).json({ status: "pending", code: "pending" }); return; }
    if (err instanceof TransferFailedError) { res.status(502).json({ error: "Trasferimento fallito (crediti restituiti)", code: "transfer_failed" }); return; }
    console.error("POST /payout/request error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

export default router;
