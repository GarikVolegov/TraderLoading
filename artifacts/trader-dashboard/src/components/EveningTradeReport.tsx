import { useMemo } from "react";
import { Loader2, Sparkles, Target } from "lucide-react";
import {
  getGetJournalEntriesQueryKey,
  getGetMissionsQueryKey,
  getGetTodayCheckinQueryKey,
  useGetJournalEntries,
  useGetMissions,
  useGetTodayCheckin,
} from "@workspace/api-client-react";
import { MOOD_EMOJIS } from "@/lib/zenEmojis";
import { buildTodayReport, type ReportEntry, type TodayReport } from "@/lib/todayReport";
import { uiText } from "@/contexts/LanguageContext";

export type { TodayReport } from "@/lib/todayReport";

/**
 * Report automatico della giornata per il Programma Serale: legge diario,
 * check-in e missioni di oggi e permette di precompilare il bilancio trade.
 */
export function EveningTradeReport({ onApply }: { onApply: (report: TodayReport) => void }) {
  const { data: entries, isLoading: entriesLoading } = useGetJournalEntries({
    query: { queryKey: getGetJournalEntriesQueryKey() },
  });
  const { data: checkin } = useGetTodayCheckin({
    query: { queryKey: getGetTodayCheckinQueryKey() },
  });
  const { data: missions } = useGetMissions({
    query: { queryKey: getGetMissionsQueryKey() },
  });

  const report = useMemo(
    () =>
      buildTodayReport(
        entries as ReportEntry[] | undefined,
        checkin?.mood ?? null,
        missions?.filter((m) => m.completed).length ?? 0,
        missions?.length ?? 0,
      ),
    [entries, checkin, missions],
  );

  if (entriesLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border/30 bg-card/50 px-4 py-4">
        <Loader2 className="h-4 w-4 animate-spin text-primary" aria-label={uiText("auto.ui.6374503707")} />
      </div>
    );
  }

  const hasTrades = report.win + report.loss + report.be > 0;
  const moodLabel = report.mood
    ? MOOD_EMOJIS.find((m) => m.emoji === report.mood)?.label ?? report.mood
    : null;

  return (
    <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-indigo-300" />
        <p className="text-sm font-bold">{uiText("auto.ui.ab6c48a0d9")}</p>
      </div>

      {!hasTrades ? (
        <p className="mt-2 text-xs leading-snug text-muted-foreground">
          Nessun trade registrato oggi nel Diario. Se hai operato, sincronizza il conto o inserisci i numeri qui sotto.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-mono font-bold text-green-400">{report.win}W</span>
            <span className="font-mono font-bold text-red-400">{report.loss}L</span>
            <span className="font-mono font-bold text-muted-foreground">{report.be}BE</span>
            {report.netPnl != null && (
              <span className={`font-mono font-bold ${report.netPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                {report.netPnl >= 0 ? "+" : ""}{report.netPnl.toFixed(2)} {report.currency}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onApply(report)}
            className="mt-3 w-full rounded-lg border border-indigo-400/40 bg-indigo-500/15 px-3 py-2 text-xs font-bold text-indigo-200 transition-colors hover:bg-indigo-500/25"
          >
            Usa questi dati nel bilancio
          </button>
        </>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-indigo-500/15 pt-2 text-[11px] text-muted-foreground">
        {moodLabel && report.mood && (
          <span>Check-in: {report.mood} {moodLabel}</span>
        )}
        {report.missionsTotal > 0 && (
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            Missioni {report.missionsCompleted}/{report.missionsTotal}
          </span>
        )}
      </div>
    </div>
  );
}
