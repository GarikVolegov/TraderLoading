import { resolveTradingViewSymbol, resolveTradingViewTimeframe } from "./symbolMapping";

export interface CandleBar {
  time: number; // Unix timestamp in secondi
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type FeedStatus = "connecting" | "live" | "fallback" | "error";

export interface SubscriptionCallbacks {
  onHistory: (bars: CandleBar[]) => void;
  onTick: (bar: CandleBar) => void;
  onStatusChange: (status: FeedStatus, message?: string) => void;
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
      if (remaining.startsWith("~h~")) {
        results.push(remaining);
      }
      break;
    }
    const len = parseInt(match[1], 10);
    const prefixLen = match[0].length;
    const body = remaining.substring(prefixLen, prefixLen + len);
    results.push(body);
    remaining = remaining.substring(prefixLen + len);
  }
  return results;
}

export class TradingViewRealtimeFeed {
  private ws: WebSocket | null = null;
  private currentSymbol: string = "";
  private currentInterval: string = "";
  private callbacks: SubscriptionCallbacks | null = null;
  private status: FeedStatus = "connecting";
  private chartSessionId: string = "";
  private symbolSeriesId: string = "sds_sym_1";
  private seriesId: string = "sds_1";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed: boolean = false;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private hasReceivedFirstData: boolean = false;

  constructor() {
    this.chartSessionId = "cs_" + Math.random().toString(36).substring(2, 11);
  }

  public subscribe(
    symbol: string,
    interval: string,
    callbacks: SubscriptionCallbacks,
  ): () => void {
    this.currentSymbol = symbol;
    this.currentInterval = interval;
    this.callbacks = callbacks;
    this.hasReceivedFirstData = false;
    this.isDestroyed = false;

    this.setStatus("connecting");
    this.connect();

    // Setup fallback timer: se entro 4.5s TradingView non ha risposto con candele,
    // eseguiamo il fallback trasparente al candle warehouse / API REST
    this.armFallbackTimer();

    return () => {
      this.unsubscribe();
    };
  }

  public changeSymbolOrTimeframe(symbol: string, interval: string): void {
    if (this.currentSymbol === symbol && this.currentInterval === interval) return;
    this.currentSymbol = symbol;
    this.currentInterval = interval;
    this.hasReceivedFirstData = false;
    this.setStatus("connecting");

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscription();
      this.armFallbackTimer();
    } else {
      this.connect();
    }
  }

  private setStatus(status: FeedStatus, msg?: string): void {
    if (this.status === status) return;
    this.status = status;
    this.callbacks?.onStatusChange(status, msg);
  }

  private connect(): void {
    if (this.isDestroyed) return;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    try {
      const url = `${TV_WS_URL}?from=unregistered_web%2F&date=${Date.now()}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        if (this.isDestroyed) return;
        this.sendAuthAndInit();
        this.sendSubscription();
      };

      this.ws.onmessage = (event) => {
        if (this.isDestroyed) return;
        this.handleMessage(event.data.toString());
      };

      this.ws.onerror = (err) => {
        if (this.isDestroyed) return;
        console.warn("[TradingView Feed] WS Error, triggering fallback", err);
        this.triggerFallback();
      };

      this.ws.onclose = () => {
        if (this.isDestroyed) return;
        if (!this.hasReceivedFirstData) {
          this.triggerFallback();
        }
        this.scheduleReconnect();
      };
    } catch (e) {
      console.warn("[TradingView Feed] Connection failed, using fallback", e);
      this.triggerFallback();
    }
  }

  private sendAuthAndInit(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(frameMessage({ m: "set_auth_token", p: ["unauthorized_user_token"] }));
    this.chartSessionId = "cs_" + Math.random().toString(36).substring(2, 11);
    this.ws.send(frameMessage({ m: "chart_create_session", p: [this.chartSessionId, ""] }));
    this.ws.send(frameMessage({ m: "switch_timezone", p: [this.chartSessionId, "Europe/Rome"] }));
  }

  private sendSubscription(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const tvSymbol = resolveTradingViewSymbol(this.currentSymbol);
    const tvTimeframe = resolveTradingViewTimeframe(this.currentInterval);

    // Risoluzione simbolo con impostazioni broker
    this.ws.send(
      frameMessage({
        m: "resolve_symbol",
        p: [
          this.chartSessionId,
          this.symbolSeriesId,
          JSON.stringify({ symbol: tvSymbol, adjustment: "splits" }),
        ],
      }),
    );

    // Creazione serie dati OHLCV
    this.ws.send(
      frameMessage({
        m: "create_series",
        p: [
          this.chartSessionId,
          this.seriesId,
          "s1",
          this.symbolSeriesId,
          tvTimeframe,
          300,
          "",
        ],
      }),
    );
  }

  private handleMessage(raw: string): void {
    const frames = parseFrames(raw);

    for (const frame of frames) {
      if (frame.startsWith("~h~")) {
        // Rispondi all'heartbeat
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(frameMessage(frame));
        }
        continue;
      }

      try {
        const msg = JSON.parse(frame);
        if (msg.m === "timescale_update") {
          this.handleTimescaleUpdate(msg.p);
        } else if (msg.m === "du") {
          this.handleDataUpdate(msg.p);
        } else if (msg.m === "critical_error") {
          console.warn("[TradingView Feed] Critical symbol error:", msg.p);
          this.triggerFallback();
        }
      } catch {
        // Pacchetto non JSON o parziale, ignora in sicurezza
      }
    }
  }

  private handleTimescaleUpdate(params: unknown[]): void {
    if (!params || params.length < 2) return;
    const updateObj = params[1] as Record<string, any>;
    const seriesData = updateObj?.[this.seriesId]?.s;

    if (Array.isArray(seriesData) && seriesData.length > 0) {
      const bars: CandleBar[] = [];
      for (const item of seriesData) {
        if (item && Array.isArray(item.v) && item.v.length >= 5) {
          const [t, o, h, l, c, v] = item.v;
          bars.push({
            time: Math.floor(t),
            open: Number(o),
            high: Number(h),
            low: Number(l),
            close: Number(c),
            volume: v != null ? Number(v) : undefined,
          });
        }
      }

      if (bars.length > 0) {
        this.clearFallbackTimer();
        this.hasReceivedFirstData = true;
        this.setStatus("live");

        // Se è la prima risposta (storico completo)
        this.callbacks?.onHistory(bars);
      }
    }
  }

  private handleDataUpdate(params: unknown[]): void {
    if (!params || params.length < 2) return;
    const updateObj = params[1] as Record<string, any>;
    const seriesUpdate = updateObj?.[this.seriesId];

    if (seriesUpdate) {
      let tickData: number[] | null = null;
      if (Array.isArray(seriesUpdate.s) && seriesUpdate.s.length > 0) {
        const last = seriesUpdate.s[seriesUpdate.s.length - 1];
        if (last && Array.isArray(last.v)) tickData = last.v;
      } else if (Array.isArray(seriesUpdate.v)) {
        tickData = seriesUpdate.v;
      }

      if (tickData && tickData.length >= 5) {
        const [t, o, h, l, c, v] = tickData;
        const bar: CandleBar = {
          time: Math.floor(t),
          open: Number(o),
          high: Number(h),
          low: Number(l),
          close: Number(c),
          volume: v != null ? Number(v) : undefined,
        };
        this.setStatus("live");
        this.callbacks?.onTick(bar);
      }
    }
  }

  private armFallbackTimer(): void {
    this.clearFallbackTimer();
    this.fallbackTimer = setTimeout(() => {
      if (!this.hasReceivedFirstData) {
        console.info("[TradingView Feed] No live response in timeout, engaging REST fallback");
        this.triggerFallback();
      }
    }, 4500);
  }

  private clearFallbackTimer(): void {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  private triggerFallback(): void {
    this.setStatus("fallback", "Connessione diretta ai server dati Limen...");
    this.fetchRestFallback();
  }

  private async fetchRestFallback(): Promise<void> {
    if (this.isDestroyed) return;
    try {
      const cleanSym = this.currentSymbol.trim().toUpperCase().replace(/[\/\-_]/g, "");
      const res = await fetch(`/api/backtest/candles?symbol=${cleanSym}&interval=${this.currentInterval}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.candles) && data.candles.length > 0) {
        const bars: CandleBar[] = data.candles.map((c: any) => ({
          time: typeof c.time === "number" ? c.time : Math.floor(new Date(c.time).getTime() / 1000),
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: c.volume != null ? Number(c.volume) : undefined,
        }));
        this.callbacks?.onHistory(bars);
      }
    } catch (e) {
      console.warn("[TradingView Feed] REST fallback also had an issue:", e);
      this.setStatus("error", "Errore nel caricamento dei dati di mercato");
    }
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isDestroyed) {
        this.connect();
      }
    }, 3500);
  }

  public unsubscribe(): void {
    this.isDestroyed = true;
    this.clearFallbackTimer();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.callbacks = null;
  }
}
