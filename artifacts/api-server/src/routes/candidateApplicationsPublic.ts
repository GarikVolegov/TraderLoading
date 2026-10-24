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
  planChosen: z.enum(["direct_150", "modular_protocol"]).optional(),
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
    const queryEmail = typeof req.query.email === "string" ? req.query.email.trim() : null;
    const entitlementsData = await getCandidateEntitlementsForUser(
      userId,
      req.user?.email ?? queryEmail,
    );
    res.json({ ok: true, ...entitlementsData });
  });

  router.get("/candidate-applications/my-status", async (req, res) => {
    const userId = req.user?.id ?? null;
    const queryEmail = typeof req.query.email === "string" ? req.query.email.trim() : null;
    const entitlementsData = await getCandidateEntitlementsForUser(
      userId,
      req.user?.email ?? queryEmail,
    );
    res.json({ ok: true, ...entitlementsData });
  });

  return router;
}
export default createCandidateApplicationsRouter();
