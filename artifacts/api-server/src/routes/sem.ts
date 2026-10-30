import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { recordSemAttribution, semRecordInputSchema } from "../services/semAttributionService.js";
import logger from "../lib/logger.js";

const router: IRouter = Router();

const semRecordLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/sem/record", semRecordLimiter, async (req, res) => {
  try {
    const parsed = semRecordInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid attribution payload", details: parsed.error.issues });
      return;
    }

    const userId = (req as unknown as { auth?: { userId?: string } }).auth?.userId || null;
    const result = await recordSemAttribution(parsed.data, userId);

    res.status(200).json({ status: "recorded", id: result.id });
  } catch (err) {
    logger.warn({ err }, "Error recording sem attribution");
    res.status(500).json({ error: "Failed to record attribution" });
  }
});

export default router;
