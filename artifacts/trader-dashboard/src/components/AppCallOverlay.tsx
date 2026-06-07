import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, X, AlarmClock, BellOff } from "lucide-react";

export interface FiringAlarm {
  id: string;
  label: string;
  time: string;
  sound: "digital" | "gentle" | "pulse";
  snoozeMins: number;
}

interface AppCallOverlayProps {
  alarm: FiringAlarm | null;
  onDismiss: () => void;
  onSnooze: (mins: number) => void;
}

// ─── Web Audio Ringtones ──────────────────────────────────────────────────────

function createRingtone(ctx: AudioContext, type: FiringAlarm["sound"]): () => void {
  let stopped = false;
  let timeouts: ReturnType<typeof setTimeout>[] = [];

  const scheduleBeep = (delay: number, freq: number, dur: number, vol = 0.3) => {
    const t = setTimeout(() => {
      if (stopped || ctx.state === "closed") return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = type === "digital" ? "square" : "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + dur + 0.05);
    }, delay);
    timeouts.push(t);
  };

  if (type === "digital") {
    const pattern = () => {
      if (stopped) return;
      scheduleBeep(0,   880, 0.1);
      scheduleBeep(120, 880, 0.1);
      scheduleBeep(240, 1100, 0.15);
      scheduleBeep(420, 880, 0.1);
      scheduleBeep(540, 880, 0.1);
      scheduleBeep(660, 1100, 0.15);
      const t = setTimeout(pattern, 1800);
      timeouts.push(t);
    };
    pattern();
  } else if (type === "gentle") {
    const pattern = () => {
      if (stopped) return;
      scheduleBeep(0,   523, 0.4, 0.2);
      scheduleBeep(500, 659, 0.4, 0.2);
      scheduleBeep(1000,784, 0.6, 0.25);
      const t = setTimeout(pattern, 2800);
      timeouts.push(t);
    };
    pattern();
  } else {
    const pattern = () => {
      if (stopped) return;
      for (let i = 0; i < 6; i++) scheduleBeep(i * 100, 440 + i * 30, 0.08, 0.2);
      const t = setTimeout(pattern, 1600);
      timeouts.push(t);
    };
    pattern();
  }

  return () => {
    stopped = true;
    timeouts.forEach(clearTimeout);
  };
}

// ─── Pulse Ring ───────────────────────────────────────────────────────────────

function PulseRing({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      className="absolute inset-0 rounded-full border-2 border-primary/40"
      initial={{ scale: 1, opacity: 0.8 }}
      animate={{ scale: 2.4, opacity: 0 }}
      transition={{ duration: 2, delay, repeat: Infinity, ease: "easeOut" }}
    />
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

export function AppCallOverlay({ alarm, onDismiss, onSnooze }: AppCallOverlayProps) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const stopRingRef = useRef<(() => void) | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!alarm) return;

    setElapsed(0);
    const ticker = setInterval(() => setElapsed(s => s + 1), 1000);

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    stopRingRef.current = createRingtone(ctx, alarm.sound);

    return () => {
      clearInterval(ticker);
      stopRingRef.current?.();
      ctx.close().catch(() => {});
      stopRingRef.current = null;
      audioCtxRef.current = null;
    };
  }, [alarm]);

  const handleDismiss = () => {
    stopRingRef.current?.();
    onDismiss();
  };

  const handleSnooze = () => {
    stopRingRef.current?.();
    onSnooze(alarm!.snoozeMins);
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <AnimatePresence>
      {alarm && (
        <motion.div
          key="call-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{
            background: "radial-gradient(ellipse at center, rgba(0,20,10,0.97) 0%, rgba(0,0,0,0.99) 100%)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="flex flex-col items-center gap-8 px-6 select-none w-full max-w-sm">
            {/* Top label */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-primary/70">
                TraderLoading
              </span>
              <span className="text-sm text-muted-foreground">Sveglia attiva</span>
            </motion.div>

            {/* Pulsing avatar */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 180 }}
              className="relative flex items-center justify-center"
            >
              <PulseRing delay={0} />
              <PulseRing delay={0.7} />
              <PulseRing delay={1.4} />
              <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/50 flex items-center justify-center shadow-2xl shadow-primary/20">
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <TrendingUp className="w-12 h-12 text-primary" />
                </motion.div>
              </div>
            </motion.div>

            {/* Label & time */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col items-center gap-2"
            >
              <h2 className="text-2xl font-bold text-foreground tracking-tight text-center">
                {alarm.label}
              </h2>
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlarmClock className="w-4 h-4" />
                <span className="text-sm font-mono">{alarm.time}</span>
                <span className="text-xs opacity-50">• {fmt(elapsed)}</span>
              </div>
            </motion.div>

            {/* Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex items-end gap-10 mt-4"
            >
              {/* Dismiss */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={handleDismiss}
                  className="w-16 h-16 rounded-full bg-destructive/20 border border-destructive/40 flex items-center justify-center hover:bg-destructive/30 active:scale-95 transition-all"
                >
                  <X className="w-7 h-7 text-destructive" />
                </button>
                <span className="text-xs text-muted-foreground">Chiudi</span>
              </div>

              {/* Snooze (only if snoozeMins > 0) */}
              {alarm.snoozeMins > 0 && (
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={handleSnooze}
                    className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/60 flex items-center justify-center hover:bg-primary/30 active:scale-95 transition-all shadow-lg shadow-primary/20"
                  >
                    <motion.div
                      animate={{ rotate: [0, -8, 8, -8, 8, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1.5 }}
                    >
                      <BellOff className="w-8 h-8 text-primary" />
                    </motion.div>
                  </button>
                  <span className="text-xs text-muted-foreground">Snooze {alarm.snoozeMins}m</span>
                </div>
              )}

              {/* Accept/OK (same as dismiss if no snooze) */}
              {alarm.snoozeMins === 0 && (
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={handleDismiss}
                    className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/60 flex items-center justify-center hover:bg-primary/30 active:scale-95 transition-all shadow-lg shadow-primary/20"
                  >
                    <AlarmClock className="w-8 h-8 text-primary" />
                  </button>
                  <span className="text-xs text-muted-foreground">OK</span>
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
