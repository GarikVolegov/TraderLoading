import type { NewsArticle, NewsEvent, NewsProviderStatus, NewsRefreshRequest, NewsResponse } from "./types.js";
import { reportJobError } from "../../lib/observability.js";
import { newsSubscriptionKey, queueProviderArticle } from "./providerCorpus.js";

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
  getSnapshot(request?: NewsRefreshRequest): NewsResponse | null;
  subscribe(request: NewsRefreshRequest): () => void;
  getProviderStatuses(): NewsProviderStatus[];
  setProviderStatus(status: Omit<NewsProviderStatus, "lastUpdated"> & { lastUpdated?: string }): void;
  ingestArticle(article: NewsArticle): boolean;
  onEvent(listener: Listener): () => void;
  start(request?: NewsRefreshRequest): void;
  stop(): Promise<void>;
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
      status: "disabled",
      transport: "none",
      message: "Ingestione news Polygon non attiva.",
      lastUpdated: now,
    },
  ];
}

export function createNewsHubRuntime(options: NewsHubRuntimeOptions): NewsHubRuntime {
  const listeners = new Set<Listener>();
  const providerStatuses = new Map<string, NewsProviderStatus>();
  let snapshot: NewsResponse | null = null;
  let timer: NodeJS.Timeout | null = null;
  const snapshots = new Map<string, NewsResponse>();
  const refreshTimes = new Map<string, number>();
  const subscriptions = new Map<string, { request: NewsRefreshRequest; count: number }>();
  const pending = new Map<string, Promise<NewsResponse>>();
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
    return queueProviderArticle(article);
  }

  async function refresh(request: NewsRefreshRequest = {}): Promise<NewsResponse> {
    const key = newsSubscriptionKey(request);
    const running = pending.get(key);
    if (running) return running;
    const work = performRefresh(request, key);
    pending.set(key, work);
    try { return await work; } finally { pending.delete(key); }
  }

  async function performRefresh(request: NewsRefreshRequest, key: string): Promise<NewsResponse> {
    try {
      const [pairs, lang] = key.split(":");
      const data = withProviderStatuses({ ...await options.fetchSnapshot({ ...request, pairs, lang }), lang });
      snapshot = data;
      refreshTimes.set(key,Date.now());
      snapshots.set(key,data);
      while(snapshots.size>100) {
        const oldest = snapshots.keys().next().value!;
        snapshots.delete(oldest); refreshTimes.delete(oldest);
      }
      emit({ type: "news_snapshot", snapshot: data });
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "News refresh failed";
      emit({ type: "news_error", message, subscriptionKey:key });
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
    getSnapshot: (request) => request ? snapshots.get(newsSubscriptionKey(request)) ?? null : snapshot,
    subscribe(request): () => void {
      const key = newsSubscriptionKey(request);
      const existing = subscriptions.get(key);
      if (existing) existing.count++;
      else subscriptions.set(key, { request:{pairs:key.split(":")[0],lang:key.split(":")[1]}, count:1 });
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        const current = subscriptions.get(key);
        if (current && --current.count <= 0) subscriptions.delete(key);
      };
    },
    getProviderStatuses: () => Array.from(providerStatuses.values()),
    setProviderStatus,
    ingestArticle,
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
        const active = subscriptions.size ? [...subscriptions.values()].map(value=>value.request) : [request];
        for (const current of active) {
          const key = newsSubscriptionKey(current);
          if (!shouldRefreshSnapshot(refreshTimes.get(key) ?? null, Date.now(), snapshotFreshMs)) continue;
          void refresh({ ...current, force: true }).catch((err) => reportJobError(err, { job: "news-refresh", key }));
        }
      }, Math.max(10_000, interval));
    },
    async stop(): Promise<void> {
      if (timer) clearInterval(timer);
      timer = null;
      subscriptions.clear();
      listeners.clear();
    },
  };
}
