import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { uiText } from "@/contexts/LanguageContext";
import { CheckCircle2 } from "lucide-react";
import type { Program } from "./types";

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

export function BreathingStep({ program, onReady }: { program: Program; onReady: () => void }) {
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
          <p className="text-primary font-semibold">{uiText("routine.breathing_completed")}</p>
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
