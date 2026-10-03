import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, ChevronRight, Brain } from "lucide-react";
import { useLanguage, uiText } from "@/contexts/LanguageContext";
import { readMoodForDate, saveMoodForDate } from "@/pages/Routine.storage";

type Phase = "inspira" | "trattieni" | "espira" | "riposa";

const PHASE_CONFIG: Record<Phase, { duration: number; color: string; ringColor: string }> = {
  inspira:   { duration: 4, color: "text-emerald-400", ringColor: "stroke-emerald-400" },
  trattieni: { duration: 4, color: "text-sky-400",     ringColor: "stroke-sky-400" },
  espira:    { duration: 4, color: "text-amber-400",   ringColor: "stroke-amber-400" },
  riposa:    { duration: 2, color: "text-slate-400",   ringColor: "stroke-slate-400" },
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

  const scale = phase === "inspira" ? 1 + progress * 0.25
    : phase === "espira" ? 1.25 - progress * 0.25
    : phase === "trattieni" ? 1.25
    : 1;

  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-border/25 bg-card/25 p-4 text-center">
      <p className="font-mono text-sm font-bold">{uiText("routine.zenzone.breathing_title")}</p>
      <div className="relative h-40 w-40">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="none" strokeWidth="3" className="stroke-muted-foreground/15" />
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
            className="flex h-24 w-24 flex-col items-center justify-center rounded-full border border-border/50 bg-gradient-to-br from-card to-card/60 shadow-lg"
          >
            <span className={`text-sm font-bold ${config.color} transition-colors duration-500`}>
              {t(`zen.breathing.${phase}`)}
            </span>
            {isActive && (
              <span className="mt-0.5 font-mono text-2xl font-bold text-foreground">{remaining}</span>
            )}
          </motion.div>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        {PHASES.map((p, i) => (
          <div key={p} className="flex items-center gap-1.5">
            <div
              className={`h-2 w-2 rounded-full transition-all duration-300 ${
                p === phase ? `${PHASE_CONFIG[p].ringColor.replace("stroke-", "bg-")} scale-125` : "bg-muted-foreground/20"
              }`}
            />
            {i < PHASES.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/30" />}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("zen.breathing.cycles")} <span className="font-semibold text-foreground">{count}</span>
      </p>
      <div className="flex gap-3">
        <Button onClick={() => setIsActive(!isActive)} size="sm" className="min-w-27.5 gap-2">
          {isActive ? <><Pause className="h-4 w-4" /> {uiText("common.pause")}</> : <><Play className="h-4 w-4" /> {uiText("routine.zenzone.breathing_start")}</>}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setIsActive(false); setPhase("inspira"); setCount(0); setElapsed(0); }}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" /> {uiText("common.reset")}
        </Button>
      </div>
    </div>
  );
}

// Stable ids go to storage; labels are display-only and localized inside the
// component (built once per render, not at module scope — uiText() only
// reflects the active language at the moment it's called).
const MOOD_META: { id: string; emoji: string; labelKey: string }[] = [
  { id: "tense", emoji: "😣", labelKey: "mood.tense" },
  { id: "neutral", emoji: "😐", labelKey: "mood.neutral" },
  { id: "calm", emoji: "🙂", labelKey: "mood.calm" },
  { id: "charged", emoji: "😄", labelKey: "mood.charged" },
  { id: "tired", emoji: "😴", labelKey: "mood.tired" },
];

function MoodCheckIn() {
  // Persisted per-day: reopening the page shows today's check-in instead of
  // silently forgetting it (the "recorded" copy must be truthful).
  const [mood, setMood] = useState<string | null>(() => readMoodForDate(new Date()));
  const MOODS = MOOD_META.map((m) => ({ ...m, label: uiText(m.labelKey) }));

  const selectMood = (id: string) => {
    setMood(id);
    saveMoodForDate(id, new Date());
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/25 bg-card/25 p-4">
      <div>
        <p className="font-mono text-sm font-bold">{uiText("routine.zenzone.mood_title")}</p>
        <p className="mt-1 text-xs text-muted-foreground/60">{uiText("routine.zenzone.mood_subtitle")}</p>
      </div>
      <div className="grid flex-1 grid-cols-5 gap-2">
        {MOODS.map(({ id, emoji, label }) => {
          const active = mood === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectMood(id)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors ${
                active ? "border-primary/45 bg-primary/15" : "border-border/25 bg-background/25"
              }`}
            >
              <span className="text-2xl">{emoji}</span>
              <span className={`text-[11px] font-bold ${active ? "text-foreground" : "text-muted-foreground/60"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground/50">
        {mood ? (
          <>
            {uiText("routine.zenzone.mood_recorded")}{" "}
            <strong className="text-foreground">
              {MOODS.find((item) => item.id === mood)?.label ?? mood}
            </strong>
          </>
        ) : (
          uiText("routine.zenzone.mood_hint")
        )}
      </p>
    </div>
  );
}

export function ZenZone() {
  return (
    <Card className="border-indigo-400/20 bg-card/35">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <p className="font-mono text-base font-bold">{uiText("zen.title")}</p>
            <p className="text-xs text-muted-foreground/60">{uiText("zen.subtitle")}</p>
          </div>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
          {uiText("common.interactive")}
        </span>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <BreathingExercise />
          <MoodCheckIn />
        </div>
      </CardContent>
    </Card>
  );
}
