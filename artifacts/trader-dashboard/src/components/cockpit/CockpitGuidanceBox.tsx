import { ArrowRight, CheckCircle2, Compass } from "lucide-react";
import type { CockpitAnalysis } from "../../../../../contracts/cockpit";

interface CockpitGuidanceBoxProps {
  phase: number;
  mode: "scalp" | "swing";
  market?: string;
  analysis?: CockpitAnalysis;
  confirmed?: boolean;
  onOpenExamples?: (category?: string) => void;
  className?: string;
}

export function getOperationalGuidance(
  phase: number,
  mode: "scalp" | "swing",
  analysis?: CockpitAnalysis,
  confirmed?: boolean,
) {
  const isScalp = mode === "scalp";
  const htf = isScalp ? "H1" : "Daily / H4";
  const itf = isScalp ? "M15" : "H1 / M15";
  const ltf = isScalp ? (analysis?.execTF || "M1") : (analysis?.execTF || "M5");

  if (confirmed || phase === 4) {
    return {
      stepLabel: "Bussola Operativa · Gestione Attiva",
      action: "Monitora la reazione a mercato, applica la protezione a Break-Even e registra il trade nel Libro della Verità.",
      isReady: true,
    };
  }

  if (phase === 1) {
    if (!analysis?.cycle) {
      return {
        stepLabel: `Bussola Operativa · Contesto [${htf}]`,
        action: `Mappa il ciclo HTF su ${htf}: seleziona la direzione del trend primario.`,
        isReady: false,
      };
    }
    if (!analysis?.context) {
      return {
        stepLabel: `Bussola Operativa · Contesto [${htf}]`,
        action: `Verifica la liquidità su ${htf}: controlla se c'è compressione o se ha già fatto sweep degli estremi.`,
        isReady: false,
      };
    }
    return {
      stepLabel: `Bussola Operativa · Contesto Verificato`,
      action: `Contesto allineato. Clicca su «Passa a Validazione Svolta [${itf}]» per procedere.`,
      isReady: true,
    };
  }

  if (phase === 2) {
    if (!analysis?.scenario) {
      return {
        stepLabel: `Bussola Operativa · Svolta [${itf}]`,
        action: `Osserva cosa ha preso a sinistra su ${itf} (sweep o mitigazione) e seleziona lo scenario di svolta.`,
        isReady: false,
      };
    }
    if (!analysis?.itfSchema) {
      return {
        stepLabel: `Bussola Operativa · Schematica [${itf}]`,
        action: `Conferma la chiusura del ciclo ${itf} con schematica valida.`,
        isReady: false,
      };
    }
    return {
      stepLabel: `Bussola Operativa · Svolta Validata`,
      action: `Scenario confermato. Clicca su «Passa a Sigillo» per scendere su ${ltf}.`,
      isReady: true,
    };
  }

  // phase === 3
  if (!analysis?.ltfSchema) {
    return {
      stepLabel: `Bussola Operativa · Schematica [${ltf}]`,
      action: `Conferma la schematica d'ingresso su ${ltf}.`,
      isReady: false,
    };
  }
  if (!analysis?.trigger) {
    return {
      stepLabel: `Bussola Operativa · Trigger [${ltf}]`,
      action: `Attendi la formazione del trigger di ingresso su ${ltf} (TEST, POC, JTC o BTI).`,
      isReady: false,
    };
  }
  if (!analysis?.target || !analysis.target.trim()) {
    return {
      stepLabel: `Bussola Operativa · Target Opposto`,
      action: `Indica il target sul pool di liquidità opposto.`,
      isReady: false,
    };
  }
  return {
    stepLabel: `Bussola Operativa · Pronto al Sigillo`,
    action: `Verifica Prezzo d'Ingresso, Stop Loss e Rischio, poi clicca su «Sigilla Ingresso».`,
    isReady: true,
  };
}

export function getStepGuidance(phase: number, mode: "scalp" | "swing") {
  const g = getOperationalGuidance(phase, mode);
  return {
    stepNum: `0${phase}`,
    eyebrow: g.stepLabel,
    title: g.action,
    detail: g.action,
    rule: "",
    shortPrompt: g.action,
    exampleCategory: phase === 3 ? "continuation" : phase === 4 ? "reaccum" : "swept",
  };
}

export function CockpitGuidanceBox({
  phase,
  mode,
  market,
  analysis,
  confirmed,
  className = "",
}: CockpitGuidanceBoxProps) {
  const guidance = getOperationalGuidance(phase, mode, analysis, confirmed);

  return (
    <div
      role="region"
      aria-label="Finestra Operativa di Guida"
      className={`rounded-xl border transition-all duration-200 ${
        guidance.isReady
          ? "border-emerald-500/35 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.08)]"
          : "border-primary/30 bg-[#12131A] shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
      } p-3 flex items-center gap-3 ${className}`}
    >
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
          guidance.isReady
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
            : "bg-primary/15 text-primary border border-primary/35"
        }`}
      >
        {guidance.isReady ? <CheckCircle2 size={15} /> : <Compass size={15} />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`font-mono text-[9.5px] font-bold tracking-wider uppercase ${
              guidance.isReady ? "text-emerald-400" : "text-primary"
            }`}
          >
            {guidance.stepLabel}
          </span>
          {market && (
            <span className="text-[9px] font-mono text-muted-foreground/80 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
              {market}
            </span>
          )}
        </div>

        <p className="text-xs text-foreground font-medium mt-0.5 leading-snug">
          {guidance.action}
        </p>
      </div>

      {guidance.isReady && (
        <div className="shrink-0 text-emerald-400/80 hidden sm:block">
          <ArrowRight size={14} />
        </div>
      )}
    </div>
  );
}
