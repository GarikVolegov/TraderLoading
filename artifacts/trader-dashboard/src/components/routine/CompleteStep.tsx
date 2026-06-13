import { motion } from "framer-motion";
import { Link } from "wouter";
import { uiText } from "@/contexts/LanguageContext";
import { Sunrise, Moon, ChevronRight, Smile } from "lucide-react";
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
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">{uiText("auto.ui.ef9fdf32a7")}</p>
              <p className="text-sm font-semibold capitalize">{emotion}</p>
            </div>
          </div>
        )}

        {program === "morning" && goals && (
          <>
            {goals.target && (
              <div className="px-4 py-3 rounded-xl border border-border/30 bg-card/50">
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">{uiText("auto.ui.61ad50a9b9")}</p>
                <p className="text-sm font-bold font-mono text-primary">{goals.target}</p>
              </div>
            )}
            {goals.maxloss && (
              <div className="px-4 py-3 rounded-xl border border-border/30 bg-card/50">
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">{uiText("auto.ui.bd6c02c7a4")}</p>
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
                  <p className="text-[10px] text-green-400 uppercase tracking-wider">{uiText("auto.ui.4973f4c599")}</p>
                  <p className="text-lg font-bold font-mono text-green-400">{review.win || "0"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-red-400 uppercase tracking-wider">{uiText("auto.ui.12e24a7d8a")}</p>
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
