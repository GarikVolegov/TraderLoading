import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import confetti from "canvas-confetti";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import {
  Sunrise, Moon, X, ChevronRight, ChevronLeft, Wind,
  Smile, Heart, Star, CheckCircle2, Target, RotateCcw,
  Flame, Clock, Play, SkipForward, Check, TrendingUp,
  Eye, ClipboardCheck, CalendarDays, Zap, BookOpen,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Program = "morning" | "evening";
type StepType =
  | "emotion-quiz"
  | "breathing"
  | "gratitude"
  | "visualization"
  | "checklist"
  | "goals"
  | "trade-review"
  | "reflection"
  | "tomorrow"
  | "complete";

interface SessionStep {
  type: StepType;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  skippable?: boolean;
}

type Answers = Record<string, unknown>;

// ─── Program step definitions ─────────────────────────────────────────────────

const MORNING_STEPS: SessionStep[] = [
  { type: "emotion-quiz",   title: "Come ti senti?",          subtitle: "Check-in emotivo pre-sessione",           icon: Smile },
  { type: "breathing",      title: "Respirazione",             subtitle: "Box breathing 4-4-4-4 · 4 cicli",         icon: Wind },
  { type: "gratitude",      title: "Gratitudine",              subtitle: "Tre cose per cui sei grato stamattina",   icon: Heart },
  { type: "visualization",  title: "Visualizzazione",          subtitle: "Immagina la tua sessione perfetta",       icon: Eye,  skippable: true },
  { type: "checklist",      title: "Checklist pre-trade",      subtitle: "Conferma i tuoi criteri d'ingresso",      icon: ClipboardCheck },
  { type: "goals",          title: "Obiettivi del giorno",     subtitle: "Target pip e limite di drawdown",          icon: Target },
  { type: "complete",       title: "Sei pronto!",              subtitle: "La sessione è configurata. Buon trading", icon: Zap },
];

const EVENING_STEPS: SessionStep[] = [
  { type: "emotion-quiz",   title: "Come è andata?",           subtitle: "Check-out emotivo di fine sessione",      icon: Smile },
  { type: "trade-review",   title: "Bilancio trade",           subtitle: "Riepilogo delle operazioni di oggi",      icon: TrendingUp },
  { type: "breathing",      title: "Decompressione",           subtitle: "Respirazione 4-7-8 per rilassarsi",       icon: Wind },
  { type: "gratitude",      title: "Gratitudine serale",       subtitle: "Tre lezioni o cose positive di oggi",     icon: Heart },
  { type: "reflection",     title: "Riflessione",              subtitle: "Analisi onesta della giornata",           icon: BookOpen },
  { type: "tomorrow",       title: "Piano di domani",          subtitle: "Prepara il focus per la prossima sessione",icon: CalendarDays },
  { type: "complete",       title: "Buona notte!",             subtitle: "Riposa bene. Domani torni più forte",     icon: Moon },
];

// ─── localStorage helpers ─────────────────────────────────────────────────────

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadCompletion(p: Program): boolean {
  try {
    const raw = localStorage.getItem(`tl_session_${p}_v2`);
    if (!raw) return false;
    const { date } = JSON.parse(raw) as { date: string };
    return date === todayKey();
  } catch { return false; }
}

function saveCompletion(p: Program, answers: Answers) {
  localStorage.setItem(
    `tl_session_${p}_v2`,
    JSON.stringify({ date: todayKey(), answers }),
  );
}

// ─── Emotion Quiz Step ────────────────────────────────────────────────────────

const EMOTIONS_MORNING = [
  { id: "anxious",    label: "Ansioso",   emoji: "😰", color: "#ef4444" },
  { id: "tense",      label: "Teso",      emoji: "😤", color: "#f97316" },
  { id: "neutral",    label: "Neutro",    emoji: "😐", color: "#6b7280" },
  { id: "calm",       label: "Calmo",     emoji: "😌", color: "#3b82f6" },
  { id: "confident",  label: "Fiducioso", emoji: "💪", color: "#10b981" },
  { id: "energetic",  label: "Energico",  emoji: "⚡", color: "#f59e0b" },
];

const EMOTIONS_EVENING = [
  { id: "frustrated", label: "Frustrato", emoji: "😤", color: "#ef4444" },
  { id: "tired",      label: "Stanco",    emoji: "😴", color: "#6b7280" },
  { id: "neutral",    label: "Neutro",    emoji: "😐", color: "#6b7280" },
  { id: "satisfied",  label: "Soddisfatto",emoji: "😊",color: "#3b82f6" },
  { id: "happy",      label: "Felice",    emoji: "🎉", color: "#10b981" },
  { id: "proud",      label: "Orgoglioso",emoji: "🏆", color: "#f59e0b" },
];

const EMOTION_ADVICE: Record<string, string> = {
  anxious:    "L'ansia è normale. Respira, segui le regole e riduci il size oggi.",
  tense:      "La tensione può distorcere le decisioni. Vai più piano, size ridotto.",
  neutral:    "Stato ottimale. Mantieni la disciplina e segui il piano.",
  calm:       "Perfetto. La calma è il vantaggio più sottovalutato nel trading.",
  confident:  "Ottimo. Attenzione all'overconfidence — rispetta i limiti.",
  energetic:  "Energia alta. Usa questo stato per la disciplina, non per l'overtrading.",
  frustrated: "Frustrazione visibile. Nessuna operazione prima di sentirti neutro.",
  tired:      "Stanchezza = errori. Valuta una sessione ridotta o un giorno di pausa.",
  satisfied:  "Buon umore. Evita il revenge trading o la compiacenza.",
  happy:      "Ottimo. Ricorda: le emozioni positive portano spesso all'overtrading.",
  proud:      "Meriti ogni successo. Domani riparti dalla disciplina.",
};

function EmotionQuizStep({
  program, answers, onChange,
}: {
  program: Program; answers: Answers; onChange: (a: Answers) => void;
}) {
  const emotions = program === "morning" ? EMOTIONS_MORNING : EMOTIONS_EVENING;
  const selected = answers.emotion as string | undefined;
  const advice = selected ? EMOTION_ADVICE[selected] : null;

  return (
    <div className="flex flex-col gap-5 w-full max-w-lg mx-auto">
      <div className="grid grid-cols-3 gap-3">
        {emotions.map((e, i) => (
          <motion.button
            key={e.id}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 400, damping: 25 }}
            onClick={() => onChange({ ...answers, emotion: e.id })}
            className={`relative flex flex-col items-center gap-2 py-4 px-2 rounded-2xl border transition-all duration-200 ${
              selected === e.id
                ? "border-2 shadow-lg"
                : "border-border/40 bg-card/40 hover:border-border/70 hover:bg-card/60"
            }`}
            style={selected === e.id ? {
              borderColor: e.color,
              backgroundColor: `${e.color}15`,
              boxShadow: `0 0 20px ${e.color}20`,
            } : {}}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-3xl leading-none">{e.emoji}</span>
            <span
              className="text-xs font-bold"
              style={{ color: selected === e.id ? e.color : undefined }}
            >
              {e.label}
            </span>
            {selected === e.id && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: e.color }}
              >
                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              </motion.div>
            )}
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {advice && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="px-4 py-3 rounded-xl border border-border/30 bg-card/60 text-sm text-muted-foreground/80 italic text-center"
          >
            {advice}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Breathing Step ───────────────────────────────────────────────────────────

const MORNING_PHASES = [
  { name: "Inspira",    duration: 4, scale: 1.0,  color: "#10b981" },
  { name: "Trattieni", duration: 4, scale: 1.0,  color: "#3b82f6" },
  { name: "Espira",    duration: 4, scale: 0.58, color: "#8b5cf6" },
  { name: "Riposa",    duration: 4, scale: 0.58, color: "#6b7280" },
];

const EVENING_PHASES = [
  { name: "Inspira",    duration: 4, scale: 1.0,  color: "#3b82f6" },
  { name: "Trattieni", duration: 7, scale: 1.0,  color: "#8b5cf6" },
  { name: "Espira",    duration: 8, scale: 0.55, color: "#6366f1" },
];

const TOTAL_CYCLES = 4;

function BreathingStep({ program, onReady }: { program: Program; onReady: () => void }) {
  const phases = program === "morning" ? MORNING_PHASES : EVENING_PHASES;
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [tick, setTick] = useState(phases[0].duration);
  const [cycle, setCycle] = useState(1);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (done) return;
    timerRef.current = setInterval(() => {
      setTick((t) => {
        if (t <= 1) {
          setPhaseIdx((pi) => {
            const nextPi = (pi + 1) % phases.length;
            if (nextPi === 0) {
              setCycle((c) => {
                if (c >= TOTAL_CYCLES) {
                  setDone(true);
                  return c;
                }
                return c + 1;
              });
            }
            const nextPhase = phases[nextPi];
            setTick(nextPhase.duration);
            return nextPi;
          });
          return phases[0].duration;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [done, phases]);

  const phase = phases[phaseIdx];
  const totalSeconds = phases.reduce((a, p) => a + p.duration, 0) * TOTAL_CYCLES;
  const elapsed = phases.slice(0, phaseIdx).reduce((a, p) => a + p.duration, 0) +
    (phase.duration - tick) + (cycle - 1) * phases.reduce((a, p) => a + p.duration, 0);
  const pct = Math.min((elapsed / totalSeconds) * 100, 100);

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Circle */}
      <div className="relative flex items-center justify-center">
        {/* Outer glow ring */}
        <motion.div
          className="absolute rounded-full"
          animate={{
            scale: phase.scale,
            opacity: done ? 0 : 0.25,
            backgroundColor: phase.color,
          }}
          transition={{ duration: phase.duration * 0.9, ease: "easeInOut" }}
          style={{ width: 220, height: 220 }}
        />
        {/* Main circle */}
        <motion.div
          className="relative rounded-full flex flex-col items-center justify-center border-2"
          animate={{
            scale: done ? 1 : phase.scale,
            borderColor: done ? "#10b981" : phase.color,
            backgroundColor: done ? "#10b98115" : `${phase.color}10`,
          }}
          transition={{ duration: phase.duration * 0.9, ease: "easeInOut" }}
          style={{ width: 180, height: 180 }}
        >
          {done ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
              <CheckCircle2 className="w-14 h-14 text-primary" />
            </motion.div>
          ) : (
            <>
              <motion.p
                key={phase.name}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-bold text-lg"
                style={{ color: phase.color }}
              >
                {phase.name}
              </motion.p>
              <motion.p
                key={tick}
                initial={{ scale: 1.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="font-mono font-bold text-4xl tabular-nums"
              >
                {tick}
              </motion.p>
            </>
          )}
        </motion.div>
      </div>

      {/* Status */}
      {!done ? (
        <div className="text-center space-y-2">
          <div className="flex items-center gap-2 justify-center">
            {Array.from({ length: TOTAL_CYCLES }).map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full transition-all duration-500"
                style={{ backgroundColor: i < cycle ? "#10b981" : "#374151" }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground/50 font-mono">
            Ciclo {cycle}/{TOTAL_CYCLES}
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <p className="text-primary font-semibold">Respirazione completata</p>
          <p className="text-sm text-muted-foreground/60">
            La mente è centrata. Procedi con il passo successivo.
          </p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onReady}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
          >
            Continua →
          </motion.button>
        </motion.div>
      )}

      {/* Progress bar */}
      {!done && (
        <div className="w-full max-w-xs h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary/60"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Gratitude Step ───────────────────────────────────────────────────────────

const MORNING_PROMPTS = [
  "Una cosa che mi dà energia stamattina…",
  "Una persona per cui sono grato oggi…",
  "Una qualità di me stesso che apprezzo come trader…",
];

const EVENING_PROMPTS = [
  "Una cosa positiva che è successa oggi nel trading…",
  "Una lezione preziosa che porto con me…",
  "Un progresso — anche piccolo — che ho fatto oggi…",
];

function GratitudeStep({
  program, answers, onChange,
}: {
  program: Program; answers: Answers; onChange: (a: Answers) => void;
}) {
  const prompts = program === "morning" ? MORNING_PROMPTS : EVENING_PROMPTS;
  const values = (answers.gratitude as string[] | undefined) ?? ["", "", ""];

  const set = (i: number, v: string) => {
    const next = [...values];
    next[i] = v;
    onChange({ ...answers, gratitude: next });
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto">
      {prompts.map((prompt, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1, type: "spring", stiffness: 320, damping: 28 }}
          className="flex flex-col gap-2"
        >
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
            <Heart className="w-3.5 h-3.5 text-pink-400" />
            {i + 1}. {prompt}
          </label>
          <textarea
            value={values[i]}
            onChange={(e) => set(i, e.target.value)}
            rows={2}
            placeholder="Scrivi qualcosa…"
            className="w-full rounded-xl border border-border/50 bg-card/60 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 resize-none focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </motion.div>
      ))}
    </div>
  );
}

// ─── Visualization Step ───────────────────────────────────────────────────────

const VIZ_TEXT = `Siediti comodo. Chiudi gli occhi per un momento.

Immagina di aprire la tua piattaforma. I mercati sono aperti.

Sei nella tua postazione preferita. La mente è chiara, il corpo rilassato.

Osservi i grafici senza emozione — solo fatti, pattern, struttura.

Vedi il tuo setup formarsi. Conosci le regole. Le rispetti.

Entri con precisione. Non ansia, solo fiducia nel processo.

Gestisci il trade: pazienza, disciplina, distacco emotivo.

Qualunque sia il risultato — hai rispettato il piano.

Sei un trader disciplinato. Ogni giorno migliori.

Apri gli occhi. Sei pronto.`;

function VisualizationStep({ onSkip }: { onSkip: () => void }) {
  const [seconds, setSeconds] = useState(90);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!started || done) return;
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { setDone(true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [started, done]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      {!started ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Eye className="w-7 h-7 text-indigo-400" />
          </div>
          <p className="text-sm text-muted-foreground/70 max-w-sm leading-relaxed">
            90 secondi di visualizzazione guidata. Siediti comodamente, respira, e lasciati guidare.
          </p>
          <div className="flex gap-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setStarted(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-bold text-sm hover:bg-indigo-500/30 transition-colors"
            >
              <Play className="w-4 h-4" />
              Inizia visualizzazione
            </motion.button>
            <button
              onClick={onSkip}
              className="px-4 py-2.5 rounded-xl border border-border/30 text-muted-foreground/50 text-sm hover:text-muted-foreground/80 transition-colors"
            >
              Salta
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-6 w-full">
          {/* Timer ring */}
          <div className="flex items-center justify-center">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/5" />
                <motion.circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke="#6366f1" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={213.6}
                  animate={{ strokeDashoffset: 213.6 * (1 - (90 - seconds) / 90) }}
                  transition={{ duration: 0.5 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {done ? (
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                ) : (
                  <span className="font-mono font-bold text-lg">{seconds}</span>
                )}
              </div>
            </div>
          </div>

          {/* Scrolling text */}
          <div className="rounded-2xl border border-indigo-500/15 bg-indigo-500/5 px-6 py-5 max-h-48 overflow-y-auto">
            {VIZ_TEXT.split("\n\n").map((para, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.8 }}
                className="text-sm text-muted-foreground/70 leading-relaxed mb-3 italic"
              >
                {para}
              </motion.p>
            ))}
          </div>

          {done && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSkip}
              className="mx-auto px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
            >
              Continua →
            </motion.button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Checklist Step ───────────────────────────────────────────────────────────

const CHECKLIST_ITEMS = [
  { id: "trend",    label: "Ho analizzato il trend principale su D1/H4" },
  { id: "setup",    label: "C'è un setup valido secondo le mie regole" },
  { id: "sltp",     label: "Ho identificato SL e TP con chiarezza" },
  { id: "risk",     label: "Il rischio è entro il mio limite (max 1-2%)" },
  { id: "events",   label: "Nessun evento macro imminente ad alto impatto" },
  { id: "emotion",  label: "Sono in uno stato emotivo equilibrato" },
];

function ChecklistStep({
  answers, onChange,
}: {
  answers: Answers; onChange: (a: Answers) => void;
}) {
  const checked = (answers.checklist as string[] | undefined) ?? [];

  const toggle = (id: string) => {
    const next = checked.includes(id)
      ? checked.filter((c) => c !== id)
      : [...checked, id];
    onChange({ ...answers, checklist: next });
  };

  return (
    <div className="flex flex-col gap-2.5 w-full max-w-lg mx-auto">
      {CHECKLIST_ITEMS.map((item, i) => {
        const isChecked = checked.includes(item.id);
        return (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 380, damping: 28 }}
            onClick={() => toggle(item.id)}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all duration-200 ${
              isChecked
                ? "border-primary/40 bg-primary/8"
                : "border-border/40 bg-card/40 hover:border-border/70"
            }`}
            whileTap={{ scale: 0.98 }}
          >
            <div
              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                isChecked ? "border-primary bg-primary" : "border-border/50"
              }`}
            >
              <AnimatePresence>
                {isChecked && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 600, damping: 20 }}
                  >
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span
              className={`text-sm font-medium transition-all duration-200 ${
                isChecked ? "line-through text-muted-foreground/40" : "text-foreground"
              }`}
            >
              {item.label}
            </span>
          </motion.button>
        );
      })}
      <p className="text-center text-xs text-muted-foreground/40 mt-1">
        {checked.length}/{CHECKLIST_ITEMS.length} confermati
      </p>
    </div>
  );
}

// ─── Goals Step ───────────────────────────────────────────────────────────────

function GoalsStep({ answers, onChange }: { answers: Answers; onChange: (a: Answers) => void }) {
  const goals = (answers.goals as Record<string, string> | undefined) ?? {};

  const set = (k: string, v: string) =>
    onChange({ ...answers, goals: { ...goals, [k]: v } });

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto">
      {[
        { key: "target",   label: "Target pip giornaliero",      placeholder: "es. 30 pips", icon: Target },
        { key: "maxloss",  label: "Perdita massima accettabile",  placeholder: "es. 1% del conto", icon: Flame },
        { key: "focus",    label: "Pair o mercato di focus",      placeholder: "es. EUR/USD, XAU/USD", icon: Star },
      ].map(({ key, label, placeholder, icon: Icon }, i) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex flex-col gap-1.5"
        >
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
            <Icon className="w-3.5 h-3.5 text-primary/60" />
            {label}
          </label>
          <input
            type="text"
            value={goals[key] ?? ""}
            onChange={(e) => set(key, e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-border/50 bg-card/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all font-mono"
          />
        </motion.div>
      ))}
    </div>
  );
}

// ─── Trade Review Step ────────────────────────────────────────────────────────

function TradeReviewStep({ answers, onChange }: { answers: Answers; onChange: (a: Answers) => void }) {
  const review = (answers.tradeReview as Record<string, string> | undefined) ?? {};

  const set = (k: string, v: string) =>
    onChange({ ...answers, tradeReview: { ...review, [k]: v } });

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto">
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: "win",   label: "Win",   color: "#10b981" },
          { key: "loss",  label: "Loss",  color: "#ef4444" },
          { key: "be",    label: "B/E",   color: "#6b7280" },
        ].map(({ key, label, color }) => (
          <div key={key} className="flex flex-col gap-1">
            <label className="text-xs font-bold text-center" style={{ color }}>{label}</label>
            <input
              type="number"
              min="0"
              value={review[key] ?? ""}
              onChange={(e) => set(key, e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-border/50 bg-card/60 px-3 py-3 text-sm text-center font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 transition-all"
              style={{ borderColor: review[key] ? color : undefined, color: review[key] ? color : undefined }}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
          P&amp;L del giorno
        </label>
        <input
          type="text"
          value={review.pnl ?? ""}
          onChange={(e) => set("pnl", e.target.value)}
          placeholder="es. +45 pips / +€120"
          className="w-full rounded-xl border border-border/50 bg-card/60 px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 transition-all"
        />
      </div>
    </div>
  );
}

// ─── Reflection Step ──────────────────────────────────────────────────────────

function ReflectionStep({ answers, onChange }: { answers: Answers; onChange: (a: Answers) => void }) {
  const reflection = (answers.reflection as Record<string, string> | undefined) ?? {};

  const set = (k: string, v: string) =>
    onChange({ ...answers, reflection: { ...reflection, [k]: v } });

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto">
      {[
        { key: "good",    label: "Cosa hai fatto bene oggi?",         placeholder: "Sii specifico e generoso con te stesso…" },
        { key: "improve", label: "Cosa faresti diversamente?",        placeholder: "Identifica 1-2 comportamenti concreti…" },
        { key: "lesson",  label: "La lezione principale di oggi:",    placeholder: "Una frase che ricorderai domani…" },
      ].map(({ key, label, placeholder }, i) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex flex-col gap-1.5"
        >
          <label className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
            {label}
          </label>
          <textarea
            value={reflection[key] ?? ""}
            onChange={(e) => set(key, e.target.value)}
            rows={2}
            placeholder={placeholder}
            className="w-full rounded-xl border border-border/50 bg-card/60 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 resize-none focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </motion.div>
      ))}
    </div>
  );
}

// ─── Tomorrow Step ────────────────────────────────────────────────────────────

function TomorrowStep({ answers, onChange }: { answers: Answers; onChange: (a: Answers) => void }) {
  const tomorrow = (answers.tomorrow as Record<string, string> | undefined) ?? {};

  const set = (k: string, v: string) =>
    onChange({ ...answers, tomorrow: { ...tomorrow, [k]: v } });

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto">
      {[
        { key: "pairs",     label: "Pair di focus per domani",           placeholder: "es. EUR/USD, XAU/USD, GBP/JPY" },
        { key: "levels",    label: "Livelli chiave da monitorare",        placeholder: "es. 1.0850 supporto, 2650 resistenza oro" },
        { key: "intention", label: "Intenzione per domani",              placeholder: "es. Seguire il piano senza deviazioni" },
      ].map(({ key, label, placeholder }, i) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex flex-col gap-1.5"
        >
          <label className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
            {label}
          </label>
          <textarea
            value={tomorrow[key] ?? ""}
            onChange={(e) => set(key, e.target.value)}
            rows={2}
            placeholder={placeholder}
            className="w-full rounded-xl border border-border/50 bg-card/60 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 resize-none focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </motion.div>
      ))}
    </div>
  );
}

// ─── Complete Step ────────────────────────────────────────────────────────────

function CompleteStep({ program, answers }: { program: Program; answers: Answers }) {
  const emotion = answers.emotion as string | undefined;
  const goals = answers.goals as Record<string, string> | undefined;
  const review = answers.tradeReview as Record<string, string> | undefined;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={`w-20 h-20 rounded-3xl flex items-center justify-center ${
          program === "morning"
            ? "bg-amber-500/15 border-2 border-amber-500/30"
            : "bg-indigo-500/15 border-2 border-indigo-500/30"
        }`}
      >
        {program === "morning"
          ? <Sunrise className="w-9 h-9 text-amber-400" />
          : <Moon className="w-9 h-9 text-indigo-400" />
        }
      </motion.div>

      {/* Summary cards */}
      <div className="w-full grid grid-cols-2 gap-3">
        {emotion && (
          <div className="col-span-2 flex items-center gap-3 px-4 py-3 rounded-xl border border-border/30 bg-card/50">
            <Smile className="w-4 h-4 text-muted-foreground/60 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Stato emotivo</p>
              <p className="text-sm font-semibold capitalize">{emotion}</p>
            </div>
          </div>
        )}

        {program === "morning" && goals && (
          <>
            {goals.target && (
              <div className="px-4 py-3 rounded-xl border border-border/30 bg-card/50">
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Target</p>
                <p className="text-sm font-bold font-mono text-primary">{goals.target}</p>
              </div>
            )}
            {goals.maxloss && (
              <div className="px-4 py-3 rounded-xl border border-border/30 bg-card/50">
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Max Loss</p>
                <p className="text-sm font-bold font-mono text-red-400">{goals.maxloss}</p>
              </div>
            )}
          </>
        )}

        {program === "evening" && review && (
          <>
            {(review.win || review.loss) && (
              <div className="col-span-2 flex gap-4 px-4 py-3 rounded-xl border border-border/30 bg-card/50">
                <div>
                  <p className="text-[10px] text-green-400 uppercase tracking-wider">Win</p>
                  <p className="text-lg font-bold font-mono text-green-400">{review.win || "0"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-red-400 uppercase tracking-wider">Loss</p>
                  <p className="text-lg font-bold font-mono text-red-400">{review.loss || "0"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">B/E</p>
                  <p className="text-lg font-bold font-mono text-muted-foreground/70">{review.be || "0"}</p>
                </div>
                {review.pnl && (
                  <div className="ml-auto">
                    <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">P&L</p>
                    <p className="text-sm font-bold font-mono">{review.pnl}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-sm text-muted-foreground/60 text-center italic">
        {program === "morning"
          ? "La sessione è pronta. Segui il piano. Ogni trade è solo un punto statistico."
          : "Hai fatto tutto il possibile oggi. Riposa profondamente — è parte del tuo edge."}
      </p>

      <Link
        href={program === "morning" ? "/news" : "/journal"}
        className="flex items-center gap-2 text-sm font-bold text-primary/80 hover:text-primary transition-colors"
      >
        {program === "morning" ? "Leggi il briefing macro" : "Apri il diario di trading"}
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

// ─── Session Modal ────────────────────────────────────────────────────────────

function SessionModal({
  program,
  onClose,
  onComplete,
}: {
  program: Program;
  onClose: () => void;
  onComplete: (answers: Answers) => void;
}) {
  const steps = program === "morning" ? MORNING_STEPS : EVENING_STEPS;
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [breathingReady, setBreathingReady] = useState(false);
  const [vizDone, setVizDone] = useState(false);

  const isLastStep = stepIdx === steps.length - 1;
  const step = steps[stepIdx];
  const accentColor = program === "morning" ? "#f59e0b" : "#818cf8";

  const canAdvance = () => {
    if (step.type === "emotion-quiz") return !!answers.emotion;
    if (step.type === "breathing") return breathingReady;
    if (step.type === "visualization") return vizDone;
    if (step.type === "complete") return false;
    return true;
  };

  const advance = () => {
    if (isLastStep) {
      onComplete(answers);
      return;
    }
    setStepIdx((i) => i + 1);
    setBreathingReady(false);
  };

  const goBack = () => {
    if (stepIdx > 0) setStepIdx((i) => i - 1);
  };

  const Icon = step.icon;

  // Fire confetti when reaching complete step
  useEffect(() => {
    if (step.type === "complete") {
      const colors = program === "morning"
        ? ["#f59e0b", "#fcd34d", "#ffffff"]
        : ["#6366f1", "#a5b4fc", "#ffffff"];
      setTimeout(() => confetti({ particleCount: 100, spread: 70, origin: { y: 0.4 }, colors, scalar: 0.9 }), 200);
    }
  }, [step.type, program]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-[hsl(224,71%,2%)]/97 backdrop-blur-sm flex flex-col"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border/20 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
              {program === "morning" ? "Programma Mattutino" : "Programma Serale"}
            </p>
            <p className="text-sm font-bold font-mono leading-tight">{step.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Step pills */}
          <div className="hidden sm:flex items-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all duration-400"
                style={{
                  width: i === stepIdx ? 20 : 6,
                  backgroundColor: i <= stepIdx ? accentColor : "#374151",
                }}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground/50 font-mono tabular-nums">
            {stepIdx + 1}/{steps.length}
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-border/30 flex items-center justify-center hover:border-border/70 hover:bg-card/40 transition-all"
          >
            <X className="w-4 h-4 text-muted-foreground/60" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-border/20 shrink-0">
        <motion.div
          className="h-full"
          style={{ backgroundColor: accentColor }}
          animate={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-xl mx-auto flex flex-col gap-8">
          {/* Step header */}
          <AnimatePresence mode="wait">
            <motion.div
              key={stepIdx}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <h2 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight">{step.title}</h2>
              <p className="text-sm text-muted-foreground/60 mt-1">{step.subtitle}</p>
            </motion.div>
          </AnimatePresence>

          {/* Step body */}
          <AnimatePresence mode="wait">
            <motion.div
              key={stepIdx}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {step.type === "emotion-quiz" && (
                <EmotionQuizStep program={program} answers={answers} onChange={setAnswers} />
              )}
              {step.type === "breathing" && (
                <BreathingStep
                  program={program}
                  onReady={() => { setBreathingReady(true); advance(); }}
                />
              )}
              {step.type === "gratitude" && (
                <GratitudeStep program={program} answers={answers} onChange={setAnswers} />
              )}
              {step.type === "visualization" && (
                <VisualizationStep onSkip={() => { setVizDone(true); advance(); }} />
              )}
              {step.type === "checklist" && (
                <ChecklistStep answers={answers} onChange={setAnswers} />
              )}
              {step.type === "goals" && (
                <GoalsStep answers={answers} onChange={setAnswers} />
              )}
              {step.type === "trade-review" && (
                <TradeReviewStep answers={answers} onChange={setAnswers} />
              )}
              {step.type === "reflection" && (
                <ReflectionStep answers={answers} onChange={setAnswers} />
              )}
              {step.type === "tomorrow" && (
                <TomorrowStep answers={answers} onChange={setAnswers} />
              )}
              {step.type === "complete" && (
                <CompleteStep program={program} answers={answers} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom nav — always show back button; hide Avanti only on auto-advancing steps */}
      <div className="border-t border-border/20 px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
        <button
          onClick={stepIdx === 0 ? onClose : goBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/30 text-sm text-muted-foreground/60 hover:text-muted-foreground/90 hover:border-border/60 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          {stepIdx === 0 ? "Chiudi" : "Indietro"}
        </button>

        {step.type !== "breathing" && step.type !== "visualization" && (
          <div className="flex items-center gap-2">
            {step.skippable && (
              <button
                onClick={advance}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5" />
                Salta
              </button>
            )}
            {step.type === "complete" ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => onComplete(answers)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white"
                style={{ backgroundColor: accentColor }}
              >
                <Check className="w-4 h-4" strokeWidth={3} />
                Completa sessione
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={advance}
                disabled={!canAdvance()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all"
                style={{
                  backgroundColor: canAdvance() ? accentColor : undefined,
                  color: canAdvance() ? "#fff" : undefined,
                  opacity: canAdvance() ? 1 : 0.35,
                  border: canAdvance() ? "none" : "1px solid hsl(var(--border) / 0.4)",
                }}
              >
                Avanti
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Program Card ─────────────────────────────────────────────────────────────

function ProgramCard({
  program,
  label,
  timeLabel,
  description,
  steps,
  isActive,
  accentColor,
  accentClass,
  borderActiveClass,
  icon: CardIcon,
  delay,
  onStart,
}: {
  program: Program;
  label: string;
  timeLabel: string;
  description: string;
  steps: SessionStep[];
  isActive: boolean;
  accentColor: string;
  accentClass: string;
  borderActiveClass: string;
  icon: React.ElementType;
  delay: number;
  onStart: () => void;
}) {
  const [completed, setCompleted] = useState(() => loadCompletion(program));

  useEffect(() => {
    const handler = () => setCompleted(loadCompletion(program));
    window.addEventListener(`tl_routine_${program}_done`, handler);
    return () => window.removeEventListener(`tl_routine_${program}_done`, handler);
  }, [program]);

  const totalMinutes = program === "morning" ? 25 : 30;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 26 }}
      className={`relative rounded-3xl border overflow-hidden flex flex-col ${
        isActive ? borderActiveClass : "border-border/35"
      }`}
      style={isActive ? { boxShadow: `0 0 60px -12px ${accentColor}25` } : {}}
    >
      {/* Glow */}
      {isActive && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 80% 45% at 50% 0%, ${accentColor}0c 0%, transparent 70%)` }}
        />
      )}

      {/* Header */}
      <div className="relative z-10 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl ${accentClass} flex items-center justify-center shrink-0`}>
            <CardIcon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-xl font-mono tracking-tight">{label}</h3>
              {isActive && !completed && (
                <motion.span
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 2.5 }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest"
                  style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                >
                  Attivo ora
                </motion.span>
              )}
              {completed && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest bg-primary/15 text-primary">
                  ✓ Completato
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground/55 mt-0.5">
              {timeLabel} · ~{totalMinutes} min
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground/65 leading-relaxed">{description}</p>

        {/* Step pills */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {steps.filter((s) => s.type !== "complete").map((s, i) => {
            const StepIcon = s.icon;
            return (
              <div
                key={i}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border/25 bg-card/30 text-[10px] text-muted-foreground/50"
              >
                <StepIcon className="w-2.5 h-2.5" />
                {s.title}
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="relative z-10 px-5 sm:px-6 pb-5 sm:pb-6 mt-auto">
        {completed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-primary/80">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span className="font-semibold">Sessione completata oggi</span>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem(`tl_session_${program}_v2`);
                setCompleted(false);
              }}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground/35 hover:text-muted-foreground/60 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Riavvia
            </button>
          </div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onStart}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-bold text-sm text-white transition-all"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
              boxShadow: `0 4px 20px ${accentColor}30`,
            }}
          >
            <Play className="w-4 h-4" />
            Inizia {program === "morning" ? "programma mattutino" : "programma serale"}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Routine() {
  const [activeSession, setActiveSession] = useState<Program | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const hour = now.getHours();
  const isMorningActive = hour >= 4 && hour < 13;
  const isEveningActive = hour >= 16 && hour < 24;

  const handleComplete = (program: Program, answers: Answers) => {
    saveCompletion(program, answers);
    window.dispatchEvent(new Event(`tl_routine_${program}_done`));
    setActiveSession(null);
  };

  return (
    <>
      <PageLayout>
        <PageHeader
          title="Programma del Trader"
          subtitle="Sessioni guidate mattutine e serali per un trading disciplinato"
          badge={
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary uppercase tracking-wider">
              Interattivo
            </span>
          }
        />

        {/* Time hero */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="flex items-center justify-between px-4 sm:px-5 py-4 rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm"
        >
          <div>
            <p className="font-mono font-bold text-2xl tabular-nums tracking-tight">
              {now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-xs text-muted-foreground/45 mt-0.5 capitalize">
              {now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {isMorningActive && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ backgroundColor: "#f59e0b15", color: "#f59e0b", border: "1px solid #f59e0b25" }}
              >
                <Sunrise className="w-3.5 h-3.5" />
                Sessione mattutina attiva
              </div>
            )}
            {isEveningActive && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ backgroundColor: "#6366f115", color: "#818cf8", border: "1px solid #6366f125" }}
              >
                <Moon className="w-3.5 h-3.5" />
                Sessione serale attiva
              </div>
            )}
            {!isMorningActive && !isEveningActive && (
              <span className="text-xs text-muted-foreground/35 font-mono">Nessuna sessione attiva</span>
            )}
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2"
        >
          {[
            { icon: Smile,        label: "Quiz emotivo",    desc: "Check-in stato mentale" },
            { icon: Wind,         label: "Respirazione",    desc: "Box breathing guidato" },
            { icon: Heart,        label: "Gratitudine",     desc: "3 prompt riflessivi" },
            { icon: ClipboardCheck, label: "Checklist",     desc: "Conferma criteri trade" },
          ].map(({ icon: Icon, label, desc }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.05 }}
              className="flex flex-col items-center text-center gap-1.5 py-3 px-2 rounded-2xl border border-border/25 bg-card/20"
            >
              <div className="w-8 h-8 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center">
                <Icon className="w-4 h-4 text-primary/70" />
              </div>
              <p className="text-xs font-bold">{label}</p>
              <p className="text-[10px] text-muted-foreground/45 leading-tight">{desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Program cards */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
          <ProgramCard
            program="morning"
            label="Programma Mattutino"
            timeLabel="05:00 – 13:00"
            description="7 step interattivi per centrare la mente, caricare l'energia e definire il piano prima di aprire i mercati."
            steps={MORNING_STEPS}
            isActive={isMorningActive}
            accentColor="#f59e0b"
            accentClass="bg-amber-500/10 text-amber-400"
            borderActiveClass="border-amber-500/20"
            icon={Sunrise}
            delay={0.14}
            onStart={() => setActiveSession("morning")}
          />
          <ProgramCard
            program="evening"
            label="Programma Serale"
            timeLabel="17:00 – 23:00"
            description="7 step interattivi per analizzare la sessione, decomprimersi e preparare la mente al riposo e al giorno dopo."
            steps={EVENING_STEPS}
            isActive={isEveningActive}
            accentColor="#818cf8"
            accentClass="bg-indigo-500/10 text-indigo-400"
            borderActiveClass="border-indigo-500/20"
            icon={Moon}
            delay={0.2}
            onStart={() => setActiveSession("evening")}
          />
        </div>

        {/* Footer quote */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-sm italic text-muted-foreground/30 pb-4"
        >
          &ldquo;Il trading di successo è il 20% tecnica e l&apos;80% psicologia.&rdquo;
        </motion.p>
      </PageLayout>

      {/* Session modal */}
      <AnimatePresence>
        {activeSession && (
          <SessionModal
            program={activeSession}
            onClose={() => setActiveSession(null)}
            onComplete={(answers) => handleComplete(activeSession, answers)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
