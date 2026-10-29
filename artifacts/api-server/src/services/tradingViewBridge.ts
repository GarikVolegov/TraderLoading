import EventEmitter from "node:events";
import { INTERVAL_SECONDS } from "./candleRegistry.js";

export interface LiveTick {
  symbol: string;
  interval: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

const TV_WS_URL = "wss://data.tradingview.com/socket.io/websocket";

function frameMessage(obj: unknown): string {
  const str = typeof obj === "string" ? obj : JSON.stringify(obj);
  return `~m~${str.length}~m~${str}`;
}

function parseFrames(raw: string): string[] {
  const results: string[] = [];
  let remaining = raw;
  const regex = /^~m~(\d+)~m~/;

  while (remaining.length > 0) {
    const match = remaining.match(regex);
    if (!match) {
      if (remaining.startsWith("~h~")) results.push(remaining);
      break;
    }
    const len = parseInt(match[1], 10);
    const prefixLen = match[0].length;
    results.push(remaining.substring(prefixLen, prefixLen + len));
    remaining = remaining.substring(prefixLen + len);
  }
  return results;
}

const TV_SYMBOL_MAP: Record<string, string> = {
  XAUUSD: "OANDA:XAUUSD",
  EURUSD: "OANDA:EURUSD",
  GBPUSD: "OANDA:GBPUSD",
  USDJPY: "OANDA:USDJPY",
  USDCHF: "OANDA:USDCHF",
  AUDUSD: "OANDA:AUDUSD",
  NZDUSD: "OANDA:NZDUSD",
  USDCAD: "OANDA:USDCAD",
  EURGBP: "OANDA:EURGBP",
  EURJPY: "OANDA:EURJPY",
  GBPJPY: "OANDA:GBPJPY",
  AUDJPY: "OANDA:AUDJPY",
  XAGUSD: "OANDA:XAGUSD",
  US30: "CAPITALCOM:US30",
  NAS100: "OANDA:NAS100USD",
  SPX500: "OANDA:SPX500USD",
  BTCUSD: "BINANCE:BTCUSDT",
  ETHUSD: "BINANCE:ETHUSDT",
  USOIL: "TVC:USOIL",
};

export class TradingViewBridge extends EventEmitter {
  private static instance: TradingViewBridge | null = null;
  private ws: any = null;
  private isConnected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private chartSession: string = "";
  private subscriptions = new Set<string>(); // key: "symbol:interval"
  private latestCandles = new Map<string, LiveTick>();

  private constructor() {
    super();
    this.setMaxListeners(0);
    this.chartSession = "cs_" + Math.random().toString(36).substring(2, 10);
    this.connect();
  }

  public static getInstance(): TradingViewBridge {
    if (!TradingViewBridge.instance) {
      TradingViewBridge.instance = new TradingViewBridge();
    }
    return TradingViewBridge.instance;
  }

  public getLatestTick(symbol: string, interval: string): LiveTick | undefined {
    return this.latestCandles.get(`${symbol.toUpperCase()}:${interval.toUpperCase()}`);
  }

  public subscribeSymbol(rawSymbol: string, interval: string): void {
    const sym = rawSymbol.toUpperCase().replace(/[\/\-_]/g, "");
    const tf = interval.toUpperCase();
    const key = `${sym}:${tf}`;
    if (this.subscriptions.has(key)) return;
    this.subscriptions.add(key);

    if (this.isConnected && this.ws) {
      this.sendSubscription(sym, tf);
    }
  }

  private connect(): void {
    try {
      const WebSocketClass = (globalThis as any).WebSocket;
      if (!WebSocketClass) return;

      this.ws = new WebSocketClass(
        `${TV_WS_URL}?from=unregistered_web%2F&date=${Date.now()}`,
        {
          headers: {
            Origin: "https://data.tradingview.com",
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          },
        },
      );

      this.ws.onopen = () => {
        this.isConnected = true;
        this.ws.send(frameMessage({ m: "set_auth_token", p: ["unauthorized_user_token"] }));
        this.chartSession = "cs_" + Math.random().toString(36).substring(2, 10);
        this.ws.send(frameMessage({ m: "chart_create_session", p: [this.chartSession, ""] }));

        // Re-sottoscrivi tutti i simboli attivi
        for (const key of this.subscriptions) {
          const [sym, tf] = key.split(":");
          this.sendSubscription(sym, tf);
        }
      };

      this.ws.onmessage = (event: any) => {
        this.handleMessage(event.data.toString());
      };

      this.ws.onerror = (err: any) => {
        console.warn("[TradingView Bridge] WS Error:", err?.message || err);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.scheduleReconnect(4000);
      };
    } catch (e) {
      console.warn("[TradingView Bridge] Failed to initialize WS:", e);
      this.scheduleReconnect(5000);
    }
  }

  private scheduleReconnect(delayMs: number): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delayMs);
    if (typeof this.reconnectTimer.unref === "function") {
      this.reconnectTimer.unref();
    }
  }

  private sendSubscription(symbol: string, interval: string): void {
    if (!this.ws || !this.isConnected) return;
    const tvSymbol = TV_SYMBOL_MAP[symbol] ?? (symbol.length === 6 ? `OANDA:${symbol}` : `FX:${symbol}`);
    const seriesId = `s_${symbol}_${interval}`.toLowerCase();
    const symbolSeriesId = `sym_${symbol}`.toLowerCase();

    // Map interval to TV resolution
    let tvTf = "60";
    if (interval === "M1" || interval === "1") tvTf = "1";
    else if (interval === "M5" || interval === "5") tvTf = "5";
    else if (interval === "M15" || interval === "15") tvTf = "15";
    else if (interval === "M30" || interval === "30") tvTf = "30";
    else if (interval === "H1" || interval === "60") tvTf = "60";
    else if (interval === "H4" || interval === "240") tvTf = "240";
    else if (interval === "D1" || interval === "D") tvTf = "1D";

    console.log(`[TradingView Bridge] Subscribing: ${tvSymbol} (${tvTf}) as ${seriesId}`);
    this.ws.send(
      frameMessage({
        m: "resolve_symbol",
        p: [
          this.chartSession,
          symbolSeriesId,
          "=" + JSON.stringify({ symbol: tvSymbol, adjustment: "splits" }),
        ],
      }),
    );

    this.ws.send(
      frameMessage({
        m: "create_series",
        p: [this.chartSession, seriesId, "s1", symbolSeriesId, tvTf, 5, ""],
      }),
    );
  }

  private handleMessage(raw: string): void {
    const frames = parseFrames(raw);
    for (const frame of frames) {
      if (frame.startsWith("~h~")) {
        if (this.ws && this.isConnected) this.ws.send(frameMessage(frame));
        continue;
      }

      try {
        const msg = JSON.parse(frame);
        if (msg.m === "timescale_update" || msg.m === "du") {
          const params = msg.p?.[1];
          if (!params || typeof params !== "object") continue;

          for (const [key, val] of Object.entries(params)) {
            if (key.startsWith("s_")) {
              const parts = key.split("_");
              if (parts.length >= 3) {
                const symbol = parts[1].toUpperCase();
                const interval = parts[2].toUpperCase();
                const seriesObj = val as any;
                let tickData: number[] | null = null;

                if (Array.isArray(seriesObj?.s) && seriesObj.s.length > 0) {
                  const last = seriesObj.s[seriesObj.s.length - 1];
                  if (last && Array.isArray(last.v)) tickData = last.v;
                } else if (Array.isArray(seriesObj?.v)) {
                  tickData = seriesObj.v;
                }

                if (tickData && tickData.length >= 5) {
                  const [t, o, h, l, c, v] = tickData;
                  const intervalSecs = INTERVAL_SECONDS[interval] ?? 3600;
                  const bucketTime = Math.floor(Number(t) / intervalSecs) * intervalSecs;
                  const tick: LiveTick = {
                    symbol,
                    interval,
                    time: bucketTime,
                    open: Number(o),
                    high: Number(h),
                    low: Number(l),
                    close: Number(c),
                    volume: v != null ? Number(v) : undefined,
                  };
                  this.latestCandles.set(`${symbol}:${interval}`, tick);
                  this.emit("tick", tick);
                }
              }
            }
          }
        }
      } catch {
        // partial or non-json frame
      }
    }
  }
}
