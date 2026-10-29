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
    if (startDate || from != null) {
      // Historical candles: immutable dataset, aggressive CDN caching
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
    } else {
      // Current live window: brief CDN caching with stale-while-revalidate to collapse traffic bursts
      res.setHeader("Cache-Control", "public, max-age=15, s-maxage=30, stale-while-revalidate=60");
    }
    if (data && typeof data === "object" && "stale" in data && data.stale) {
      res.setHeader("X-Aureus-Data-Source", "PIT-Stale-Fallback");
    } else {
      res.setHeader("X-Aureus-Data-Source", "Live-Stream");
    }
    res.json(data);
  } catch (err: unknown) {
    if (err instanceof ReplayHistoryError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    try {
      const emergency = await getCandles(symbol, interval, {
        startDate,
        from,
        to,
        limit,
        mode: "replay",
        anchorTime,
        replayTime,
        warmupBars,
      });
      if (emergency && emergency.candles && emergency.candles.length > 0) {
        res.setHeader("X-Aureus-Data-Source", "Emergency-PIT-Fallback");
        res.json({ ...emergency, stale: true });
        return;
      }
    } catch {
      // ignore fallback error and return standard error
    }
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
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
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400");
    res.json(meta);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

router.get("/candles/live", (req, res) => {
  if (!isValidSymbolInput(req.query.symbol)) {
    res.status(400).json({ error: "Invalid symbol" });
    return;
  }
  const symbol = normalizeSymbol(req.query.symbol);
  const interval = normalizeInterval(req.query.interval);

  if (!isSupportedSymbol(symbol)) {
    res.status(400).json({
      error: `Symbol ${symbol} not supported. Available: ${SUPPORTED_SYMBOLS.join(", ")}`,
    });
    return;
  }
  if (!INTERVAL_SECONDS[interval]) {
    res.status(400).json({
      error: `Interval ${interval} not supported. Available: ${Object.keys(INTERVAL_SECONDS).join(", ")}`,
    });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  const bridge = TradingViewBridge.getInstance();
  bridge.subscribeSymbol(symbol, interval);

  const safeWrite = (payload: string) => {
    if (!res.writableEnded && !(res as any).writableNeedDrain) {
      res.write(payload);
    }
  };

  const latest = bridge.getLatestTick(symbol, interval);
  if (latest) {
    safeWrite(`data: ${JSON.stringify(latest)}\n\n`);
  } else {
    safeWrite(`data: ${JSON.stringify({ status: "connected", symbol, interval })}\n\n`);
  }

  const onTick = (tick: any) => {
    if (tick.symbol === symbol && tick.interval === interval) {
      safeWrite(`data: ${JSON.stringify(tick)}\n\n`);
    }
  };

  bridge.on("tick", onTick);

  const ping = setInterval(() => {
    safeWrite(": ping\n\n");
  }, 15000);
  if (typeof ping.unref === "function") {
    ping.unref();
  }

  req.on("close", () => {
    clearInterval(ping);
    bridge.off("tick", onTick);
  });
});

export default router;
