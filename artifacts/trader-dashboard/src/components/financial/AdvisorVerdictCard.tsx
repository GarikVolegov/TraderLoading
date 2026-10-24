import React from "react";
import type { AdvisorHealthEvaluation } from "../../../../../contracts/financialArchitecture";
import { ShieldCheck, Target, Sparkles, CheckCircle2 } from "lucide-react";
import { ToolInfoTrigger } from "./ToolInfoTrigger";

export interface AdvisorVerdictCardProps {
  evaluation: AdvisorHealthEvaluation;
  onOpenDossier: (toolId: string) => void;
  className?: string;
}

export const AdvisorVerdictCard: React.FC<AdvisorVerdictCardProps> = ({
  evaluation,
  onOpenDossier,
  className = "",
}) => {
  const isOptimal = evaluation.score >= 80;
  const isAttention = evaluation.score < 65;

  const scoreBadgeTone = isOptimal
    ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
    : isAttention
      ? "bg-red-950/30 border-red-500/40 text-red-300"
      : "bg-[#C5A059]/15 border-[#C5A059]/40 text-[#E8C56A]";

  return (
    <div
      className={`rounded-xl border border-border/70 bg-[#07080b]/80 p-2.5 sm:p-3 space-y-2 transition-all shadow-sm ${className}`}
    >
      {/* Intestazione del Verdetto */}
      <div className="flex items-center justify-between border-b border-border/50 pb-1.5 gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Sparkles className="h-3.5 w-3.5 text-[#C5A059] shrink-0" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#E8C56A] truncate">
            Diagnosi dell'Architetto
          </span>
          <ToolInfoTrigger
            toolId="portfolioStressTest"
            toolName="Diagnosi Advisor"
            onClick={onOpenDossier}
            tone="gold"
            size="xs"
          />
        </div>

        {/* Score Circolare / Chip Sovrana */}
        <div
          className={`font-mono text-[9.5px] font-bold uppercase px-2 py-0.5 rounded border whitespace-nowrap shrink-0 ${scoreBadgeTone}`}
        >
          {evaluation.score}/100 {evaluation.grade}
        </div>
      </div>

      {/* Griglia a 3 Micro-KPI Consulenziali */}
      <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
        {/* KPI 1: Tasso di Risparmio */}
        <div className="rounded border border-border/60 bg-[#11131c]/50 p-1.5">
          <span className="text-[9.5px] uppercase text-slate-400 block truncate font-medium">
            Savings Rate
          </span>
          <span
            className={`text-xs font-bold block mt-0.5 ${
              evaluation.savingsRatePct >= 20 ? "text-emerald-400" : "text-[#E8C56A]"
            }`}
          >
            {evaluation.savingsRatePct.toFixed(1)}%
          </span>
        </div>

        {/* KPI 2: Crossover Indipendenza */}
        <div className="rounded border border-border/60 bg-[#11131c]/50 p-1.5">
          <div className="flex items-center justify-center gap-1">
            <Target className="h-2.5 w-2.5 text-[#C5A059]" />
            <span className="text-[9.5px] uppercase text-slate-400 block truncate font-medium">
              Crossover
            </span>
          </div>
          <span className="text-xs font-bold text-foreground block mt-0.5 truncate">
            {evaluation.crossoverYear !== null ? `Anno ${evaluation.crossoverYear}` : "In Crescita"}
          </span>
        </div>

        {/* KPI 3: Scudo Antifragile */}
        <div className="rounded border border-border/60 bg-[#11131c]/50 p-1.5">
          <div className="flex items-center justify-center gap-1">
            <ShieldCheck className="h-2.5 w-2.5 text-emerald-400" />
            <span className="text-[9.5px] uppercase text-slate-400 block truncate font-medium">
              Scudo Shock
            </span>
          </div>
          <span className="text-xs font-bold text-emerald-400 block mt-0.5">
            {evaluation.shieldScore}/100
          </span>
        </div>
      </div>

      {/* 2 Raccomandazioni Chirurgiche (Zero Muri di Testo) */}
      <div className="space-y-1 pt-0.5">
        {evaluation.recommendations.slice(0, 2).map((rec, i) => (
          <div
            key={i}
            className="flex items-start gap-1.5 text-[10px] sm:text-[10.5px] font-sans text-slate-300 leading-snug"
          >
            <CheckCircle2 className="h-3 w-3 text-[#C5A059] shrink-0 mt-0.5" />
            <span className="line-clamp-2">{rec}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
