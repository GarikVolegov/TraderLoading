import { Router, type IRouter } from "express";
import { parseBacktestChartUpdate } from "../../../../contracts/backtestChart.js";
import {
  backtestChartStore,
  type BacktestChartStore,
} from "../services/backtestChartPreferences.js";

export function createBacktestChartRouter(store: BacktestChartStore = backtestChartStore): IRouter {
  const router = Router();
  router.use("/settings/backtest-chart", (req, res, next) => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Autenticazione richiesta" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  router.get("/settings/backtest-chart", async (req, res) => {
    try {
      res.json(await store.read(req.user!.id));
    } catch {
      res.status(503).json({ error: "Preferenze grafico temporaneamente non disponibili" });
    }
  });
  router.put("/settings/backtest-chart", async (req, res) => {
    if (JSON.stringify(req.body ?? {}).length > 200_000) {
      res.status(413).json({ error: "Preferenze troppo grandi" });
      return;
    }
    const update = parseBacktestChartUpdate(req.body);
    if (!update) {
      res.status(400).json({ error: "Preferenze grafico non valide" });
      return;
    }
    try {
      const result = await store.write(req.user!.id, update);
      res.status(result.conflict ? 409 : 200).json(result.snapshot);
    } catch {
      res.status(503).json({ error: "Salvataggio preferenze non disponibile" });
    }
  });
  return router;
}
export default createBacktestChartRouter();
