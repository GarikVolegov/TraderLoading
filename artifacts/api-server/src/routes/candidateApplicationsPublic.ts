import { Router, type IRouter } from "express";
import { z } from "zod";
import { createMoneyRateLimiter } from "../lib/moneyRateLimit.js";
import {
  createCandidate,
  getCandidateEntitlementsForUser,
} from "../services/launchApplications.js";

export const candidateApplicationInputSchema = z.object({
  requestKey: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  contactType: z.enum(["whatsapp", "telegram"]).default("whatsapp"),
  contactHandle: z.string().trim().min(2).max(100),
  situation: z.string().trim().max(500).optional(),
  horizon: z.string().trim().max(500).optional(),
  obstacle: z.string().trim().max(500).optional(),
  commitment: z.string().trim().max(500).optional(),
  planChosen: z
    .enum(["direct_150", "modular_protocol", "founders_10", "complete_150", "base_free"])
    .optional(),
  billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
  selectedServices: z.array(z.string()).optional(),
  referredBy: z.string().trim().max(50).nullable().optional(),
});

export function createCandidateApplicationsRouter(save = createCandidate): IRouter {
  const router = Router();

  router.post(
    "/candidate-applications",
    createMoneyRateLimiter({ windowMs: 3600_000, limit: 10 }),
    async (req, res) => {
      const input = candidateApplicationInputSchema.safeParse(req.body);
      if (!input.success) {
        res.status(400).json({ error: "Controlla i dati della candidatura e riprova." });
        return;
      }
      const candidate = await save(input.data, req.user?.id ?? null);
      res.status(201).json({ ok: true, candidate });
    },
  );

  router.get("/candidate-applications/my-entitlements", async (req, res) => {
    const userId = req.user?.id ?? null;
    const userEmail = req.user?.email ?? null;

    if (!userId && !userEmail) {
      res.json({
        ok: true,
        hasApplication: false,
        candidateCode: null,
        status: "nessuna",
        selectedServices: ["base_protocol"],
        approvedServices: ["base_protocol"],
        monthlyFeeCents: 0,
        yearlyFeeCents: 0,
        oneTimeFeeCents: 0,
        entitlements: {
          varco: true,
          bookOfTruth: true,
          brotherhood: true,
          fiveGrades: true,
          quarterlyTournaments: false,
          forgeOfThePast: false,
          financialArchitecture: false,
          doctrineOfTime: false,
        },
      });
      return;
    }

    const entitlementsData = await getCandidateEntitlementsForUser(userId, userEmail);
    res.json({ ok: true, ...entitlementsData });
  });

  router.get("/candidate-applications/my-status", async (req, res) => {
    const userId = req.user?.id ?? null;
    const userEmail = req.user?.email ?? null;
    const candidateCode = typeof req.query.candidateCode === "string" ? req.query.candidateCode.trim() : null;

    if (!userId && !userEmail && !candidateCode) {
      res.json({
        ok: true,
        hasApplication: false,
        candidateCode: null,
        status: "nessuna",
      });
      return;
    }

    const entitlementsData = await getCandidateEntitlementsForUser(
      userId,
      userEmail,
      candidateCode,
    );
    res.json({ ok: true, ...entitlementsData });
  });

  return router;
}
export default createCandidateApplicationsRouter();
