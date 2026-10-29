import { useRoutineStorage } from "@/hooks/useRoutineStorage";
import { useState, useEffect, useRef, useCallback, type ElementType } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Play, Pause, RotateCcw, ChevronRight, Compass, Flame, ShieldCheck, Crosshair, Zap, Moon } from "lucide-react";
import { useLanguage, uiText } from "@/contexts/LanguageContext";
import { readMoodForDate, saveMoodForDate } from "@/pages/Routine.storage";

type Phase = "inspira" | "trattieni" | "espira" | "riposa";

const PHASE_CONFIG: Record<Phase, { duration: number; color: string; ringColor: string; label: string }> = {
  inspira:   { duration: 4, color: "text-emerald-400", ringColor: "stroke-emerald-400", label: "Inspira (4s)" },
  trattieni: { duration: 4, color: "text-[#E8C56A]",     ringColor: "stroke-[#C5A059]",   label: "Trattieni (4s)" },
  espira:    { duration: 4, color: "text-amber-400",   ringColor: "stroke-amber-400",   label: "Espira (4s)" },
  riposa:    { duration: 4, color: "text-slate-400",   ringColor: "stroke-slate-400",   label: "Stasi (4s)" },
};

const PHASES: Phase[] = ["inspira", "trattieni", "espira", "riposa"];
const CIRCUMFERENCE = 2 * Math.PI * 46;

function BreathingExercise() {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<Phase>("inspira");
  const [isActive, setIsActive] = useState(false);
  const [count, setCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;

  const tick = useCallback(() => {
    const now = performance.now();
    const dt = (now - startTimeRef.current) / 1000;
    const dur = PHASE_CONFIG[phaseRef.current].duration;

    if (dt >= dur) {
      const idx = PHASES.indexOf(phaseRef.current);
      const nextIdx = (idx + 1) % PHASES.length;
      if (nextIdx === 0) setCount((c) => c + 1);
      setPhase(PHASES[nextIdx]);
      setElapsed(0);
      startTimeRef.current = now;
    } else {
      setElapsed(dt);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (isActive) {
      startTimeRef.current = performance.now();
      setElapsed(0);
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isActive, tick]);

  const config = PHASE_CONFIG[phase];
  const progress = elapsed / config.duration;
  const remaining = Math.ceil(config.duration - elapsed);
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  const scale = phase === "inspira" ? 1 + progress * 0.22
    : phase === "espira" ? 1.22 - progress * 0.22
    : phase === "trattieni" ? 1.22
    : 1;

  return (
    <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-[#C5A059]/20 bg-black/40 p-5 text-center">
      <div className="flex items-center justify-between w-full">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-[#E8C56A]">
          {uiText("routine.zenzone.breathing_title")}
        </p>
        <span className="font-mono text-[9px] uppercase font-bold text-muted-foreground/75 px-1.5 py-0.5 rounded border border-white/10 bg-white/5 whitespace-nowrap">
          Box 4-4-4-4
        </span>
      </div>

      <div className="relative h-44 w-44 my-2">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="none" strokeWidth="2.5" className="stroke-white/10" />
          <circle
            cx="50" cy="50" r="46"
            fill="none"
            strokeWidth="3.5"
            strokeLinecap="round"
            className={`${config.ringColor} transition-[stroke] duration-500`}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={isActive ? dashOffset : CIRCUMFERENCE}
            style={{ transition: "stroke-dashoffset 100ms linear, stroke 500ms" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ scale }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex h-28 w-28 flex-col items-center justify-center rounded-full border border-[#C5A059]/35 bg-gradient-to-b from-[#11131c] to-[#07080b] shadow-[0_0_20px_rgba(0,0,0,0.8)]"
          >
            <span className={`font-mono text-xs font-bold uppercase tracking-wider ${config.color} transition-colors duration-500`}>
              {t(`zen.breathing.${phase}`)}
            </span>
            {isActive ? (
              <span className="mt-1 font-mono text-3xl font-bold tabular-nums tracking-tight text-[#F4F4F6]">
                {remaining}
              </span>
            ) : (
              <span className="mt-1 font-mono text-[10px] uppercase font-semibold text-muted-foreground/60">
                Pronto
              </span>
            )}
          </motion.div>
        </div>
      </div>

      {/* Indicatori fasi sequenza */}
      <div className="flex items-center gap-2">
        {PHASES.map((p, i) => (
          <div key={p} className="flex items-center gap-1.5">
            <div
              className={`h-2 w-2 rounded-full transition-all duration-300 ${
                p === phase ? `${PHASE_CONFIG[p].ringColor.replace("stroke-", "bg-")} scale-125 shadow-[0_0_8px_currentColor]` : "bg-white/15"
              }`}
            />
            {i < PHASES.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/30" />}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between w-full pt-1 border-t border-white/5 font-mono text-xs">
        <span className="text-muted-foreground/75">
          {t("zen.breathing.cycles")}
        </span>
        <span className="font-bold text-[#E8C56A] tabular-nums whitespace-nowrap">
          {count} Cicli
        </span>
      </div>

      <div className="flex gap-2.5 w-full">
        <button
          type="button"
          onClick={() => setIsActive(!isActive)}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 font-display text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
            isActive
              ? "border border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
              : "border border-[#C5A059]/60 bg-gradient-to-r from-[#C5A059] to-[#9A7B38] text-black shadow-[0_0_14px_rgba(197,160,89,0.2)] hover:brightness-110"
          }`}
        >
          {isActive ? <><Pause className="h-3.5 w-3.5" /> {uiText("common.pause")}</> : <><Play className="h-3.5 w-3.5" /> {uiText("routine.zenzone.breathing_start")}</>}
        </button>
        <button
          type="button"
          onClick={() => { setIsActive(false); setPhase("inspira"); setCount(0); setElapsed(0); }}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-muted-foreground transition-colors hover:border-[#C5A059]/30 hover:text-[#E8C56A] cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="h-3.5 w-3.5" /> {uiText("common.reset")}
        </button>
      </div>
    </div>
  );
}

// Stable ids go to storage; labels are display-only and localized inside the
// component (built once per render, not at module scope — uiText() only
// reflects the active language at the moment it's called).
const MOOD_META: { id: string; labelKey: string; icon: ElementType; color: string; desc: string }[] = [
  { id: "tense", labelKey: "mood.tense", icon: Flame, color: "#ef4444", desc: "Tensione elevata. Riduci risk size all'1% ed evita ingressi anticipati." },
  { id: "neutral", labelKey: "mood.neutral", icon: ShieldCheck, color: "#94a3b8", desc: "Equilibrio operativo ottimale. Nessun attaccamento o foga emotiva." },
  { id: "calm", labelKey: "mood.calm", icon: Crosshair, color: "#10b981", desc: "Calma lucida. Attendi esclusivamente il Sigillo d'Azione." },
  { id: "charged", labelKey: "mood.charged", icon: Zap, color: "#E8C56A", desc: "Focus sovrano. Incanala la presenza nell'osservanza del piano." },
  { id: "tired", labelKey: "mood.tired", icon: Moon, color: "#64748b", desc: "Affaticamento cognitivo. Sospendi o limita la durata della sessione." },
];

function MoodCheckIn() {
  const storage = useRoutineStorage();
  const [mood, setMood] = useState<string | null>(() => readMoodForDate(new Date(), storage));
  useEffect(() => { setMood(readMoodForDate(new Date(), storage)); }, [storage]);
  const MOODS = MOOD_META.map((m) => ({ ...m, label: uiText(m.labelKey) }));

  const selectMood = (id: string) => {
    setMood(id);
    saveMoodForDate(id, new Date(), storage);
  };

  const selectedItem = MOODS.find((item) => item.id === mood);

  return (
    <div className="flex flex-col justify-between gap-4 rounded-xl border border-[#C5A059]/20 bg-black/40 p-5">
      <div>
        <div className="flex items-center justify-between w-full">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-[#E8C56A]">
            {uiText("routine.zenzone.mood_title")}
          </p>
          <span className="font-mono text-[9px] uppercase font-bold text-muted-foreground/75 px-1.5 py-0.5 rounded border border-white/10 bg-white/5 whitespace-nowrap">
            Stato Biometrico
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground/75 leading-relaxed">
          {uiText("routine.zenzone.mood_subtitle")}
        </p>
      </div>

      {/* Griglia 5 stati stoici con Lucide Icons (Zero emoji) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 my-2">
        {MOODS.map(({ id, icon: MoodIcon, color, label }) => {
          const active = mood === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectMood(id)}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-2.5 transition-all cursor-pointer ${
                active
                  ? "border-[#C5A059]/60 bg-[#C5A059]/15 shadow-[0_0_12px_rgba(197,160,89,0.2)]"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
              }`}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg border"
                style={{
                  backgroundColor: `${color}18`,
                  borderColor: `${color}40`,
                  color,
                }}
              >
                <MoodIcon className="h-4 w-4" />
              </div>
              <span className={`font-mono text-[10px] font-bold uppercase tracking-wider text-center leading-tight whitespace-nowrap ${
                active ? "text-[#E8C56A]" : "text-muted-foreground/80"
              }`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Advice stoico contestuale allo stato selezionato */}
      <div className="rounded-lg border border-white/5 bg-black/30 p-2.5 min-h-[46px] flex items-center">
        {selectedItem ? (
          <div className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: selectedItem.color }} />
            <p className="font-mono text-[11px] text-slate-300/90 leading-tight">
              <strong className="text-foreground uppercase mr-1">{selectedItem.label}:</strong>
              {selectedItem.desc}
            </p>
          </div>
        ) : (
          <p className="font-mono text-[10.5px] text-muted-foreground/60 italic leading-tight">
            {uiText("routine.zenzone.mood_hint")}
          </p>
        )}
      </div>

      {/* Footer di conferma registrazione */}
      <div className="flex items-center justify-between border-t border-white/5 pt-2.5 font-mono text-[11px]">
        <span className="text-muted-foreground/65">
          {uiText("routine.zenzone.mood_recorded")}
        </span>
        <span className="font-bold text-[#E8C56A] uppercase tracking-wider whitespace-nowrap">
          {selectedItem ? selectedItem.label : "In attesa"}
        </span>
      </div>
    </div>
  );
}

export function ZenZone() {
  return (
    <Card className="relative overflow-hidden rounded-2xl border border-[#C5A059]/25 bg-gradient-to-b from-[#0e1118]/95 via-[#0d0f14]/90 to-[#07080b]/95 shadow-[0_4px_24px_rgba(0,0,0,0.5)] backdrop-blur-md">
      {/* Hairline dorato superiore */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#C5A059]/40 to-transparent" />

      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#E8C56A] shadow-[0_0_12px_rgba(197,160,89,0.15)]">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-base font-bold uppercase tracking-wide text-foreground">
              {uiText("zen.title")}
            </p>
            <p className="text-xs text-muted-foreground/75">
              {uiText("zen.subtitle")}
            </p>
          </div>
        </div>
        <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-[#C5A059]/35 bg-[#C5A059]/15 text-[#E8C56A] whitespace-nowrap">
          CALIBRAZIONE ATTIVA
        </span>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BreathingExercise />
          <MoodCheckIn />
        </div>
      </CardContent>
    </Card>
  );
}
