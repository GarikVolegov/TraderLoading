import React, { useMemo } from "react";
import {
  Layers,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  X,
  TrendingUp,
  Square,
  Percent,
  Type,
  Ruler,
  Sliders,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  BarChart2,
} from "lucide-react";
import type { ReplayDrawing } from "@/lib/replay/types";
import type { IndicatorConfig } from "@/lib/replay/indicatorCatalog";

export interface ChartObjectTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  interval: string;
  drawings: ReplayDrawing[];
  onUpdateDrawing: (drawing: ReplayDrawing) => void;
  onDeleteDrawing: (id: string) => void;
  onClearAllDrawings: () => void;
  onSelectDrawing?: (id: string) => void;
  selectedDrawingId?: string | null;
  indicators?: IndicatorConfig[];
  onToggleIndicator?: (id: string) => void;
  onClearAllIndicators?: () => void;
  onSelectAllIndicators?: () => void;
  onOpenSettings?: () => void;
}

function getDrawingIcon(kind: string) {
  switch (kind) {
    case "trend":
    case "ray":
    case "infoline":
      return <TrendingUp size={13} className="text-[#C5A059]" />;
    case "hline":
    case "hray":
      return <Minus size={13} className="text-[#C5A059]" />;
    case "rect":
      return <Square size={13} className="text-amber-400" />;
    case "fib":
      return <Percent size={13} className="text-emerald-400" />;
    case "position":
      return <ArrowUpRight size={13} className="text-emerald-400" />;
    case "text":
    case "callout":
      return <Type size={13} className="text-sky-400" />;
    case "ruler":
    case "priceRange":
    case "dateRange":
      return <Ruler size={13} className="text-indigo-400" />;
    default:
      return <Sliders size={13} className="text-[#C5A059]" />;
  }
}

function getDrawingLabel(d: ReplayDrawing): string {
  if ("text" in d && d.text && d.text.trim()) {
    return `${d.kind.toUpperCase()}: "${d.text}"`;
  }
  switch (d.kind) {
    case "trend":
      return "Trendline Sovrana";
    case "ray":
      return "Semiretta Direzionale";
    case "infoline":
      return "Infolinea con Telemetria";
    case "hline":
      return `Linea Orizzontale (${d.price.toFixed(2)})`;
    case "hray":
      return `Semiretta Orizzontale (${d.at.price.toFixed(2)})`;
    case "rect":
      return `Rettangolo SMC (${Math.min(d.a.price, d.b.price).toFixed(2)} - ${Math.max(d.a.price, d.b.price).toFixed(2)})`;
    case "fib":
      return "Fibonacci Golden Ratio";
    case "position": {
      const risk = Math.abs(d.entry.price - d.slPrice);
      const reward = Math.abs(d.tpPrice - d.entry.price);
      const rr = risk > 0 ? (reward / risk).toFixed(2) : "1.00";
      return d.direction === "buy" ? `Posizione Long (R:R 1:${rr})` : `Posizione Short (R:R 1:${rr})`;
    }
    case "ruler":
      return "Misuratore Pips & Barre";
    case "path":
      return "Percorso Multi-Segmento";
    case "highlighter":
      return "Evidenziatore Flusso";
    case "frvp":
      return "Fixed Range Volume Profile";
    case "avwap":
      return "VWAP Ancorato";
    default:
      return `${d.kind.toUpperCase()}`;
  }
}

export function ChartObjectTreeModal({
  isOpen,
  onClose,
  symbol,
  interval,
  drawings,
  onUpdateDrawing,
  onDeleteDrawing,
  onClearAllDrawings,
  onSelectDrawing,
  selectedDrawingId,
  indicators = [],
  onToggleIndicator,
  onClearAllIndicators,
  onSelectAllIndicators,
  onOpenSettings,
}: ChartObjectTreeModalProps) {
  if (!isOpen) return null;

  const totalObjects = drawings.length + indicators.filter((i) => i.on).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-[#C5A059]/30 bg-[#0d0f14] p-5 shadow-2xl shadow-black text-slate-100 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Albero degli Oggetti e Livelli del Grafico"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#C5A059]/20 pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A]">
              <Layers size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm tracking-wide text-white">
                  ALBERO DEGLI OGGETTI & LIVELLI
                </h3>
                <span className="font-mono text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] whitespace-nowrap">
                  {totalObjects} ELEMENTI
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Gestione cartografica su <span className="font-mono text-white font-semibold">{symbol}</span> · {interval}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex items-center justify-between gap-2 py-2 px-1 mb-2 text-xs border-b border-white/5">
          <span className="text-slate-400 text-[11px]">
            {drawings.length} Disegni · {indicators.filter((i) => i.on).length} Indicatori
          </span>
          <div className="flex items-center gap-2">
            {drawings.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Vuoi davvero rimuovere tutti i disegni dal grafico corrente?")) {
                    onClearAllDrawings();
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-[10px] font-semibold transition-all whitespace-nowrap"
              >
                <Trash2 size={11} />
                <span>Cancella Disegni</span>
              </button>
            )}
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#E8C56A] hover:bg-[#C5A059]/20 text-[10px] font-semibold transition-all whitespace-nowrap"
              >
                <Sliders size={11} />
                <span>Impostazioni</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Object Tree List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin scrollbar-thumb-[#C5A059]/30">
          {/* Sezione Indicatori */}
          {indicators.length > 0 && (
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5 px-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Activity size={12} className="text-[#C5A059]" />
                  <span>Strumenti & Indicatori</span>
                </div>
                <div className="flex items-center gap-2">
                  {onClearAllIndicators && (
                    <button
                      type="button"
                      onClick={onClearAllIndicators}
                      className="text-[9.5px] text-zinc-400 hover:text-[#E8C56A] underline cursor-pointer"
                      title="Spegni tutti gli indicatori per un grafico pulito"
                    >
                      Pulisci Tutto
                    </button>
                  )}
                  {onSelectAllIndicators && (
                    <button
                      type="button"
                      onClick={onSelectAllIndicators}
                      className="text-[9.5px] text-zinc-400 hover:text-white underline cursor-pointer"
                      title="Attiva tutti gli indicatori"
                    >
                      Tutti
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                {indicators.map((ind) => (
                  <div
                    key={ind.id}
                    className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                      ind.on
                        ? "bg-white/[0.03] border-white/10 hover:border-[#C5A059]/30"
                        : "bg-black/20 border-white/5 opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: ind.color || "#C5A059" }}
                      />
                      <span className="text-xs font-medium text-slate-200 truncate">
                        {ind.type.toUpperCase()} {ind.period ? `(${ind.period})` : ""}
                      </span>
                    </div>
                    {onToggleIndicator && (
                      <button
                        type="button"
                        onClick={() => onToggleIndicator(ind.id)}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        title={ind.on ? "Nascondi indicatore" : "Mostra indicatore"}
                      >
                        {ind.on ? <Eye size={14} className="text-[#E8C56A]" /> : <EyeOff size={14} />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sezione Disegni Grafici */}
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5 px-1 flex items-center gap-1.5">
              <Sparkles size={12} className="text-[#C5A059]" />
              <span>Armeria Geometrica (Disegni Tracciati)</span>
            </div>
            {drawings.length === 0 ? (
              <div className="p-6 text-center rounded-lg border border-dashed border-white/10 text-slate-400 text-xs">
                Nessun disegno presente sul grafico di {symbol}.
                <div className="text-[11px] text-slate-500 mt-1">
                  Usa la barra laterale o le scorciatoie (Alt+H, Alt+T, Alt+R) per tracciare livelli sovrani.
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {drawings.map((d) => {
                  const isSelected = selectedDrawingId === d.id;
                  const isLocked = Boolean(d.locked);
                  const isHidden = Boolean(d.hidden);

                  return (
                    <div
                      key={d.id}
                      className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                        isSelected
                          ? "bg-[#C5A059]/15 border-[#C5A059]/60 shadow-sm"
                          : "bg-white/[0.03] border-white/10 hover:border-[#C5A059]/30"
                      } ${isHidden ? "opacity-40" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectDrawing?.(d.id)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                      >
                        <div className="flex-shrink-0 p-1 rounded bg-black/40 border border-white/10">
                          {getDrawingIcon(d.kind)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-slate-200 truncate">
                            {getDrawingLabel(d)}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2">
                            <span>Tipo: {d.kind}</span>
                            {"color" in d && d.color && (
                              <span
                                className="inline-block w-2 h-2 rounded-full border border-black/40"
                                style={{ backgroundColor: d.color }}
                              />
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Controls per item */}
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        {/* Lock */}
                        <button
                          type="button"
                          onClick={() => onUpdateDrawing({ ...d, locked: !isLocked })}
                          className={`p-1 rounded transition-colors ${
                            isLocked ? "text-amber-400 bg-amber-400/10" : "text-slate-400 hover:text-white hover:bg-white/10"
                          }`}
                          title={isLocked ? "Sblocca disegno" : "Blocca coordinate"}
                        >
                          {isLocked ? <Lock size={13} /> : <Unlock size={13} />}
                        </button>

                        {/* Visibility */}
                        <button
                          type="button"
                          onClick={() => onUpdateDrawing({ ...d, hidden: !isHidden })}
                          className={`p-1 rounded transition-colors ${
                            isHidden ? "text-slate-500" : "text-slate-400 hover:text-white hover:bg-white/10"
                          }`}
                          title={isHidden ? "Mostra sul grafico" : "Nascondi disegno"}
                        >
                          {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => onDeleteDrawing(d.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Elimina disegno"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-[#C5A059]/20 flex items-center justify-between text-[11px] text-slate-400">
          <span>Tasti rapidi: Canc per rimuovere il selezionato · Esc per deselezionare</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/15 text-[#E8C56A] hover:bg-[#C5A059]/25 font-semibold text-xs transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
