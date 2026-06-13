import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Play, Eye } from "lucide-react";

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

export function VisualizationStep({ onSkip }: { onSkip: () => void }) {
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
