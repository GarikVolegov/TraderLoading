// ─── AUREUS PROTOCOL — Replay Watchlist Panel ────────────────────────────────
// "Every asset in one list. Flip between them in a click."
// Cockpit di selezione rapida strumenti per il backtest replay con cambio istantaneo.

import React, { useState, useMemo } from "react";
import {
  Search,
  Check,
  TrendingUp,
  DollarSign,
  Coins,
  Flame,
  Activity,
  ArrowRight,
} from "lucide-react";
import { synestheticClick } from "@/lib/soundFx";

export interface ReplayWatchlistPanelProps {
  currentSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

interface InstrumentMeta {
  symbol: string;
  name: string;
  category: "forex" | "metals" | "indices" | "crypto";
  spread: string;
  pipSize: string;
}

const INSTRUMENT_CATALOG: InstrumentMeta[] = [
  // Metalli & Materie Prime
  { symbol: "XAUUSD", name: "Oro Spot / Dollaro USA", category: "metals", spread: "0.15", pipSize: "0.01" },
  { symbol: "XAGUSD", name: "Argento Spot / Dollaro USA", category: "metals", spread: "0.02", pipSize: "0.001" },
  { symbol: "USOIL", name: "Petrolio Greggio WTI", category: "metals", spread: "0.03", pipSize: "0.01" },

  // Indici
  { symbol: "US30", name: "Wall Street 30 / Dow Jones", category: "indices", spread: "1.2", pipSize: "1.0" },
  { symbol: "NAS100", name: "US Tech 100 / Nasdaq", category: "indices", spread: "0.8", pipSize: "0.1" },
  { symbol: "SPX500", name: "S&P 500 Sovrano", category: "indices", spread: "0.3", pipSize: "0.1" },

  // Forex Major & Cross
  { symbol: "EURUSD", name: "Euro / Dollaro USA", category: "forex", spread: "0.2", pipSize: "0.0001" },
  { symbol: "GBPUSD", name: "Sterlina / Dollaro USA", category: "forex", spread: "0.4", pipSize: "0.0001" },
  { symbol: "USDJPY", name: "Dollaro USA / Yen Giapponese", category: "forex", spread: "0.3", pipSize: "0.01" },
  { symbol: "AUDUSD", name: "Dollaro Australiano / USA", category: "forex", spread: "0.3", pipSize: "0.0001" },
  { symbol: "USDCAD", name: "Dollaro USA / Canadese", category: "forex", spread: "0.4", pipSize: "0.0001" },
  { symbol: "USDCHF", name: "Dollaro USA / Franco Svizzero", category: "forex", spread: "0.4", pipSize: "0.0001" },
  { symbol: "EURJPY", name: "Euro / Yen Giapponese", category: "forex", spread: "0.5", pipSize: "0.01" },
  { symbol: "GBPJPY", name: "Sterlina / Yen Giapponese", category: "forex", spread: "0.8", pipSize: "0.01" },

  // Crypto
  { symbol: "BTCUSD", name: "Bitcoin / Dollaro USA", category: "crypto", spread: "5.0", pipSize: "1.0" },
  { symbol: "ETHUSD", name: "Ethereum / Dollaro USA", category: "crypto", spread: "0.8", pipSize: "0.1" },
];

export function ReplayWatchlistPanel({
  currentSymbol,
  onSelectSymbol,
}: ReplayWatchlistPanelProps) {
  const [filterQuery, setFilterQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | "metals" | "indices" | "forex" | "crypto">("all");

  const filteredInstruments = useMemo(() => {
    return INSTRUMENT_CATALOG.filter((inst) => {
      const matchCat = activeCategory === "all" || inst.category === activeCategory;
      const matchQuery =
        !filterQuery.trim() ||
        inst.symbol.toLowerCase().includes(filterQuery.toLowerCase()) ||
        inst.name.toLowerCase().includes(filterQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [filterQuery, activeCategory]);

  const handleSelect = (symbol: string) => {
    synestheticClick();
    if (symbol !== currentSymbol) {
      onSelectSymbol(symbol);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-3 gap-3 bg-[#0d0f14] text-slate-200">
      {/* Header & Ricerca */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="font-serif text-xs uppercase tracking-wider text-[#C5A059] font-bold">
            Watchlist Sovrana
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            {filteredInstruments.length} Asset
          </span>
        </div>

        {/* Input Ricerca */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Cerca ticker o strumento..."
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-[#07080b] border border-[#C5A059]/25 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#C5A059] font-mono"
          />
        </div>

        {/* Pillole Filtro Categorie */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
          {[
            { id: "all", label: "Tutti" },
            { id: "metals", label: "Metalli" },
            { id: "indices", label: "Indici" },
            { id: "forex", label: "Forex" },
            { id: "crypto", label: "Crypto" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                synestheticClick();
                setActiveCategory(cat.id as any);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wider transition-colors whitespace-nowrap cursor-pointer ${
                activeCategory === cat.id
                  ? "bg-[#C5A059]/20 border border-[#C5A059] text-[#E8C56A] font-bold"
                  : "bg-[#11131c] border border-white/10 text-slate-400 hover:text-slate-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista Strumenti con Cambio a 1 Click */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-[#C5A059]/30">
        {filteredInstruments.map((inst) => {
          const isSelected = inst.symbol === currentSymbol;
          return (
            <div
              key={inst.symbol}
              onClick={() => handleSelect(inst.symbol)}
              className={`group flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? "bg-[#C5A059]/15 border-[#C5A059] shadow-[0_0_12px_rgba(197,160,89,0.2)]"
                  : "bg-[#11131c]/80 border-white/5 hover:border-[#C5A059]/30 hover:bg-[#11131c]"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-md border font-mono text-[10px] font-bold shrink-0 ${
                    isSelected
                      ? "border-[#C5A059] bg-[#C5A059] text-black"
                      : "border-white/10 bg-[#07080b] text-[#E8C56A]"
                  }`}
                >
                  {inst.symbol.slice(0, 3)}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-white tracking-wide">
                      {inst.symbol}
                    </span>
                    {isSelected && (
                      <span className="text-[9px] px-1 rounded bg-[#C5A059]/20 text-[#E8C56A] font-mono font-bold">
                        ATTIVO
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 truncate">
                    {inst.name}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-right shrink-0">
                <div className="flex flex-col font-mono text-[10px]">
                  <span className="text-slate-400">Spread: {inst.spread}</span>
                  <span className="text-[9px] text-slate-500">Pip: {inst.pipSize}</span>
                </div>
                {isSelected ? (
                  <Check size={14} className="text-[#E8C56A]" />
                ) : (
                  <ArrowRight size={13} className="text-slate-600 group-hover:text-[#C5A059] transition-colors" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
