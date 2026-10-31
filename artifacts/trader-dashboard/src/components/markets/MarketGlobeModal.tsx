import { useState } from "react";
import { X, Globe2, LineChart, Sun, Moon, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { MarketGlobe3D, MARKET_PINS, type MarketPin } from "./MarketGlobe3D";
import { MarketComparativeChart } from "./MarketComparativeChart";
import { triggerHaptic } from "@/lib/hapticPulse";
import { useLocation } from "wouter";

interface MarketGlobeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MarketGlobeModal({ isOpen, onClose }: MarketGlobeModalProps) {
  const [, setLocation] = useLocation();
  const [selectedRegion, setSelectedRegion] = useState<"all" | "us" | "europe" | "asia">("all");
  const [viewMode, setViewMode] = useState<"globe" | "chart">("globe");
  const [focusedPin, setFocusedPin] = useState<MarketPin | null>(null);

  if (!isOpen) return null;

  const filteredPins =
    selectedRegion === "all" ? MARKET_PINS : MARKET_PINS.filter((p) => p.region === selectedRegion);

  const handleOpenAssetInCockpit = (symbol: string) => {
    triggerHaptic("success");
    onClose();
    setLocation(`/cockpit?symbol=${encodeURIComponent(symbol)}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="La Sfera dei Mercati"
        className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-xl md:max-w-2xl bg-[#07080b] border-0 sm:border sm:border-[#C5A059]/35 sm:rounded-3xl flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.9)] text-foreground"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-4 pb-3 border-b border-[#C5A059]/20 bg-[#0d0f14]/80">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/15 text-[#E8C56A]">
              <Globe2 className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-bold tracking-wide text-white">
                La Sfera dei Mercati
              </h2>
              <p className="font-mono text-[10px] text-[#94a3b8] uppercase tracking-wider">
                Telemetria Kill-Zone &amp; Dinamica Globale
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              onClose();
            }}
            className="p-2 rounded-full border border-white/10 bg-[#11131c] text-[#94a3b8] hover:text-white hover:border-[#C5A059]/40 transition-colors"
            aria-label="Chiudi telemetria mercati"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Cockpit Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin scrollbar-thumb-[#C5A059]/30">
          {/* Controls row: Region Pills + View Switcher */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Region selector pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: "all", label: "Tutti" },
                { id: "us", label: "Stati Uniti" },
                { id: "europe", label: "Europa" },
                { id: "asia", label: "Asia-Pacifico" },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic("selection");
                    setSelectedRegion(r.id as any);
                  }}
                  className={`px-3 py-1.5 rounded-full font-mono text-[11px] font-bold whitespace-nowrap transition-all border ${
                    selectedRegion === r.id
                      ? "bg-[#C5A059]/20 border-[#C5A059] text-[#E8C56A] shadow-[0_0_12px_rgba(197,160,89,0.25)]"
                      : "bg-[#0d0f14] border-white/10 text-[#94a3b8] hover:border-white/20 hover:text-white"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Mode Toggle (Globe 3D vs Comparative Trajectory) */}
            <div className="inline-flex items-center rounded-xl border border-white/10 bg-[#0d0f14] p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setViewMode("globe");
                }}
                className={`flex items-center gap-1.5 px-3 py-1 font-mono text-[10px] uppercase font-bold rounded-lg transition-all ${
                  viewMode === "globe"
                    ? "bg-[#C5A059] text-[#07080b] shadow-[0_0_10px_rgba(197,160,89,0.4)]"
                    : "text-[#94a3b8] hover:text-white"
                }`}
              >
                <Globe2 className="h-3 w-3" />
                <span>Globo 3D</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setViewMode("chart");
                }}
                className={`flex items-center gap-1.5 px-3 py-1 font-mono text-[10px] uppercase font-bold rounded-lg transition-all ${
                  viewMode === "chart"
                    ? "bg-[#C5A059] text-[#07080b] shadow-[0_0_10px_rgba(197,160,89,0.4)]"
                    : "text-[#94a3b8] hover:text-white"
                }`}
              >
                <LineChart className="h-3 w-3" />
                <span>Traiettoria</span>
              </button>
            </div>
          </div>

          {/* Viewport: 3D Globe or Comparative Trajectory */}
          <div className="rounded-2xl border border-[#C5A059]/25 bg-gradient-to-b from-[#0c0e16] to-[#07080b] p-2 overflow-hidden shadow-inner relative">
            {viewMode === "globe" ? (
              <MarketGlobe3D
                selectedRegion={selectedRegion}
                onSelectPin={(pin) => {
                  setFocusedPin(pin);
                }}
              />
            ) : (
              <MarketComparativeChart region={selectedRegion} />
            )}

            {/* Hint overlay */}
            <div className="absolute bottom-2 left-3 pointer-events-none flex items-center gap-1.5 text-[9px] font-mono text-[#94a3b8]/70">
              <Sparkles className="h-2.5 w-2.5 text-[#C5A059]" />
              <span>
                {viewMode === "globe"
                  ? "Trascina per ruotare · Tocca un marker per focalizzare"
                  : "Dinamica percentuale comparativa delle piazze d'affari"}
              </span>
            </div>
          </div>

          {/* Focused Pin Inspector Card (if clicked) */}
          {focusedPin && (
            <div className="p-3 rounded-xl border border-[#C5A059]/40 bg-[#0d0f14] flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xl shrink-0">{focusedPin.flag}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white">{focusedPin.symbol}</span>
                    <span className="text-xs text-[#94a3b8] truncate">{focusedPin.name}</span>
                    {focusedPin.isKillZone ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold uppercase bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                        <Sun className="h-2.5 w-2.5" /> KILL-ZONE ATTIVA
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold uppercase bg-white/5 text-[#94a3b8] border border-white/10">
                        <Moon className="h-2.5 w-2.5" /> FUORI ORARIO
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs mt-0.5">
                    <span className="text-[#E8C56A] font-bold">{focusedPin.price}</span>
                    <span className={focusedPin.changePct >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}>
                      {focusedPin.changePct >= 0
                        ? `+${focusedPin.changePct.toFixed(2)}%`
                        : `${focusedPin.changePct.toFixed(2)}%`}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenAssetInCockpit(focusedPin.symbol)}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-[#C5A059] bg-[#C5A059]/20 hover:bg-[#C5A059] text-[#E8C56A] hover:text-[#07080b] font-mono text-[11px] font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Attraversa Varco</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* List of Indices / Assets */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between px-1">
              <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                Indici e Asset Eletti
              </span>
              <span className="font-mono text-[10px] text-[#94a3b8]">
                {filteredPins.length} Mercati Sincronizzati
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredPins.map((pin) => {
                const isPositive = pin.changePct >= 0;
                return (
                  <div
                    key={pin.id}
                    onClick={() => {
                      triggerHaptic("selection");
                      setFocusedPin(pin);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      focusedPin?.id === pin.id
                        ? "border-[#E8C56A] bg-[#141624] ring-1 ring-[#E8C56A]/50"
                        : "border-white/5 bg-[#0d0f14]/90 hover:border-[#C5A059]/40 hover:bg-[#11131c]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl shrink-0">{pin.flag}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-white">{pin.symbol}</span>
                          {pin.isKillZone && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                        </div>
                        <p className="font-mono text-[10px] text-[#94a3b8] truncate">{pin.name}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-xs font-bold text-white block tabular-nums whitespace-nowrap">
                        {pin.price}
                      </span>
                      <span
                        className={`font-mono text-[10px] font-bold block tabular-nums whitespace-nowrap ${
                          isPositive ? "text-[#10b981]" : "text-[#ef4444]"
                        }`}
                      >
                        {isPositive ? `▲ +${pin.changePct.toFixed(2)}%` : `▼ ${pin.changePct.toFixed(2)}%`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-[#24242C] bg-[#07080b] flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#94a3b8]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#10b981]" />
            <span>Fusi Orari Sincronizzati (CET / UTC)</span>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              onClose();
            }}
            className="px-4 py-2 rounded-lg border border-white/10 bg-[#11131c] hover:bg-[#1a1c28] text-white font-mono text-xs font-bold uppercase transition-all"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
