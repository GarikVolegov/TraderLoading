// ─── Quick Order Drawer (Landscape & Mobile HUD) ───────────────────────────
// Ergonomic slide-in order drawer for Backtest Replay:
// - Direct right-thumb one-tap Market executions (BUY & SELL).
// - Dynamic lot size & monetary risk calculation based on ticket preset.
// - Quick R:R presets (1:1, 1:2, 1:3, 1:5) and Risk % chips (0.5%, 1.0%, 1.5%, 2.0%).
// - Quick SL/TP pip steppers (+/- 5 pips).
// - Active positions management (live floating P&L, "Tutte a BE", "Chiudi Tutte").
// - Bio-Lock guard integration (Tactical Breath enforcement on high drift).
// - Touch swipe-right to dismiss gesture & iOS safe-area insets.

import { useCallback, useRef, useState, useMemo, useEffect } from "react";
import {
  Crosshair,
  X,
  TrendingUp,
  TrendingDown,
  Layers,
  ShieldCheck,
  Zap,
  ArrowUp,
  ArrowDown,
  Check,
  AlertTriangle,
  Minus,
  Plus,
  Flame,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatMoney, formatPrice, formatSignedMoney } from "./format";
import {
  synestheticClick,
  synestheticSealOfAction,
  synestheticAlert,
} from "@/lib/soundFx";
import {
  loadBioLockConfig,
  evaluateBioLockStatus,
  getLastBreathAlignmentTimestamp,
  recordBreathAlignmentTimestamp,
  type BioLockConfig,
} from "@/lib/bioLockGuard";
import { TacticalBreathModal } from "../cockpit/TacticalBreathModal";
import { useSmartWatchHeartRate } from "@/hooks/useSmartWatchHeartRate";
import { computeReplayTelemetry } from "./ReplayBioTelemetryHUD";
import type { ReplayEngine } from "./useReplayEngine";

export interface QuickOrderDrawerProps {
  engine: ReplayEngine;
  isOpen: boolean;
  onClose: () => void;
}

const RISK_PRESETS = [0.5, 1.0, 1.5, 2.0] as const;
const RR_PRESETS = [1, 2, 3, 5] as const;

export function QuickOrderDrawer({ engine, isOpen, onClose }: QuickOrderDrawerProps) {
  const { language } = useLanguage();
  const watch = useSmartWatchHeartRate();
  const [breathModalOpen, setBreathModalOpen] = useState(false);
  const [pendingDirection, setPendingDirection] = useState<"buy" | "sell" | null>(null);
  const [bioLockConfig, setBioLockConfig] = useState<BioLockConfig>(() => loadBioLockConfig());
  const [lastBreathTs, setLastBreathTs] = useState<number | null>(() => getLastBreathAlignmentTimestamp());

  // Bio-Lock synchronization
  useEffect(() => {
    const handleSync = () => {
      setBioLockConfig(loadBioLockConfig());
      setLastBreathTs(getLastBreathAlignmentTimestamp());
    };
    window.addEventListener("aureus-biolock-updated", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("aureus-biolock-updated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const currentBpm = watch.isLive
    ? watch.bpm
    : computeReplayTelemetry(engine.positions, engine.currentPrice, engine.symbol, engine.openProfit).bpm;

  const bioLockEval = useMemo(() => {
    return evaluateBioLockStatus({
      config: bioLockConfig,
      currentBpm,
      isCriticalDrift: currentBpm >= bioLockConfig.maxBpmThreshold,
      lastBreathMs: lastBreathTs,
      nowMs: Date.now(),
    });
  }, [bioLockConfig, currentBpm, lastBreathTs]);

  // Touch swipe-to-dismiss gesture on drawer
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - touchStartXRef.current;
    const dy = endY - touchStartYRef.current;

    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // Swipe right to dismiss drawer
    if (dx > 44 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      synestheticClick();
      onClose();
    }
  }, [onClose]);

  // Direct order submission with Bio-Lock verification
  const submitOrder = useCallback((direction: "buy" | "sell") => {
    synestheticClick();

    if (bioLockEval.isLocked) {
      synestheticAlert();
      setPendingDirection(direction);
      setBreathModalOpen(true);
      return;
    }

    if (direction === "buy") {
      engine.buy();
    } else {
      engine.sell();
    }
    synestheticSealOfAction();
  }, [bioLockEval.isLocked, engine]);

  const applyRrPreset = useCallback((ratio: number) => {
    synestheticClick();
    const sl = engine.ticket.slPips > 0 ? engine.ticket.slPips : 25;
    engine.setTicket((prev) => ({
      ...prev,
      tpPips: Math.round(sl * ratio * 10) / 10,
    }));
  }, [engine]);

  const applyRiskPreset = useCallback((riskPercent: number) => {
    synestheticClick();
    engine.setTicket((prev) => ({
      ...prev,
      riskMode: "percent",
      riskValue: riskPercent,
    }));
  }, [engine]);

  const stepSl = useCallback((delta: number) => {
    synestheticClick();
    engine.setTicket((prev) => ({
      ...prev,
      slPips: Math.max(5, Math.round((prev.slPips + delta) * 10) / 10),
    }));
  }, [engine]);

  const stepTp = useCallback((delta: number) => {
    synestheticClick();
    engine.setTicket((prev) => ({
      ...prev,
      tpPips: Math.max(5, Math.round((prev.tpPips + delta) * 10) / 10),
    }));
  }, [engine]);

  if (!isOpen) return null;

  const unavailable = engine.loading || engine.executing || engine.noData || Boolean(engine.error);
  const currentPriceFormatted = engine.currentPrice > 0 ? formatPrice(engine.currentPrice, engine.symbol) : "—";
  const openPosCount = engine.positions.length;

  return (
    <>
      {/* Dimmed backdrop for one-tap dismissal */}
      <div
        aria-hidden="true"
        onClick={() => {
          synestheticClick();
          onClose();
        }}
        className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      />

      {/* Slide-in lateral drawer */}
      <aside
        role="dialog"
        aria-label="Forgia Rapida Replay"
        aria-modal="true"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          paddingTop: "max(12px, env(safe-area-inset-top))",
          paddingBottom: "max(14px, env(safe-area-inset-bottom))",
          paddingRight: "max(14px, env(safe-area-inset-right))",
          paddingLeft: "14px",
        }}
        className="fixed right-0 top-0 bottom-0 z-[125] w-[320px] max-w-[88vw] bg-[#07080b]/98 border-l border-[#C5A059]/30 text-white shadow-[-12px_0_40px_rgba(0,0,0,0.9)] flex flex-col font-mono select-none overflow-hidden animate-in slide-in-from-right duration-200"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#C5A059]/20">
          <div className="flex items-center gap-1.5 min-w-0">
            <Zap className="h-4 w-4 text-[#E8C56A] shrink-0" />
            <span className="text-[11px] font-bold tracking-wider text-[#E8C56A] uppercase whitespace-nowrap">
              FORGIA RAPIDA
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[9.5px] font-bold text-[#E8C56A] uppercase whitespace-nowrap">
              {engine.symbol}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10.5px] text-slate-300 font-bold whitespace-nowrap">
              {currentPriceFormatted}
            </span>
            <button
              type="button"
              onClick={() => {
                synestheticClick();
                onClose();
              }}
              title="Chiudi Drawer"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:border-[#C5A059]/40 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Scrollable controls body */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5 scrollbar-thin scrollbar-thumb-[#C5A059]/30">
          {/* Primary Execution Buttons (Buy / Sell) */}
          <div className="grid grid-cols-2 gap-2">
            {/* BUY BUTTON */}
            <button
              type="button"
              disabled={unavailable}
              onClick={() => submitOrder("buy")}
              className="flex flex-col items-center justify-center min-h-[52px] p-2 rounded-xl border border-emerald-500/50 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 hover:border-emerald-400 active:scale-[0.98] transition-all cursor-pointer shadow-[0_4px_16px_rgba(16,185,129,0.2)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-1 font-bold text-xs uppercase tracking-wider">
                <ArrowUp size={14} className="text-emerald-400" />
                <span>BUY</span>
              </div>
              <span className="text-[10px] text-emerald-200/90 font-mono font-medium whitespace-nowrap mt-0.5">
                {engine.lots.toFixed(2)} Lot
              </span>
            </button>

            {/* SELL BUTTON */}
            <button
              type="button"
              disabled={unavailable}
              onClick={() => submitOrder("sell")}
              className="flex flex-col items-center justify-center min-h-[52px] p-2 rounded-xl border border-rose-500/50 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 hover:border-rose-400 active:scale-[0.98] transition-all cursor-pointer shadow-[0_4px_16px_rgba(244,63,94,0.2)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-1 font-bold text-xs uppercase tracking-wider">
                <ArrowDown size={14} className="text-rose-400" />
                <span>SELL</span>
              </div>
              <span className="text-[10px] text-rose-200/90 font-mono font-medium whitespace-nowrap mt-0.5">
                {engine.lots.toFixed(2)} Lot
              </span>
            </button>
          </div>

          {/* Telemetry Summary Bar */}
          <div className="grid grid-cols-3 gap-1 p-2 rounded-lg bg-black/60 border border-white/10 text-center font-mono">
            <div>
              <div className="text-[8.5px] uppercase tracking-wider text-slate-400">Rischio</div>
              <div className="text-[10.5px] font-bold text-[#E8C56A] whitespace-nowrap">
                ${engine.riskAmount.toFixed(0)}
              </div>
            </div>
            <div>
              <div className="text-[8.5px] uppercase tracking-wider text-slate-400">Taglia</div>
              <div className="text-[10.5px] font-bold text-slate-200 whitespace-nowrap">
                {engine.lots.toFixed(2)} L
              </div>
            </div>
            <div>
              <div className="text-[8.5px] uppercase tracking-wider text-slate-400">R:R Target</div>
              <div className="text-[10.5px] font-bold text-emerald-400 whitespace-nowrap">
                1:{engine.rr != null ? engine.rr.toFixed(1) : "—"}
              </div>
            </div>
          </div>

          {/* Risk % Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
              <span>Rischio per Trade</span>
              <span className="text-[#E8C56A] font-mono whitespace-nowrap">{engine.ticket.riskValue}%</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {RISK_PRESETS.map((pct) => {
                const isActive = Math.abs(engine.ticket.riskValue - pct) < 0.05;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => applyRiskPreset(pct)}
                    className={`py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? "border-[#C5A059] bg-[#C5A059]/25 text-[#E8C56A] shadow-[0_0_10px_rgba(197,160,89,0.3)]"
                        : "border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-white/20"
                    }`}
                  >
                    {pct}%
                  </button>
                );
              })}
            </div>
          </div>

          {/* R:R Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
              <span>Preset Ratio R:R</span>
              <span className="text-emerald-400 font-mono whitespace-nowrap">
                1:{engine.rr != null ? engine.rr.toFixed(1) : "—"} RR
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {RR_PRESETS.map((ratio) => {
                const isTarget = engine.rr != null && Math.abs(engine.rr - ratio) < 0.2;
                return (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => applyRrPreset(ratio)}
                    className={`py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                      isTarget
                        ? "border-emerald-500 bg-emerald-500/25 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                        : "border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-white/20"
                    }`}
                  >
                    1:{ratio}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SL & TP Pips Steppers */}
          <div className="space-y-2">
            {/* Stop Loss Stepper */}
            <div className="flex items-center justify-between p-1.5 rounded-lg bg-black/50 border border-white/10">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-rose-400 whitespace-nowrap pl-1">
                Stop Loss
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => stepSl(-5)}
                  className="flex h-6 w-6 items-center justify-center rounded border border-white/10 bg-white/5 text-slate-300 hover:text-white cursor-pointer"
                >
                  <Minus size={11} />
                </button>
                <span className="text-[10.5px] font-bold text-rose-300 font-mono min-w-[58px] text-center whitespace-nowrap">
                  {engine.ticket.slPips} pips
                </span>
                <button
                  type="button"
                  onClick={() => stepSl(5)}
                  className="flex h-6 w-6 items-center justify-center rounded border border-white/10 bg-white/5 text-slate-300 hover:text-white cursor-pointer"
                >
                  <Plus size={11} />
                </button>
              </div>
            </div>

            {/* Take Profit Stepper */}
            <div className="flex items-center justify-between p-1.5 rounded-lg bg-black/50 border border-white/10">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-400 whitespace-nowrap pl-1">
                Take Profit
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => stepTp(-5)}
                  className="flex h-6 w-6 items-center justify-center rounded border border-white/10 bg-white/5 text-slate-300 hover:text-white cursor-pointer"
                >
                  <Minus size={11} />
                </button>
                <span className="text-[10.5px] font-bold text-emerald-300 font-mono min-w-[58px] text-center whitespace-nowrap">
                  {engine.ticket.tpPips} pips
                </span>
                <button
                  type="button"
                  onClick={() => stepTp(5)}
                  className="flex h-6 w-6 items-center justify-center rounded border border-white/10 bg-white/5 text-slate-300 hover:text-white cursor-pointer"
                >
                  <Plus size={11} />
                </button>
              </div>
            </div>
          </div>

          {/* Active Positions Management (When positions exist) */}
          {openPosCount > 0 && (
            <div className="pt-2 border-t border-[#C5A059]/20 space-y-2">
              <div className="flex items-center justify-between text-[9.5px] font-bold uppercase tracking-wider">
                <span className="text-slate-300 flex items-center gap-1">
                  <Layers size={11} className="text-[#E8C56A]" />
                  <span>Posizioni ({openPosCount})</span>
                </span>
                <span
                  className={`font-mono text-[10.5px] font-bold whitespace-nowrap ${
                    engine.openProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {formatSignedMoney(engine.openProfit, language)}
                </span>
              </div>

              {/* Bulk Actions (Tutte a BE & Chiudi Tutte) */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    synestheticClick();
                    engine.moveAllToBreakeven();
                  }}
                  className="py-1.5 px-2 rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/15 text-[#E8C56A] text-[9.5px] font-bold uppercase tracking-wider hover:bg-[#C5A059]/25 transition-colors cursor-pointer whitespace-nowrap text-center"
                >
                  Tutte a BE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    synestheticSealOfAction();
                    engine.closeAllPositions();
                  }}
                  className="py-1.5 px-2 rounded-lg border border-rose-500/40 bg-rose-500/15 text-rose-300 text-[9.5px] font-bold uppercase tracking-wider hover:bg-rose-500/25 transition-colors cursor-pointer whitespace-nowrap text-center"
                >
                  Chiudi Tutte
                </button>
              </div>

              {/* Positions List */}
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-0.5 scrollbar-thin">
                {engine.positions.map((pos, idx) => {
                  const posId = pos.id ?? `pos-${idx}`;
                  const isLong = pos.direction === "buy";
                  const posPnl =
                    engine.currentPrice > 0
                      ? (isLong
                          ? engine.currentPrice - pos.entryPrice
                          : pos.entryPrice - engine.currentPrice) *
                        pos.lots *
                        100000
                      : 0;

                  return (
                    <div
                      key={posId}
                      className="p-1.5 rounded-lg bg-black/60 border border-white/10 flex items-center justify-between text-[9.5px] font-mono"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`px-1 py-0.2 rounded font-bold uppercase text-[8.5px] whitespace-nowrap ${
                            isLong
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {isLong ? "LONG" : "SHORT"}
                        </span>
                        <span className="text-slate-300 whitespace-nowrap">
                          {pos.lots.toFixed(2)} L
                        </span>
                        <span
                          className={`font-bold whitespace-nowrap ${
                            posPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {formatSignedMoney(posPnl, language)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            synestheticClick();
                            engine.moveToBreakeven(posId);
                          }}
                          title="Porta a Breakeven"
                          className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[9px] text-slate-300 hover:text-white cursor-pointer whitespace-nowrap"
                        >
                          BE
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            synestheticSealOfAction();
                            engine.closePositionById(posId);
                          }}
                          title="Chiudi Posizione"
                          className="px-1.5 py-0.5 rounded border border-rose-500/30 bg-rose-500/10 text-[9px] text-rose-300 hover:bg-rose-500/20 cursor-pointer whitespace-nowrap"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div className="pt-2 mt-2 border-t border-[#C5A059]/15 flex items-center justify-between text-[8.5px] text-slate-400 uppercase tracking-wider">
          <span>Swipe → per chiudere</span>
          <span className="text-[#E8C56A]">AUREUS PROTOCOL</span>
        </div>
      </aside>

      {/* Bio-Lock Tactical Breath Modal */}
      <TacticalBreathModal
        isOpen={breathModalOpen}
        onClose={() => setBreathModalOpen(false)}
        onComplete={() => {
          recordBreathAlignmentTimestamp();
          setLastBreathTs(Date.now());
          setBreathModalOpen(false);
          if (pendingDirection) {
            if (pendingDirection === "buy") {
              engine.buy();
            } else {
              engine.sell();
            }
            synestheticSealOfAction();
            setPendingDirection(null);
          }
        }}
      />
    </>
  );
}
