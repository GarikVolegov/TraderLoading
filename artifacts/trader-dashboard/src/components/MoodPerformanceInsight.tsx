import { useMemo } from "react";
import { BrainCircuit, Info, Loader2 } from "lucide-react";
import {
  getGetCheckinsQueryKey,
  getGetJournalEntriesQueryKey,
  useGetCheckins,
  useGetJournalEntries,
} from "@workspace/api-client-react";
import { MOOD_EMOJIS } from "@/lib/zenEmojis";
import {
  computeMoodPerformance,
  MIN_TRADES_FOR_SIGNAL,
  type MoodCheckinInput,
  type MoodEntryInput,
} from "@/lib/moodPerformance";

function moodLabel(emoji: string): string {
  return MOOD_EMOJIS.find((m) => m.emoji === emoji)?.label ?? emoji;
}

export function MoodPerformanceInsight() {
  const { data: checkins, isLoading: checkinsLoading } = useGetCheckins({
    query: { queryKey: getGetCheckinsQueryKey() },
  });
  const { data: entries, isLoading: entriesLoading } = useGetJournalEntries({
    query: { queryKey: getGetJournalEntriesQueryKey() },
  });

  const stats = useMemo(
    () =>
      computeMoodPerformance(
        checkins as MoodCheckinInput[] | undefined,
        entries as MoodEntryInput[] | undefined,
      ),
    [checkins, entries],
  );

  const isLoading = checkinsLoading || entriesLoading;
  const significant = stats.filter((s) => !s.lowSample && s.winRate != null);
  const best = significant.length > 1 ? significant.reduce((a, b) => (b.winRate! > a.winRate! ? b : a)) : null;
  const worst = significant.length > 1 ? significant.reduce((a, b) => (b.winRate! < a.winRate! ? b : a)) : null;

  return (
    <div className="rounded-2xl border border-border/30 bg-card/60 p-5 backdrop-blur-sm">
      <div className="mb-1 flex items-center gap-2">
        <BrainCircuit className="h-4 w-4 text-primary" />
        <h3 className="text-base font-bold">Umore & Performance</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Win rate dei tuoi trade in base allo stato d'animo dichiarato al check-in di inizio sessione.
      </p>

      {isLoading ? (
        <div className="flex min-h-[8rem] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Caricamento insight" />
        </div>
      ) : stats.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/45 bg-secondary/20 p-6 text-center">
          <p className="text-sm font-bold">Ancora nessun dato</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-snug text-muted-foreground">
            Compila il check-in a inizio sessione e registra i trade nel Diario: qui vedrai come il tuo
            stato d'animo influenza i risultati.
          </p>
        </div>
      ) : (
        <>
          {best && worst && best.mood !== worst.mood && (
            <div className="mb-4 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm leading-snug">
              Quando parti <span className="font-bold">{best.mood} {moodLabel(best.mood)}</span> il tuo win
              rate è <span className="font-mono font-bold text-emerald-300">{best.winRate}%</span>, quando
              parti <span className="font-bold">{worst.mood} {moodLabel(worst.mood)}</span> scende a{" "}
              <span className="font-mono font-bold text-red-300">{worst.winRate}%</span>.
            </div>
          )}

          <div className="space-y-2">
            {stats.map((s) => (
              <div
                key={s.mood}
                className="flex items-center gap-3 rounded-xl border border-border/35 bg-secondary/20 px-3 py-2.5"
              >
                <span className="text-2xl">{s.mood}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{moodLabel(s.mood)}</p>
                    <p className="shrink-0 text-[11px] text-muted-foreground">
                      {s.days} giorn{s.days === 1 ? "o" : "i"} · {s.trades} trade
                    </p>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/60">
                      {s.winRate != null && (
                        <div
                          className={`h-full rounded-full ${s.winRate >= 50 ? "bg-emerald-400/80" : "bg-red-400/80"}`}
                          style={{ width: `${s.winRate}%` }}
                        />
                      )}
                    </div>
                    <span className={`w-12 shrink-0 text-right font-mono text-xs font-bold ${
                      s.winRate == null ? "text-muted-foreground" : s.winRate >= 50 ? "text-emerald-300" : "text-red-300"
                    }`}>
                      {s.winRate != null ? `${s.winRate}%` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {stats.some((s) => s.lowSample) && (
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground/80">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Le percentuali diventano indicative con almeno {MIN_TRADES_FOR_SIGNAL} trade decisi (win/loss)
              per stato d'animo: continua a fare check-in per affinare l'analisi.
            </p>
          )}
        </>
      )}
    </div>
  );
}
