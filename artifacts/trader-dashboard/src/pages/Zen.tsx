import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Wind, Eye, BookOpen, Heart, Clock, Play, Pause, RotateCcw, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

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
      if (nextIdx === 0) setCount(c => c + 1);
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
    <Card className="bg-card/60 backdrop-blur-sm border-border/30">
      <CardContent className="flex flex-col items-center gap-6 py-8 sm:py-12 px-4">
        <div className="relative w-44 h-44 sm:w-56 sm:h-56">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
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
              className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-card to-card/60 border border-border/50 flex flex-col items-center justify-center shadow-lg"
            >
              <span className={`text-base sm:text-lg font-bold ${config.color} transition-colors duration-500`}>
                {t(`zen.breathing.${phase}` as any)}
              </span>
              {isActive && (
                <span className="text-2xl sm:text-3xl font-mono font-bold text-foreground mt-0.5">
                  {remaining}
                </span>
              )}
            </motion.div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {PHASES.map((p, i) => (
            <div key={p} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
                p === phase ? `${PHASE_CONFIG[p].ringColor.replace("stroke-", "bg-")} scale-125` : "bg-muted-foreground/20"
              }`} />
              {i < PHASES.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/30" />}
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          {t("zen.breathing.cycles")} <span className="font-semibold text-foreground">{count}</span>
        </p>

        <div className="flex gap-3">
          <Button onClick={() => setIsActive(!isActive)} className="gap-2 min-w-[120px]">
            {isActive
              ? <><Pause className="w-4 h-4" /> {t("common.pause")}</>
              : <><Play className="w-4 h-4" /> {t("common.start")}</>}
          </Button>
          <Button
            variant="outline"
            onClick={() => { setIsActive(false); setPhase("inspira"); setCount(0); setElapsed(0); }}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" /> {t("common.reset")}
          </Button>
        </div>

        <p className="text-[10px] sm:text-xs text-muted-foreground/60 text-center max-w-xs">
          {t("zen.breathing.hint")}
        </p>
      </CardContent>
    </Card>
  );
}

function ResultVisualization() {
  const { t } = useLanguage();
  const [goal, setGoal] = useState("");

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30">
      <CardContent className="space-y-4 sm:space-y-6 py-6 sm:py-8 px-4 sm:px-6">
        <div className="flex items-center gap-2 mb-2">
          <Eye className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold">{t("zen.visualization.title")}</h3>
        </div>

        <div>
          <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-2">
            {t("zen.visualization.label")}
          </label>
          <Textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={t("zen.visualization.placeholder")}
            className="h-24 sm:h-32 resize-none text-sm"
          />
        </div>

        {goal && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 sm:p-6 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 space-y-3 sm:space-y-4"
          >
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t("zen.visualization.hint_1")}
            </p>
            <motion.p
              className="text-sm sm:text-lg font-semibold text-foreground italic"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              {goal}
            </motion.p>
            <p className="text-[10px] sm:text-xs text-muted-foreground/60">
              {t("zen.visualization.hint_2")}
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

function MotivationalQuotes() {
  const { t } = useLanguage();
  const quotes = [
    { text: "La disciplina è scegliere tra ciò che vuoi adesso e ciò che vuoi di più.", author: "Abraham Lincoln" },
    { text: "Il trading non è una maratona, è una serie di sprint disciplinati.", author: "Saggezza del mercato" },
    { text: "La paura e l'avidità sono i nemici del trader consapevole.", author: "Saggio del trading" },
    { text: "Ogni perdita è una lezione, non una sconfitta.", author: "Mentalità vincente" },
    { text: "Il successo arriva a chi controlla le emozioni, non a chi segue le emozioni.", author: "Psicologia del trading" },
    { text: "Pianifica il tuo trade, quindi trada il tuo piano.", author: "Mark Douglas" },
  ];

  const [current, setCurrent] = useState(0);

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30">
      <CardContent className="flex flex-col items-center justify-center py-8 sm:py-14 px-4 space-y-6 sm:space-y-8">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold">{t("zen.quotes.title")}</h3>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center space-y-3 sm:space-y-4"
          >
            <p className="text-base sm:text-xl font-semibold text-foreground italic max-w-md leading-relaxed">
              &ldquo;{quotes[current].text}&rdquo;
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">&mdash; {quotes[current].author}</p>
          </motion.div>
        </AnimatePresence>

        <Button variant="outline" onClick={() => setCurrent((current + 1) % quotes.length)} size="sm">
          {t("zen.quotes.next")}
        </Button>

        <p className="text-[10px] sm:text-xs text-muted-foreground/60">
          {current + 1} / {quotes.length}
        </p>
      </CardContent>
    </Card>
  );
}

function Gratitude() {
  const { t } = useLanguage();
  const [gratitudes, setGratitudes] = useState<string[]>([]);
  const [input, setInput] = useState("");

  const addGratitude = () => {
    if (input.trim()) {
      setGratitudes([...gratitudes, input.trim()]);
      setInput("");
    }
  };

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30">
      <CardContent className="space-y-4 py-6 sm:py-8 px-4 sm:px-6">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold">{t("zen.gratitude.title")}</h3>
        </div>

        <p className="text-xs sm:text-sm text-muted-foreground">
          {t("zen.gratitude.label")}
        </p>

        <div className="flex gap-2">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGratitude()}
            placeholder={t("zen.gratitude.placeholder")}
            className="flex-1 text-sm"
          />
          <Button onClick={addGratitude} size="sm" className="px-3">
            +
          </Button>
        </div>

        {gratitudes.length > 0 && (
          <div className="space-y-2">
            {gratitudes.map((g, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 rounded-xl bg-primary/5 border border-primary/15 text-sm flex items-start gap-2.5"
              >
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary text-xs font-bold">{i + 1}</span>
                </div>
                <p className="text-foreground">{g}</p>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MeditationTimer() {
  const { t } = useLanguage();
  const [minutes, setMinutes] = useState(5);
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(300);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setSeconds(s => {
        if (s === 0) {
          setMinutes(m => {
            if (m === 0) {
              setIsRunning(false);
              return 0;
            }
            return m - 1;
          });
          return 59;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleStart = (mins: number) => {
    setMinutes(mins);
    setSeconds(0);
    setIsRunning(true);
    setTotalSeconds(mins * 60);
  };

  const remaining = minutes * 60 + seconds;
  const progress = totalSeconds > 0 ? ((totalSeconds - remaining) / totalSeconds) * 100 : 0;
  const circumference = 2 * Math.PI * 45;
  const dashOffset = circumference * (1 - progress / 100);

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/30">
      <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 px-4 space-y-6 sm:space-y-8">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold">{t("zen.meditation.title")}</h3>
        </div>

        <div className="relative w-36 h-36 sm:w-48 sm:h-48">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" strokeWidth="3" className="stroke-muted-foreground/15" />
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              strokeWidth="3.5"
              strokeLinecap="round"
              className="stroke-primary"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-3xl sm:text-4xl font-bold text-foreground font-mono">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </div>
          </div>
        </div>

        {!isRunning ? (
          <div className="flex gap-2">
            {[3, 5, 10].map((mins) => (
              <Button
                key={mins}
                onClick={() => handleStart(mins)}
                variant="outline"
                size="sm"
                className="min-w-[56px]"
              >
                {mins} min
              </Button>
            ))}
          </div>
        ) : (
          <div className="flex gap-2">
            <Button onClick={() => setIsRunning(false)} className="gap-2">
              <Pause className="w-4 h-4" /> {t("common.pause")}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setIsRunning(false); setMinutes(5); setSeconds(0); }}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" /> {t("common.reset")}
            </Button>
          </div>
        )}

        <p className="text-[10px] sm:text-xs text-muted-foreground/60 text-center max-w-xs">
          {t("zen.meditation.hint")}
        </p>
      </CardContent>
    </Card>
  );
}

export default function Zen() {
  const { t } = useLanguage();
  return (
    <PageLayout>
      <PageHeader title={t("zen.title")} subtitle={t("zen.subtitle")} />
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Tabs defaultValue="breathing" className="w-full">
          <div className="flex flex-col md:flex-row gap-4 md:gap-6">
            <TabsList className="flex md:flex-col w-full md:w-1/3 h-auto gap-1 bg-card/50 backdrop-blur-md p-1.5 rounded-xl border border-border md:self-start">
              <TabsTrigger value="breathing"     className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm flex-1 md:w-full">{t("zen.tab.breathing")}</TabsTrigger>
              <TabsTrigger value="visualization" className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm flex-1 md:w-full">{t("zen.tab.visualization")}</TabsTrigger>
              <TabsTrigger value="quotes"        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm flex-1 md:w-full">{t("zen.tab.quotes")}</TabsTrigger>
              <TabsTrigger value="gratitude"     className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm flex-1 md:w-full">{t("zen.tab.gratitude")}</TabsTrigger>
              <TabsTrigger value="meditation"    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm flex-1 md:w-full">{t("zen.tab.meditation")}</TabsTrigger>
            </TabsList>

            <div className="md:w-2/3">
              <TabsContent value="breathing"     className="mt-0"><BreathingExercise /></TabsContent>
              <TabsContent value="visualization" className="mt-0"><ResultVisualization /></TabsContent>
              <TabsContent value="quotes"        className="mt-0"><MotivationalQuotes /></TabsContent>
              <TabsContent value="gratitude"     className="mt-0"><Gratitude /></TabsContent>
              <TabsContent value="meditation"    className="mt-0"><MeditationTimer /></TabsContent>
            </div>
          </div>
        </Tabs>
      </motion.section>
    </PageLayout>
  );
}
