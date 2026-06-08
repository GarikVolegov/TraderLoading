import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BellOff, Building2, Phone, ShieldCheck, X } from "lucide-react";
import { reportClientError } from "@/lib/clientErrorReporter";
import type { ScheduledCallConfig } from "@/lib/scheduledCalls";

interface ScheduledCallOverlayProps {
  call: ScheduledCallConfig | null;
  onDismiss: () => void;
  onSnooze: (mins: number) => void;
}

function createCallTone(ctx: AudioContext, ringtone: ScheduledCallConfig["ringtone"]): () => void {
  let stopped = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const tone = ringtone === "institutional" ? [392, 494, 587] : ringtone === "gentle" ? [523, 659, 784] : [740, 920, 740];

  const beep = (delay: number, freq: number, duration: number, volume = 0.24) => {
    const timer = setTimeout(() => {
      if (stopped || ctx.state === "closed") return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = ringtone === "digital" ? "square" : "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.03);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration + 0.03);
    }, delay);
    timers.push(timer);
  };

  const pattern = () => {
    if (stopped) return;
    tone.forEach((freq, index) => beep(index * 260, freq, 0.18));
    timers.push(setTimeout(pattern, ringtone === "pulse" ? 1500 : 2400));
  };
  pattern();

  return () => {
    stopped = true;
    timers.forEach(clearTimeout);
  };
}

export function ScheduledCallOverlay({ call, onDismiss, onSnooze }: ScheduledCallOverlayProps) {
  const stopToneRef = useRef<(() => void) | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!call) return;
    setElapsed(0);
    const ticker = setInterval(() => setElapsed((value) => value + 1), 1000);
    const ctx = new AudioContext();
    stopToneRef.current = createCallTone(ctx, call.ringtone);
    return () => {
      clearInterval(ticker);
      stopToneRef.current?.();
      stopToneRef.current = null;
      ctx.close().catch((error) => reportClientError(error, { context: "scheduled call audio close", notify: false }));
    };
  }, [call]);

  const close = () => {
    stopToneRef.current?.();
    onDismiss();
  };

  const snooze = () => {
    if (!call) return;
    stopToneRef.current?.();
    onSnooze(call.snoozeMins);
  };

  const fmt = (seconds: number) =>
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <AnimatePresence>
      {call && (
        <motion.div
          key="scheduled-bank-call"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[radial-gradient(circle_at_50%_20%,rgba(201,162,39,0.16),rgba(2,6,23,0.98)_46%,rgba(0,0,0,1))] px-5 text-foreground backdrop-blur-xl"
        >
          <div className="w-full max-w-sm select-none">
            <motion.div
              initial={{ y: 18, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 170, damping: 20 }}
              className="relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-slate-950/90 p-6 shadow-2xl shadow-black/70"
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: call.accentColor }} />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" style={{ color: call.accentColor }} />
                  Chiamata verificata
                </div>
                <div className="font-mono text-xs text-muted-foreground">{fmt(elapsed)}</div>
              </div>

              <div className="mt-7 flex flex-col items-center text-center">
                <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-white/10 bg-slate-900 shadow-[0_0_0_10px_rgba(255,255,255,0.03)]">
                  <motion.div
                    className="absolute inset-0 rounded-full border"
                    style={{ borderColor: call.accentColor }}
                    animate={{ scale: [1, 1.25, 1.45], opacity: [0.65, 0.18, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                  />
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/40 text-xl font-black" style={{ color: call.accentColor }}>
                    {call.logoText || <Building2 className="h-9 w-9" />}
                  </div>
                </div>

                <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em]" style={{ color: call.accentColor }}>
                  {call.department}
                </p>
                <h2 className="mt-2 text-2xl font-black leading-tight tracking-normal">{call.callerName || "Banca - Ufficio Risk"}</h2>
                <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">{call.callMessage}</p>
              </div>

              <div className="mt-8 flex items-end justify-center gap-8">
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={close}
                    className="flex h-16 w-16 items-center justify-center rounded-full border border-red-400/35 bg-red-500/15 text-red-300 transition hover:bg-red-500/25 active:scale-95"
                    aria-label={call.secondaryActionLabel}
                  >
                    <X className="h-7 w-7" />
                  </button>
                  <span className="text-xs text-muted-foreground">{call.secondaryActionLabel}</span>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={close}
                    className="flex h-20 w-20 items-center justify-center rounded-full border-2 text-slate-950 shadow-lg transition active:scale-95"
                    style={{ backgroundColor: call.accentColor, borderColor: call.accentColor }}
                    aria-label={call.primaryActionLabel}
                  >
                    <Phone className="h-8 w-8" />
                  </button>
                  <span className="text-xs text-muted-foreground">{call.primaryActionLabel}</span>
                </div>

                {call.snoozeMins > 0 && (
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={snooze}
                      className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/10 text-muted-foreground transition hover:bg-white/15 active:scale-95"
                      aria-label={`Snooze ${call.snoozeMins}m`}
                    >
                      <BellOff className="h-6 w-6" />
                    </button>
                    <span className="text-xs text-muted-foreground">{call.snoozeMins} min</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
