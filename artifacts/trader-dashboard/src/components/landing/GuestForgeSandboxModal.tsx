import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Crosshair,
  Flame,
  Play,
  Pause,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  SkipForward,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { LimenResponsiveDrawer } from "@/components/ui/LimenResponsiveDrawer";
import {
  synestheticClick,
  synestheticCheck,
  synestheticConfirm,
  synestheticTrophy,
  synestheticAlert,
} from "@/lib/soundFx";
import { trackEvent } from "@/lib/analytics";

export interface SandboxCandle {
  readonly index: number;
  readonly time: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly label: string;
}

export interface CustodeChecklistItem {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly metricBadge: string;
}

export const SANDBOX_SCENARIO_LEVELS = {
  symbol: "XAU/USD",
  timeframe: "15 min",
  session: "LONDRA KILLZONE",
  ssl: 2642.5,
  entry: 2645.0,
  stopLoss: 2640.0,
  takeProfit: 2660.0,
  riskEur: 100.0,
  rewardEur: 300.0,
  rrRatio: 3.0,
} as const;

export const CUSTODE_CHECKLIST_ITEMS: readonly CustodeChecklistItem[] = [
  {
    id: "sweep_ssl",
    code: "REGOLA I",
    label: "Liquidità di Sessione Londra Spazzata (Sweep SSL)",
    metricBadge: "SSL 2,642.50",
  },
  {
    id: "bos_fvg",
    code: "REGOLA II",
    label: "Rottura di Struttura (BOS) + Fair Value Gap M15",
    metricBadge: "15 min BOS",
  },
  {
    id: "risk_rr",
    code: "REGOLA III",
    label: "Rischio Calibrato 1% (100 EUR) & R:R 1:3",
    metricBadge: "1:3 R:R",
  },
] as const;

export const GUEST_SANDBOX_CANDLES: readonly SandboxCandle[] = [
  {
    index: 0,
    time: "08:00",
    open: 2646.2,
    high: 2647.4,
    low: 2644.8,
    close: 2645.3,
    label: "Consolidamento Pre-Londra",
  },
  {
    index: 1,
    time: "08:15",
    open: 2645.3,
    high: 2645.9,
    low: 2643.6,
    close: 2643.9,
    label: "Compressione verso SSL",
  },
  {
    index: 2,
    time: "08:30",
    open: 2643.9,
    high: 2644.5,
    low: 2642.7,
    close: 2643.1,
    label: "Test Soglia Liquidità",
  },
  {
    index: 3,
    time: "08:45",
    open: 2643.1,
    high: 2643.8,
    low: 2641.2,
    close: 2643.4,
    label: "Sweep SSL Londra (2,641.20)",
  },
  {
    index: 4,
    time: "09:00",
    open: 2643.4,
    high: 2646.2,
    low: 2643.1,
    close: 2645.8,
    label: "Displacement Istituzionale + BOS",
  },
  {
    index: 5,
    time: "09:15",
    open: 2645.8,
    high: 2646.4,
    low: 2644.6,
    close: 2645.0,
    label: "Mitigazione FVG · Ingresso 2,645.00",
  },
  {
    index: 6,
    time: "09:30",
    open: 2645.0,
    high: 2647.8,
    low: 2644.7,
    close: 2647.3,
    label: "Impulso Direzionale (+0.46 R)",
  },
  {
    index: 7,
    time: "09:45",
    open: 2647.3,
    high: 2649.6,
    low: 2646.9,
    close: 2649.1,
    label: "Espansione Strutturale (+0.82 R)",
  },
  {
    index: 8,
    time: "10:00",
    open: 2649.1,
    high: 2650.4,
    low: 2648.2,
    close: 2648.6,
    label: "Riaccumulo Algoritmico (+0.72 R)",
  },
  {
    index: 9,
    time: "10:15",
    open: 2648.6,
    high: 2652.2,
    low: 2648.4,
    close: 2651.8,
    label: "Rottura Massimi Sessione (+1.36 R)",
  },
  {
    index: 10,
    time: "10:30",
    open: 2651.8,
    high: 2654.5,
    low: 2651.2,
    close: 2654.0,
    label: "Accelerazione Aurea (+1.80 R)",
  },
  {
    index: 11,
    time: "10:45",
    open: 2654.0,
    high: 2655.1,
    low: 2652.9,
    close: 2653.5,
    label: "Pullback Difeso (+1.70 R)",
  },
  {
    index: 12,
    time: "11:00",
    open: 2653.5,
    high: 2657.2,
    low: 2653.3,
    close: 2656.8,
    label: "Spinta Verso Target (+2.36 R)",
  },
  {
    index: 13,
    time: "11:15",
    open: 2656.8,
    high: 2659.1,
    low: 2656.4,
    close: 2658.7,
    label: "Compressione Pre-Target (+2.74 R)",
  },
  {
    index: 14,
    time: "11:30",
    open: 2658.7,
    high: 2660.8,
    low: 2658.3,
    close: 2660.2,
    label: "Target Raggiunto · TP 2,660.00 (+3.00 R)",
  },
  {
    index: 15,
    time: "11:45",
    open: 2660.2,
    high: 2661.5,
    low: 2659.6,
    close: 2660.9,
    label: "Consolidamento Post-Sigillo",
  },
] as const;

export const INITIAL_VISIBLE_BAR_INDEX = 5;

export function calculateSandboxMetrics(
  currentBarIndex: number,
  tradeExecuted: boolean,
): {
  currentPrice: number;
  pnlR: number;
  pnlEur: number;
  hitTakeProfit: boolean;
} {
  const safeIndex = Math.max(
    0,
    Math.min(GUEST_SANDBOX_CANDLES.length - 1, currentBarIndex),
  );
  const candle = GUEST_SANDBOX_CANDLES[safeIndex];
  if (!tradeExecuted) {
    return {
      currentPrice: candle.close,
      pnlR: 0,
      pnlEur: 0,
      hitTakeProfit: false,
    };
  }

  // Check if any bar from execution up to safeIndex reached Take Profit
  const reachedTp = GUEST_SANDBOX_CANDLES.slice(
    INITIAL_VISIBLE_BAR_INDEX,
    safeIndex + 1,
  ).some((c) => c.high >= SANDBOX_SCENARIO_LEVELS.takeProfit);

  if (reachedTp) {
    return {
      currentPrice: SANDBOX_SCENARIO_LEVELS.takeProfit,
      pnlR: SANDBOX_SCENARIO_LEVELS.rrRatio,
      pnlEur: SANDBOX_SCENARIO_LEVELS.rewardEur,
      hitTakeProfit: true,
    };
  }

  const riskPoints =
    SANDBOX_SCENARIO_LEVELS.entry - SANDBOX_SCENARIO_LEVELS.stopLoss;
  const rawR = (candle.close - SANDBOX_SCENARIO_LEVELS.entry) / riskPoints;
  const clampedR = Math.max(-1, Math.min(SANDBOX_SCENARIO_LEVELS.rrRatio, rawR));
  const pnlR = Number(clampedR.toFixed(2));
  const pnlEur = Number((pnlR * SANDBOX_SCENARIO_LEVELS.riskEur).toFixed(2));

  return {
    currentPrice: candle.close,
    pnlR,
    pnlEur,
    hitTakeProfit: false,
  };
}

export interface GuestForgeSandboxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestAdmission: (reason: string) => void;
}

export function GuestForgeSandboxModal({
  open,
  onOpenChange,
  onRequestAdmission,
}: GuestForgeSandboxModalProps) {
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [visibleBarIndex, setVisibleBarIndex] = useState<number>(
    INITIAL_VISIBLE_BAR_INDEX,
  );
  const [tradeExecuted, setTradeExecuted] = useState<boolean>(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [gateWarningPulse, setGateWarningPulse] = useState<boolean>(false);

  const allChecklistChecked =
    checkedIds.length === CUSTODE_CHECKLIST_ITEMS.length;

  const metrics = useMemo(
    () => calculateSandboxMetrics(visibleBarIndex, tradeExecuted),
    [visibleBarIndex, tradeExecuted],
  );

  const currentCandle =
    GUEST_SANDBOX_CANDLES[visibleBarIndex] ??
    GUEST_SANDBOX_CANDLES[INITIAL_VISIBLE_BAR_INDEX];

  const toggleChecklistItem = useCallback((id: string) => {
    synestheticClick();
    setGateWarningPulse(false);
    setCheckedIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((item) => item !== id) : [...prev, id];
      if (!exists && next.length === CUSTODE_CHECKLIST_ITEMS.length) {
        synestheticCheck();
      }
      return next;
    });
  }, []);

  const handleCheckAllCustode = useCallback(() => {
    synestheticCheck();
    setGateWarningPulse(false);
    setCheckedIds(CUSTODE_CHECKLIST_ITEMS.map((item) => item.id));
  }, []);

  const handleExecuteLong = useCallback(() => {
    if (!allChecklistChecked) {
      synestheticAlert();
      setGateWarningPulse(true);
      return;
    }
    synestheticConfirm();
    setTradeExecuted(true);
    setIsAutoPlaying(true);
    trackEvent("landing_guest_sandbox_execute_long", {
      barIndex: visibleBarIndex,
    });
  }, [allChecklistChecked, visibleBarIndex]);

  const handleStepForward = useCallback(() => {
    synestheticClick();
    setVisibleBarIndex((prev) => {
      const next = Math.min(GUEST_SANDBOX_CANDLES.length - 1, prev + 1);
      if (
        tradeExecuted &&
        GUEST_SANDBOX_CANDLES[next]?.high >= SANDBOX_SCENARIO_LEVELS.takeProfit
      ) {
        synestheticTrophy();
      }
      return next;
    });
  }, [tradeExecuted]);

  const handleReset = useCallback(() => {
    synestheticClick();
    setIsAutoPlaying(false);
    setTradeExecuted(false);
    setVisibleBarIndex(INITIAL_VISIBLE_BAR_INDEX);
    setGateWarningPulse(false);
  }, []);

  useEffect(() => {
    if (!open) {
      setIsAutoPlaying(false);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!isAutoPlaying || !open) return;
    if (
      visibleBarIndex >= GUEST_SANDBOX_CANDLES.length - 1 ||
      metrics.hitTakeProfit
    ) {
      setIsAutoPlaying(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setVisibleBarIndex((prev) => {
        const next = Math.min(GUEST_SANDBOX_CANDLES.length - 1, prev + 1);
        if (
          tradeExecuted &&
          GUEST_SANDBOX_CANDLES[next]?.high >=
            SANDBOX_SCENARIO_LEVELS.takeProfit
        ) {
          synestheticTrophy();
        } else {
          synestheticClick();
        }
        return next;
      });
    }, 380);

    return () => window.clearTimeout(timer);
  }, [isAutoPlaying, open, visibleBarIndex, metrics.hitTakeProfit, tradeExecuted]);

  // SVG Chart Geometry
  const chartWidth = 680;
  const chartHeight = 230;
  const priceMin = 2639.0;
  const priceMax = 2662.5;

  const priceToY = (price: number): number => {
    const ratio = (price - priceMin) / (priceMax - priceMin);
    return chartHeight - 18 - ratio * (chartHeight - 36);
  };

  const ySsl = priceToY(SANDBOX_SCENARIO_LEVELS.ssl);
  const yEntry = priceToY(SANDBOX_SCENARIO_LEVELS.entry);
  const ySl = priceToY(SANDBOX_SCENARIO_LEVELS.stopLoss);
  const yTp = priceToY(SANDBOX_SCENARIO_LEVELS.takeProfit);

  const visibleCandles = GUEST_SANDBOX_CANDLES.slice(0, visibleBarIndex + 1);
  const slotWidth = (chartWidth - 90) / GUEST_SANDBOX_CANDLES.length;

  return (
    <LimenResponsiveDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="inline-flex items-center gap-2">
          <Flame className="h-4 w-4 text-[#C5A059] shrink-0" />
          <span>BANCO DI FORGIATURA // PROVA IMMEDIATA (60 SEC)</span>
        </span>
      }
      subtitle="Sperimenta i 3 Pilastri Sovrani (Custode della Soglia, Forgia del Passato, Libro della Verità) a zero login."
      desktopClassName="max-w-5xl bg-[#07080b] border-[#C5A059]/40 p-5"
    >
      <div
        className="space-y-3.5 text-[#F4F4F6]"
        data-testid="guest-forge-sandbox-modal"
      >
        {/* Top Telemetry Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#0d0f14] border border-[#C5A059]/25 rounded-lg p-2.5">
          <div className="flex items-center justify-between px-2 py-1 rounded bg-[#11131c] border border-white/5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
              ASSET / TF
            </span>
            <span className="font-mono text-xs font-bold tracking-tight text-[#E8C56A] whitespace-nowrap">
              XAU/USD · 15 min
            </span>
          </div>

          <div className="flex items-center justify-between px-2 py-1 rounded bg-[#11131c] border border-white/5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
              CUSTODE
            </span>
            <span
              className={`font-mono text-xs font-bold tracking-tight whitespace-nowrap ${
                allChecklistChecked ? "text-[#10b981]" : "text-[#E8C56A]"
              }`}
            >
              {checkedIds.length}/3 Regole
            </span>
          </div>

          <div className="flex items-center justify-between px-2 py-1 rounded bg-[#11131c] border border-white/5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
              RENDIMENTO R
            </span>
            <span
              className={`font-mono text-xs font-bold tracking-tight whitespace-nowrap ${
                metrics.pnlR > 0
                  ? "text-[#10b981]"
                  : metrics.pnlR < 0
                    ? "text-[#ef4444]"
                    : "text-slate-300"
              }`}
            >
              {metrics.pnlR >= 0 ? `+${metrics.pnlR.toFixed(2)} R` : `${metrics.pnlR.toFixed(2)} R`}
            </span>
          </div>

          <div className="flex items-center justify-between px-2 py-1 rounded bg-[#11131c] border border-white/5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
              ESITO NETTO
            </span>
            <span
              className={`font-mono text-xs font-bold tracking-tight whitespace-nowrap ${
                metrics.pnlEur > 0
                  ? "text-[#10b981]"
                  : metrics.pnlEur < 0
                    ? "text-[#ef4444]"
                    : "text-slate-300"
              }`}
            >
              {metrics.pnlEur >= 0
                ? `+${metrics.pnlEur.toFixed(2)} EUR`
                : `${metrics.pnlEur.toFixed(2)} EUR`}
            </span>
          </div>
        </div>

        {/* Balanced 2-Column Interactive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
          {/* LEFT COLUMN: FASE 1 — IL CUSTODE DELLA SOGLIA */}
          <div
            className={`lg:col-span-5 flex flex-col justify-between rounded-xl bg-[#0d0f14] border p-3.5 transition-all ${
              gateWarningPulse
                ? "border-[#ef4444] shadow-[0_0_20px_rgba(239,68,68,0.25)]"
                : allChecklistChecked
                  ? "border-[#10b981]/45 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                  : "border-[#C5A059]/25"
            }`}
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck className="h-4 w-4 text-[#C5A059] shrink-0" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#E8C56A] whitespace-nowrap">
                    I. Il Custode della Soglia
                  </span>
                </div>
                <span
                  className={`font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded whitespace-nowrap ${
                    allChecklistChecked
                      ? "bg-[#10b981]/15 border border-[#10b981]/40 text-[#10b981]"
                      : "bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A]"
                  }`}
                >
                  {allChecklistChecked ? "VARCO SBLOCCATO" : "GATE BLOCCATO"}
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-snug">
                Convalida i 3 criteri del protocollo per sbloccare l'esecuzione sul Banco di Forgiatura.
              </p>

              <div className="space-y-2">
                {CUSTODE_CHECKLIST_ITEMS.map((item) => {
                  const isChecked = checkedIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleChecklistItem(item.id)}
                      data-testid={`sandbox-check-${item.id}`}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-start justify-between gap-2.5 cursor-pointer ${
                        isChecked
                          ? "bg-[#10b981]/10 border-[#10b981]/45 text-white"
                          : "bg-[#11131c] border-white/10 hover:border-[#C5A059]/45 text-slate-300"
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`mt-0.5 h-4 w-4 rounded flex items-center justify-center shrink-0 border ${
                            isChecked
                              ? "bg-[#10b981] border-[#10b981] text-[#07080b]"
                              : "border-[#C5A059]/50 bg-[#07080b]"
                          }`}
                        >
                          {isChecked && <CheckCircle2 className="h-3 w-3 stroke-[2.5]" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-mono text-[9px] uppercase tracking-wider text-[#C5A059]">
                            {item.code}
                          </div>
                          <div className="text-xs font-medium leading-snug">
                            {item.label}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] whitespace-nowrap shrink-0">
                        {item.metricBadge}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Gate Action Footer */}
            <div className="pt-3 mt-3 border-t border-white/10 space-y-2">
              {!allChecklistChecked ? (
                <button
                  type="button"
                  onClick={handleCheckAllCustode}
                  data-testid="sandbox-check-all-btn"
                  className="w-full py-2 px-3 rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/15 hover:bg-[#C5A059]/25 text-[#E8C56A] font-mono text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
                >
                  Convalida Tutte le 3 Regole (1-Click)
                </button>
              ) : (
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#10b981]/10 border border-[#10b981]/30">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#10b981] font-bold">
                    INTEGRITÀ PRE-TRADE CONVALIDATA
                  </span>
                  <span className="font-mono text-xs font-bold tracking-tight text-[#10b981] whitespace-nowrap">
                    100%
                  </span>
                </div>
              )}

              {gateWarningPulse && (
                <div className="flex items-center gap-2 text-[11px] font-mono text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/30 rounded px-2.5 py-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                  <span>Il Custode blocca ordini impulsivi: spunta le 3 regole.</span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: FASE 2 — IL BANCO DI FORGIATURA (SVG REPLAY) */}
          <div className="lg:col-span-7 flex flex-col justify-between rounded-xl bg-[#0d0f14] border border-[#C5A059]/25 p-3.5">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <Crosshair className="h-4 w-4 text-[#C5A059] shrink-0" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#E8C56A] whitespace-nowrap">
                    II. Banco di Forgiatura · Replay
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] whitespace-nowrap">
                    Barra {visibleBarIndex + 1}/{GUEST_SANDBOX_CANDLES.length}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400 tracking-tight whitespace-nowrap">
                    {currentCandle.time} · {currentCandle.label}
                  </span>
                </div>
              </div>

              {/* Crisp Institutional Candlestick SVG */}
              <div className="relative rounded-lg bg-[#07080b] border border-white/10 overflow-hidden">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-[195px] sm:h-[215px] block select-none"
                  role="img"
                  aria-label="Simulatore Grafico XAU/USD London Sweep"
                >
                  {/* Risk / Reward Shaded Zones when trade is active */}
                  {tradeExecuted && (
                    <>
                      <rect
                        x={12}
                        y={yTp}
                        width={chartWidth - 96}
                        height={Math.max(2, yEntry - yTp)}
                        fill="rgba(16, 185, 129, 0.08)"
                      />
                      <rect
                        x={12}
                        y={yEntry}
                        width={chartWidth - 96}
                        height={Math.max(2, ySl - yEntry)}
                        fill="rgba(239, 68, 68, 0.08)"
                      />
                    </>
                  )}

                  {/* Horizontal Reference Lines */}
                  {/* Take Profit Line */}
                  <line
                    x1={12}
                    y1={yTp}
                    x2={chartWidth - 84}
                    y2={yTp}
                    stroke="#10b981"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                  <text
                    x={chartWidth - 80}
                    y={yTp + 3}
                    fill="#10b981"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    TP 2,660.00
                  </text>

                  {/* Entry Line */}
                  <line
                    x1={12}
                    y1={yEntry}
                    x2={chartWidth - 84}
                    y2={yEntry}
                    stroke="#E8C56A"
                    strokeWidth={1.2}
                    strokeDasharray="3 3"
                  />
                  <text
                    x={chartWidth - 80}
                    y={yEntry + 3}
                    fill="#E8C56A"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    IN 2,645.00
                  </text>

                  {/* SSL Liquidity Sweep Line */}
                  <line
                    x1={12}
                    y1={ySsl}
                    x2={chartWidth - 84}
                    y2={ySsl}
                    stroke="#C5A059"
                    strokeWidth={1}
                    strokeOpacity={0.65}
                    strokeDasharray="2 2"
                  />
                  <text
                    x={chartWidth - 80}
                    y={ySsl + 3}
                    fill="#C5A059"
                    fontSize="8.5"
                    fontFamily="monospace"
                  >
                    SSL 2,642.50
                  </text>

                  {/* Stop Loss Line */}
                  <line
                    x1={12}
                    y1={ySl}
                    x2={chartWidth - 84}
                    y2={ySl}
                    stroke="#ef4444"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                  <text
                    x={chartWidth - 80}
                    y={ySl + 3}
                    fill="#ef4444"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    SL 2,640.00
                  </text>

                  {/* Candlesticks */}
                  {visibleCandles.map((candle) => {
                    const cx = 24 + candle.index * slotWidth + slotWidth * 0.5;
                    const isBull = candle.close >= candle.open;
                    const color = isBull ? "#10b981" : "#ef4444";
                    const yHigh = priceToY(candle.high);
                    const yLow = priceToY(candle.low);
                    const yOpen = priceToY(candle.open);
                    const yClose = priceToY(candle.close);
                    const bodyTop = Math.min(yOpen, yClose);
                    const bodyHeight = Math.max(2.5, Math.abs(yClose - yOpen));

                    return (
                      <g key={candle.index}>
                        <line
                          x1={cx}
                          y1={yHigh}
                          x2={cx}
                          y2={yLow}
                          stroke={color}
                          strokeWidth={1.3}
                        />
                        <rect
                          x={cx - slotWidth * 0.32}
                          y={bodyTop}
                          width={slotWidth * 0.64}
                          height={bodyHeight}
                          fill={color}
                          rx={1}
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Transport & Execution Controls */}
            <div className="pt-3 mt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleStepForward}
                  disabled={visibleBarIndex >= GUEST_SANDBOX_CANDLES.length - 1}
                  data-testid="sandbox-step-forward-btn"
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-white/15 bg-[#11131c] hover:border-[#C5A059]/50 text-xs font-mono text-white disabled:opacity-40 transition-all cursor-pointer whitespace-nowrap"
                >
                  <SkipForward className="h-3.5 w-3.5 text-[#C5A059]" />
                  <span>+1 Barra</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    synestheticClick();
                    setIsAutoPlaying((prev) => !prev);
                  }}
                  disabled={visibleBarIndex >= GUEST_SANDBOX_CANDLES.length - 1}
                  data-testid="sandbox-autoplay-btn"
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-white/15 bg-[#11131c] hover:border-[#C5A059]/50 text-xs font-mono text-white disabled:opacity-40 transition-all cursor-pointer whitespace-nowrap"
                >
                  {isAutoPlaying ? (
                    <>
                      <Pause className="h-3.5 w-3.5 text-[#E8C56A]" />
                      <span>Pausa</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 text-[#C5A059]" />
                      <span>Auto-Replay</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  data-testid="sandbox-reset-btn"
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-white/10 bg-[#11131c] hover:border-white/30 text-xs font-mono text-slate-300 transition-all cursor-pointer whitespace-nowrap"
                  title="Reset Simulazione"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleExecuteLong}
                disabled={tradeExecuted}
                data-testid="sandbox-execute-long-btn"
                className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                  tradeExecuted
                    ? "bg-[#10b981]/20 border border-[#10b981]/50 text-[#10b981]"
                    : allChecklistChecked
                      ? "bg-[#C5A059] text-[#07080b] border border-[#E8C56A] shadow-[0_0_20px_rgba(197,160,89,0.35)] hover:brightness-110"
                      : "bg-[#11131c] border border-[#C5A059]/35 text-[#E8C56A] hover:border-[#C5A059]"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {tradeExecuted
                    ? "ORDINE LONG ATTIVO (1:3 R:R)"
                    : "ESEGUI LONG (1:3 R:R)"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* FASE 3 — IL SIGILLO NEL LIBRO DELLA VERITÀ */}
        <div
          className={`rounded-xl border p-3.5 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            metrics.hitTakeProfit
              ? "bg-[#10b981]/10 border-[#10b981]/50 shadow-[0_0_25px_rgba(16,185,129,0.15)]"
              : "bg-[#0d0f14] border-[#C5A059]/25"
          }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#C5A059] shrink-0" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#E8C56A]">
                III. Il Libro della Verità
              </span>
              <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#10b981]/15 border border-[#10b981]/35 text-[#10b981] whitespace-nowrap">
                {metrics.hitTakeProfit
                  ? "TARGET +3.00 R SIGILLATO · ZERO DERIVA"
                  : " AUDIT TELEMETRICO ATTIVO"}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-snug">
              {metrics.hitTakeProfit
                ? "Esecuzione impeccabile: +300.00 EUR (+3.00 R) forgiati al 100% di Integrità. Reclama ora il tuo Dossier dell'Operatore."
                : "Completa la checklist del Custode, esegui l'ordine Long e osserva il replay fino al Target 1:3 R:R."}
            </p>
          </div>

          <button
            type="button"
            data-testid="sandbox-claim-dossier-cta"
            onClick={() => {
              synestheticConfirm();
              trackEvent("landing_guest_sandbox_claim_dossier", {
                completedTp: metrics.hitTakeProfit,
              });
              onRequestAdmission(
                "Completata Prova Immediata della Forgia (+3.00R al 100% Integrità)",
              );
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#C5A059] hover:bg-[#E8C56A] text-[#07080b] font-mono text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(197,160,89,0.3)] transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>Varca la Soglia &amp; Salva il Tuo Dossier</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
          </button>
        </div>
      </div>
    </LimenResponsiveDrawer>
  );
}
