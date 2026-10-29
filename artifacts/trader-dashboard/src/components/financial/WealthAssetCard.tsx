import React from "react";
import { ToolInfoTrigger } from "./ToolInfoTrigger";
import { Slider } from "@/components/ui/slider";
import { Clock, Zap } from "lucide-react";

export interface WealthAssetCardProps {
  toolId: string;
  label: string;
  subtitle: string;
  icon?: React.ReactNode;
  valueEuro: number;
  pct: number;
  subPct?: number;
  subPctLabel?: string;
  totalNetWorth: number;
  color: string;
  tone?: "gold" | "emerald" | "crimson" | "slate";
  derivedMetricLabel?: string;
  derivedMetricValue?: string;
  secondaryMetric?: string;
  timingSignal?: string;
  timingScore?: number;
  pacMonthlyEuro?: number;
  badgeTag?: string;
  onChangeEuro: (newVal: number) => void;
  onOpenDossier: (toolId: string) => void;
  onOpenPropCalculator?: () => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export const WealthAssetCard: React.FC<WealthAssetCardProps> = ({
  toolId,
  label,
  subtitle: _subtitle,
  icon: _icon,
  valueEuro,
  pct,
  subPct,
  subPctLabel = "Inv",
  totalNetWorth: _totalNetWorth,
  color,
  tone = "gold",
  derivedMetricLabel,
  derivedMetricValue,
  secondaryMetric,
  timingSignal,
  timingScore,
  pacMonthlyEuro,
  badgeTag,
  onChangeEuro,
  onOpenDossier,
  onOpenPropCalculator,
  min = 0,
  max = 100000,
  step = 500,
  className = "",
}) => {
  const toneBorder =
    tone === "emerald"
      ? "border-emerald-500/35 hover:border-emerald-500/60 bg-emerald-950/20"
      : tone === "crimson"
        ? "border-red-500/35 hover:border-red-500/60 bg-red-950/20"
        : tone === "slate"
          ? "border-slate-700/70 hover:border-slate-500/70 bg-slate-900/35"
          : "border-[#C5A059]/30 hover:border-[#C5A059]/65 bg-[#0d0f14]/95 shadow-[0_0_15px_rgba(0,0,0,0.35)]";

  return (
    <div
      className={`rounded-xl border p-3 sm:p-3.5 transition-all duration-150 flex flex-col justify-between gap-2 ${toneBorder} ${className}`}
    >
      {/* ─── RIGA 1: NOME ASSET COMPLETO (ZERO TRUNCATE) + INPUT VALORE (€) & QUOTA (%) ─── */}
      <div className="flex items-center justify-between gap-2">
        {/* Identità Asset: icona, label e micro-trigger */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="h-2 w-2 rounded-full shrink-0 shadow-[0_0_6px_currentColor]"
            style={{ backgroundColor: color, color }}
          />
          <span className="font-mono text-xs sm:text-[13px] font-bold uppercase tracking-tight text-foreground truncate min-w-0">
            {label}
          </span>
          <ToolInfoTrigger
            toolId={toolId}
            toolName={label}
            onClick={onOpenDossier}
            tone={tone}
            size="xs"
          />
        </div>

        {/* Controllo Valore Compatto & Percentuale */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative">
            <input
              type="number"
              min={min}
              step={step}
              value={valueEuro === 0 ? "" : valueEuro}
              onChange={(e) => onChangeEuro(Math.max(0, Number(e.target.value) || 0))}
              placeholder="0"
              aria-label={`Allocazione per ${label}`}
              className="w-20 sm:w-24 h-7 text-right font-mono text-xs sm:text-[12.5px] font-bold pr-4 bg-[#07080b] border border-[#C5A059]/35 rounded px-2 text-foreground focus:border-[#E8C56A] outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="absolute right-1.5 top-1 font-mono text-[10px] text-[#C5A059] font-bold pointer-events-none">
              €
            </span>
          </div>

          <div className="flex items-center gap-1">
            {subPct !== undefined && (
              <span
                className="font-mono text-[9.5px] text-slate-400 whitespace-nowrap hidden sm:inline"
                title={`${subPct.toFixed(1)}% del paniere investimenti`}
              >
                ({subPct.toFixed(0)}% {subPctLabel})
              </span>
            )}
            <span className="font-mono text-xs sm:text-[12.5px] font-bold text-[#E8C56A] whitespace-nowrap min-w-[46px] text-right px-1.5 py-0.5 rounded bg-[#C5A059]/10 border border-[#C5A059]/25">
              {pct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* ─── RIGA 2: SLIDER DI REGOLAZIONE DINAMICA A TUTTA LARGHEZZA ─── */}
      <div className="px-0.5 py-0.5">
        <Slider
          value={[Math.min(max, valueEuro)]}
          min={min}
          max={max}
          step={step}
          onValueChange={([val]) => onChangeEuro(val ?? 0)}
          className="py-1 cursor-pointer"
        />
      </div>

      {/* ─── RIGA 3: TELEMETRIE OPERATIVE & RENDIMENTO QUANTITATIVO AD ALTO CONTRASTO ─── */}
      <div className="flex items-center justify-between gap-2 font-mono text-[10.5px] sm:text-[11px] pt-0.5 min-w-0">
        {/* Regime / Timing Quantitativo con Score */}
        {timingSignal ? (
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Clock className="h-3 w-3 text-[#C5A059] shrink-0" />
            {timingScore !== undefined && (
              <span
                className={`px-1.5 py-0.2 rounded font-bold text-[9px] shrink-0 font-mono ${
                  timingScore >= 80
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                    : timingScore >= 60
                      ? "bg-[#C5A059]/25 text-[#E8C56A] border border-[#C5A059]/40"
                      : "bg-red-950/70 text-red-300 border border-red-500/40"
                }`}
              >
                {timingScore}/100
              </span>
            )}
            <span className="truncate text-slate-200 font-medium text-[10.5px] sm:text-[11px]">{timingSignal}</span>
          </div>
        ) : (
          <span className="text-slate-400 truncate min-w-0">{badgeTag || ""}</span>
        )}

        {/* Metrica Quantitativa di Rendimento (Right-aligned, ampio spazio garantito) */}
        {derivedMetricValue && (
          <div className="flex items-center gap-1 text-[#E8C56A] whitespace-nowrap shrink-0 font-mono text-[10.5px]">
            {derivedMetricLabel && (
              <span className="text-slate-400 uppercase text-[9px] hidden sm:inline font-semibold">
                {derivedMetricLabel}:
              </span>
            )}
            <span className="font-bold">
              {derivedMetricValue}
            </span>
          </div>
        )}
      </div>

      {/* ─── RIGA 4: MICRO-TELEMETRIA SECONDARIA, PAC MENSILE E BADGE ─── */}
      {(secondaryMetric || (pacMonthlyEuro !== undefined && pacMonthlyEuro > 0) || badgeTag || onOpenPropCalculator) && (
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-border/40 min-w-0">
          <span className="text-slate-400 font-medium truncate min-w-0 flex-1">
            {secondaryMetric || ""}
          </span>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {onOpenPropCalculator && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPropCalculator();
                }}
                className="inline-flex items-center gap-1 font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#C5A059]/20 border border-[#C5A059]/40 text-[#E8C56A] hover:bg-[#C5A059]/35 hover:text-[#F3D88C] transition-all cursor-pointer whitespace-nowrap shadow-sm"
                title="Apri il Calcolatore Asimmetrico Prop Firm & Broker Sovrani"
              >
                <Zap className="h-2.5 w-2.5 text-[#E8C56A]" />
                <span>Prop Firm (148x)</span>
              </button>
            )}
            {pacMonthlyEuro !== undefined && pacMonthlyEuro > 0 && (
              <span className="font-bold text-emerald-400 bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-500/30 whitespace-nowrap text-[9px]">
                +{pacMonthlyEuro.toLocaleString("it-IT")} €/m PAC
              </span>
            )}
            {badgeTag && (
              <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-secondary/50 border border-border/50 text-slate-400 whitespace-nowrap">
                {badgeTag}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
