import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/QueryErrorState";
import { fetchMarketDecisions, marketDecisionsKey, decisionJournalHref } from "@/lib/marketIntelligenceApi";

/** Market outcomes are independent of the trader's entry, exit and net P&L. */
export function MarketDecisionReview({ ownerKey = "guest" }: { ownerKey?: string }) {
  const { t, language } = useLanguage();
  const query = useInfiniteQuery({ queryKey: [...marketDecisionsKey, ownerKey], queryFn: ({ pageParam }) => fetchMarketDecisions(pageParam), initialPageParam: undefined as string | undefined, getNextPageParam: page => page.nextCursor ?? undefined });
  const items = query.data?.pages.flatMap(page => page.items) ?? [];
  const resolved = items.filter(item => item.outcome).length;
  const time = (stamp: string) => new Intl.DateTimeFormat(language, { timeZone: "Europe/Rome", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(stamp));
  const number = (value: number) => new Intl.NumberFormat(language, { maximumFractionDigits: 5 }).format(value);
  return <section className="space-y-4" aria-label={t("intelligence.review")}>
    <div className="rounded-xl border border-border bg-card p-4"><h2 className="font-sans text-lg font-semibold">{t("intelligence.review")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("intelligence.review_hint")}</p>{items.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{t("intelligence.review_counts", { total: items.length, resolved, pending: items.length - resolved })}</p>}</div>
    {query.isPending && <p role="status" className="text-sm text-muted-foreground">{t("intelligence.loading")}</p>}
    {query.isError && <QueryErrorState onRetry={() => void query.refetch()} />}
    {!query.isPending && !query.isError && items.length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">{t("intelligence.no_decisions")} <Link href="/?vista=mercati&horizon=4h" className="text-primary underline">{t("workspace.markets")}</Link></p>}
    <ol className="space-y-3">{items.map(item => { const outlook = item.snapshot.outlook; const p = outlook?.status === "available" && outlook.validation?.passed ? outlook.probabilities : null; return <li key={item.id} className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-sans font-semibold">{item.snapshot.pair} / 4h</h3><span className="text-xs text-muted-foreground">{time(item.createdAt)} · {t("intelligence.timezone")}</span></div>
      <p className="mt-2 text-sm font-medium">{t(item.choice === "trade" ? "intelligence.choice_trade" : "intelligence.choice_wait")}</p>
      <p className="mt-2 text-sm">{t("intelligence.market_outcome")} <strong>{t(item.outcome ? `intelligence.${item.outcome.outcome}` : "intelligence.awaiting_outcome")}</strong></p>
      {item.outcome && <p className="mt-1 text-xs text-muted-foreground">{t("intelligence.final_price")} {number(item.outcome.finalPrice)} · {time(item.outcome.observedAt)}</p>}
      <details className="mt-3 text-sm"><summary className="min-h-10 cursor-pointer py-2 font-semibold">{t("intelligence.saved_context")}</summary><div className="space-y-2 border-t border-border pt-3 text-muted-foreground">
        <p>{t("intelligence.context_index")} {item.snapshot.score ?? "—"} · {t("center.coverage")} {item.snapshot.coverage}/100</p>
        {outlook && <><p>{t("intelligence.cutoff")} {time(outlook.cutoffAt)} · {t("intelligence.target")} {time(outlook.targetEnd)}</p><p className="break-all">{t("intelligence.model")} {outlook.modelVersion ?? "—"}</p></>}
        {p ? <p>{t("intelligence.recorded_probabilities")} {t("intelligence.up")} {Math.round(p.up * 100)}% · {t("intelligence.flat")} {Math.round(p.flat * 100)}% · {t("intelligence.down")} {Math.round(p.down * 100)}%</p> : <p>{t("intelligence.no_probability")}</p>}
        {item.snapshot.news.map(news => <a key={news.url} className="block py-1 text-primary underline" href={news.url} target="_blank" rel="noopener noreferrer">{news.title}</a>)}
        {item.note && <p className="whitespace-pre-wrap">{item.note}</p>}
      </div></details>
      {item.choice === "trade" && !item.journalEntryId && <Link href={decisionJournalHref(item)} className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-primary">{t("intelligence.open_journal")}</Link>}
      {item.journalEntryId && <p className="mt-3 text-xs text-muted-foreground">{t("intelligence.journal_linked", { id: item.journalEntryId })}</p>}
    </li>; })}</ol>
    {query.hasNextPage && <Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{t("intelligence.load_more")}</Button>}
  </section>;
}
