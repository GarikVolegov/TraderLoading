import { useState, useEffect } from "react";
import { SigilIcon } from "@/components/ui/SigilIcon";
import { Badge } from "@/components/ui/badge";
import { Shield, SlidersHorizontal, Compass } from "lucide-react";
import type { ProcessState } from "@/lib/traderProcessApi";
import { getLimenSessionInfo } from "@/lib/limenSession";

interface DailyOrderPulseHeaderProps {
  state?: ProcessState | null;
  activeView: "flow" | "method";
  onViewChange: (view: "flow" | "method") => void;
  onNewVersion?: () => void;
}

function getSessionInfo(d: Date): { name: string; active: boolean; statusColor: string } {
  const info = getLimenSessionInfo(d);
  return {
    name: info.name,
    active: info.isActive,
    statusColor: info.statusColor,
  };
}

const PHASE_LABELS: Record<string, string> = {
  define: "Fase I · Fondazione",
  verify: "Fase II · La Forgia",
  apply: "Fase III · Il Varco",
  consolidate: "Fase IV · Libro della Verità",
};

export function DailyOrderPulseHeader({
  state,
  activeView,
  onViewChange,
}: DailyOrderPulseHeaderProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const dateFormatted = now.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const timeFormatted = now.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });

  const sessionInfo = getSessionInfo(now);
  const activeMethod = state?.activeMethod;
  const phase = state?.progress?.phase ?? activeMethod?.phase ?? "define";

  return (
    <div className="space-y-4 pb-2">
      {/* ── BREADCRUMB & METRICHE LIVE ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <SigilIcon variant="daily-order" size={18} className="text-primary" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
            LIMEN PROTOCOL // PROTOCOLLO OPERATIVO
          </span>
        </div>

        {/* Live Session Clock Badge */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-surface-1/90 px-3 py-1 font-mono text-[11px] shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-muted-foreground uppercase">{dateFormatted}</span>
            <span className="text-primary font-bold">CET {timeFormatted}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface-1/80 px-2.5 py-1 font-mono text-[11px]">
            <span className={`font-semibold ${sessionInfo.statusColor}`}>
              {sessionInfo.name}
            </span>
          </div>
        </div>
      </div>

      {/* ── TITOLO PRINCIPALE & VISTA SWITCHER ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tight text-foreground font-display">
              L&apos;Ordine Giornaliero
            </h1>
            <Badge variant="gold" className="hidden sm:inline-flex uppercase">
              Quartier Generale
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Il rito operativo quotidiano dell&apos;Architetto. Allineamento, esecuzione chirurgica
            oltre Il Varco e sigillo inflessibile della verità.
          </p>
        </div>

        {/* View Switcher Tabs (Rito del Giorno vs Architettura Metodo) */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-1 p-1.5 shadow-inner shrink-0">
          <button
            type="button"
            onClick={() => onViewChange("flow")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-mono font-bold tracking-wider transition-all ${
              activeView === "flow"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            <Compass size={14} />
            <span>IL RITO DEL GIORNO</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange("method")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-mono font-bold tracking-wider transition-all ${
              activeView === "method"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>ARCHITETTURA METODO</span>
            {activeMethod && (
              <span className="ml-1 rounded px-1.5 py-0.5 bg-black/20 text-[9px]">
                v{activeMethod.version}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── BANNER METODO ATTIVO CONTESTUALE ── */}
      {activeMethod && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3.5 text-xs shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <SigilIcon variant="threshold" size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Metodo Operativo In Vigore:
                </span>
                <strong className="font-semibold text-foreground tracking-wide">
                  {activeMethod.name}
                </strong>
                <Badge variant="gold" className="text-[10px] px-1.5 py-0">
                  v{activeMethod.version}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Regole codificate, checklist personale e parametri di rischio sigillati.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="gold" className="text-[11px]">
              {PHASE_LABELS[phase] ?? phase}
            </Badge>
            <Badge variant="success" className="text-[11px] flex items-center gap-1.5">
              <Shield size={12} />
              <span>INDICE INTEGRITÀ: 100%</span>
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}
