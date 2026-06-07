import type { NewsArticle, NewsEvent, NewsProviderStatus, NewsRefreshRequest, NewsResponse } from "./types.js";

type Listener = (event: NewsEvent) => void;
type FetchSnapshot = (request: NewsRefreshRequest) => Promise<NewsResponse>;

export interface NewsHubRuntimeOptions {
  fetchSnapshot: FetchSnapshot;
  refreshIntervalMs?: number;
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
        void refresh({ ...request, force: true }).catch(() => undefined);
      }, Math.max(10_000, interval));
    },
    async stop(): Promise<void> {
      if (timer) clearInterval(timer);
      timer = null;
      listeners.clear();
    },
  };
}
