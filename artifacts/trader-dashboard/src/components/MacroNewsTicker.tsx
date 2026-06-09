import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useBackground } from "@/contexts/BackgroundContext";
import {
  Brain,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Activity,
  Check,
  ExternalLink,
  ShieldCheck,
  Clock,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatItalianNewsRelativeTime } from "@/lib/relativeTime";
import { deriveEffectiveFilterItems } from "@/lib/toolPairFilters";
import { reportClientError } from "@/lib/clientErrorReporter";

const API = "/api";

interface MacroArticleDeepDive {
  whatHappened: string;
  whyItMatters: string;
  possibleImpact: string;
}

interface MacroArticle {
  title: string;
  summary: string;
  originalTitle?: string;
  originalSummary?: string;
  impact: string;
  currency: string;
  direction: string;
  source: string;
  sources?: string[];
  resolvedUrl?: string | null;
  sourceUrl?: string | null;
  citationUrls?: string[]; // real Perplexity-verified source URLs
  verified?: boolean;
  category?: string;
  timestamp?: string;
  imageUrl?: string | null;
  url?: string | null;
  deepDive?: MacroArticleDeepDive;
}

interface MacroNewsData {
  articles: MacroArticle[];
  sentiment: string;
  sentimentIntensity?: string;
  summary: string;
  fetchedAt: string;
  citationUrls?: string[];
}

const ALL_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "JPY",
  "CHF",
  "CAD",
  "AUD",
  "NZD",
  "XAU",
];

const STORAGE_KEY = "macro-news-currencies";

const CURRENCY_FLAGS: Record<string, string> = {
  EUR: "\u{1F1EA}\u{1F1FA}",
  USD: "\u{1F1FA}\u{1F1F8}",
  GBP: "\u{1F1EC}\u{1F1E7}",
  JPY: "\u{1F1EF}\u{1F1F5}",
  CHF: "\u{1F1E8}\u{1F1ED}",
  CAD: "\u{1F1E8}\u{1F1E6}",
  AUD: "\u{1F1E6}\u{1F1FA}",
  NZD: "\u{1F1F3}\u{1F1FF}",
  XAU: "\u{1F947}",
  GLOBALE: "\u{1F30D}",
};

const IMPACT_DOT: Record<string, string> = {
  alto: "\u{1F534}",
  medio: "\u{1F7E1}",
  basso: "\u{1F7E2}",
};

const IMPACT_STYLES: Record<string, string> = {
  alto: "text-red-400 bg-red-500/10 border-red-500/30",
  medio: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  basso: "text-green-400 bg-green-500/10 border-green-500/30",
};

const SENTIMENT_STYLES: Record<string, string> = {
  "risk-on": "text-primary bg-primary/10 border-primary/30",
  "risk-off": "text-destructive bg-destructive/10 border-destructive/30",
  neutrale: "text-muted-foreground bg-secondary/50 border-border",
};

const DIRECTION_ICONS: Record<string, React.ReactNode> = {
  bullish: <TrendingUp className="w-3.5 h-3.5 text-primary" />,
  bearish: <TrendingDown className="w-3.5 h-3.5 text-destructive" />,
  neutrale: <Minus className="w-3.5 h-3.5 text-muted-foreground" />,
};

function loadCurrencies(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((c: string) => ALL_CURRENCIES.includes(c));
      }
    }
  } catch (error) {
    reportClientError(error, {
      context: "macro news currency preferences load",
      notify: false,
    });
  }
  return [...ALL_CURRENCIES];
}

function saveCurrencies(currencies: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(currencies));
}

function searchSourceUrl(source: string, title: string): string {
  const q = encodeURIComponent(`${source} ${title}`);
  return `https://www.google.com/search?q=${q}`;
}

function preferredMacroArticleUrl(
  article: Pick<MacroArticle, "url" | "resolvedUrl">,
): string | null {
  return article.resolvedUrl &&
    !article.resolvedUrl.includes("news.google.com/rss/articles")
    ? article.resolvedUrl
    : (article.url ?? null);
}

function extractDomain(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.length > 28 ? host.slice(0, 26) + "…" : host;
  } catch {
    return url.slice(0, 28);
  }
}

const CATEGORY_LABELS: Record<string, { label: string; cls: string }> = {
  "banca-centrale": {
    label: "🏦 Banca Centrale",
    cls: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  },
  "macro-dati": {
    label: "📊 Dati Macro",
    cls: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  },
  conflitto: {
    label: "⚔️ Conflitto",
    cls: "border-red-500/30 bg-red-500/10 text-red-400",
  },
  sanzioni: {
    label: "🚫 Sanzioni",
    cls: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  },
  elezioni: {
    label: "🗳️ Elezioni",
    cls: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  },
  commercio: {
    label: "🤝 Commercio",
    cls: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  },
  energia: {
    label: "⚡ Energia",
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  commodities: {
    label: "🪙 Commodities",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
};

function MacroNewsDetailDialog({
  article,
  open,
  onOpenChange,
}: {
  article: MacroArticle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!article) return null;
  const detailUrl = preferredMacroArticleUrl(article);
  const deepDive = article.deepDive ?? {
    whatHappened: article.summary || article.title,
    whyItMatters: `La notizia riguarda ${article.currency} e puo' modificare aspettative, flussi o volatilita' sull'asset monitorato.`,
    possibleImpact: `Impatto ${article.impact} su ${article.currency}. Direzione stimata: ${article.direction}.`,
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] bg-card/95 backdrop-blur-xl border-border max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap pr-6">
            <span
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${IMPACT_STYLES[article.impact] ?? IMPACT_STYLES.basso}`}
            >
              {article.impact.toUpperCase()}
            </span>
            {article.category && CATEGORY_LABELS[article.category] && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold border ${CATEGORY_LABELS[article.category].cls}`}
              >
                {CATEGORY_LABELS[article.category].label}
              </span>
            )}
            <span className="font-mono text-xs font-bold text-muted-foreground">
              {CURRENCY_FLAGS[article.currency] ?? "\u{1F4CA}"}{" "}
              {article.currency}
            </span>
          </div>
          <DialogTitle className="text-xl leading-snug pt-2">
            {article.title}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            <span>{article.source}</span>
            {article.timestamp && (
              <>
                <span>·</span>
                <span>{formatItalianNewsRelativeTime(article.timestamp)}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {article.imageUrl && (
          <img
            src={article.imageUrl}
            alt=""
            className="w-full max-h-64 object-cover rounded-lg border border-border/40"
          />
        )}

        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-foreground/90">
            {article.summary}
          </p>

          <div className="grid gap-3">
            {[
              ["Cosa e' successo", deepDive.whatHappened],
              ["Perche' influenza l'asset", deepDive.whyItMatters],
              ["Come puo' impattare", deepDive.possibleImpact],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-primary/15 bg-primary/5 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-primary/80 mb-1">
                  {label}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {(article.originalTitle || article.originalSummary) && (
            <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                Originale
              </p>
              {article.originalTitle && (
                <p className="text-sm font-semibold text-muted-foreground">
                  {article.originalTitle}
                </p>
              )}
              {article.originalSummary && (
                <p className="text-xs text-muted-foreground/80 mt-1 leading-relaxed">
                  {article.originalSummary}
                </p>
              )}
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

function getStoredLang(): string {
  try {
    return localStorage.getItem("tl_language") ?? "it";
  } catch {
    return "it";
  }
}

async function fetchMacroNews(
  currencies: string[],
  force = false,
): Promise<MacroNewsData> {
  const params = new URLSearchParams();
  if (currencies.length > 0 && currencies.length < ALL_CURRENCIES.length) {
    params.set("currencies", currencies.join(","));
  }
  if (force) params.set("force", "1");
  params.set("lang", getStoredLang());
  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API}/tools/macro-news${qs}`);
  if (!res.ok) throw new Error(`Errore ${res.status}`);
  return res.json();
}

export function MacroNewsTicker() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<MacroArticle | null>(
    null,
  );
  const [selectedCurrencies, setSelectedCurrencies] =
    useState<string[]>(loadCurrencies);
  const forceNextRef = useRef(false);
  const { selectedCurrencies: contextCurrencies } = useBackground();

  const pairDerivedCurrencies = useMemo(() => {
    const valid = contextCurrencies.filter((c) => ALL_CURRENCIES.includes(c));
    return valid.length > 0 ? valid : null;
  }, [contextCurrencies]);

  useEffect(() => {
    if (pairDerivedCurrencies) {
      setSelectedCurrencies(pairDerivedCurrencies);
      saveCurrencies(pairDerivedCurrencies);
    }
  }, [pairDerivedCurrencies]);

  useEffect(() => {
    saveCurrencies(selectedCurrencies);
  }, [selectedCurrencies]);

  const macroFilter = useMemo(
    () =>
      deriveEffectiveFilterItems({
        requestedItems: pairDerivedCurrencies ?? selectedCurrencies,
        supportedItems: ALL_CURRENCIES,
        defaultItems: selectedCurrencies,
      }),
    [pairDerivedCurrencies, selectedCurrencies],
  );
  const isPairDerivedMode = pairDerivedCurrencies !== null;
  const effectiveCurrencies = macroFilter.items;

  const currenciesKey = useMemo(
    () => [...effectiveCurrencies].sort().join(","),
    [effectiveCurrencies],
  );

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["macro-news", currenciesKey],
    queryFn: () => {
      const force = forceNextRef.current;
      forceNextRef.current = false;
      return fetchMacroNews(effectiveCurrencies, force);
    },
    refetchInterval: 2 * 60 * 1000,
    staleTime: 90 * 1000,
    retry: 1,
  });

  const tickerItems = useMemo(() => {
    if (!data?.articles?.length) return [];
    return data.articles.map((a) => {
      const flag = CURRENCY_FLAGS[a.currency] ?? "\u{1F4CA}";
      const dot = IMPACT_DOT[a.impact] ?? "\u26AA";
      const impactLabel = a.impact ? a.impact.toUpperCase() : "";
      const sourceCount = a.sources?.length ?? (a.source ? 1 : 0);
      const srcLabel =
        sourceCount > 0
          ? ` [${sourceCount} ${sourceCount === 1 ? "fonte" : "fonti"}]`
          : "";
      const verifiedMark = sourceCount >= 3 ? " \u2713" : "";
      return `${dot} ${flag} ${a.currency}: ${a.title} \u2014 ${impactLabel}${srcLabel}${verifiedMark}`;
    });
  }, [data]);

  const toggleCurrency = useCallback((cur: string) => {
    setSelectedCurrencies((prev) => {
      if (prev.includes(cur)) {
        const next = prev.filter((c) => c !== cur);
        return next.length === 0 ? [cur] : next;
      }
      return [...prev, cur];
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedCurrencies([...ALL_CURRENCIES]);
  }, []);

  const fetchedTimeAgo = useMemo(() => {
    if (!data?.fetchedAt) return null;
    return formatItalianNewsRelativeTime(data.fetchedAt);
  }, [data?.fetchedAt]);

  return (
    <>
      <div
        className="flex-1 min-w-0 overflow-hidden relative cursor-pointer group"
        onClick={() => setSheetOpen(true)}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">
              Analisi macro AI...
            </span>
          </div>
        ) : isError ? (
          <span className="text-xs text-destructive/70">
            Errore caricamento notizie
          </span>
        ) : tickerItems.length > 0 ? (
          <div className="overflow-hidden whitespace-nowrap mask-fade">
            <div className="inline-flex animate-marquee gap-8">
              {tickerItems.map((item, i) => (
                <span
                  key={i}
                  className="text-xs text-muted-foreground font-medium group-hover:text-primary transition-colors"
                >
                  {item}
                </span>
              ))}
              {tickerItems.map((item, i) => (
                <span
                  key={`dup-${i}`}
                  className="text-xs text-muted-foreground font-medium group-hover:text-primary transition-colors"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            Clicca per il briefing macro AI
          </span>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl"
        >
          <SheetHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-base flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  Agente Notizie Macro
                </SheetTitle>
                <SheetDescription className="text-xs mt-0.5">
                  Briefing AI verificato su fonti multiple
                  {fetchedTimeAgo && (
                    <span className="ml-2 text-muted-foreground/60 inline-flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      Aggiornato {fetchedTimeAgo}
                    </span>
                  )}
                </SheetDescription>
              </div>
              <button
                onClick={() => {
                  forceNextRef.current = true;
                  refetch();
                }}
                disabled={isFetching}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-all disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`}
                />
                {isFetching ? "Aggiornamento..." : "Aggiorna"}
              </button>
            </div>
          </SheetHeader>

          <div className="pt-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Valute dai tuoi pair
              </p>
              {isPairDerivedMode ? (
                <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {effectiveCurrencies.map((cur) => (
                      <span
                        key={cur}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border border-primary/30 bg-primary/10 text-primary"
                      >
                        {CURRENCY_FLAGS[cur] ?? ""} {cur}
                      </span>
                    ))}
                  </div>
                  {macroFilter.unsupportedItems.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Non supportate qui:{" "}
                      {macroFilter.unsupportedItems.join(", ")}.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={selectAll}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                      selectedCurrencies.length === ALL_CURRENCIES.length
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    Tutte
                  </button>
                  {ALL_CURRENCIES.map((cur) => {
                    const active = selectedCurrencies.includes(cur);
                    return (
                      <label
                        key={cur}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                          active
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleCurrency(cur)}
                          className="sr-only"
                        />
                        <span
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                            active
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {active && (
                            <Check className="w-2.5 h-2.5 text-primary-foreground" />
                          )}
                        </span>
                        {CURRENCY_FLAGS[cur]} {cur}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {data?.sentiment && (
              <div className="flex items-center gap-3">
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                    SENTIMENT_STYLES[data.sentiment] ??
                    SENTIMENT_STYLES["neutrale"]
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  {data.sentiment.toUpperCase()}
                  {data.sentimentIntensity && (
                    <span className="opacity-70 font-bold">· {data.sentimentIntensity.toUpperCase()}</span>
                  )}
                </div>
                {data.summary && (
                  <p className="text-xs text-muted-foreground italic flex-1 line-clamp-2">
                    &ldquo;{data.summary}&rdquo;
                  </p>
                )}
              </div>
            )}

            {isFetching && !data && (
              <div className="flex flex-col items-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm">Analisi macro in corso...</p>
                <p className="text-xs text-muted-foreground/60">
                  Può richiedere 10-20 secondi
                </p>
              </div>
            )}

            {data?.articles && data.articles.length > 0 && (
              <div className="space-y-2.5">
                <AnimatePresence>
                  {data.articles.map((article, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedArticle(article)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedArticle(article);
                        }
                      }}
                      className="rounded-2xl border border-border bg-card/60 overflow-hidden cursor-pointer hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      {article.imageUrl && (
                        <div className="w-full h-28 overflow-hidden">
                          <img
                            src={article.imageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (
                                e.currentTarget as HTMLImageElement
                              ).parentElement!.style.display = "none";
                            }}
                          />
                        </div>
                      )}
                      <div className="p-3.5 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-sm font-semibold leading-tight flex-1">
                            <button
                              type="button"
                              className="text-left hover:text-primary hover:underline transition-colors"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedArticle(article);
                              }}
                            >
                              {article.title}
                            </button>
                          </h4>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="font-mono text-xs font-bold text-muted-foreground">
                              {CURRENCY_FLAGS[article.currency] ?? "\u{1F4CA}"}{" "}
                              {article.currency}
                            </span>
                            {DIRECTION_ICONS[article.direction] ??
                              DIRECTION_ICONS.neutrale}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {article.summary}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                              IMPACT_STYLES[article.impact] ??
                              IMPACT_STYLES.basso
                            }`}
                          >
                            {article.impact.toUpperCase()}
                          </span>
                          <span
                            className={`text-[10px] font-medium ${
                              article.direction === "bullish"
                                ? "text-primary"
                                : article.direction === "bearish"
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {article.direction}
                          </span>
                          {/* Category badge — geopolitical, macro, energy, etc. */}
                          {article.category &&
                            CATEGORY_LABELS[article.category] && (
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold border ${CATEGORY_LABELS[article.category].cls}`}
                              >
                                {CATEGORY_LABELS[article.category].label}
                              </span>
                            )}
                          {/* Verification badge: Perplexity citations > AI-named sources */}
                          {article.verified ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              {article.citationUrls &&
                              article.citationUrls.length > 0
                                ? `${article.citationUrls.length} URL REALI`
                                : article.sources && article.sources.length >= 3
                                  ? `${article.sources.length} FONTI`
                                  : "VERIFICATO"}
                            </span>
                          ) : article.sources && article.sources.length > 0 ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold border border-yellow-500/30 bg-yellow-500/10 text-yellow-400">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              {article.sources.length}{" "}
                              {article.sources.length === 1 ? "FONTE" : "FONTI"}
                            </span>
                          ) : null}
                          {article.timestamp && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/60 ml-auto">
                              <Clock className="w-2.5 h-2.5" />
                              {formatItalianNewsRelativeTime(article.timestamp)}
                            </span>
                          )}
                        </div>

                        {/* Sources — real Perplexity citation URLs take priority over named sources */}
                        {((article.citationUrls &&
                          article.citationUrls.length > 0) ||
                          (article.sources && article.sources.length > 0)) && (
                          <div className="pt-1.5 border-t border-border/30">
                            <div className="flex items-center gap-1 mb-1.5">
                              <span className="text-[9px] text-muted-foreground/50 font-semibold uppercase tracking-wide">
                                {article.citationUrls &&
                                article.citationUrls.length > 0 ? (
                                  <>
                                    Fonti verificate (
                                    {article.citationUrls.length}
                                    <span className="text-emerald-400">
                                      {" "}
                                      · Perplexity
                                    </span>
                                    )
                                  </>
                                ) : (
                                  <>
                                    Fonti ({article.sources!.length}
                                    {article.sources!.length >= 3 ? (
                                      <span className="text-emerald-400">
                                        {" "}
                                        · verificato
                                      </span>
                                    ) : (
                                      <span className="text-yellow-400">
                                        {" "}
                                        · min 3
                                      </span>
                                    )}
                                    )
                                  </>
                                )}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {/* Prefer real citation URLs (verified by Perplexity's web search) */}
                              {article.citationUrls &&
                              article.citationUrls.length > 0
                                ? article.citationUrls.map((url, si) => (
                                    <a
                                      key={si}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(event) =>
                                        event.stopPropagation()
                                      }
                                      title={url}
                                      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-medium border border-emerald-500/30 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all"
                                    >
                                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                      {extractDomain(url)}
                                    </a>
                                  ))
                                : /* Fallback: named sources with Google search link */
                                  article.sources!.map((src, si) => (
                                    <a
                                      key={si}
                                      href={searchSourceUrl(src, article.title)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(event) =>
                                        event.stopPropagation()
                                      }
                                      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-medium border border-blue-500/25 bg-blue-500/8 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/40 transition-all"
                                    >
                                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                      {src}
                                    </a>
                                  ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {!data && !isFetching && (
              <div className="flex flex-col items-center py-8 gap-2 text-muted-foreground">
                <Brain className="w-10 h-10 opacity-20" />
                <p className="text-sm">
                  Clicca &ldquo;Aggiorna&rdquo; per ottenere il briefing macro
                </p>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground/50 text-center pt-2">
              Generato con AI &middot; Non costituisce consulenza finanziaria
            </p>
          </div>
        </SheetContent>
      </Sheet>
      <MacroNewsDetailDialog
        article={selectedArticle}
        open={Boolean(selectedArticle)}
        onOpenChange={(open) => !open && setSelectedArticle(null)}
      />
    </>
  );
}
