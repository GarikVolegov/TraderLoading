import { Router, type IRouter } from "express";
import { getCandles, getCandlesMeta, isSupportedSymbol, SUPPORTED_SYMBOLS } from "../services/candles.js";
import { INTERVAL_SECONDS } from "../services/candleRegistry.js";
import { ReplayHistoryError } from "../services/replayHistory.js";
import { TradingViewBridge } from "../services/tradingViewBridge.js";

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

function isValidSymbolInput(value: unknown): boolean {
  return value === undefined || (typeof value === "string" && value.trim().length > 0);
}

function validStartDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeInterval(value: unknown): string {
  if (typeof value !== "string") return "H1";
  const u = value.trim().toUpperCase();
  if (u === "60" || u === "1H") return "H1";
  if (u === "240" || u === "4H") return "H4";
  if (u === "15") return "M15";
  if (u === "5") return "M5";
  if (u === "1") return "M1";
  if (u === "30") return "M30";
  if (u === "D" || u === "1D") return "D1";
  if (u === "W" || u === "1W") return "W1";
  return u;
}

router.get("/backtest/candles", async (req, res) => {
  if (!isValidSymbolInput(req.query.symbol)) { res.status(400).json({ error: "Invalid symbol" }); return; }
  const symbol = normalizeSymbol(req.query.symbol);
  const interval = normalizeInterval(req.query.interval);
  const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
  const from = parseUnixParam(req.query.from);
  const to = parseUnixParam(req.query.to);
  const limit = parseUnixParam(req.query.limit);
  const mode = req.query.mode === "replay" ? "replay" as const : undefined;
  const anchorTime = parseUnixParam(req.query.anchorTime);
  const replayTime = parseUnixParam(req.query.replayTime);
  const warmupBars = req.query.warmupBars === "0" ? 0 : parseUnixParam(req.query.warmupBars);

  if (!INTERVAL_SECONDS[interval] || (req.query.mode != null && req.query.mode !== "replay") ||
    (startDate != null && !validStartDate(startDate)) ||
    ["from", "to", "limit", "anchorTime", "replayTime"].some(name => req.query[name] != null && parseUnixParam(req.query[name]) == null) ||
    (req.query.warmupBars != null && req.query.warmupBars !== "0" && warmupBars == null)) {
    res.status(400).json({ error: "Invalid timeframe, mode or startDate" });
    return;
  }

  if (!isSupportedSymbol(symbol)) {
    res.status(400).json({
      error: `Symbol ${symbol} not supported. Available: ${SUPPORTED_SYMBOLS.join(", ")}`,
    });
    return;
  }

  // Bound the cursors: a timestamp past tomorrow is garbage input, not a page.
  const horizon = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  if ([from, to, anchorTime, replayTime].some(value => value != null && value > horizon) || (from != null && to != null && from >= to)) {
    res.status(400).json({ error: "from/to must be unix seconds not further than one day in the future" });
    return;
  }

  try {
    const data = await getCandles(symbol, interval, { startDate, from, to, limit, mode, anchorTime, replayTime, warmupBars });
    res.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(err instanceof ReplayHistoryError ? err.status : 502).json({ error: msg });
  }
});

router.get("/backtest/candles/meta", async (req, res) => {
  if (!isValidSymbolInput(req.query.symbol)) { res.status(400).json({ error: "Invalid symbol" }); return; }
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

router.get("/candles/live", (req, res) => {
  const symbol = normalizeSymbol(req.query.symbol);
  const interval = normalizeInterval(req.query.interval);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  const bridge = TradingViewBridge.getInstance();
  bridge.subscribeSymbol(symbol, interval);

  const latest = bridge.getLatestTick(symbol, interval);
  if (latest) {
    res.write(`data: ${JSON.stringify(latest)}\n\n`);
  } else {
    res.write(`data: ${JSON.stringify({ status: "connected", symbol, interval })}\n\n`);
  }

  const onTick = (tick: any) => {
    if (tick.symbol === symbol && tick.interval === interval) {
      res.write(`data: ${JSON.stringify(tick)}\n\n`);
    }
  };

  bridge.on("tick", onTick);

  const ping = setInterval(() => {
    res.write(": ping\n\n");
  }, 15000);

  req.on("close", () => {
    clearInterval(ping);
    bridge.off("tick", onTick);
  });
});

export default router;
