import type { NewsArticle, NewsEvent, NewsProviderStatus, NewsRefreshRequest, NewsResponse } from "./types.js";
import { reportJobError } from "../../lib/observability.js";

type Listener = (event: NewsEvent) => void;
type FetchSnapshot = (request: NewsRefreshRequest) => Promise<NewsResponse>;

export interface NewsHubRuntimeOptions {
  fetchSnapshot: FetchSnapshot;
  refreshIntervalMs?: number;
  /** The periodic tick rebuilds only when the last snapshot is older than this.
   *  Defaults to NEWS_SNAPSHOT_FRESH_MS (~10 min). */
  snapshotFreshMs?: number;
}

const DEFAULT_SNAPSHOT_FRESH_MS = Number(process.env.NEWS_SNAPSHOT_FRESH_MS ?? 10 * 60_000);

/** Whether the periodic refresh should rebuild now: only if never built or the last
 *  build is at/older than the fresh window. Keeps the expensive rebuild off the
 *  60s tick so zero-user periods don't burn LLM/translate quota. */
export function shouldRefreshSnapshot(lastRefreshAt: number | null, now: number, freshMs: number): boolean {
  if (lastRefreshAt === null) return true;
  return now - lastRefreshAt >= freshMs;
}

export interface NewsHubRuntime {
  refresh(request?: NewsRefreshRequest): Promise<NewsResponse>;
  getSnapshot(): NewsResponse | null;
  getProviderStatuses(): NewsProviderStatus[];
  setProviderStatus(status: Omit<NewsProviderStatus, "lastUpdated"> & { lastUpdated?: string }): void;
  ingestArticle(article: NewsArticle): boolean;
  getLastRequest(): NewsRefreshRequest;
  onEvent(listener: Listener): () => void;
  start(request?: NewsRefreshRequest): void;
  stop(): Promise<void>;
}

function articleKey(article: NewsArticle): string {
  if (article.url) return `url:${article.url.toLowerCase()}`;
  return `title:${article.title.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 160)}`;
}

function defaultStatuses(): NewsProviderStatus[] {
  const now = new Date().toISOString();
  return [
    { provider: "rss", status: "polling", transport: "polling", message: "Fallback RSS attivo.", lastUpdated: now },
    {
      provider: "benzinga",
      status: process.env.BENZINGA_API_KEY ? "connecting" : "disabled",
      transport: process.env.BENZINGA_API_KEY ? "websocket" : "none",
      message: process.env.BENZINGA_API_KEY ? "Connessione WebSocket in preparazione." : "BENZINGA_API_KEY non configurata.",
      lastUpdated: now,
    },
    {
      provider: "finnhub",
      status: process.env.FINNHUB_API_KEY ? "connecting" : "disabled",
      transport: process.env.FINNHUB_API_KEY ? "websocket" : "none",
      message: process.env.FINNHUB_API_KEY ? "Connessione WebSocket in preparazione." : "FINNHUB_API_KEY non configurata.",
      lastUpdated: now,
    },
    {
      provider: "polygon",
      status: process.env.POLYGON_API_KEY ? "polling" : "disabled",
      transport: process.env.POLYGON_API_KEY ? "rest" : "none",
      message: process.env.POLYGON_API_KEY
        ? "Polygon configurato per news REST/market stream."
        : "POLYGON_API_KEY non configurata.",
      lastUpdated: now,
    },
  ];
}

export function createNewsHubRuntime(options: NewsHubRuntimeOptions): NewsHubRuntime {
  const listeners = new Set<Listener>();
  const providerStatuses = new Map<string, NewsProviderStatus>();
  const seenArticles = new Set<string>();
  let snapshot: NewsResponse | null = null;
  let timer: NodeJS.Timeout | null = null;
  let lastRequest: NewsRefreshRequest = {};
  let lastRefreshAt: number | null = null;
  const snapshotFreshMs = options.snapshotFreshMs ?? DEFAULT_SNAPSHOT_FRESH_MS;

  for (const status of defaultStatuses()) providerStatuses.set(status.provider, status);

  function emit(event: NewsEvent): void {
    for (const listener of listeners) listener(event);
  }

  function withProviderStatuses(data: NewsResponse): NewsResponse {
    const statuses = data.providerStatuses?.length ? data.providerStatuses : Array.from(providerStatuses.values());
    return { ...data, providerStatuses: statuses };
  }

  function ingestArticle(article: NewsArticle): boolean {
    const key = articleKey(article);
    if (seenArticles.has(key)) return false;
    seenArticles.add(key);
    emit({ type: "news_article", article });
    return true;
  }

  async function refresh(request: NewsRefreshRequest = {}): Promise<NewsResponse> {
    try {
      lastRequest = request;
      const data = withProviderStatuses(await options.fetchSnapshot(request));
      snapshot = data;
      lastRefreshAt = Date.now();
      for (const article of data.articles) ingestArticle(article);
      emit({ type: "news_snapshot", snapshot: data });
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "News refresh failed";
      emit({ type: "news_error", message });
      throw error;
    }
  }

  function setProviderStatus(status: Omit<NewsProviderStatus, "lastUpdated"> & { lastUpdated?: string }): void {
    const normalized: NewsProviderStatus = { ...status, lastUpdated: status.lastUpdated ?? new Date().toISOString() };
    providerStatuses.set(normalized.provider, normalized);
    emit({ type: "news_provider_status", status: normalized });
  }

  return {
    refresh,
    getSnapshot: () => snapshot,
    getProviderStatuses: () => Array.from(providerStatuses.values()),
    setProviderStatus,
    ingestArticle,
    getLastRequest: () => lastRequest,
    onEvent(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start(request: NewsRefreshRequest = {}): void {
      if (timer || options.refreshIntervalMs === 0) return;
      const interval = options.refreshIntervalMs ?? Number(process.env.NEWS_REFRESH_INTERVAL_MS ?? 60_000);
      timer = setInterval(() => {
        // Skip the expensive rebuild while the snapshot is still fresh (zero-user
        // periods must not burn LLM/translate quota every tick), and surface
        // failures instead of swallowing them.
        if (!shouldRefreshSnapshot(lastRefreshAt, Date.now(), snapshotFreshMs)) return;
        void refresh({ ...request, force: true }).catch((err) => reportJobError(err, { job: "news-refresh" }));
      }, Math.max(10_000, interval));
    },
    async stop(): Promise<void> {
      if (timer) clearInterval(timer);
      timer = null;
      listeners.clear();
    },
  };
}
