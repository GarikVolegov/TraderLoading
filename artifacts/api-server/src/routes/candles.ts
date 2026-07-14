import { Router, type IRouter } from "express";
import { getCandles, getCandlesMeta, isSupportedSymbol, SUPPORTED_SYMBOLS } from "../services/candles.js";

const router: IRouter = Router();

function parseUnixParam(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
}

function normalizeSymbol(value: unknown): string {
  return (typeof value === "string" && value !== "" ? value : "EURUSD").toUpperCase().replace("/", "");
}

router.get("/backtest/candles", async (req, res) => {
  const symbol = normalizeSymbol(req.query.symbol);
  const interval = (req.query.interval as string) || "H1";
  const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
  const from = parseUnixParam(req.query.from);
  const to = parseUnixParam(req.query.to);
  const limit = parseUnixParam(req.query.limit);

  if (!isSupportedSymbol(symbol)) {
    res.status(400).json({
      error: `Symbol ${symbol} not supported. Available: ${SUPPORTED_SYMBOLS.join(", ")}`,
    });
    return;
  }

  // Bound the cursors: a timestamp past tomorrow is garbage input, not a page.
  const horizon = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  if ((from != null && from > horizon) || (to != null && to > horizon)) {
    res.status(400).json({ error: "from/to must be unix seconds not further than one day in the future" });
    return;
  }

  try {
    const data = await getCandles(symbol, interval, { startDate, from, to, limit });
    res.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

router.get("/backtest/candles/meta", async (req, res) => {
  const symbol = normalizeSymbol(req.query.symbol);

  if (!isSupportedSymbol(symbol)) {
    res.status(400).json({
      error: `Symbol ${symbol} not supported. Available: ${SUPPORTED_SYMBOLS.join(", ")}`,
    });
    return;
  }

  try {
    const meta = await getCandlesMeta(symbol);
    res.json(meta);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

export default router;
