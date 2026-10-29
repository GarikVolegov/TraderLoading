import { motion } from "framer-motion";
import { Link } from "wouter";
import { uiText } from "@/contexts/LanguageContext";
import { Sunrise, Moon, ChevronRight, ShieldCheck } from "lucide-react";
import type { Program, Answers } from "./types";

export function CompleteStep({ program, answers }: { program: Program; answers: Answers }) {
  const emotion = answers.emotion as string | undefined;
  const goals = answers.goals as Record<string, string> | undefined;
  const review = answers.tradeReview as Record<string, string> | undefined;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="w-20 h-20 rounded-2xl flex items-center justify-center border border-[#C5A059]/40 bg-[#C5A059]/15 shadow-[0_0_24px_rgba(197,160,89,0.25)]"
      >
        {program === "morning"
          ? <Sunrise className="w-10 h-10 text-[#E8C56A]" />
          : <Moon className="w-10 h-10 text-[#E8C56A]" />
        }
      </motion.div>

      {/* Summary cards */}
      <div className="w-full grid grid-cols-2 gap-3">
        {emotion && (
          <div className="col-span-2 flex items-center gap-3 px-4 py-3 rounded-xl border border-[#C5A059]/25 bg-black/40">
            <ShieldCheck className="w-4 h-4 text-[#C5A059] shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground/60 uppercase font-mono tracking-wider">
                {uiText("auto.ui.ef9fdf32a7")}
              </p>
              <p className="font-mono text-xs font-bold text-[#E8C56A] uppercase tracking-wider">{emotion}</p>
            </div>
          </div>
        )}

        {program === "morning" && goals && (
          <>
            {goals.target && (
              <div className="px-4 py-3 rounded-xl border border-white/10 bg-black/40">
                <p className="text-[10px] text-muted-foreground/60 uppercase font-mono tracking-wider">{uiText("auto.ui.61ad50a9b9")}</p>
                <p className="text-sm font-bold font-mono text-[#E8C56A]">{goals.target}</p>
              </div>
            )}
            {goals.maxloss && (
              <div className="px-4 py-3 rounded-xl border border-white/10 bg-black/40">
                <p className="text-[10px] text-muted-foreground/60 uppercase font-mono tracking-wider">{uiText("auto.ui.bd6c02c7a4")}</p>
                <p className="text-sm font-bold font-mono text-red-400">{goals.maxloss}</p>
              </div>
            )}
          </>
        )}

        {program === "evening" && review && (
          <>
            {(review.win || review.loss) && (
              <div className="col-span-2 flex gap-4 px-4 py-3 rounded-xl border border-white/10 bg-black/40">
                <div>
                  <p className="text-[10px] text-emerald-400 uppercase font-mono tracking-wider">{uiText("auto.ui.4973f4c599")}</p>
                  <p className="text-lg font-bold font-mono text-emerald-400">{review.win || "0"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-red-400 uppercase font-mono tracking-wider">{uiText("auto.ui.12e24a7d8a")}</p>
                  <p className="text-lg font-bold font-mono text-red-400">{review.loss || "0"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground/60 uppercase font-mono tracking-wider">B/E</p>
                  <p className="text-lg font-bold font-mono text-muted-foreground/75">{review.be || "0"}</p>
                </div>
                {review.pnl && (
                  <div className="ml-auto">
                    <p className="text-[10px] text-muted-foreground/60 uppercase font-mono tracking-wider">P&L</p>
                    <p className="text-sm font-bold font-mono text-[#E8C56A]">{review.pnl}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-xs font-mono text-muted-foreground/70 text-center italic leading-relaxed">
        {program === "morning"
          ? "Allineamento sigillato. Entra con metodo: ogni esecuzione è subordinata al Custode della Soglia."
          : "La seduta è conclusa. La rendicontazione su Il Libro della Verità consolida l'esperienza ed elimina la deriva."}
      </p>

      <Link
        href={program === "morning" ? "/?vista=notizie" : "/journal"}
        className="flex items-center gap-2 font-mono text-xs font-bold text-[#E8C56A] hover:text-[#F3D88C] transition-colors uppercase tracking-wider"
      >
        {program === "morning" ? "Accedi a Il Varco & Briefing Macro" : "Apri Il Libro della Verità"}
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
