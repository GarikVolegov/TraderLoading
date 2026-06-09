import { useMemo, useState, type ElementType, type SyntheticEvent } from "react";
import { format } from "date-fns";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Loader2,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { JournalEntryModal } from "@/components/JournalEntryModal";
import { useDateLocale } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { parseTradeContent } from "@/lib/parseTradeContent";
import { getGetJournalEntriesQueryKey, useGetJournalEntries } from "@workspace/api-client-react";
import {
  getJournalEntryEffectiveResult,
  getJournalEntryNetPnl,
  getJournalResultMeta,
  getJournalWidgetSummary,
  safeParseJournalDate,
  type JournalResultTone,
  type JournalWidgetEntry,
} from "./JournalWidget.helpers";

const RESULT_TONE_CLASS: Record<JournalResultTone, string> = {
  success: "border-emerald-500/35 bg-emerald-500/12 text-emerald-300",
  danger: "border-red-500/35 bg-red-500/12 text-red-300",
  warning: "border-amber-500/35 bg-amber-500/12 text-amber-300",
  muted: "border-border/45 bg-secondary/45 text-muted-foreground",
};

function stopWidgetPropagation(event: SyntheticEvent) {
  event.stopPropagation();
}

function Metric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: ElementType;
  tone: string;
}) {
  return (
    <div className="rounded-md border border-border/35 bg-secondary/30 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase leading-none text-muted-foreground">
        <Icon className={cn("h-3 w-3", tone)} />
        <span>{label}</span>
      </div>
      <p className={cn("mt-1.5 font-mono text-lg font-black leading-none tabular-nums", tone)}>
        {value}
      </p>
    </div>
  );
}

export function JournalWidget() {
  const [, navigate] = useLocation();
  const dateLocale = useDateLocale();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: entries, isLoading, isError } = useGetJournalEntries({
    query: { queryKey: getGetJournalEntriesQueryKey(), refetchInterval: 10_000 },
  });

  const summary = useMemo(
    () => getJournalWidgetSummary(entries as JournalWidgetEntry[] | undefined),
    [entries],
  );

  const latest = summary.latestEntry;
  const latestDate = safeParseJournalDate(latest?.tradeDate) ?? safeParseJournalDate(latest?.createdAt);
  const latestMeta = getJournalResultMeta(getJournalEntryEffectiveResult(latest));

  const openNewTrade = (event: SyntheticEvent) => {
    event.stopPropagation();
    setIsModalOpen(true);
  };

  const openJournal = (event: SyntheticEvent) => {
    event.stopPropagation();
    navigate("/journal");
  };

  return (
    <>
      <Card className="h-full overflow-hidden border-border/30 bg-card/60 backdrop-blur-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h3 className="truncate text-base font-black leading-tight">Diario Trading</h3>
              </div>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                Riepilogo rapido e inserimento trade
              </p>
            </div>
            <div className="rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-center">
              <p className="font-mono text-lg font-black leading-none text-primary">{summary.todayCount}</p>
              <p className="mt-0.5 text-[0.55rem] font-bold uppercase leading-none text-primary/75">oggi</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[9rem] items-center justify-center rounded-md border border-border/35 bg-secondary/25">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Caricamento diario" />
            </div>
          ) : isError ? (
            <div className="rounded-md border border-border/40 bg-secondary/25 p-4">
              <p className="text-sm font-bold text-foreground">Diario non disponibile</p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                Apri la pagina completa per riprovare.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3 h-9 px-2 text-primary"
                onClick={openJournal}
                onPointerDown={(event) => event.stopPropagation()}
                aria-label="Apri pagina diario"
              >
                Apri diario
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          ) : !latest ? (
            <div className="rounded-md border border-dashed border-border/45 bg-secondary/20 p-4 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/35" />
              <p className="mt-2 text-sm font-bold">Nessun trade registrato</p>
              <p className="mx-auto mt-1 max-w-[14rem] text-xs leading-snug text-muted-foreground">
                Crea il primo trade per iniziare a vedere statistiche e recap.
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className="mb-1.5 text-[0.55rem] font-bold uppercase tracking-wider text-muted-foreground/70">
                  Ultimi 7 giorni
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Metric label="Win" value={summary.weekly.wins} icon={TrendingUp} tone="text-emerald-300" />
                  <Metric label="Loss" value={summary.weekly.losses} icon={TrendingDown} tone="text-red-300" />
                  <Metric label="Rate" value={`${summary.weekly.winRate}%`} icon={BarChart3} tone="text-primary" />
                </div>
              </div>

              <div className="rounded-md border border-border/35 bg-secondary/25 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[0.62rem] font-bold uppercase text-muted-foreground">Ultimo trade</p>
                    <p className="mt-1 truncate text-sm font-black leading-tight">{latest.title}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-md border px-2 py-1 text-[0.62rem] font-bold leading-none",
                      RESULT_TONE_CLASS[latestMeta.tone],
                    )}
                  >
                    {latestMeta.label}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>
                    {latestDate ? format(latestDate, "d MMM yyyy", { locale: dateLocale }) : "Data recente"}
                  </span>
                </div>
                {(() => {
                  const parsed = parseTradeContent(latest.content);
                  if (parsed) {
                    const profit = getJournalEntryNetPnl(latest) ?? 0;
                    const profitTone = profit > 0 ? "text-emerald-300" : profit < 0 ? "text-red-300" : "text-muted-foreground";
                    return (
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <span className={`font-mono text-base font-black ${profitTone}`}>
                          {profit > 0 ? "+" : ""}{profit.toFixed(2)} {parsed.currency ?? ""}
                        </span>
                        {parsed.entryPrice != null && parsed.exitPrice != null && (
                          <span className="font-mono text-muted-foreground/85">
                            {parsed.entryPrice} → {parsed.exitPrice}
                          </span>
                        )}
                      </div>
                    );
                  }
                  return (
                    <p className="mt-2 line-clamp-2 text-xs leading-snug text-muted-foreground/85">
                      {latest.content || "Nessuna nota per questo trade."}
                    </p>
                  );
                })()}
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-2 border-t border-border/35 pt-3">
            <Button
              type="button"
              className="h-10"
              onClick={openNewTrade}
              onPointerDown={(event) => event.stopPropagation()}
              aria-label="Crea nuovo trade dal widget diario"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Nuovo trade
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={openJournal}
              onPointerDown={(event) => event.stopPropagation()}
              aria-label="Apri pagina diario"
            >
              Apri
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div onClick={stopWidgetPropagation} onPointerDown={(event) => event.stopPropagation()}>
        <JournalEntryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          entry={null}
        />
      </div>
    </>
  );
}
