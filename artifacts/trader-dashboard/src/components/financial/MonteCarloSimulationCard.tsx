import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  simulateMonteCarloEquity,
  type AccountObjective,
  type TradingStyle,
} from "../../../../../contracts/financialArchitecture";
import {
  TrendingUp,
  ShieldCheck,
  Activity,
  Waves,
  BarChart3,
  Grid3X3,
} from "lucide-react";

interface MonteCarloSimulationCardProps {
  tradingAllocation: number;
  reserveAllocation: number;
  expectedMonthlyReturnPct: number;
  simulatedDrawdownPct: number;
  accountObjective: AccountObjective;
  initialWinRatePct?: number;
  initialRiskRewardRatio?: number;
  className?: string;
}

type TabView = "trajectories" | "underwater" | "distribution" | "matrix";

const W = 620;
const H = 220;
const PAD_X = 48;
const PAD_Y = 28;

export const MonteCarloSimulationCard: React.FC<MonteCarloSimulationCardProps> = ({
  tradingAllocation,
  reserveAllocation,
  expectedMonthlyReturnPct,
  simulatedDrawdownPct,
  accountObjective,
  initialWinRatePct = 54,
  initialRiskRewardRatio = 1.85,
  className = "",
}) => {
  const [horizonMonths, setHorizonMonths] = useState<number>(12);
  const [tradingStyle, setTradingStyle] = useState<TradingStyle>("DAY_TRADING");
  const [winRatePct, setWinRatePct] = useState<number>(initialWinRatePct);
  const [riskRewardRatio, setRiskRewardRatio] = useState<number>(initialRiskRewardRatio);
  const [tradesPerMonth, setTradesPerMonth] = useState<number>(20);
  const [activeTab, setActiveTab] = useState<TabView>("trajectories");
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const initialCapital = Math.max(0, tradingAllocation);
  const monthlyReturn = Math.max(0.5, expectedMonthlyReturnPct || 3);
  const drawdownPct = Math.max(3, simulatedDrawdownPct || 10);

  // Expectancy matematica per trade in unità R
  const expectancyR = (winRatePct / 100) * riskRewardRatio - (1 - winRatePct / 100);

  const mc = useMemo(() => {
    return simulateMonteCarloEquity({
      initialCapital,
      expectedMonthlyReturnPct: monthlyReturn,
      simulatedDrawdownPct: drawdownPct,
      horizonMonths,
      accountObjective,
      tradingStyle,
      winRatePct,
      riskRewardRatio,
      tradesPerMonth,
      iterations: 1000,
      seed: 20261018,
      samplePathCount: 14,
    });
  }, [
    initialCapital,
    monthlyReturn,
    drawdownPct,
    horizonMonths,
    accountObjective,
    tradingStyle,
    winRatePct,
    riskRewardRatio,
    tradesPerMonth,
  ]);

  // SVG coordinate mappers per Equity
  const allValues = useMemo(() => {
    if (initialCapital <= 0) return [0, 1000];
    return [
      ...mc.p5,
      ...mc.p95,
      initialCapital,
      ...mc.samplePaths.flatMap((p: number[]) => p),
    ];
  }, [mc, initialCapital]);

  const minVal = useMemo(() => {
    const rawMin = Math.min(...allValues);
    return Math.max(0, Math.floor(rawMin * 0.94));
  }, [allValues]);

  const maxVal = useMemo(() => {
    const rawMax = Math.max(...allValues);
    return Math.max(rawMax * 1.06, initialCapital * 1.15, 100);
  }, [allValues, initialCapital]);

  const steps = horizonMonths;
  const xOf = useCallback((step: number) => PAD_X + (step / steps) * (W - PAD_X * 2), [steps]);
  const yOf = useCallback(
    (val: number) => {
      const range = maxVal - minVal || 1;
      const clamped = Math.max(minVal, Math.min(maxVal, val));
      return H - PAD_Y - ((clamped - minVal) / range) * (H - PAD_Y * 2);
    },
    [maxVal, minVal],
  );

  // SVG coordinate mappers per Underwater Drawdown (0% in cima, maxDrawdown in basso)
  const maxUnderwaterDD = useMemo(() => {
    const deepest = Math.max(25, mc.maxDrawdownEstimatedPct * 1.1);
    return Math.min(100, Math.ceil(deepest / 5) * 5);
  }, [mc.maxDrawdownEstimatedPct]);

  const yOfDD = useCallback(
    (ddPctVal: number) => {
      const clamped = Math.max(0, Math.min(maxUnderwaterDD, ddPctVal));
      return PAD_Y + (clamped / maxUnderwaterDD) * (H - PAD_Y * 2);
    },
    [maxUnderwaterDD],
  );

  // Calcolo percorsi Fan Chart
  const p5p95Band = useMemo(() => {
    if (mc.p5.length === 0) return "";
    const top = mc.p95.map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
    const bottom = mc.p5
      .map((_, i) => {
        const revIdx = mc.p5.length - 1 - i;
        return `L${xOf(revIdx).toFixed(1)},${yOf(mc.p5[revIdx]).toFixed(1)}`;
      })
      .join(" ");
    return `${top} ${bottom} Z`;
  }, [mc.p95, mc.p5, xOf, yOf]);

  const p10p90Band = useMemo(() => {
    if (mc.p10.length === 0) return "";
    const top = mc.p90.map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
    const bottom = mc.p10
      .map((_, i) => {
        const revIdx = mc.p10.length - 1 - i;
        return `L${xOf(revIdx).toFixed(1)},${yOf(mc.p10[revIdx]).toFixed(1)}`;
      })
      .join(" ");
    return `${top} ${bottom} Z`;
  }, [mc.p90, mc.p10, xOf, yOf]);

  const p25p75Band = useMemo(() => {
    if (mc.p25.length === 0) return "";
    const top = mc.p75.map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
    const bottom = mc.p25
      .map((_, i) => {
        const revIdx = mc.p25.length - 1 - i;
        return `L${xOf(revIdx).toFixed(1)},${yOf(mc.p25[revIdx]).toFixed(1)}`;
      })
      .join(" ");
    return `${top} ${bottom} Z`;
  }, [mc.p75, mc.p25, xOf, yOf]);

  const p10Path = mc.p10.map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  const p90Path = mc.p90.map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  const medianPath = mc.p50.map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");

  // Calcolo percorsi Underwater
  const underwaterP90Band = useMemo(() => {
    if (mc.drawdownP90.length === 0) return "";
    const line = mc.drawdownP90
      .map((dd, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOfDD(dd).toFixed(1)}`)
      .join(" ");
    const baselineReturn = `L${xOf(steps).toFixed(1)},${yOfDD(0).toFixed(1)} L${xOf(0).toFixed(1)},${yOfDD(0).toFixed(1)} Z`;
    return `${line} ${baselineReturn}`;
  }, [mc.drawdownP90, steps, xOf, yOfDD]);

  const underwaterP50Path = useMemo(() => {
    return mc.drawdownP50
      .map((dd, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOfDD(dd).toFixed(1)}`)
      .join(" ");
  }, [mc.drawdownP50, xOf, yOfDD]);

  const baselineY = yOf(initialCapital);
  const endMedianX = xOf(steps);
  const endMedianY = yOf(mc.endP50);

  // Gestione interazione hover/scrubbing
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgWidth = rect.width;
    const ratio = Math.max(0, Math.min(1, (mouseX / svgWidth) * W));
    const stepRatio = (ratio - PAD_X) / (W - PAD_X * 2);
    const m = Math.max(0, Math.min(steps, Math.round(stepRatio * steps)));
    setHoverMonth(m);
  };

  const handleMouseLeave = () => {
    setHoverMonth(null);
  };

  // Calcolo Rapporto di Copertura Fondo Riserva vs Peggiore Drawdown P95
  const estimatedMaxLossEuro = Math.round(initialCapital * (mc.maxDrawdownP95Pct / 100));
  const reserveCoverageRatio =
    estimatedMaxLossEuro > 0 ? (reserveAllocation / estimatedMaxLossEuro).toFixed(1) : "∞";

  if (initialCapital <= 0) {
    return (
      <div
        className={`w-full rounded-xl border border-dashed border-border/80 bg-[#101014] p-6 text-center flex flex-col items-center justify-center min-h-[300px] ${className}`}
      >
        <Activity className="h-9 w-9 text-muted-foreground/60 mb-2 animate-pulse" />
        <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Simulatore Quantitativo Monte Carlo
        </h4>
        <p className="text-xs text-muted-foreground/80 mt-1 max-w-sm leading-relaxed">
          Assegna una quota al Capitale di Trading nel pannello centrale per generare 1.000 traiettorie stocastiche, analizzare la distribuzione dei drawdown e calcolare il Value at Risk.
        </p>
      </div>
    );
  }

  const inspectedMonth = hoverMonth !== null ? mc.monthDetails[hoverMonth] : null;

  return (
    <div
      className={`w-full rounded-xl border border-border bg-[#101014] p-4 sm:p-5 flex flex-col justify-between shadow-sm transition-all ${className}`}
    >
      {/* ─── HEADER: TITOLO, BADGE CODE SPESSE & CONTROLLI ─── */}
      <div className="space-y-3 pb-3 border-b border-border/70">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                  Proiezione Monte Carlo Quantitativa
                </h4>
                <span className="rounded bg-[#C5A059]/15 px-2 py-0.5 font-mono text-[9px] font-bold text-[#C5A059] border border-[#C5A059]/30">
                  1.000 TRAIETTORIE // STUDENT-T FAT TAIL
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {accountObjective === "GROWTH"
                  ? `Compounding Puro // Rendimento Atteso ${monthlyReturn}%/mese // Tolleranza Drawdown -${drawdownPct}%`
                  : `Regime Cashflow // Prelievo 40% surplus // Compounding 60%`}
              </p>
            </div>
          </div>

          {/* Selettori Orizzonte e Stile Operativo */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Orizzonte Mesi */}
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-[#0D0D10] p-0.5">
              {[12, 24, 36, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setHorizonMonths(m)}
                  className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold transition-all ${
                    horizonMonths === m
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={`${m} Mesi (${(m / 12).toFixed(0)} Anni)`}
                >
                  {m}m
                </button>
              ))}
            </div>

            {/* Frequenza / Trading Style */}
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-[#0D0D10] p-0.5">
              {(["SCALPING", "DAY_TRADING", "SWING_TRADING"] as TradingStyle[]).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setTradingStyle(style)}
                  className={`rounded px-2 py-0.5 font-mono text-[9px] font-bold transition-all ${
                    tradingStyle === style
                      ? "bg-[#C5A059]/25 text-[#C5A059] border border-[#C5A059]/40"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {style === "SCALPING" ? "Scalp" : style === "DAY_TRADING" ? "Day" : "Swing"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── BARRA DI CALIBRAZIONE REALE: WIN RATE, R:R & EXPECTANCY (ZERO RETTE) ─── */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-[#07080b] border border-[#C5A059]/25 font-mono text-[9.5px]">
          {/* Win Rate */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 uppercase font-semibold">Win Rate:</span>
            <div className="flex items-center gap-0.5 bg-[#0D0D10] p-0.5 rounded border border-border">
              {[45, 50, 54, 60].map((wr) => (
                <button
                  key={wr}
                  type="button"
                  onClick={() => setWinRatePct(wr)}
                  className={`px-1.5 py-0.2 rounded font-bold transition-all ${
                    winRatePct === wr
                      ? "bg-[#C5A059] text-[#07080b] shadow-xs"
                      : "text-slate-400 hover:text-foreground"
                  }`}
                >
                  {wr}%
                </button>
              ))}
            </div>
          </div>

          {/* Risk to Reward */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 uppercase font-semibold">Risk:Reward:</span>
            <div className="flex items-center gap-0.5 bg-[#0D0D10] p-0.5 rounded border border-border">
              {[1.5, 1.85, 2.0, 2.5].map((rr) => (
                <button
                  key={rr}
                  type="button"
                  onClick={() => setRiskRewardRatio(rr)}
                  className={`px-1.5 py-0.2 rounded font-bold transition-all ${
                    riskRewardRatio === rr
                      ? "bg-[#C5A059] text-[#07080b] shadow-xs"
                      : "text-slate-400 hover:text-foreground"
                  }`}
                >
                  {rr}R
                </button>
              ))}
            </div>
          </div>

          {/* Frequenza Trade/Mese */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 uppercase font-semibold">Trade/m:</span>
            <div className="flex items-center gap-0.5 bg-[#0D0D10] p-0.5 rounded border border-border">
              {[10, 20, 30].map((tpm) => (
                <button
                  key={tpm}
                  type="button"
                  onClick={() => setTradesPerMonth(tpm)}
                  className={`px-1.5 py-0.2 rounded font-bold transition-all ${
                    tradesPerMonth === tpm
                      ? "bg-[#C5A059] text-[#07080b] shadow-xs"
                      : "text-slate-400 hover:text-foreground"
                  }`}
                >
                  {tpm}
                </button>
              ))}
            </div>
          </div>

          {/* Expectancy Edge Badge */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-bold">
            <span>EV:</span>
            <span>+{expectancyR.toFixed(2)} R</span>
            <span className="text-slate-400 text-[8.5px] font-normal">
              (+{(expectancyR * (initialCapital * 0.0081)).toFixed(0)} €/trade)
            </span>
          </div>
        </div>

        {/* ─── TABS INTERATTIVI DI VISUALIZZAZIONE ─── */}
        <div className="flex items-center gap-1.5 border-t border-border/60 pt-2.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("trajectories")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[10px] font-bold transition-all shrink-0 ${
              activeTab === "trajectories"
                ? "bg-primary text-primary-foreground"
                : "bg-[#0D0D10] text-muted-foreground hover:text-foreground hover:bg-[#141418]"
            }`}
          >
            <TrendingUp className="h-3 w-3" />
            <span>Fan Chart Traiettorie</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("underwater")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[10px] font-bold transition-all shrink-0 ${
              activeTab === "underwater"
                ? "bg-[#8B1E1E] text-white"
                : "bg-[#0D0D10] text-muted-foreground hover:text-foreground hover:bg-[#141418]"
            }`}
          >
            <Waves className="h-3 w-3" />
            <span>Drawdown Underwater</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("distribution")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[10px] font-bold transition-all shrink-0 ${
              activeTab === "distribution"
                ? "bg-[#C5A059] text-[#0A0A0C]"
                : "bg-[#0D0D10] text-muted-foreground hover:text-foreground hover:bg-[#141418]"
            }`}
          >
            <BarChart3 className="h-3 w-3" />
            <span>Istogramma Terminale</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("matrix")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[10px] font-bold transition-all shrink-0 ${
              activeTab === "matrix"
                ? "bg-[#C5A059] text-[#0A0A0C]"
                : "bg-[#0D0D10] text-muted-foreground hover:text-foreground hover:bg-[#141418]"
            }`}
          >
            <Grid3X3 className="h-3 w-3" />
            <span>Stress Test Matrix</span>
          </button>
        </div>
      </div>

      {/* ─── AREA GRAFICA PRINCIPALE (INTERATTIVA) ─── */}
      <div className="relative w-full rounded-xl border border-border bg-[#0B0B0E] p-2.5 my-3 overflow-hidden">
        {/* HUD Overlay per il Mese Hoverato */}
        {inspectedMonth && (
          <div className="absolute top-2 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-[#C5A059]/40 bg-[#0A0A0C]/95 px-3 py-1.5 font-mono text-[10px] text-foreground backdrop-blur-md shadow-md">
            <span className="font-bold text-[#C5A059]">
              MESE {inspectedMonth.month} // ISPEZIONE TEMPORALE
            </span>
            <div className="flex items-center gap-3">
              <span>
                Bull (P90):{" "}
                <strong className="text-[#C5A059]">
                  {inspectedMonth.p90.toLocaleString("it-IT")} €
                </strong>
              </span>
              <span>
                Base (P50):{" "}
                <strong className="text-[#C5A059]">
                  {inspectedMonth.p50.toLocaleString("it-IT")} €
                </strong>
              </span>
              <span>
                Stress (P10):{" "}
                <strong className={inspectedMonth.p10 >= initialCapital ? "text-[#C5A059]" : "text-[#ef4444]"}>
                  {inspectedMonth.p10.toLocaleString("it-IT")} €
                </strong>
              </span>
              <span>
                Drawdown Mediano:{" "}
                <strong className="text-[#ef4444]">
                  -{inspectedMonth.medianDrawdownPct}%
                </strong>
              </span>
            </div>
          </div>
        )}

        {/* ─── TAB 1: FAN CHART TRAIETTORIE ─── */}
        {activeTab === "trajectories" && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto overflow-visible select-none cursor-crosshair"
            style={{ maxHeight: "230px" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <defs>
              {/* Cono Esterno P5-P95 */}
              <linearGradient id="mcBandP5P95" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#C5A059" stopOpacity="0.02" />
                <stop offset="100%" stopColor="#C5A059" stopOpacity="0.08" />
              </linearGradient>

              {/* Cono P10-P90 */}
              <linearGradient id="mcBandP10P90" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#C5A059" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#C5A059" stopOpacity="0.14" />
              </linearGradient>

              {/* Cono P25-P75 */}
              <linearGradient id="mcBandP25P75" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#C5A059" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#C5A059" stopOpacity="0.22" />
              </linearGradient>
            </defs>

            {/* Linea Valore Massimo */}
            <line
              x1={PAD_X}
              y1={yOf(maxVal)}
              x2={W - PAD_X}
              y2={yOf(maxVal)}
              stroke="hsl(var(--border))"
              strokeDasharray="2 3"
              strokeOpacity="0.3"
            />
            <text
              x={PAD_X - 6}
              y={yOf(maxVal) + 3}
              textAnchor="end"
              className="fill-muted-foreground font-mono text-[9px]"
            >
              {Math.round(maxVal).toLocaleString("it-IT")}€
            </text>

            {/* Baseline Capitale Iniziale */}
            <line
              x1={PAD_X}
              y1={baselineY}
              x2={W - PAD_X}
              y2={baselineY}
              stroke="#C5A059"
              strokeDasharray="3 3"
              strokeWidth="1.2"
              strokeOpacity="0.5"
            />
            <text
              x={PAD_X - 6}
              y={baselineY + 3}
              textAnchor="end"
              className="fill-[#C5A059] font-mono text-[9px] font-bold"
            >
              {initialCapital.toLocaleString("it-IT")}€
            </text>

            {/* Linea Valore Minimo */}
            <line
              x1={PAD_X}
              y1={yOf(minVal)}
              x2={W - PAD_X}
              y2={yOf(minVal)}
              stroke="hsl(var(--border))"
              strokeDasharray="2 3"
              strokeOpacity="0.3"
            />
            <text
              x={PAD_X - 6}
              y={yOf(minVal) + 3}
              textAnchor="end"
              className="fill-muted-foreground font-mono text-[9px]"
            >
              {Math.round(minVal).toLocaleString("it-IT")}€
            </text>

            {/* Coni di Confidenza */}
            {p5p95Band && <path d={p5p95Band} fill="url(#mcBandP5P95)" />}
            {p10p90Band && <path d={p10p90Band} fill="url(#mcBandP10P90)" />}
            {p25p75Band && <path d={p25p75Band} fill="url(#mcBandP25P75)" />}

            {/* Traiettorie stocastiche individuali di esempio */}
            {mc.samplePaths.map((path, idx) => {
              const d = path
                .map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`)
                .join(" ");
              return (
                <path
                  key={idx}
                  d={d}
                  fill="none"
                  stroke="#C5A059"
                  strokeOpacity="0.12"
                  strokeWidth="1"
                />
              );
            })}

            {/* Bordo P10 (Stress Line) */}
            <path
              d={p10Path}
              fill="none"
              stroke="#ef4444"
              strokeWidth="1.3"
              strokeDasharray="4 3"
              strokeOpacity="0.75"
            />

            {/* Bordo P90 (Bull Line) */}
            <path
              d={p90Path}
              fill="none"
              stroke="#D4AF37"
              strokeWidth="1.3"
              strokeDasharray="4 3"
              strokeOpacity="0.75"
            />

            {/* Curva Mediana P50 */}
            <path
              d={medianPath}
              fill="none"
              stroke="#C5A059"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Punto Iniziale */}
            <circle cx={xOf(0)} cy={baselineY} r="3.5" fill="#C5A059" stroke="#0A0A0C" strokeWidth="1.5" />

            {/* Punto Finale Mediano */}
            <circle cx={endMedianX} cy={endMedianY} r="4.5" fill="#C5A059" stroke="#0A0A0C" strokeWidth="1.5" />

            {/* Badge Finale Mediano */}
            <g transform={`translate(${endMedianX - 64}, ${Math.max(14, endMedianY - 24)})`}>
              <rect
                width="68"
                height="18"
                rx="4"
                fill="#0A0A0C"
                stroke="#C5A059"
                strokeWidth="1"
                fillOpacity="0.95"
              />
              <text
                x="34"
                y="12"
                textAnchor="middle"
                className="fill-[#C5A059] font-mono text-[9px] font-bold"
              >
                P50: {mc.endP50.toLocaleString("it-IT")}€
              </text>
            </g>

            {/* Crosshair Interattivo sul mese hoverato */}
            {hoverMonth !== null && (
              <g>
                <line
                  x1={xOf(hoverMonth)}
                  y1={PAD_Y}
                  x2={xOf(hoverMonth)}
                  y2={H - PAD_Y}
                  stroke="#C5A059"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={xOf(hoverMonth)}
                  cy={yOf(mc.p90[hoverMonth])}
                  r="3.5"
                  fill="#D4AF37"
                  stroke="#0A0A0C"
                  strokeWidth="1.5"
                />
                <circle
                  cx={xOf(hoverMonth)}
                  cy={yOf(mc.p50[hoverMonth])}
                  r="4"
                  fill="#C5A059"
                  stroke="#0A0A0C"
                  strokeWidth="1.5"
                />
                <circle
                  cx={xOf(hoverMonth)}
                  cy={yOf(mc.p10[hoverMonth])}
                  r="3.5"
                  fill="#8B1E1E"
                  stroke="#0A0A0C"
                  strokeWidth="1.5"
                />
              </g>
            )}

            {/* Asse X Temporale */}
            <text x={xOf(0)} y={H - 5} textAnchor="start" className="fill-muted-foreground font-mono text-[8px]">
              M0 (Oggi)
            </text>
            <text x={xOf(Math.round(steps / 2))} y={H - 5} textAnchor="middle" className="fill-muted-foreground font-mono text-[8px]">
              M{Math.round(steps / 2)}
            </text>
            <text x={xOf(steps)} y={H - 5} textAnchor="end" className="fill-muted-foreground font-mono text-[8px]">
              M{steps} ({steps} Mesi)
            </text>
          </svg>
        )}

        {/* ─── TAB 2: ANALISI DRAWDOWN UNDERWATER ─── */}
        {activeTab === "underwater" && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto overflow-visible select-none cursor-crosshair"
            style={{ maxHeight: "230px" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <defs>
              <linearGradient id="mcUnderwaterGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.3" />
              </linearGradient>
            </defs>

            {/* Linea 0% (Baseline di Parità) */}
            <line x1={PAD_X} y1={yOfDD(0)} x2={W - PAD_X} y2={yOfDD(0)} stroke="#10B981" strokeWidth="1.2" />
            <text x={PAD_X - 6} y={yOfDD(0) + 3} textAnchor="end" className="fill-[#10B981] font-mono text-[9px] font-bold">
              0.0%
            </text>

            {/* Soglia -5% Drawdown Lieve */}
            <line
              x1={PAD_X}
              y1={yOfDD(5)}
              x2={W - PAD_X}
              y2={yOfDD(5)}
              stroke="hsl(var(--border))"
              strokeDasharray="2 3"
              strokeOpacity="0.4"
            />
            <text x={PAD_X - 6} y={yOfDD(5) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[8px]">
              -5.0%
            </text>

            {/* Soglia -10% LIMEN Standard Target */}
            <line
              x1={PAD_X}
              y1={yOfDD(10)}
              x2={W - PAD_X}
              y2={yOfDD(10)}
              stroke="#C5A059"
              strokeDasharray="3 3"
              strokeWidth="1.2"
              strokeOpacity="0.6"
            />
            <text x={PAD_X - 6} y={yOfDD(10) + 3} textAnchor="end" className="fill-[#C5A059] font-mono text-[8px] font-bold">
              -10% (LIMEN)
            </text>

            {/* Soglia -20% Drawdown Severo */}
            <line
              x1={PAD_X}
              y1={yOfDD(20)}
              x2={W - PAD_X}
              y2={yOfDD(20)}
              stroke="#ef4444"
              strokeDasharray="3 3"
              strokeWidth="1.2"
              strokeOpacity="0.5"
            />
            <text x={PAD_X - 6} y={yOfDD(20) + 3} textAnchor="end" className="fill-[#ef4444] font-mono text-[8px] font-bold">
              -20% (Severo)
            </text>

            {/* Area Riempimento Drawdown P90 */}
            {underwaterP90Band && <path d={underwaterP90Band} fill="url(#mcUnderwaterGrad)" />}

            {/* Traiettorie drawdown di esempio */}
            {mc.sampleDrawdownPaths.map((path, idx) => {
              const d = path
                .map((dd, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOfDD(dd).toFixed(1)}`)
                .join(" ");
              return (
                <path
                  key={idx}
                  d={d}
                  fill="none"
                  stroke="#ef4444"
                  strokeOpacity="0.14"
                  strokeWidth="1"
                />
              );
            })}

            {/* Curva Mediana Drawdown P50 */}
            <path
              d={underwaterP50Path}
              fill="none"
              stroke="#C5A059"
              strokeWidth="2"
              strokeDasharray="4 2"
            />

            {/* Curva P90 Stress Drawdown */}
            <path
              d={mc.drawdownP90.map((dd, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOfDD(dd).toFixed(1)}`).join(" ")}
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
            />

            {/* Crosshair Interattivo */}
            {hoverMonth !== null && (
              <g>
                <line
                  x1={xOf(hoverMonth)}
                  y1={PAD_Y}
                  x2={xOf(hoverMonth)}
                  y2={H - PAD_Y}
                  stroke="#C5A059"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={xOf(hoverMonth)}
                  cy={yOfDD(mc.drawdownP90[hoverMonth])}
                  r="4"
                  fill="#ef4444"
                  stroke="#0A0A0C"
                  strokeWidth="1.5"
                />
              </g>
            )}

            {/* Asse X Temporale */}
            <text x={xOf(0)} y={H - 5} textAnchor="start" className="fill-muted-foreground font-mono text-[8px]">
              M0 (Oggi)
            </text>
            <text x={xOf(Math.round(steps / 2))} y={H - 5} textAnchor="middle" className="fill-muted-foreground font-mono text-[8px]">
              M{Math.round(steps / 2)}
            </text>
            <text x={xOf(steps)} y={H - 5} textAnchor="end" className="fill-muted-foreground font-mono text-[8px]">
              M{steps} ({steps} Mesi)
            </text>
          </svg>
        )}

        {/* ─── TAB 3: ISTOGRAMMA DI DISTRIBUZIONE TERMINALE ─── */}
        {activeTab === "distribution" && (
          <div className="space-y-2">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-auto overflow-visible select-none"
              style={{ maxHeight: "230px" }}
            >
              {(() => {
                const maxPct = Math.max(...mc.histogram.map((b) => b.percentage), 1);
                const chartH = H - PAD_Y * 2 - 14;
                const binW = (W - PAD_X * 2) / mc.histogram.length;

                return (
                  <g>
                    {/* Griglia orizzontale */}
                    <line
                      x1={PAD_X}
                      y1={H - PAD_Y}
                      x2={W - PAD_X}
                      y2={H - PAD_Y}
                      stroke="hsl(var(--border))"
                      strokeWidth="1"
                    />

                    {mc.histogram.map((b, idx) => {
                      const barH = (b.percentage / maxPct) * chartH;
                      const bx = PAD_X + idx * binW + 2;
                      const by = H - PAD_Y - barH;
                      const isProfit = b.min >= initialCapital;
                      const isLoss = b.max <= initialCapital;

                      const fillColor = isProfit ? "#10B981" : isLoss ? "#ef4444" : "#C5A059";

                      return (
                        <g key={idx}>
                          <rect
                            x={bx}
                            y={by}
                            width={Math.max(4, binW - 4)}
                            height={Math.max(2, barH)}
                            rx="3"
                            fill={fillColor}
                            fillOpacity={b.isStartingCapitalBin ? 0.9 : 0.65}
                            stroke={b.isStartingCapitalBin ? "#C5A059" : fillColor}
                            strokeWidth={b.isStartingCapitalBin ? 1.5 : 1}
                          />

                          {/* Percentuale sopra la barra */}
                          {b.percentage > 1 && (
                            <text
                              x={bx + (binW - 4) / 2}
                              y={by - 4}
                              textAnchor="middle"
                              className="fill-foreground font-mono text-[8px] font-bold"
                            >
                              {b.percentage}%
                            </text>
                          )}

                          {/* Range label sotto la barra */}
                          <text
                            x={bx + (binW - 4) / 2}
                            y={H - PAD_Y + 14}
                            textAnchor="middle"
                            className="fill-muted-foreground font-mono text-[8px]"
                          >
                            {b.rangeLabel}
                          </text>
                        </g>
                      );
                    })}

                    {/* Linea Capitale Iniziale di Riferimento */}
                    <text
                      x={W - PAD_X}
                      y={PAD_Y - 4}
                      textAnchor="end"
                      className="fill-[#C5A059] font-mono text-[9px] font-bold"
                    >
                      Capitale Iniziale: {initialCapital.toLocaleString("it-IT")} €
                    </text>
                  </g>
                );
              })()}
            </svg>
            <div className="flex items-center justify-between text-[10px] font-mono px-2 text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#C5A059]" />
                Oro: Esito in Profitto (Compounding Sovrano)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#8B1E1E]" />
                Cremisi: Esito in Drawdown rispetto al Capitale Iniziale
              </span>
            </div>
          </div>
        )}

        {/* ─── TAB 4: STRESS TEST MATRIX (PARAMETRI QUANT) ─── */}
        {activeTab === "matrix" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-2">
            <div className="rounded-lg border border-border bg-[#0D0D10] p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Value at Risk (VaR 95%)</span>
                <span className="text-[#ef4444] font-bold text-xs font-mono">-{mc.monthlyVaR95Pct}%</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Peggior rendimento mensile atteso con il 95% di confidenza.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-[#0D0D10] p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Expected Shortfall (CVaR)</span>
                <span className="text-[#ef4444] font-bold text-xs font-mono">-{mc.monthlyCVaR95Pct}%</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Perdita media attesa negli scenari di coda estrema (tail risk 5%).
              </p>
            </div>

            <div className="rounded-lg border border-border bg-[#0D0D10] p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Max Drawdown P95</span>
                <span className="text-[#ef4444] font-bold text-xs font-mono">-{mc.maxDrawdownP95Pct}%</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Il drawdown massimo da essere pronti ad assorbire nel periodo.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-[#0D0D10] p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Probabilità Raddoppio (2x)</span>
                <span className="text-[#C5A059] font-bold text-xs font-mono">{mc.probDoubleCapitalPct}%</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Probabilità statistica di raddoppiare il capitale (200% del capitale iniziale).
              </p>
            </div>

            <div className="rounded-lg border border-border bg-[#0D0D10] p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Capitale Integro (Prob &ge; 100%)</span>
                <span className="text-[#C5A059] font-bold text-xs font-mono">{mc.probCapitalPreservedPct}%</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Percentuale di traiettorie che terminano senza perdita di capitale.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-[#0D0D10] p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Rischio di Rovina (&lt; 50%)</span>
                <span className="text-[#8B1E1E] font-bold text-xs font-mono">{mc.riskOfRuinPct}%</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Probabilità di dimezzare il conto di trading prima della fine dell'orizzonte.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── KPI METRICS BOARD (4 SCENARI SINTETICI) ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
        {/* Scenario P10 (Stress) */}
        <div className="rounded-lg border border-border bg-[#0D0D10] p-2 text-center">
          <p className="text-[9px] uppercase tracking-wider text-[#ef4444] font-bold">
            P10 Stress (90% Conf.)
          </p>
          <p className="text-xs font-bold text-foreground mt-0.5">
            {mc.endP10.toLocaleString("it-IT")} €
          </p>
          <span
            className={`text-[10px] font-semibold ${
              mc.endP10GainPct >= 0 ? "text-[#C5A059]" : "text-[#ef4444]"
            }`}
          >
            {mc.endP10GainPct >= 0 ? "+" : ""}
            {mc.endP10GainPct}%
          </span>
        </div>

        {/* Scenario P50 (Mediana Base) */}
        <div className="rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/15 p-2 text-center">
          <p className="text-[9px] uppercase tracking-wider text-[#C5A059] font-bold">
            P50 Mediana (Base)
          </p>
          <p className="text-xs font-bold text-[#C5A059] mt-0.5">
            {mc.endP50.toLocaleString("it-IT")} €
          </p>
          <span className="text-[10px] font-semibold text-[#C5A059]">
            +{mc.endP50GainPct}%
          </span>
        </div>

        {/* Scenario P90 (Bull Market) */}
        <div className="rounded-lg border border-border bg-[#0D0D10] p-2 text-center">
          <p className="text-[9px] uppercase tracking-wider text-primary font-bold">
            P90 Bull (High Edge)
          </p>
          <p className="text-xs font-bold text-foreground mt-0.5">
            {mc.endP90.toLocaleString("it-IT")} €
          </p>
          <span className="text-[10px] font-semibold text-primary">
            +{mc.endP90GainPct}%
          </span>
        </div>

        {/* Max Drawdown P95 */}
        <div className="rounded-lg border border-border bg-[#0D0D10] p-2 text-center">
          <p className="text-[9px] uppercase tracking-wider text-[#C5A059] font-bold">
            Max DD P95 Stimato
          </p>
          <p className="text-xs font-bold text-[#ef4444] mt-0.5">
            -{mc.maxDrawdownP95Pct}%
          </p>
          <span className="text-[10px] text-muted-foreground">
            -{estimatedMaxLossEuro.toLocaleString("it-IT")} €
          </span>
        </div>
      </div>

      {/* ─── NOTA DI PROTEZIONE & RAPPORTO DI COPERTURA RISERVA ─── */}
      <div className="mt-3 rounded-xl border border-[#C5A059]/35 bg-[#C5A059]/10 px-3.5 py-2.5 flex items-start gap-3">
        <ShieldCheck className="h-4 w-4 text-[#C5A059] shrink-0 mt-0.5" />
        <div className="text-[11px] text-muted-foreground leading-relaxed">
          <div className="flex items-center gap-2 flex-wrap">
            <strong className="text-foreground font-mono">
              Fondo di Riserva: {reserveAllocation.toLocaleString("it-IT")} €
            </strong>
            <span className="rounded bg-[#C5A059]/20 px-1.5 py-0.2 font-mono text-[9px] font-bold text-[#C5A059]">
              COPERTURA {reserveCoverageRatio}x MAX DD
            </span>
          </div>
          <p className="mt-0.5">
            Il fondo intatto copre <strong className="text-foreground">{reserveCoverageRatio} volte</strong> la perdita massima stimata a P95 (-{estimatedMaxLossEuro.toLocaleString("it-IT")} €). In caso di prolungata serie negativa, il cuscinetto assorbe ogni shock statistico senza intaccare le spese vitali.
          </p>
        </div>
      </div>
    </div>
  );
};
