import { Router, type IRouter, type RequestHandler } from "express";
import { requireAdmin } from "../lib/adminAuth.js";
import { createMoneyRateLimiter } from "../lib/moneyRateLimit.js";
import {
  ACADEMY_TERMS_VERSION, getAcademyBillingStatus, createAcademyCheckout, createAcademyPortal, updateAcademyCancellation,
  enrollAcademyAffiliate, getAcademyCommissions, listAcademyPayouts, payAcademyCommissions,
} from "../services/academyBilling.js";

export interface AcademyBillingRouterOptions {
  status?: typeof getAcademyBillingStatus;
  checkout?: typeof createAcademyCheckout;
  portal?: typeof createAcademyPortal;
  cancellation?: typeof updateAcademyCancellation;
  enroll?: typeof enrollAcademyAffiliate;
  commissions?: typeof getAcademyCommissions;
  payouts?: typeof listAcademyPayouts;
  pay?: typeof payAcademyCommissions;
  adminGuard?: RequestHandler;
}

export function createAcademyBillingRouter(options: AcademyBillingRouterOptions = {}): IRouter {
  const router = Router();
  const moneyLimiter = createMoneyRateLimiter({ windowMs: 60_000, limit: 10 });
  const authenticated: RequestHandler = (req, res, next) => {
    if (!req.user?.id) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
    next();
  };
  const action = (handler: RequestHandler): RequestHandler => async (req, res, next) => {
    try { await handler(req, res, next); } catch (err) {
      const expected = err as { status?: number; code?: string };
      if (expected.status && expected.code) { res.status(expected.status).json({ error: expected.code }); return; }
      next(err);
    }
  };
  router.get("/academy/billing", authenticated, action(async (req, res) => {
    res.json(await (options.status ?? getAcademyBillingStatus)(req.user!.id));
  }));
  router.post("/academy/billing/checkout", authenticated, moneyLimiter, action(async (req, res) => {
    const referralCode = req.body?.referralCode;
    if (referralCode !== undefined && (typeof referralCode !== "string" || !/^AC[A-F0-9]{16}$/i.test(referralCode))) {
      res.status(400).json({ error: "invalid_academy_referral" }); return;
    }
    res.json(await (options.checkout ?? createAcademyCheckout)(req.user!, referralCode));
  }));
  router.post("/academy/billing/portal", authenticated, moneyLimiter, action(async (req, res) => {
    res.json(await (options.portal ?? createAcademyPortal)(req.user!.id));
  }));
  for (const [path, cancel] of [["cancel", true], ["resume", false]] as const) {
    router.post(`/academy/billing/${path}`, authenticated, moneyLimiter, action(async (req, res) => {
      res.json(await (options.cancellation ?? updateAcademyCancellation)(req.user!.id, cancel));
    }));
  }
  router.post("/academy/affiliate/enroll", authenticated, action(async (req, res) => {
    if (req.body?.acceptedTerms !== true || req.body?.termsVersion !== ACADEMY_TERMS_VERSION) {
      res.status(400).json({ error: "academy_affiliate_terms_required", termsVersion: ACADEMY_TERMS_VERSION }); return;
    }
    await (options.enroll ?? enrollAcademyAffiliate)(req.user!.id);
    res.json(await (options.status ?? getAcademyBillingStatus)(req.user!.id));
  }));
  router.get("/academy/affiliate/commissions", authenticated, action(async (req, res) => {
    res.json(await (options.commissions ?? getAcademyCommissions)(req.user!.id));
  }));
  const adminGuard = options.adminGuard ?? requireAdmin("billing.subscriptions.write");
  router.get("/academy/affiliate/payouts", authenticated, adminGuard, action(async (_req, res) => {
    res.json(await (options.payouts ?? listAcademyPayouts)());
  }));
  router.post("/academy/affiliate/payouts", authenticated, adminGuard, moneyLimiter, action(async (req, res) => {
    const ids = req.body?.commissionIds;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 50 || ids.some(id => typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id))) {
      res.status(400).json({ error: "academy_commission_ids_required" }); return;
    }
    res.json(await (options.pay ?? payAcademyCommissions)(ids, req.user!.id));
  }));
  return router;
}

export default createAcademyBillingRouter();
