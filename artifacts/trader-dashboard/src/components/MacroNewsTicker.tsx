import { Link } from "wouter";
import { Newspaper } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackground } from "@/contexts/BackgroundContext";
import { useSearch } from "wouter";
import { createNewsQueryKey, fetchNews } from "@/lib/newsApi";
import { newsArticleReference, selectNewsBrief, newsRelevantToPair } from "@/lib/newsBrief";

/** Preview only: the extended feed and detail live in the operating center. */
export function MacroNewsTicker() {
  const { t, language } = useLanguage();
  const { selectedPairs, settingsLoaded } = useBackground();
  const search = useSearch();
  const requestedPair = new URLSearchParams(search).get("pair");
  const pair = requestedPair === "all" ? null : selectedPairs.includes(requestedPair ?? "") ? requestedPair : selectedPairs[0] ?? null;
  const selectedPairsKey = pair ?? selectedPairs.join(",");
  const query = useQuery({
    queryKey: [...createNewsQueryKey(selectedPairsKey, language), "preview"],
    queryFn: () => fetchNews({ selectedPairsKey, language, limit: 100 }),
    enabled: settingsLoaded,
    staleTime: 90_000,
    refetchInterval: 120_000,
  });
  const article = selectNewsBrief((query.data?.articles ?? []).filter(item => newsRelevantToPair(item, pair)))[0];
  const params = new URLSearchParams({ vista: "notizie", pair: pair ?? "all", horizon: "4h" });
  if (article) params.set("article", newsArticleReference(article));
  const href = `/?${params}`;
  return <Link href={href} className="flex min-h-11 min-w-0 items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
    <Newspaper className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{article?.title ?? t("workspace.news")}</span>
  </Link>;
}
