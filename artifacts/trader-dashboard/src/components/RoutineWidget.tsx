import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Sunrise, Moon, ChevronRight, CheckCircle2, Play, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadDone(program: "morning" | "evening"): boolean {
  try {
    const raw = localStorage.getItem(`tl_session_${program}_v2`);
    if (!raw) return false;
    const { date } = JSON.parse(raw) as { date: string };
    return date === todayKey();
  } catch { return false; }
}

// ─── SVG Progress Ring ─────────────────────────────────────────────────────────

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const pct = done / total;
  const offset = circ * (1 - pct);
  const color = done === total ? "hsl(var(--primary))" : done > 0 ? "hsl(35 100% 55%)" : "hsl(var(--border))";

  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
        {/* Track */}
        <circle cx="28" cy="28" r={r} fill="none" stroke="hsl(var(--border)/0.5)" strokeWidth="3.5" />
        {/* Progress */}
        <motion.circle
          cx="28" cy="28" r={r}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          style={{ filter: done > 0 ? `drop-shadow(0 0 4px ${color})` : "none" }}
        />
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        <AnimatePresence mode="wait">
          <motion.span
            key={done}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="text-base font-bold font-mono tabular-nums leading-none"
            style={{ color }}
          >
            {done}/{total}
          </motion.span>
        </AnimatePresence>
        <span className="text-[8px] text-muted-foreground/50 uppercase tracking-wider mt-0.5">sessioni</span>
      </div>
    </div>
  );
}

// ─── Session Row ───────────────────────────────────────────────────────────────

function SessionRow({
  label, icon: Icon, color, done,
}: { label: string; icon: React.ElementType; color: string; done: boolean }) {
  return (
    <motion.div
      layout
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${
        done
          ? "bg-primary/5 border border-primary/15"
          : "bg-secondary/30 border border-border/20"
      }`}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}30` }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <span className="text-xs font-semibold flex-1" style={{ color: done ? "hsl(var(--foreground)/0.85)" : color }}>
        {label}
      </span>
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div
            key="done"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </motion.div>
        ) : (
          <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="w-4 h-4 rounded-full border-2 border-border/40" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Widget ───────────────────────────────────────────────────────────────

export function RoutineWidget() {
  const [morningDone, setMorningDone] = useState(false);
  const [eveningDone, setEveningDone] = useState(false);

  const refresh = () => {
    setMorningDone(loadDone("morning"));
    setEveningDone(loadDone("evening"));
  };

  useEffect(() => {
    refresh();
    window.addEventListener("tl_routine_morning_done", refresh);
    window.addEventListener("tl_routine_evening_done", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("tl_routine_morning_done", refresh);
      window.removeEventListener("tl_routine_evening_done", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const done = (morningDone ? 1 : 0) + (eveningDone ? 1 : 0);
  const bothDone = done === 2;

  return (
    <Card className="overflow-hidden relative">
      {/* Subtle ambient glow when complete */}
      <AnimatePresence>
        {bothDone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--primary)/0.06) 0%, transparent 70%)",
            }}
          />
        )}
      </AnimatePresence>

      <CardContent className="px-4 py-4 space-y-3">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <ProgressRing done={done} total={2} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="text-sm font-bold font-mono tracking-tight">Routine</p>
              {bothDone && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.3 }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </motion.div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/50 leading-snug">
              {bothDone
                ? "Entrambe le sessioni completate"
                : done === 1
                ? "Una sessione completata"
                : "Nessuna sessione completata"}
            </p>

            <Link
              href="/routine"
              className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-primary/70 hover:text-primary transition-colors"
            >
              {bothDone ? "Visualizza" : <><Play className="w-2.5 h-2.5" />Inizia</>}
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Session rows */}
        <div className="space-y-2">
          <SessionRow
            label="Programma mattutino"
            icon={Sunrise}
            color="#f59e0b"
            done={morningDone}
          />
          <SessionRow
            label="Programma serale"
            icon={Moon}
            color="#818cf8"
            done={eveningDone}
          />
        </div>

        {/* CTA hint when nothing done */}
        <AnimatePresence>
          {!morningDone && !eveningDone && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Link href="/routine">
                <div className="px-3 py-2 rounded-xl bg-primary/5 border border-primary/15 hover:bg-primary/8 hover:border-primary/25 transition-all cursor-pointer group">
                  <p className="text-[10px] text-muted-foreground/60 text-center group-hover:text-primary/70 transition-colors">
                    Inizia la sessione guidata interattiva →
                  </p>
                </div>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
