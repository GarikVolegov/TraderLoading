import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Newspaper, TrendingUp, TrendingDown, Minus, RefreshCw,
  ExternalLink, Clock, ChevronDown,
  ChevronUp, Zap, ThumbsUp, ThumbsDown, SlidersHorizontal, X,
} from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { QueryErrorState } from "@/components/QueryErrorState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useBackground } from "@/contexts/BackgroundContext";
import { useLanguage, useDateLocale, uiText } from "@/contexts/LanguageContext";
import {
  createNewsQueryKey,
  createNewsRefreshMessage,
  createNewsSubscribeMessage,
  fetchNews,
  type Article,
  type NewsData,
  type NewsSocketMessage,
} from "@/lib/newsApi";
import { apiJSON } from "@/lib/apiFetch";
import { useLocation, useSearch } from "wouter";
import { updateWorkspaceQuery } from "@/lib/workspaceNavigation";
import { newsArticleReference, newsArticleMatchesReference, newsRelevantToPair, selectNewsBrief, sourceHostname } from "@/lib/newsBrief";

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
    score >= 8 ? uiText("auto.ui.d32aa72141") :
    score >= 5 ? uiText("auto.ui.4ed09f9264") : uiText("auto.ui.e9d822f15f");
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap ${color}`}>
      <Zap className="w-2.5 h-2.5" />
      {score}/10 {label}
    </span>
  );
}

function PairEffectsBadge({ article, pair }: { article: Article; pair: string | null }) {
  const { t } = useLanguage();
  const effects = (article.effects ?? []).filter(effect => !pair || effect.pair === pair);
  if (!effects.length) return <span className="text-xs text-muted-foreground">{t("intelligence.uncertain")}</span>;
  return <>{effects.slice(0, 3).map(effect => <span key={effect.pair} className="inline-flex items-center gap-1"><PairBadge pair={effect.pair} />{effect.direction === "uncertain" ? <span className="text-xs text-muted-foreground">{t("intelligence.uncertain")}</span> : <SentimentBadge sentiment={effect.direction} />}</span>)}</>;
}

function FreshnessBadge({ article }: { article: Article }) {
  const { t } = useLanguage();
  if (!article.publishedAt || !Number.isFinite(Date.parse(article.publishedAt))) return <span className="text-xs text-muted-foreground">{t("market.unknown_time")}</span>;
  const tier = article.freshnessTier ?? (article.isFallback ? "fallback" : "fresh");
  const age = article.ageMinutes;
  const label =
    tier === "live" ? "Live" :
    tier === "fresh" && typeof age === "number" && age <= 60 ? uiText("auto.ui.9a07f2bb32") :
    tier === "fresh" ? uiText("auto.ui.99db104f23") :
    tier === "fallback" ? uiText("auto.ui.0ebd91a99e") :
    uiText("auto.ui.b38270fe36");
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

type ImpactBand = "all" | "high" | "med" | "low";
type SentimentFilter = "all" | "bullish" | "bearish" | "neutral";

function impactBand(score: number): Exclude<ImpactBand, "all"> {
  return score >= 8 ? "high" : score >= 5 ? "med" : "low";
}

// labelKey (not a pre-resolved label) so the option stays reactive to language
// changes — these arrays are module-level consts, evaluated once at import.
const IMPACT_FILTER_OPTIONS: { id: ImpactBand; labelKey: string }[] = [
  { id: "all", labelKey: "auto.ui.148ba18ee0" },
  { id: "high", labelKey: "auto.ui.f46edd0236" },
  { id: "med", labelKey: "auto.ui.5ae9f5bf54" },
  { id: "low", labelKey: "auto.ui.97f1c99bbc" },
];

const SENTIMENT_FILTER_OPTIONS: { id: SentimentFilter; labelKey: string }[] = [
  { id: "all", labelKey: "auto.ui.148ba18ee0" },
  { id: "bullish", labelKey: "auto.ui.94f006e5a1" },
  { id: "bearish", labelKey: "auto.ui.9dbe58d934" },
  { id: "neutral", labelKey: "auto.ui.628ea0ce38" },
];

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; labelKey: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="inline-flex gap-0.5 rounded-full border border-border/50 bg-secondary/50 p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-full px-2.5 py-1 text-xs font-bold transition-colors ${
            value === option.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground/70 hover:text-foreground"
          }`}
        >
          {uiText(option.labelKey)}
        </button>
      ))}
    </div>
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

const NEWS_PAGE_SIZE = 15;

function articleKey(article: Pick<Article, "url" | "title">): string {
  return article.url ? `url:${article.url}` : `title:${article.title.toLowerCase().slice(0, 160)}`;
}

function articleTime(article: Article | undefined): number {
  if (!article) return 0;
  if (!article.publishedAt) return Date.now();
  const ts = new Date(article.publishedAt).getTime();
  return Number.isNaN(ts) ? Date.now() : ts;
}

// Flatten paginated pages into a single chronological list, dropping duplicates
// that can appear when the cached corpus shifts between page fetches.
function flattenNewsPages(data: InfiniteData<NewsData> | undefined): Article[] {
  const seen = new Set<string>();
  const out: Article[] = [];
  for (const page of data?.pages ?? []) {
    for (const article of page.articles) {
      const key = articleKey(article);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(article);
    }
  }
  return out;
}

// Prepend only genuinely-newer live articles to the first page so the live
// socket never reshuffles or duplicates the chronological history below.
function prependLiveArticles(
  current: InfiniteData<NewsData> | undefined,
  incoming: Article[],
): InfiniteData<NewsData> | undefined {
  if (!current || current.pages.length === 0) return current;
  const loaded = new Set<string>();
  for (const page of current.pages) for (const article of page.articles) loaded.add(articleKey(article));
  const topTime = articleTime(current.pages[0].articles[0]);
  const fresh = incoming
    .filter((article) => !loaded.has(articleKey(article)) && articleTime(article) >= topTime)
    .sort((a, b) => articleTime(b) - articleTime(a));
  if (fresh.length === 0) return current;
  const [first, ...rest] = current.pages;
  return { ...current, pages: [{ ...first, articles: [...fresh, ...first.articles] }, ...rest] };
}

// Merge live snapshot metadata into the first page without touching the loaded
// article history (which is owned by pagination).
function mergeSnapshotMeta(
  current: InfiniteData<NewsData> | undefined,
  snapshot: NewsData,
): InfiniteData<NewsData> | undefined {
  if (!current || current.pages.length === 0) return current;
  const [first, ...rest] = current.pages;
  const merged: NewsData = {
    ...first,
    fetchedAt: snapshot.fetchedAt,
    nextRefreshAt: snapshot.nextRefreshAt ?? first.nextRefreshAt,
    agentSummary: snapshot.agentSummary ?? first.agentSummary,
    watchedPairs: snapshot.watchedPairs ?? first.watchedPairs,
    providerStatuses: snapshot.providerStatuses ?? first.providerStatuses,
    source: snapshot.source ?? first.source,
    sourceStatus: snapshot.sourceStatus ?? first.sourceStatus,
    analysisStatus: snapshot.analysisStatus ?? first.analysisStatus,
    freshArticlesCount: snapshot.freshArticlesCount ?? first.freshArticlesCount,
    freshnessWindowHours: snapshot.freshnessWindowHours ?? first.freshnessWindowHours,
  };
  return { ...current, pages: [merged, ...rest] };
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
      {uiText("auto.ui.f35bea07da", { remaining })}
    </span>
  );
}

// ─── Article Card ─────────────────────────────────────────────────────────────

function NewsDetailDialog({ article, pair, open, onOpenChange }: { article: Article | null; pair: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useLanguage();
  const explanation = article ? article.relevanceReason ?? article.impactReason : undefined;
  if (!article) return null;
  const detailUrl = preferredArticleUrl(article);
  const deepDive = article.contentBasis === "full_text" ? article.deepDive : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] bg-card/95 backdrop-blur-xl border-border max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap pr-6">
            <FreshnessBadge article={article} />
            {article.impactScore && <ImpactScore score={article.impactScore} />}
            <PairEffectsBadge article={article} pair={pair} />
          </div>
          <DialogTitle className="text-xl leading-snug pt-2">{article.title}</DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
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
          <p className="text-xs text-muted-foreground">{t(`workspace.evidence.${article.contentBasis ?? "snippet"}`)} · {t(`workspace.analysis.${article.analysisMethod ?? "none"}`)} · {article.source}</p>
          <p className="text-sm leading-relaxed text-foreground/90">{article.summary}</p>
          {(article.effects ?? []).filter(effect => !pair || effect.pair === pair).map(effect => <section key={effect.pair} className="rounded-lg border border-border bg-secondary/20 p-3"><h3 className="font-sans text-sm font-semibold">{effect.pair} / 4h</h3><dl className="mt-3 space-y-3 text-sm">{[["event_fact", effect.fact], ["scenario", effect.scenario], ["invalidation", effect.invalidation]].map(([key, value]) => <div key={key}><dt className="text-xs font-semibold text-primary">{t(`intelligence.${key}`)}</dt><dd className="mt-1 text-muted-foreground">{value}</dd></div>)}</dl>{effect.evidenceUrls.filter(url => /^https?:\/\//i.test(url)).map(url => <a key={url} className="mt-2 block text-xs text-primary underline" href={url} target="_blank" rel="noopener noreferrer">{sourceHostname(url)}</a>)}</section>)}

          {deepDive ? (
            <div className="grid gap-3">
              {[
                [uiText("auto.ui.814395b5a9"), deepDive.whatHappened],
                [uiText("auto.ui.3c4f0698e2"), deepDive.whyItMatters],
                [uiText("auto.ui.cf43d6477f"), deepDive.possibleImpact],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-primary/15 bg-primary/5 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-primary/80 mb-1">{label}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{value}</p>
                </div>
              ))}
            </div>
          ) : explanation && article.contentBasis === "full_text" && (
            <div className="rounded-lg border border-primary/15 bg-primary/5 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-primary/80 mb-1">{t("news.impact_for_trading")}</p>
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
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">{t("news.original")}</p>
              {article.originalTitle && <p className="text-sm font-semibold text-muted-foreground">{article.originalTitle}</p>}
              {article.originalSummary && <p className="text-xs text-muted-foreground/80 mt-1 leading-relaxed">{article.originalSummary}</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {(article.citationUrls ?? []).filter(url => /^https?:\/\//i.test(url) && sourceHostname(url) && url !== detailUrl && url !== article.sourceUrl).map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">{sourceHostname(url)}</a>)}
            {detailUrl && (
              <a
                href={detailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <ExternalLink className="w-4 h-4" />
                {uiText("auto.ui.ee8a13250e")}
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
                {uiText("auto.ui.ee8a13250e")}
              </a>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ArticleCard({ article, pair, idx, isAI, onOpen, vote, onVote, voteDisabled }: { article: Article; pair: string | null; idx: number; isAI: boolean; onOpen: (article: Article) => void; vote: number; onVote: (vote: number) => void; voteDisabled: boolean }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const explanation = article.relevanceReason ?? article.impactReason;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx, 10) * 0.04 }}
      className="h-full"
    >
      <Card
        role="button"
        tabIndex={0}
        onClick={() => onOpen(article)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
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
              <PairEffectsBadge article={article} pair={pair} />
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
              <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider font-medium">{t("news.impacts")}</span>
              {article.affectedPairs.map((p) => <PairBadge key={p} pair={p} />)}
            </div>
          )}

          {/* Impact reason expand */}
          {isAI && explanation && article.contentBasis === "full_text" && (
            <div>
              <button
                onClick={(event) => { event.stopPropagation(); setExpanded((v) => !v); }}
                className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary transition-colors font-medium"
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {uiText("auto.ui.0fe5a7669f")}
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
            <span>{article.source}</span>
            <span>{t(`workspace.evidence.${article.contentBasis ?? "snippet"}`)}</span>
            {article.publishedAt && (
              <>
                <span>·</span>
                <TimeAgo iso={article.publishedAt} />
              </>
            )}
            <div className="ml-auto flex items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
              <button type="button" title={t("news.more_like_this")} aria-label={t("news.more_like_this")}
                aria-pressed={vote === 1} disabled={voteDisabled}
                onClick={() => onVote(vote === 1 ? 0 : 1)}
                className={`p-1 rounded transition-colors hover:bg-emerald-500/15 ${vote === 1 ? "text-emerald-400" : "text-muted-foreground/40"}`}>
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button type="button" title={t("news.less_like_this")} aria-label={t("news.less_like_this")}
                aria-pressed={vote === -1} disabled={voteDisabled}
                onClick={() => onVote(vote === -1 ? 0 : -1)}
                className={`p-1 rounded transition-colors hover:bg-red-500/15 ${vote === -1 ? "text-red-400" : "text-muted-foreground/40"}`}>
                <ThumbsDown className="w-3 h-3" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

// ─── Feed training panel (per-user keywords + profile) ────────────────────────

function FeedTrainingPanel({ onApplied }: { onApplied: () => void }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isPending, isError, refetch } = useQuery<{ keywords: string[]; profile: string }>({
    queryKey: ["news-preferences"],
    queryFn: () => apiJSON("news/preferences"),
  });
  const [keywords, setKeywords] = useState<string[]>([]);
  const [profile, setProfile] = useState("");
  const [kwInput, setKwInput] = useState("");
  const loadedRef = useRef(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => {
    if (data && !loadedRef.current) {
      loadedRef.current = true;
      setKeywords(data.keywords ?? []);
      setProfile(data.profile ?? "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (submitted: { keywords: string[]; profile: string }) => apiJSON<{ keywords: string[]; profile: string }>("news/preferences", { method: "PUT", body: JSON.stringify(submitted) }),
    onSuccess: (saved) => {
      qc.setQueryData(["news-preferences"], saved);
      setKeywords(saved.keywords); setProfile(saved.profile);
      onApplied();
    },
    onError: (cause) => setSaveError(cause instanceof Error ? cause.message : t("settings.preference_failed")),
    onSettled: () => { savingRef.current = false; },
  });
  const submit = () => {
    if (savingRef.current || isPending || isError) return;
    savingRef.current = true; setSaveError(null);
    save.mutate({ keywords: [...keywords], profile });
  };

  const addKw = () => {
    const k = kwInput.trim();
    if (k && !keywords.includes(k)) setKeywords([...keywords, k]);
    setKwInput("");
  };

  return (
    <div className="tl-panel p-3 sm:p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-sm font-semibold">
        <SlidersHorizontal className="w-4 h-4 text-primary" />
        {uiText("auto.ui.fd67dc1c1c")}
        {open ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {isError && <div role="alert"><QueryErrorState onRetry={() => void refetch()} /></div>}
          {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
          <fieldset disabled={save.isPending || isPending || isError} aria-busy={save.isPending} className="space-y-3 min-w-0">
          <div>
            <label className="text-xs text-muted-foreground">{t("news.personalization.keywords")}</label>
            {keywords.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {keywords.map((k) => (
                  <span key={k} className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {k}
                    <button type="button" aria-label={`${t("common.delete")} ${k}`} onClick={() => setKeywords(keywords.filter((x) => x !== k))} className="hover:text-red-400"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <input
              aria-label={t("news.personalization.keywords")}
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKw(); } }}
              placeholder={t("news.personalization.keywords_placeholder")}
              className="mt-1.5 w-full rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t("news.personalization.strategy")}</label>
            <textarea
              aria-label={t("news.personalization.strategy")}
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              placeholder={t("news.personalization.strategy_placeholder")}
              className="mt-1.5 w-full min-h-20 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground/60">{t("news.personalization.feedback_hint")}</p>
            <Button size="sm" disabled={save.isPending || isPending || isError} onClick={submit}>
              {save.isPending && <RefreshCw className="w-4 h-4 mr-1 animate-spin" />}
              {uiText("auto.ui.21a71b1d79")}
            </Button>
          </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function News() {
  return <PageLayout><NewsWorkspace /></PageLayout>;
}

export function NewsWorkspace() {
  const { t, language } = useLanguage();
  const search = useSearch();
  const [, navigate] = useLocation();
  const requestedArticle = new URLSearchParams(search).get("article");
  const qc = useQueryClient();
  const { selectedPairs, settingsLoaded } = useBackground();
  const requestedPair = new URLSearchParams(search).get("pair");
  const activePair = requestedPair === "all" ? null : selectedPairs.includes(requestedPair ?? "") ? requestedPair : selectedPairs[0] ?? null;
  const selectedPairsKey = activePair ?? selectedPairs.join(",");
  const queryKey = useMemo(() => createNewsQueryKey(selectedPairsKey, language), [language, selectedPairsKey]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "fallback" | "error">("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  type Feedback = { articleKey: string; source: string; vote: number };
  const feedbackQuery = useQuery<{ feedback: Feedback[] }>({ queryKey: ["news-feedback"], queryFn: () => apiJSON("news/feedback") });
  const votes = useMemo(() => Object.fromEntries((feedbackQuery.data?.feedback ?? []).map(entry => [entry.articleKey, entry.vote])), [feedbackQuery.data]);
  const votePendingRef = useRef(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const params = new URLSearchParams(search);
  const requestedImpact = params.get("impact") as ImpactBand;
  const impactFilter: ImpactBand = IMPACT_FILTER_OPTIONS.some(option => option.id === requestedImpact) ? requestedImpact : "all";
  const requestedSentiment = params.get("sentiment") as SentimentFilter;
  const sentimentFilter: SentimentFilter = SENTIMENT_FILTER_OPTIONS.some(option => option.id === requestedSentiment) ? requestedSentiment : "all";
  const currencyFilters = useMemo(() => (new URLSearchParams(search).get("currencies") ?? "").split(",").filter(Boolean), [search]);
  const setImpactFilter = (impact: ImpactBand) => navigate(`/${updateWorkspaceQuery(search, { impact: impact === "all" ? null : impact })}`);
  const setSentimentFilter = (sentiment: SentimentFilter) => navigate(`/${updateWorkspaceQuery(search, { sentiment: sentiment === "all" ? null : sentiment })}`);
  const voteMutation = useMutation({
    mutationFn: async (payload: Feedback) => {
      await qc.cancelQueries({ queryKey: ["news-feedback"] });
      return apiJSON("news/feedback", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: (_response, saved) => {
      qc.setQueryData<{ feedback: Feedback[] }>(["news-feedback"], current => ({ feedback: [...(current?.feedback ?? []).filter(entry => entry.articleKey !== saved.articleKey), saved] }));
      void qc.invalidateQueries({ queryKey: ["macro-news"] });
    },
    onError: (cause) => setVoteError(cause instanceof Error ? cause.message : t("settings.preference_failed")),
    onSettled: () => { votePendingRef.current = false; },
  });
  const handleVote = (article: Article, v: number) => {
    if (votePendingRef.current || feedbackQuery.isPending || feedbackQuery.isError) return;
    votePendingRef.current = true; setVoteError(null);
    const key = articleKey(article);
    voteMutation.mutate({ articleKey: key, source: article.source, vote: v });
  };

  const { data, isLoading, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, isError, refetch } =
    useInfiniteQuery<NewsData>({
      queryKey,
      queryFn: ({ pageParam }) =>
        fetchNews({ selectedPairsKey, language, cursor: (pageParam as string) ?? "0", limit: NEWS_PAGE_SIZE }),
      initialPageParam: "0",
      enabled: settingsLoaded,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      staleTime: 90 * 1000,
      refetchInterval: liveStatus === "live" ? false : 120_000,
    });

  const preview = useQuery({
    queryKey: [...queryKey, "preview"],
    queryFn: () => fetchNews({ selectedPairsKey, language, limit: 100 }),
    enabled: settingsLoaded, staleTime: 90_000,
  });
  const articles = useMemo(() => flattenNewsPages(data).filter(article => votes[articleKey(article)] !== -1), [data, votes]);
  const selectedArticle = [...articles, ...(preview.data?.articles ?? [])].find(article => newsArticleMatchesReference(article, requestedArticle)) ?? null;
  const setSelectedArticle = (article: Article | null) => navigate(`/${updateWorkspaceQuery(search, { vista: "notizie", article: article ? newsArticleReference(article) : null })}`);

  const allCurrencies = useMemo(
    () => [...new Set(articles.flatMap((article) => article.affectedPairs ?? []))],
    [articles],
  );
  const toggleCurrencyFilter = (currency: string) => {
    const next = currencyFilters.includes(currency) ? currencyFilters.filter(c => c !== currency) : [...currencyFilters, currency];
    navigate(`/${updateWorkspaceQuery(search, { currencies: next.join(",") || null })}`);
  };
  const filteredArticles = useMemo(
    () =>
      articles.filter(
        (article) =>
          (impactFilter === "all" || impactBand(article.impactScore ?? 0) === impactFilter) &&
          newsRelevantToPair(article, activePair) &&
          (sentimentFilter === "all" || (article.effects ?? []).some(effect => (!activePair || effect.pair === activePair) && effect.direction === (sentimentFilter === "neutral" ? "uncertain" : sentimentFilter))) &&
          (currencyFilters.length === 0 || (article.affectedPairs ?? []).some((pair) => currencyFilters.includes(pair))),
      ),
    [articles, impactFilter, sentimentFilter, currencyFilters, activePair],
  );
  const brief = useMemo(() => selectNewsBrief((preview.data?.articles ?? articles).filter(article =>
    votes[articleKey(article)] !== -1
    && (impactFilter === "all" || impactBand(article.impactScore ?? 0) === impactFilter)
    && newsRelevantToPair(article, activePair)
    && (sentimentFilter === "all" || (article.effects ?? []).some(effect => (!activePair || effect.pair === activePair) && effect.direction === (sentimentFilter === "neutral" ? "uncertain" : sentimentFilter)))
    && (currencyFilters.length === 0 || (article.affectedPairs ?? []).some(pair => currencyFilters.includes(pair)))
  )), [preview.data, articles, votes, impactFilter, sentimentFilter, currencyFilters, activePair]);

  // Resolve a linked story that is on a later feed page before declaring it unavailable.
  useEffect(() => {
    if (requestedArticle && !selectedArticle && hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [requestedArticle, selectedArticle, hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  // Load the next page when the sentinel near the bottom scrolls into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, articles.length]);

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
        qc.setQueryData<InfiniteData<NewsData>>(queryKey, (current) =>
          mergeSnapshotMeta(prependLiveArticles(current, message.snapshot.articles), message.snapshot),
        );
        setLiveStatus("live");
      }
      if (message.type === "news_article") {
        qc.setQueryData<InfiniteData<NewsData>>(queryKey, (current) => prependLiveArticles(current, [message.article]));
      }
      if (message.type === "news_provider_status" && message.status.status === "error") setLiveStatus("error");
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

  const newsData = data?.pages?.[0];
  const isAI = newsData?.source === "ai";
  const liveLabel = t(liveStatus === "connecting" ? "intelligence.loading" : liveStatus === "live" ? "market.available" : "market.unavailable");
  const hasFreshArticles = (newsData?.freshArticlesCount ?? articles.filter((article) => !article.isFallback).length) > 0;
  const freshnessLabel = hasFreshArticles
    ? uiText("auto.ui.826f7a559f", { hours: newsData?.freshnessWindowHours ?? 48 })
    : articles.length > 0
      ? uiText("auto.ui.4ad305722b")
      : uiText("auto.ui.8941db7b73");

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(createNewsRefreshMessage(selectedPairsKey, language)));
      }
      await qc.invalidateQueries({ queryKey });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
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

      <nav aria-label={t("intelligence.pair_focus")} className="flex flex-wrap items-center gap-2"><span className="mr-1 text-xs text-muted-foreground">{t("intelligence.pair_focus")} / 4h</span>{[...selectedPairs, "all"].map(pair => <button key={pair} type="button" aria-pressed={pair === (activePair ?? "all")} className={`min-h-10 rounded-full border px-3 py-2 text-xs font-semibold ${pair === (activePair ?? "all") ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`} onClick={() => navigate(`/${updateWorkspaceQuery(search, { pair, horizon: "4h", article: null, currencies: null })}`)}>{pair === "all" ? t("intelligence.all_pairs") : pair}</button>)}</nav>

      {newsData?.sourceStatus && newsData.sourceStatus !== "available" && <p role="status" className="text-sm text-muted-foreground">{t(`workspace.news_sources.${newsData.sourceStatus}`)}</p>}
      {newsData?.analysisStatus === "unavailable" && <p role="status" className="text-sm text-muted-foreground">{t("workspace.news_analysis_unavailable")}</p>}
      {voteError && <p role="alert" className="text-sm text-destructive">{voteError}</p>}
      {feedbackQuery.isError && <div role="alert"><QueryErrorState onRetry={() => void feedbackQuery.refetch()} /></div>}
      {requestedArticle && !selectedArticle && !isLoading && !isFetchingNextPage && !hasNextPage && <p role="status" className="rounded-lg border border-border p-3 text-sm text-muted-foreground">{t("workspace.article_unavailable")}</p>}

      <section aria-label={t("workspace.brief")} className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="font-sans text-lg font-semibold">{t("workspace.brief")}</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">{t("workspace.brief_hint")}</p>
        {brief.length > 0 ? <ol className="divide-y divide-border">{brief.map((article, index) => <li key={newsArticleReference(article)}>
          <button type="button" onClick={() => setSelectedArticle(article)} className="flex min-h-14 w-full items-start gap-3 py-3 text-left hover:text-primary">
            <span className="pt-0.5 font-mono text-xs text-primary">0{index + 1}</span><span><span className="block text-sm font-semibold">{article.title}</span><span className="mt-1 block text-xs text-muted-foreground">{article.source} · {article.publishedAt ? <TimeAgo iso={article.publishedAt} /> : null} · {t(`workspace.evidence.${article.contentBasis ?? "snippet"}`)}</span>{article.summary && article.summary !== article.title && <span className="mt-1 block text-sm text-muted-foreground">{article.summary}</span>}</span>
          </button>
        </li>)}</ol>
          : !isLoading && !isError
            ? <p className="text-sm text-muted-foreground">{t(newsData?.sourceStatus === "unavailable" ? "workspace.news_sources.unavailable" : "workspace.brief_empty")}</p>
            : null}
      </section>

      {/* Meta bar */}
      {newsData && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground/70 flex-wrap">
          {newsData.fetchedAt && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <TimeAgo iso={newsData.fetchedAt} />
            </span>
          )}
          {isAI && newsData.nextRefreshAt && <RefreshCountdown nextRefreshAt={newsData.nextRefreshAt} />}
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
            {t("intelligence.connection")}: {liveLabel}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 font-semibold text-sky-300">
            <Clock className="h-3 w-3" />
            {t("intelligence.freshness")}: {freshnessLabel}
          </span>
        </div>
      )}

      <FeedTrainingPanel onApplied={() => { qc.invalidateQueries({ queryKey: ["news-preferences"] }); qc.invalidateQueries({ queryKey }); }} />
      <h2 className="pt-3 text-base font-semibold">{t("workspace.feed")}</h2>

      {/* Filters (impact / sentiment / currency) */}
      {articles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
          <SegmentedControl options={IMPACT_FILTER_OPTIONS} value={impactFilter} onChange={setImpactFilter} />
          <SegmentedControl options={SENTIMENT_FILTER_OPTIONS} value={sentimentFilter} onChange={setSentimentFilter} />
          {allCurrencies.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {allCurrencies.map((currency) => {
                const active = currencyFilters.includes(currency);
                return (
                  <button
                    key={currency}
                    type="button"
                    onClick={() => toggleCurrencyFilter(currency)}
                    className={`rounded-md border px-2 py-1 font-mono text-[11px] font-bold transition-colors ${
                      active
                        ? "border-primary/45 bg-primary/12 text-primary"
                        : "border-border/50 bg-secondary/40 text-muted-foreground/70"
                    }`}
                  >
                    {currency}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* News grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg border border-border/30 bg-secondary/40" />
          ))}
        </div>
      ) : isError && articles.length === 0 ? (
        <QueryErrorState onRetry={() => void refetch()} />
      ) : filteredArticles.length > 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredArticles.map((article, idx) => (
              <ArticleCard key={`${articleKey(article)}-${idx}`} article={article} pair={activePair} idx={idx} isAI={isAI} onOpen={setSelectedArticle} vote={votes[articleKey(article)] ?? 0} onVote={(v) => handleVote(article, v)} voteDisabled={voteMutation.isPending || feedbackQuery.isPending || feedbackQuery.isError} />
            ))}
          </div>

          {/* Infinite scroll sentinel + status */}
          <div ref={sentinelRef} className="h-px w-full" aria-hidden />
          {isFetchingNextPage && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground/70">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              {uiText("auto.ui.b5ac7a492b")}
            </div>
          )}
          {!hasNextPage && (
            <p className="py-4 text-center text-xs text-muted-foreground/40">
              {uiText("auto.ui.3ada7a8dc3")}
            </p>
          )}
        </div>
      ) : articles.length > 0 ? (
        <Card className="border-dashed border-border/40 bg-card/50">
          <CardContent className="p-10 text-center">
            <p className="text-sm text-muted-foreground/70">
              {uiText("auto.ui.92464ec4e0")}
            </p>
          </CardContent>
        </Card>
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
      <NewsDetailDialog article={selectedArticle} pair={activePair} open={Boolean(selectedArticle)} onOpenChange={(open) => !open && setSelectedArticle(null)} />
    </>
  );
}
