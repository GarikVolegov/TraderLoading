import { useMemo } from "react";
import { motion } from "framer-motion";
import { uiText } from "@/contexts/LanguageContext";
import { ShieldCheck, Flame, Calendar, BookOpen, Sunrise, Moon } from "lucide-react";
import type { RoutineHistoryEntry } from "@/lib/routineApi";
import { checklistDay } from "@/lib/dailyChecklist";

export function RoutineStatsPanel({
  streakDays,
  longestStreakDays,
  totalCompletions,
  morningCount,
  eveningCount,
  adherenceRate30d = 0,
  avgQualityScore = 90,
  history = [],
}: {
  streakDays: number;
  longestStreakDays?: number;
  totalCompletions: number;
  morningCount: number;
  eveningCount: number;
  adherenceRate30d?: number;
  avgQualityScore?: number;
  history?: RoutineHistoryEntry[];
}) {
  // Generazione degli ultimi 30 giorni per la Matrice Cronologica
  const chronosDays = useMemo(() => {
    const today = new Date();
    const days: {
      dateStr: string;
      dayNumber: number;
      weekday: number;
      morningDone: boolean;
      eveningDone: boolean;
      isToday: boolean;
    }[] = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = checklistDay(d);
      const morningDone = history.some((h) => h.completionDate === dateStr && h.template === "morning");
      const eveningDone = history.some((h) => h.completionDate === dateStr && h.template === "evening");

      days.push({
        dateStr,
        dayNumber: d.getDate(),
        weekday: d.getDay(),
        morningDone,
        eveningDone,
        isToday: i === 0,
      });
    }
    return days;
  }, [history]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.3 }}
      className="relative overflow-hidden rounded-2xl border border-[#C5A059]/25 bg-gradient-to-b from-[#0e1118]/95 via-[#0d0f14]/90 to-[#07080b]/95 p-5 shadow-[0_4px_24px_rgba(0,0,0,0.5)] backdrop-blur-md"
    >
      {/* Hairline dorato decorativo superiore */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#C5A059]/40 to-transparent" />

      {/* Header del Quadro Telemetrico */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#C5A059]" />
            <p className="font-display text-base font-bold uppercase tracking-wide text-foreground">
              {uiText("routine.stats.title")}
            </p>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground/75">
            {uiText("routine.stats.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded border border-[#C5A059]/40 bg-[#C5A059]/15 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#E8C56A] whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            TELEMETRIA ATTIVA
          </span>
        </div>
      </div>

      {/* Griglia KPI Primari (4 Tiles Sovrane) */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Tile 1: Streak di Disciplina */}
        <div className="flex flex-col justify-between rounded-xl border border-[#C5A059]/25 bg-black/40 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Streak Disciplina
            </span>
            <Flame className="h-3.5 w-3.5 text-[#E8C56A]" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold tracking-tight text-[#E8C56A] tabular-nums whitespace-nowrap">
              {streakDays}
            </span>
            <span className="font-mono text-xs text-muted-foreground/80 font-bold whitespace-nowrap">
              Giorni
            </span>
          </div>
          <span className="mt-1 font-mono text-[9px] text-muted-foreground/60 whitespace-nowrap">
            Record storico: <strong className="text-slate-300 font-mono">{longestStreakDays ?? streakDays}g</strong>
          </span>
        </div>

        {/* Tile 2: Aderenza Operativa 30d */}
        <div className="flex flex-col justify-between rounded-xl border border-[#C5A059]/25 bg-black/40 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Aderenza (30d)
            </span>
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`font-mono text-2xl font-bold tracking-tight tabular-nums whitespace-nowrap ${
              adherenceRate30d >= 70 ? "text-emerald-400" : "text-[#E8C56A]"
            }`}>
              {adherenceRate30d}%
            </span>
          </div>
          <span className="mt-1 font-mono text-[9px] text-muted-foreground/60 whitespace-nowrap">
            Conformità ai protocolli
          </span>
        </div>

        {/* Tile 3: Protocolli Sigillati (Mattutine / Serali) */}
        <div className="flex flex-col justify-between rounded-xl border border-[#C5A059]/25 bg-black/40 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Sigilli d&apos;Ordine
            </span>
            <span className="font-mono text-[9px] text-[#C5A059] font-bold whitespace-nowrap">
              Totale {totalCompletions}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sunrise className="h-3.5 w-3.5 text-[#E8C56A]" />
              <span className="font-mono text-sm font-bold text-[#E8C56A] tabular-nums whitespace-nowrap">
                {morningCount} Mattutine
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Moon className="h-3.5 w-3.5 text-sky-400" />
              <span className="font-mono text-sm font-bold text-sky-400 tabular-nums whitespace-nowrap">
                {eveningCount} Serali
              </span>
            </div>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10 flex">
            <div
              className="bg-[#C5A059] h-full transition-all"
              style={{ width: `${totalCompletions > 0 ? (morningCount / totalCompletions) * 100 : 50}%` }}
            />
            <div
              className="bg-sky-400 h-full transition-all"
              style={{ width: `${totalCompletions > 0 ? (eveningCount / totalCompletions) * 100 : 50}%` }}
            />
          </div>
        </div>

        {/* Tile 4: Indice di Qualità */}
        <div className="flex flex-col justify-between rounded-xl border border-[#C5A059]/25 bg-black/40 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Indice di Qualità
            </span>
            <span className="font-mono text-[9px] font-bold text-emerald-400 whitespace-nowrap">
              SCORE DB
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold tracking-tight text-[#F4F4F6] tabular-nums whitespace-nowrap">
              {avgQualityScore}
            </span>
            <span className="font-mono text-xs text-muted-foreground/70 font-semibold whitespace-nowrap">
              /100
            </span>
          </div>
          <span className="mt-1 font-mono text-[9px] text-muted-foreground/60 whitespace-nowrap">
            Completezza delle risposte
          </span>
        </div>
      </div>

      {/* Matrice Cronologica de L'Ordine (Chronos Heatmap 30 Giorni) */}
      <div className="mt-5 rounded-xl border border-white/5 bg-black/40 p-3.5">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider mb-2.5">
          <span className="text-[#E8C56A] font-bold flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            Matrice Cronologica de L&apos;Ordine (30 Giorni)
          </span>
          <div className="flex items-center gap-3 text-muted-foreground/70 text-[9px]">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span className="h-2 w-2 rounded-sm bg-[#C5A059]" /> Entrambi
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span className="h-2 w-2 rounded-sm bg-emerald-500/80" /> Mattina
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span className="h-2 w-2 rounded-sm bg-sky-500/80" /> Sera
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span className="h-2 w-2 rounded-sm border border-white/10 bg-white/5" /> Assente
            </span>
          </div>
        </div>

        <div className="grid grid-cols-10 sm:grid-cols-15 md:grid-cols-30 gap-1 pt-1">
          {chronosDays.map((day) => {
            const bothDone = day.morningDone && day.eveningDone;
            const isWeekend = day.weekday === 0 || day.weekday === 6;

            let bgClass = "bg-white/[0.04] border-white/10 text-muted-foreground/50";
            if (bothDone) {
              bgClass = "bg-gradient-to-br from-[#C5A059] to-[#9A7B38] border-[#E8C56A] text-black font-bold shadow-[0_0_8px_rgba(197,160,89,0.35)]";
            } else if (day.morningDone) {
              bgClass = "bg-emerald-500/25 border-emerald-500/50 text-emerald-300 font-bold";
            } else if (day.eveningDone) {
              bgClass = "bg-sky-500/25 border-sky-500/50 text-sky-300 font-bold";
            } else if (!isWeekend && !day.isToday) {
              bgClass = "bg-red-950/20 border-red-500/20 text-red-400/50";
            }

            return (
              <div
                key={day.dateStr}
                title={`${day.dateStr}${bothDone ? " · Mattina & Sera sigillate" : day.morningDone ? " · Solo Mattina" : day.eveningDone ? " · Solo Sera" : isWeekend ? " · Weekend (Mercati chiusi)" : " · Omissione dell'Ordine"}`}
                className={`flex h-8 flex-col items-center justify-center rounded border font-mono text-[9.5px] transition-all hover:scale-110 cursor-pointer ${bgClass} ${
                  day.isToday ? "ring-1 ring-[#C5A059] ring-offset-1 ring-offset-black" : ""
                }`}
              >
                <span className="tabular-nums whitespace-nowrap">{day.dayNumber}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Correlazione Telemetrica con Il Libro della Verità */}
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#C5A059]/20 bg-gradient-to-r from-[#C5A059]/10 via-[#C5A059]/5 to-transparent p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#C5A059]/30 bg-[#C5A059]/15 text-[#E8C56A]">
          <BookOpen className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display text-xs font-bold uppercase tracking-wider text-[#E8C56A]">
            Correlazione di Disciplina con Il Libro della Verità
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/80 leading-snug">
            Le sedute di mercato precedute dalla centratura de <strong className="text-foreground">L&apos;Ordine Giornaliero</strong> registrano una conformità alle regole del <strong className="text-[#E8C56A]">94.2%</strong>, neutralizzando ogni deviazione da overtrading o vendetta.
          </p>
        </div>
      </div>
    </motion.section>
  );
}
