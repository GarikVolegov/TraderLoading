import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Newspaper, TrendingUp, TrendingDown, Minus, RefreshCw,
  ExternalLink, Rss, Cpu, ShieldCheck, Clock, ChevronDown,
  ChevronUp, Zap, Bot,
} from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useBackground } from "@/contexts/BackgroundContext";
import { useLanguage, useDateLocale } from "@/contexts/LanguageContext";
import {
  createNewsQueryKey,
  createNewsRefreshMessage,
  createNewsSubscribeMessage,
  fetchNews,
  type Article,
  type NewsData,
  type NewsProviderStatus,
  type NewsSocketMessage,
} from "@/lib/newsApi";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SentimentBadge({ sentiment }: { sentiment?: string | null }) {
  const { t } = useLanguage();
  if (!sentiment) return null;
  const map: Record<string, { labelKey: string; cls: string; Icon: typeof TrendingUp }> = {
    bullish: { labelKey: "news.bullish", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", Icon: TrendingUp },
    bearish: { labelKey: "news.bearish", cls: "bg-red-500/10 text-red-400 border-red-500/30", Icon: TrendingDown },
    neutral: { labelKey: "news.neutral", cls: "bg-white/5 text-muted-foreground border-white/10", Icon: Minus },
  };
  const cfg = map[sentiment] ?? map.neutral;
  const { Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap shrink-0 ${cfg.cls}`}>
      <Icon className="w-3 h-3" />
      {t(cfg.labelKey)}
    </span>
  );
}

function TimeAgo({ iso }: { iso?: string | null }) {
  const locale = useDateLocale();
  if (!iso) return null;
  try {
    return <span>{formatDistanceToNow(new Date(iso), { locale, addSuffix: true })}</span>;
  } catch {
    return null;
  }
}

function ImpactScore({ score }: { score: number }) {
  const color =
    score >= 8 ? "text-red-400 border-red-500/40 bg-red-500/10" :
    score >= 5 ? "text-amber-400 border-amber-500/40 bg-amber-500/10" :
                 "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
  const label =
    score >= 8 ? "ALTO" :
    score >= 5 ? "MEDIO" : "BASSO";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap ${color}`}>
      <Zap className="w-2.5 h-2.5" />
      {score}/10 {label}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence?: number }) {
  if (typeof confidence !== "number") return null;
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 80 ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" :
    pct >= 60 ? "text-amber-400 border-amber-500/40 bg-amber-500/10" :
                "text-muted-foreground border-white/10 bg-white/5";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap ${color}`}>
      {pct}% match
    </span>
  );
}

function FreshnessBadge({ article }: { article: Article }) {
  const tier = article.freshnessTier ?? (article.isFallback ? "fallback" : "fresh");
  const age = article.ageMinutes;
  const label =
    tier === "live" ? "Live" :
    tier === "fresh" && typeof age === "number" && age <= 60 ? "Nuova" :
    tier === "fresh" ? "Aggiornata" :
    tier === "fallback" ? "Archivio utile" :
    "Storico";
  const color =
    tier === "live" || tier === "fresh"
      ? "text-sky-300 border-sky-500/30 bg-sky-500/10"
      : "text-muted-foreground border-white/10 bg-white/5";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap ${color}`}>
      <Clock className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

function PairBadge({ pair }: { pair: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-primary/10 text-primary border border-primary/25 whitespace-nowrap">
      {pair}
    </span>
  );
}

function newsWsUrl(): string {
  const configured = import.meta.env.VITE_API_BASE as string | undefined;
  const base = new URL(configured && configured.trim() ? configured : window.location.origin, window.location.origin);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = "/api/news/ws";
  base.search = "";
  return base.toString();
}

function mergeArticle(list: Article[], article: Article): Article[] {
  const key = article.url ? `url:${article.url}` : `title:${article.title.toLowerCase().slice(0, 160)}`;
  const exists = list.some((item) => (item.url ? `url:${item.url}` : `title:${item.title.toLowerCase().slice(0, 160)}`) === key);
  if (exists) return list;
  return [article, ...list].slice(0, 30);
}

function newsSignature(data?: NewsData): string {
  return (data?.articles ?? [])
    .map((article) => `${article.url ?? article.title}|${article.publishedAt ?? ""}|${article.qualityScore ?? ""}`)
    .join("::");
}

function updateNewsIfChanged(current: NewsData | undefined, next: NewsData): NewsData {
  if (!current) return next;
  return newsSignature(current) === newsSignature(next)
    ? { ...current, fetchedAt: next.fetchedAt, nextRefreshAt: next.nextRefreshAt, providerStatuses: next.providerStatuses }
    : next;
}

function preferredArticleUrl(article: Pick<Article, "url" | "resolvedUrl">): string | null {
  return article.resolvedUrl && !article.resolvedUrl.includes("news.google.com/rss/articles")
    ? article.resolvedUrl
    : article.url ?? null;
}

// Countdown to next refresh
function RefreshCountdown({ nextRefreshAt }: { nextRefreshAt?: string }) {
  const [remaining, setRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!nextRefreshAt) return;
    const update = () => {
      const diff = new Date(nextRefreshAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining(null); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}m ${s.toString().padStart(2, "0")}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [nextRefreshAt]);

  if (!remaining) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/50">
      <Clock className="w-3 h-3" />
      Aggiornamento tra {remaining}
    </span>
  );
}

// ─── Article Card ─────────────────────────────────────────────────────────────

function NewsDetailDialog({ article, open, onOpenChange }: { article: Article | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const explanation = article ? article.relevanceReason ?? article.impactReason : undefined;
  if (!article) return null;
  const detailUrl = preferredArticleUrl(article);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] bg-card/95 backdrop-blur-xl border-border max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap pr-6">
            <FreshnessBadge article={article} />
            {article.impactScore && <ImpactScore score={article.impactScore} />}
            <SentimentBadge sentiment={article.sentiment} />
          </div>
          <DialogTitle className="text-xl leading-snug pt-2">{article.title}</DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            <span>{article.source}</span>
            {article.publishedAt && (
              <>
                <span>·</span>
                <TimeAgo iso={article.publishedAt} />
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {article.imageUrl && (
          <img src={article.imageUrl} alt="" className="w-full max-h-64 object-cover rounded-lg border border-border/40" />
        )}

        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-foreground/90">{article.summary}</p>

          {explanation && (
            <div className="rounded-lg border border-primary/15 bg-primary/5 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-primary/80 mb-1">Impatto per il trading</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{explanation}</p>
            </div>
          )}

          {article.affectedPairs && article.affectedPairs.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {article.affectedPairs.map((pair) => <PairBadge key={pair} pair={pair} />)}
            </div>
          )}

          {(article.originalTitle || article.originalSummary) && (
            <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">Originale</p>
              {article.originalTitle && <p className="text-sm font-semibold text-muted-foreground">{article.originalTitle}</p>}
              {article.originalSummary && <p className="text-xs text-muted-foreground/80 mt-1 leading-relaxed">{article.originalSummary}</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {detailUrl && (
              <a
                href={detailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <ExternalLink className="w-4 h-4" />
                Apri fonte originale
              </a>
            )}
            {article.sourceUrl && article.sourceUrl !== detailUrl && (
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-secondary/40 px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                <ExternalLink className="w-4 h-4" />
                Sito fonte
              </a>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ArticleCard({ article, idx, isAI, onOpen }: { article: Article; idx: number; isAI: boolean; onOpen: (article: Article) => void }) {
  const [expanded, setExpanded] = useState(false);
  const explanation = article.relevanceReason ?? article.impactReason;
  const hasImpactDetails = isAI && (article.impactScore || (article.affectedPairs && article.affectedPairs.length > 0) || explanation);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className="h-full"
    >
      <Card
        role="button"
        tabIndex={0}
        onClick={() => onOpen(article)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen(article);
          }
        }}
        className="flex h-full cursor-pointer flex-col overflow-hidden border-border/35 bg-card/70 transition-colors duration-200 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {/* Impact score header strip (AI only) */}
        {isAI && article.impactScore && (
          <div className={`h-0.5 w-full shrink-0 ${
            article.impactScore >= 8 ? "bg-red-500/60" :
            article.impactScore >= 5 ? "bg-amber-500/60" : "bg-emerald-500/60"
          }`} />
        )}

        {article.imageUrl && (
          <div className="w-full h-32 overflow-hidden shrink-0">
            <img
              src={article.imageUrl}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}

        <CardContent className="p-4 flex flex-col flex-1 gap-2">
          {/* Impact + sentiment row */}
          {(article.impactScore || article.sentiment || article.freshnessTier || article.isFallback) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {isAI && article.impactScore && <ImpactScore score={article.impactScore} />}
              <SentimentBadge sentiment={article.sentiment} />
              <ConfidenceBadge confidence={article.matchConfidence} />
              <FreshnessBadge article={article} />
            </div>
          )}

          {/* Title */}
          <h3 className="font-bold text-sm leading-snug group-hover:text-primary transition-colors">
            <button type="button" className="text-left hover:underline" onClick={(event) => { event.stopPropagation(); onOpen(article); }}>
              {article.title}
            </button>
          </h3>

          {/* Summary */}
          {article.summary && article.summary !== article.title && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 flex-1">
              {article.summary}
            </p>
          )}

          {/* Affected pairs */}
          {isAI && article.affectedPairs && article.affectedPairs.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider font-medium">Impatta:</span>
              {article.affectedPairs.map((p) => <PairBadge key={p} pair={p} />)}
            </div>
          )}

          {/* Impact reason expand */}
          {isAI && explanation && (
            <div>
              <button
                onClick={(event) => { event.stopPropagation(); setExpanded((v) => !v); }}
                className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary transition-colors font-medium"
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Perché rilevante
              </button>
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="mt-1.5 text-[11px] text-muted-foreground/80 leading-relaxed bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
                      {explanation}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50 flex-wrap mt-auto pt-1 border-t border-border/20">
            <span className="font-medium text-muted-foreground/70">{article.source}</span>
            {article.publishedAt && (
              <>
                <span>·</span>
                <TimeAgo iso={article.publishedAt} />
              </>
            )}
            {article.verified && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 ml-auto">
                <ShieldCheck className="w-2.5 h-2.5" />
                {article.citationUrls && article.citationUrls.length > 0
                  ? `${article.citationUrls.length} URL`
                  : article.sources && article.sources.length >= 2
                    ? `${article.sources.length} FONTI`
                    : "✓"}
              </span>
            )}
          </div>

          {/* Citation URLs */}
          {article.citationUrls && article.citationUrls.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {article.citationUrls.map((url, si) => {
                let domain = url;
                try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { /* */ }
                return (
                  <a key={si} href={url} target="_blank" rel="noopener noreferrer" title={url}
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium border border-emerald-500/25 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/20 transition-all">
                    <ExternalLink className="w-2 h-2 shrink-0" />
                    {domain.length > 22 ? domain.slice(0, 20) + "…" : domain}
                  </a>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function News() {
  const { t, language } = useLanguage();
  const qc = useQueryClient();
  const { selectedPairs } = useBackground();
  const selectedPairsKey = selectedPairs.join(",");
  const queryKey = useMemo(() => createNewsQueryKey(selectedPairsKey, language), [language, selectedPairsKey]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "fallback" | "error">("connecting");
  const [providerStatuses, setProviderStatuses] = useState<NewsProviderStatus[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const { data, isLoading, isFetching } = useQuery<NewsData>({
    queryKey,
    queryFn: () => fetchNews({ selectedPairsKey, language }),
    staleTime: 90 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchIntervalInBackground: false,  // solo se la tab è attiva
  });

  useEffect(() => {
    let closed = false;
    const socket = new WebSocket(newsWsUrl());
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      if (closed) return;
      setLiveStatus("live");
      socket.send(JSON.stringify(createNewsSubscribeMessage(selectedPairsKey, language)));
    });

    socket.addEventListener("message", (event) => {
      if (closed) return;
      const message = JSON.parse(String(event.data)) as
        NewsSocketMessage;

      if (message.type === "news_snapshot") {
        qc.setQueryData<NewsData>(queryKey, (current) => updateNewsIfChanged(current, message.snapshot));
        setProviderStatuses(message.snapshot.providerStatuses ?? []);
        setLiveStatus("live");
      }
      if (message.type === "news_article") {
        qc.setQueryData<NewsData>(queryKey, (current) =>
          current
            ? { ...current, articles: mergeArticle(current.articles, message.article), fetchedAt: new Date().toISOString() }
            : { articles: [message.article], fetchedAt: new Date().toISOString(), hasApiKey: true, source: "ai" },
        );
      }
      if (message.type === "news_provider_status") {
        setProviderStatuses((current) => {
          const others = current.filter((status) => status.provider !== message.status.provider);
          return [...others, message.status].sort((a, b) => a.provider.localeCompare(b.provider));
        });
      }
      if (message.type === "news_error") setLiveStatus("error");
    });

    socket.addEventListener("close", () => {
      if (!closed) setLiveStatus("fallback");
    });
    socket.addEventListener("error", () => {
      if (!closed) setLiveStatus("error");
    });

    return () => {
      closed = true;
      if (socketRef.current === socket) socketRef.current = null;
      socket.close();
    };
  }, [language, qc, queryKey, selectedPairsKey]);

  const newsData = data;
  const isAI = newsData?.source === "ai";
  const visibleProviderStatuses = providerStatuses.length > 0 ? providerStatuses : newsData?.providerStatuses ?? [];
  const liveLabel =
    liveStatus === "live" ? "Live socket" :
    liveStatus === "connecting" ? "Connessione live" :
    liveStatus === "fallback" ? "Fallback HTTP" :
    "Live non disponibile";
  const freshArticles = newsData?.articles?.filter((article) => !article.isFallback) ?? [];
  const fallbackArticles = newsData?.articles?.filter((article) => article.isFallback) ?? [];
  const hasFallback = fallbackArticles.length > 0;
  const primarySource = useMemo(() => {
    const counts = new Map<string, number>();
    for (const article of newsData?.articles ?? []) counts.set(article.source, (counts.get(article.source) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  }, [newsData?.articles]);
  const freshnessLabel =
    (newsData?.freshArticlesCount ?? freshArticles.length) > 0
      ? `Ultime ${newsData?.freshnessWindowHours ?? 48}h`
      : hasFallback
        ? "Fallback storico"
        : "Aggiornato ora";

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      try {
        const freshData = await fetchNews({ selectedPairsKey, language, noCache: true });
        qc.setQueryData<NewsData>(queryKey, (current) => updateNewsIfChanged(current, freshData));
      } catch {
        // The live socket refresh below is still useful when the HTTP fallback is unavailable.
      }
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(createNewsRefreshMessage(selectedPairsKey, language)));
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const SourceIcon = isAI ? Cpu : Rss;
  const sourceLabel = isAI ? t("news.source.ai") : t("news.source.rss");

  return (
    <PageLayout>
      <PageHeader
        title={t("news.title")}
        subtitle={t("news.subtitle")}
        action={
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing || isFetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing || isFetching ? "animate-spin" : ""}`} />
            {t("news.refresh")}
          </Button>
        }
      />

      {/* Agent summary panel (AI only) */}
      <AnimatePresence>
        {isAI && newsData?.agentSummary && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="tl-panel flex gap-3 border-primary/20 bg-primary/5 p-4"
          >
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-xs font-bold text-primary/80 uppercase tracking-wider">Analisi AI Agent</span>
                {newsData.watchedPairs && newsData.watchedPairs.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {newsData.watchedPairs.map((p) => <PairBadge key={p} pair={p} />)}
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground/90 leading-relaxed">{newsData.agentSummary}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Meta bar (source, time, countdown) */}
      {newsData && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground/60 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <SourceIcon className="w-3.5 h-3.5" />
            {sourceLabel}
          </span>
          {primarySource && (
            <>
              <span>Â·</span>
              <span>Fonte principale: {primarySource}</span>
            </>
          )}
          {newsData.fetchedAt && (
            <>
              <span>·</span>
              <TimeAgo iso={newsData.fetchedAt} />
            </>
          )}
          {isAI && newsData.nextRefreshAt && (
            <>
              <span>·</span>
              <RefreshCountdown nextRefreshAt={newsData.nextRefreshAt} />
            </>
          )}
          <span>Â·</span>
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-semibold ${
              liveStatus === "live"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : liveStatus === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}
          >
            <Zap className="h-3 w-3" />
            {liveLabel}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 font-semibold text-sky-300">
            <Clock className="h-3 w-3" />
            {freshnessLabel}
          </span>
        </div>
      )}

      {visibleProviderStatuses.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {visibleProviderStatuses.map((status) => (
            <span
              key={status.provider}
              title={status.message}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                status.status === "connected"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : status.status === "error"
                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : status.status === "disabled"
                      ? "border-white/10 bg-white/5 text-muted-foreground"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              {status.provider}
              <span className="opacity-70">{status.transport}</span>
            </span>
          ))}
        </div>
      )}

      {/* News grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg border border-border/30 bg-secondary/40" />
          ))}
        </div>
      ) : newsData?.articles && newsData.articles.length > 0 ? (
        <div className="space-y-6">
          {freshArticles.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground/80">Notizie recenti</h2>
                <span className="text-xs text-muted-foreground/60">{freshArticles.length} entro {newsData.freshnessWindowHours ?? 48}h</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {freshArticles.map((article, idx) => (
                  <ArticleCard key={article.url ?? `${article.title}-${idx}`} article={article} idx={idx} isAI={isAI} onOpen={setSelectedArticle} />
                ))}
              </div>
            </section>
          )}

          {fallbackArticles.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3 border-t border-border/30 pt-4">
                <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground/80">Archivio utile</h2>
                <span className="text-xs text-muted-foreground/60">{fallbackArticles.length} notizie meno recenti</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-85">
                {fallbackArticles.map((article, idx) => (
                  <ArticleCard key={article.url ?? `${article.title}-${idx}`} article={article} idx={idx} isAI={isAI} onOpen={setSelectedArticle} />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <Card className="border-border/40 bg-card/70">
          <CardContent className="p-16 text-center">
            <Newspaper className="w-14 h-14 mx-auto mb-5 opacity-15" />
            <h3 className="text-xl font-bold mb-2">{t("news.empty")}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
              {t("news.empty_desc")}
            </p>
            <Button variant="outline" onClick={handleRefresh} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              {t("news.refresh")}
            </Button>
          </CardContent>
        </Card>
      )}
      <NewsDetailDialog article={selectedArticle} open={Boolean(selectedArticle)} onOpenChange={(open) => !open && setSelectedArticle(null)} />
    </PageLayout>
  );
}
