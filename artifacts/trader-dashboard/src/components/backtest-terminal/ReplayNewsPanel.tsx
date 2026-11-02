// ─── AUREUS PROTOCOL — Replay News Panel (Macro Calendar) ───────────────────
// Notizie Macroeconomiche & Calendario Storico per il Replay:
// Mostra gli eventi di alto impatto (CPI, NFP, FOMC) sincronizzati con la data
// di replay e con le valute pertinenti allo strumento attivo.

import React, { useMemo } from "react";
import {
  Calendar,
  AlertTriangle,
  Clock,
  ExternalLink,
  Flame,
  Globe,
  Sliders,
} from "lucide-react";
import { getCurrenciesForSymbol } from "../chart/RedNewsOverlay";
import { synestheticClick } from "@/lib/soundFx";

export interface ReplayNewsPanelProps {
  symbol: string;
  replayTime?: number | null;
  showNewsOnChart: boolean;
  onToggleNewsOnChart: () => void;
}

interface MockMacroEvent {
  id: string;
  title: string;
  country: string;
  currency: string;
  impact: "High" | "Medium" | "Low";
  dateOffsetHours: number; // rispetto all'orario replay
  forecast: string;
  previous: string;
}

const STATIC_EVENTS: MockMacroEvent[] = [
  { id: "e1", title: "US Non-Farm Payrolls (NFP)", country: "US", currency: "USD", impact: "High", dateOffsetHours: -2, forecast: "180K", previous: "216K" },
  { id: "e2", title: "US CPI (YoY) - Indice Prezzi al Consumo", country: "US", currency: "USD", impact: "High", dateOffsetHours: 4, forecast: "3.1%", previous: "3.4%" },
  { id: "e3", title: "FOMC Rate Decision & Conferenza Powell", country: "US", currency: "USD", impact: "High", dateOffsetHours: 18, forecast: "5.25%", previous: "5.25%" },
  { id: "e4", title: "ECB Main Refinancing Rate", country: "EU", currency: "EUR", impact: "High", dateOffsetHours: -12, forecast: "4.50%", previous: "4.50%" },
  { id: "e5", title: "UK GDP (MoM) Prodotto Interno Lordo", country: "GB", currency: "GBP", impact: "Medium", dateOffsetHours: 8, forecast: "0.2%", previous: "-0.1%" },
  { id: "e6", title: "BOJ Core CPI (Giappone)", country: "JP", currency: "JPY", impact: "High", dateOffsetHours: -26, forecast: "2.8%", previous: "2.5%" },
];

export function ReplayNewsPanel({
  symbol,
  replayTime,
  showNewsOnChart,
  onToggleNewsOnChart,
}: ReplayNewsPanelProps) {
  const currencies = useMemo(() => getCurrenciesForSymbol(symbol), [symbol]);

  // Filtra eventi pertinenti alle valute dello strumento
  const relevantEvents = useMemo(() => {
    return STATIC_EVENTS.filter(
      (ev) => currencies.includes(ev.currency) || currencies.includes("USD"),
    );
  }, [currencies]);

  return (
    <div className="flex flex-col h-full overflow-hidden p-3 gap-3 bg-[#0d0f14] text-slate-200 font-sans">
      {/* Header & Toggle Visualizzazione Grafico */}
      <div className="flex flex-col gap-2 shrink-0 pb-2 border-b border-[#C5A059]/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Globe size={14} className="text-[#C5A059]" />
            <span className="font-serif text-xs uppercase tracking-wider text-[#C5A059] font-bold">
              Notizie Macroeconomiche
            </span>
          </div>
          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#E8C56A] uppercase font-bold">
            {currencies.join(" / ")}
          </span>
        </div>

        {/* Toggle Flag sul Grafico */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-[#07080b] border border-white/10">
          <span className="text-xs text-slate-300">Marker Bandiere sul Grafico</span>
          <button
            type="button"
            onClick={() => {
              synestheticClick();
              onToggleNewsOnChart();
            }}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider transition-colors cursor-pointer ${
              showNewsOnChart
                ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                : "bg-white/5 border border-white/10 text-slate-400"
            }`}
          >
            {showNewsOnChart ? "ATTIVO" : "NASCOSTO"}
          </button>
        </div>
      </div>

      {/* Lista Eventi */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-[#C5A059]/30">
        {relevantEvents.map((ev) => {
          const isHigh = ev.impact === "High";
          return (
            <div
              key={ev.id}
              className={`p-2.5 rounded-lg border flex flex-col gap-1.5 transition-all ${
                isHigh
                  ? "bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50"
                  : "bg-[#11131c] border-white/5 hover:border-[#C5A059]/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-bold px-1 rounded bg-black/50 border border-white/10 text-slate-200">
                    {ev.currency}
                  </span>
                  <span
                    className={`text-[9px] font-mono font-bold px-1 rounded ${
                      isHigh
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    }`}
                  >
                    {ev.impact.toUpperCase()}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {ev.dateOffsetHours < 0
                    ? `${Math.abs(ev.dateOffsetHours)}h fa`
                    : `tra ${ev.dateOffsetHours}h`}
                </span>
              </div>

              <span className="text-xs font-medium text-slate-100 leading-snug">
                {ev.title}
              </span>

              <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-white/5 text-slate-400">
                <span>Prev: {ev.previous}</span>
                <span className="text-slate-200">Fcst: {ev.forecast}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
