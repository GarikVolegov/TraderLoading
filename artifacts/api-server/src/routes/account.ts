import { Router, type IRouter, type Request, type Response } from "express";
import { clearSession, deleteSession, getSessionId } from "../lib/auth.js";
import {
  deleteAccountData,
  getAccountDeletionDisclosure,
} from "../services/accountDeletion.js";
import {
  exportAccountData,
  getAccountExportDisclosure,
} from "../services/accountExport.js";
import logger from "../lib/logger.js";

const router: IRouter = Router();

router.get("/account/deletion-disclosure", (_req: Request, res: Response) => {
  res.json(getAccountDeletionDisclosure());
});

router.get("/account/export-disclosure", (_req: Request, res: Response) => {
  res.json(getAccountExportDisclosure());
});

router.get("/account/export", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return;
  }

  try {
    const payload = await exportAccountData(req.user.id);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="traderloading-data-export.json"',
    );
    res.json(payload);
  } catch (error) {
    logger.error({ err: error, userId: req.user.id }, "Account export failed");
    res.status(500).json({
      error:
        "Non siamo riusciti a preparare l'export dei dati. Contatta il supporto.",
    });
  }
});

router.delete("/account", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return;
  }

  try {
    const result = await deleteAccountData(req.user.id);
    const sid = getSessionId(req);
    if (sid) await deleteSession(sid);
    clearSession(res);
    res.json(result);
  } catch (error) {
    logger.error({ err: error, userId: req.user.id }, "Account deletion failed");
    res.status(500).json({
      error:
        "Non siamo riusciti a completare la cancellazione dell'account. Contatta il supporto.",
    });
  }
});

export default router;
