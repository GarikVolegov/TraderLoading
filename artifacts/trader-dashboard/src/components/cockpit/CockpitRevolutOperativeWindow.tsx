import { useState, useMemo, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  CheckCircle2,
  Circle,
  Zap,
  Target,
  Crosshair,
  Lock,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  Flame,
  ArrowRight,
} from "lucide-react";
import { getPipMultiplier } from "@/lib/pipMultiplier";
import { pipValuePerLot, pipSize, computeLots } from "@/lib/replay/lotSizing";
import { synestheticClick, synestheticConfirm, synestheticCheck } from "@/lib/soundFx";
import { triggerHaptic } from "@/lib/haptics";
import type { PlannedTradeInfo } from "../chart/LimenProprietaryChart";

export interface CockpitRevolutOperativeWindowProps {
  market: string;
  onSelectMarket: (sym: string) => void;
  direction: "buy" | "sell";
  onDirectionChange: (dir: "buy" | "sell") => void;
  entryPrice: string;
  onEntryChange: (val: string) => void;
  stopLoss: string;
  onStopLossChange: (val: string) => void;
  takeProfit: string;
  onTakeProfitChange: (val: string) => void;
  currentPrice?: number;
  onTradePlanned?: (trade: PlannedTradeInfo) => void;
  onOpenRegisterModal: () => void;
  currency?: string;
  riskEur?: number;
  isGuest?: boolean;
  className?: string;
}

const PRIMARY_PAIRS = [
  { symbol: "XAUUSD", label: "ORO · XAU" },
  { symbol: "EURUSD", label: "EURO · EUR" },
  { symbol: "GBPUSD", label: "STERLINA · GBP" },
  { symbol: "BTCUSD", label: "BITCOIN · BTC" },
  { symbol: "US30", label: "WALL ST · US30" },
];

export function CockpitRevolutOperativeWindow({
  market,
  onSelectMarket,
  direction,
  onDirectionChange,
  entryPrice,
  onEntryChange,
  stopLoss,
  onStopLossChange,
  takeProfit,
  onTakeProfitChange,
  currentPrice,
  onTradePlanned,
  onOpenRegisterModal,
  currency = "€",
  riskEur = 100,
  isGuest = false,
  className = "",
}: CockpitRevolutOperativeWindowProps) {
  // Pre-Flight Custode Rules state (Interactive 3 Rules)
  const [ruleSweep, setRuleSweep] = useState(true);
  const [ruleStructure, setRuleStructure] = useState(true);
  const [ruleRisk, setRuleRisk] = useState(true);

  // Fallback prices if empty
  const numericEntry = parseFloat(entryPrice) || currentPrice || (market.includes("XAU") ? 2650.0 : 1.085);
  const pipMult = useMemo(() => getPipMultiplier(market), [market]);
  const pipSz = useMemo(() => pipSize(market), [market]);

  // Compute SL distance in pips and EUR
  const numericSl = parseFloat(stopLoss);
  const slPips = useMemo(() => {
    if (!numericSl || !numericEntry || numericSl === numericEntry) {
      return market.includes("XAU") ? 25.0 : 15.0;
    }
    const diff = Math.abs(numericEntry - numericSl);
    return Math.max(0.1, Math.round(diff * pipMult * 10) / 10);
  }, [numericSl, numericEntry, pipMult, market]);

  // Compute TP distance in pips and EUR
  const numericTp = parseFloat(takeProfit);
  const tpPips = useMemo(() => {
    if (!numericTp || !numericEntry || numericTp === numericEntry) {
      return slPips * 3;
    }
    const diff = Math.abs(numericTp - numericEntry);
    return Math.max(0.1, Math.round(diff * pipMult * 10) / 10);
  }, [numericTp, numericEntry, pipMult, slPips]);

  // Dynamic R:R
  const riskReward = useMemo(() => {
    if (!slPips || slPips <= 0) return 3.0;
    const ratio = tpPips / slPips;
    return Math.round(ratio * 100) / 100;
  }, [slPips, tpPips]);

  // Dynamic Lots & Projected Rewards
  const lots = useMemo(() => {
    return computeLots({ riskAmount: riskEur, slPips, symbol: market }) || 0.5;
  }, [riskEur, slPips, market]);

  const projectedReward = useMemo(() => {
    return Math.round(riskEur * riskReward * 100) / 100;
  }, [riskEur, riskReward]);

  // Sync entry to current market price
  const handleSyncCurrentPrice = () => {
    if (!currentPrice) return;
    synestheticClick();
    triggerHaptic("selection");
    const formatted = market.includes("XAU")
      ? currentPrice.toFixed(2)
      : currentPrice >= 100
      ? currentPrice.toFixed(2)
      : currentPrice.toFixed(5);
    onEntryChange(formatted);

    // Auto-align SL and TP based on direction and current default distances
    const slOffset = slPips * pipSz;
    const tpOffset = tpPips * pipSz;
    if (direction === "buy") {
      onStopLossChange((currentPrice - slOffset).toFixed(market.includes("XAU") ? 2 : 5));
      onTakeProfitChange((currentPrice + tpOffset).toFixed(market.includes("XAU") ? 2 : 5));
    } else {
      onStopLossChange((currentPrice + slOffset).toFixed(market.includes("XAU") ? 2 : 5));
      onTakeProfitChange((currentPrice - tpOffset).toFixed(market.includes("XAU") ? 2 : 5));
    }
  };

  // Quick preset SL distances
  const handleQuickSl = (pips: number) => {
    synestheticClick();
    triggerHaptic("selection");
    const offset = pips * pipSz;
    const base = parseFloat(entryPrice) || currentPrice || numericEntry;
    if (direction === "buy") {
      onStopLossChange((base - offset).toFixed(market.includes("XAU") ? 2 : 5));
    } else {
      onStopLossChange((base + offset).toFixed(market.includes("XAU") ? 2 : 5));
    }
  };

  // Quick preset RR multiples
  const handleQuickRr = (multiplier: number) => {
    synestheticClick();
    triggerHaptic("selection");
    const targetPips = slPips * multiplier;
    const offset = targetPips * pipSz;
    const base = parseFloat(entryPrice) || currentPrice || numericEntry;
    if (direction === "buy") {
      onTakeProfitChange((base + offset).toFixed(market.includes("XAU") ? 2 : 5));
    } else {
      onTakeProfitChange((base - offset).toFixed(market.includes("XAU") ? 2 : 5));
    }
  };

  // Execution: project on chart and open official modal
  const handleExecute = () => {
    synestheticConfirm();
    triggerHaptic("heavy");

    const plannedTrade: PlannedTradeInfo = {
      direction: direction,
      entryPrice: parseFloat(entryPrice) || numericEntry,
      stopLoss: parseFloat(stopLoss) || (direction === "buy" ? numericEntry - slPips * pipSz : numericEntry + slPips * pipSz),
      takeProfit: parseFloat(takeProfit) || (direction === "buy" ? numericEntry + tpPips * pipSz : numericEntry - tpPips * pipSz),
      riskReward: riskReward,
    };

    if (onTradePlanned) {
      onTradePlanned(plannedTrade);
    }
    onOpenRegisterModal();
  };

  const isPreFlightReady = ruleSweep && ruleStructure && ruleRisk && riskReward >= 1.5;

  return (
    <div
      className={`rounded-2xl border border-[#C5A059]/30 bg-[#0d0f14]/95 backdrop-blur-xl p-3.5 sm:p-4 font-mono shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex flex-col gap-3.5 select-none ${className}`}
      data-testid="revolut-operative-window"
    >
      {/* ── 1. ASSET SELECTOR & LIVE TICK ── */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          {PRIMARY_PAIRS.map((p) => {
            const active = market.toUpperCase() === p.symbol;
            return (
              <button
                key={p.symbol}
                type="button"
                onClick={() => {
                  synestheticClick();
                  triggerHaptic("selection");
                  onSelectMarket(p.symbol);
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? "bg-[#C5A059]/25 border border-[#C5A059] text-[#E8C56A] shadow-[0_0_12px_rgba(197,160,89,0.3)]"
                    : "bg-white/5 border border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                {p.symbol.replace("USD", "")}
              </button>
            );
          })}
        </div>

        {/* Live Market Price Pill */}
        <div className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg bg-black/60 border border-white/10">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-[11px] font-bold text-white tabular-nums tracking-tight whitespace-nowrap">
            {currentPrice
              ? market.includes("XAU")
                ? currentPrice.toFixed(2)
                : currentPrice >= 100
                ? currentPrice.toFixed(2)
                : currentPrice.toFixed(5)
              : "2,652.40"}
          </span>
        </div>
      </div>

      {/* ── 2. DIREZIONE OPERATIVA (BUY / SELL) ── */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            synestheticClick();
            triggerHaptic("selection");
            onDirectionChange("buy");
          }}
          className={`relative overflow-hidden py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer font-bold text-xs uppercase tracking-wider ${
            direction === "buy"
              ? "bg-gradient-to-br from-emerald-500/25 to-emerald-950/40 border-emerald-500 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.35)] scale-[1.01]"
              : "bg-[#11131c] border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20"
          }`}
        >
          <TrendingUp className={`w-4 h-4 ${direction === "buy" ? "text-emerald-400" : "text-slate-500"}`} />
          <span className="whitespace-nowrap">COMPRA · LONG</span>
        </button>

        <button
          type="button"
          onClick={() => {
            synestheticClick();
            triggerHaptic("selection");
            onDirectionChange("sell");
          }}
          className={`relative overflow-hidden py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer font-bold text-xs uppercase tracking-wider ${
            direction === "sell"
              ? "bg-gradient-to-br from-rose-500/25 to-rose-950/40 border-rose-500 text-rose-300 shadow-[0_0_20px_rgba(239,68,68,0.35)] scale-[1.01]"
              : "bg-[#11131c] border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20"
          }`}
        >
          <TrendingDown className={`w-4 h-4 ${direction === "sell" ? "text-rose-400" : "text-slate-500"}`} />
          <span className="whitespace-nowrap">VENDI · SHORT</span>
        </button>
      </div>

      {/* ── 3. MATRICE LIVELLI FINANZIARI (ENTRY, SL, TP) ── */}
      <div className="space-y-2 bg-[#11131c]/80 rounded-xl p-2.5 border border-white/5">
        {/* ENTRATA */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider whitespace-nowrap">
              Entrata
            </span>
            <button
              type="button"
              onClick={handleSyncCurrentPrice}
              title="Copia Prezzo Live dal Mercato"
              className="px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] text-[8.5px] font-bold uppercase tracking-wider hover:bg-[#C5A059]/30 transition-colors whitespace-nowrap"
            >
              Prezzo Live
            </button>
          </div>
          <input
            type="number"
            step="any"
            value={entryPrice}
            onChange={(e) => onEntryChange(e.target.value)}
            placeholder={String(numericEntry)}
            className="w-28 sm:w-32 bg-black/60 border border-white/15 focus:border-[#C5A059] focus:outline-none rounded-lg px-2 py-1 text-right text-xs font-bold text-white tabular-nums tracking-tight"
          />
        </div>

        {/* STOP LOSS */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider whitespace-nowrap">
              Stop Loss
            </span>
            <span className="text-[9px] text-slate-400 whitespace-nowrap">
              {slPips.toFixed(1)} pips · <strong className="text-rose-400">-{riskEur} {currency}</strong>
            </span>
          </div>
          <input
            type="number"
            step="any"
            value={stopLoss}
            onChange={(e) => onStopLossChange(e.target.value)}
            placeholder={(direction === "buy" ? numericEntry - slPips * pipSz : numericEntry + slPips * pipSz).toFixed(market.includes("XAU") ? 2 : 5)}
            className="w-28 sm:w-32 bg-black/60 border border-rose-500/30 focus:border-rose-500 focus:outline-none rounded-lg px-2 py-1 text-right text-xs font-bold text-rose-300 tabular-nums tracking-tight"
          />
        </div>

        {/* Quick SL Presets */}
        <div className="flex items-center gap-1 justify-end pt-0.5">
          {[15, 25, 40].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleQuickSl(p)}
              className="px-1.5 py-0.2 rounded bg-black/40 border border-white/10 text-[8.5px] text-slate-400 hover:text-white transition-colors"
            >
              {p} pips
            </button>
          ))}
        </div>

        {/* TAKE PROFIT / TARGET */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider whitespace-nowrap">
              Take Profit
            </span>
            <span className="text-[9px] text-slate-400 whitespace-nowrap">
              {tpPips.toFixed(1)} pips · <strong className="text-emerald-400">+{projectedReward} {currency}</strong>
            </span>
          </div>
          <input
            type="number"
            step="any"
            value={takeProfit}
            onChange={(e) => onTakeProfitChange(e.target.value)}
            placeholder={(direction === "buy" ? numericEntry + tpPips * pipSz : numericEntry - tpPips * pipSz).toFixed(market.includes("XAU") ? 2 : 5)}
            className="w-28 sm:w-32 bg-black/60 border border-emerald-500/30 focus:border-emerald-500 focus:outline-none rounded-lg px-2 py-1 text-right text-xs font-bold text-emerald-300 tabular-nums tracking-tight"
          />
        </div>

        {/* Quick RR Multipliers */}
        <div className="flex items-center gap-1 justify-end pt-0.5">
          {[2, 3, 5].map((rr) => (
            <button
              key={rr}
              type="button"
              onClick={() => handleQuickRr(rr)}
              className="px-1.5 py-0.2 rounded bg-black/40 border border-white/10 text-[8.5px] text-slate-400 hover:text-[#E8C56A] transition-colors"
            >
              1:{rr} R
            </button>
          ))}
        </div>
      </div>

      {/* ── 4. R:R TELEMETRY HERO (REVOLUT FINTECH KPI) ── */}
      <div className="rounded-xl border border-[#C5A059]/30 bg-gradient-to-r from-[#C5A059]/10 via-[#0d0f14] to-[#C5A059]/10 p-2.5 flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
            Rischio / Rendimento
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold text-[#E8C56A] tabular-nums tracking-tight whitespace-nowrap">
              1:{riskReward.toFixed(2)} R
            </span>
            <span className="text-[9.5px] font-bold text-emerald-400 whitespace-nowrap">
              (+{projectedReward} {currency})
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">
            Lotto Stimato
          </span>
          <span className="text-sm font-bold text-white tabular-nums tracking-tight whitespace-nowrap">
            {lots.toFixed(2)} Lotti
          </span>
        </div>
      </div>

      {/* ── 5. CUSTODE DELLA SOGLIA: PRE-FLIGHT INTEGRITY CHECKLIST ── */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059]" />
            Custode della Soglia (Pre-Flight)
          </span>
          <span className={isPreFlightReady ? "text-emerald-400" : "text-amber-400"}>
            {[ruleSweep, ruleStructure, ruleRisk].filter(Boolean).length}/3 Sbloccate
          </span>
        </div>

        <div className="grid grid-cols-1 gap-1">
          {/* Regola 1 */}
          <button
            type="button"
            onClick={() => {
              synestheticCheck();
              triggerHaptic("selection");
              setRuleSweep((v) => !v);
            }}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-[9.5px] font-semibold transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
              ruleSweep
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                : "bg-white/5 border-white/10 text-slate-400"
            }`}
          >
            <span className="truncate">1. Liquidità di Sessione Spazzata (Sweep)</span>
            {ruleSweep ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /> : <Circle className="w-3 h-3 text-slate-600 shrink-0" />}
          </button>

          {/* Regola 2 */}
          <button
            type="button"
            onClick={() => {
              synestheticCheck();
              triggerHaptic("selection");
              setRuleStructure((v) => !v);
            }}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-[9.5px] font-semibold transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
              ruleStructure
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                : "bg-white/5 border-white/10 text-slate-400"
            }`}
          >
            <span className="truncate">2. Rottura di Struttura (BOS) + Fair Value Gap</span>
            {ruleStructure ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /> : <Circle className="w-3 h-3 text-slate-600 shrink-0" />}
          </button>

          {/* Regola 3 */}
          <button
            type="button"
            onClick={() => {
              synestheticCheck();
              triggerHaptic("selection");
              setRuleRisk((v) => !v);
            }}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-[9.5px] font-semibold transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
              ruleRisk
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                : "bg-white/5 border-white/10 text-slate-400"
            }`}
          >
            <span className="truncate">3. Rischio Massimo 1% & R:R ≥ 1:2.0</span>
            {ruleRisk ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /> : <Circle className="w-3 h-3 text-slate-600 shrink-0" />}
          </button>
        </div>
      </div>

      {/* ── 6. PULSANTE D'AZIONE PRIMARIO (REVOLUT-STYLE SOVEREIGN BUTTON) ── */}
      <button
        type="button"
        onClick={handleExecute}
        className={`w-full py-3 px-4 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-[0.98] ${
          isPreFlightReady
            ? "bg-gradient-to-r from-[#C5A059] via-[#E8C56A] to-[#C5A059] text-black shadow-[0_0_24px_rgba(197,160,89,0.35)] hover:brightness-110"
            : "bg-[#C5A059]/20 border border-[#C5A059]/40 text-[#E8C56A] hover:bg-[#C5A059]/30"
        }`}
      >
        <Zap className="w-4 h-4 fill-current shrink-0" />
        <span className="whitespace-nowrap">
          {isGuest ? "ATTRAVERSA IL VARCO · SIMULA ORDINE" : "ATTRAVERSA IL VARCO · SIGILLA ORDINE"}
        </span>
        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
      </button>

      {/* Guest Note / Integrity Seal Note */}
      <div className="text-center text-[9px] text-slate-400 flex items-center justify-center gap-1">
        <Sparkles className="w-2.5 h-2.5 text-[#C5A059]" />
        <span>Protocollo Aureus · Esecuzione Zero-Leak Verificata</span>
      </div>
    </div>
  );
}
