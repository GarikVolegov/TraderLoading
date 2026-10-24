import { Router } from "express";
import { z } from "zod";
import { db, schoolRequestsTable, launchEmailsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { isLimenOwner, requireAdmin } from "../lib/adminAuth.js";
import { createMoneyRateLimiter } from "../lib/moneyRateLimit.js";
import { createSchoolRequest } from "../services/launchApplications.js";
import { createStreamUpload, streamPlayback, streamVideoState } from "../services/academyStream.js";

export const schoolRequestSchema = z.object({
  requestKey: z.string().uuid(),
  school: z.string().trim().min(2).max(160),
  name: z.string().trim().min(2).max(100),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  currentStudents: z.number().int().min(0).max(1000000),
  monthlyEntrants: z.number().int().min(0).max(1000000),
  needs: z.string().trim().min(10).max(4000),
});
const router = Router();
router.post(
  "/school-requests",
  createMoneyRateLimiter({ windowMs: 3600_000, limit: 5 }),
  async (req, res) => {
    const value = schoolRequestSchema.safeParse(req.body);
    if (!value.success) {
      res.status(400).json({ error: "Controlla i dati della richiesta." });
      return;
    }
    res.status(201).json(await createSchoolRequest(value.data));
  },
);
router.get("/admin/school-requests", requireAdmin("users.read"), async (_req, res) => {
  res.json(
    await db
      .select()
      .from(schoolRequestsTable)
      .orderBy(desc(schoolRequestsTable.createdAt))
      .limit(200),
  );
});
router.patch(
  "/admin/school-requests/:id",
  requireAdmin("billing.subscriptions.write"),
  async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const patch = z
      .object({
        status: z.enum(["new", "contacted", "quoted", "closed"]),
        notes: z.string().trim().max(4000),
      })
      .parse(req.body);
    const [row] = await db
      .update(schoolRequestsTable)
      .set(patch)
      .where(eq(schoolRequestsTable.id, id))
      .returning();
    if (!row) {
      res.sendStatus(404);
      return;
    }
    res.json(row);
  },
);
router.get("/admin/launch-emails", requireAdmin("security.audit.read"), async (_req, res) => {
  res.json(
    await db
      .select({
        key: launchEmailsTable.key,
        kind: launchEmailsTable.kind,
        status: launchEmailsTable.status,
        attempts: launchEmailsTable.attempts,
        createdAt: launchEmailsTable.createdAt,
        sentAt: launchEmailsTable.sentAt,
      })
      .from(launchEmailsTable)
      .orderBy(desc(launchEmailsTable.createdAt))
      .limit(100),
  );
});
router.use("/academy/videos", async (req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (!req.user?.id) {
    res.sendStatus(401);
    return;
  }
  if (!(await isLimenOwner(req.user.id))) {
    res.sendStatus(403);
    return;
  }
  next();
});
router.post(
  "/academy/videos/upload",
  createMoneyRateLimiter({ windowMs: 3600_000, limit: 20 }),
  async (req, res) => {
    const { size } = z
      .object({
        size: z
          .number()
          .int()
          .positive()
          .max(30 * 1024 ** 3),
      })
      .parse(req.body);
    res.json(await createStreamUpload(req.user!.id, size));
  },
);
router.get("/academy/videos/:id", async (req, res) => {
  const id = z
    .string()
    .regex(/^[a-f0-9]{32}$/)
    .parse(req.params.id);
  const state = await streamVideoState(id);
  res.json({ ...state, ...(state.state === "ready" ? await streamPlayback(id) : {}) });
});
export default router;
