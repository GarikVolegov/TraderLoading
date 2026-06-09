import { Router, type IRouter } from "express";
import { getCandles, isSupportedSymbol, SUPPORTED_SYMBOLS } from "../services/candles.js";

const router: IRouter = Router();

router.get("/backtest/candles", async (req, res) => {
  const symbol = (req.query.symbol as string || "EURUSD").toUpperCase().replace("/", "");
  const interval = (req.query.interval as string) || "H1";
  const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;

  if (!isSupportedSymbol(symbol)) {
    res.status(400).json({
      error: `Symbol ${symbol} not supported. Available: ${SUPPORTED_SYMBOLS.join(", ")}`,
    });
    return;
  }

  try {
    const data = await getCandles(symbol, interval, { startDate });
    res.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

export default router;
