import { useState, type ReactNode } from "react";
import { uiText } from "@/contexts/LanguageContext";
import {
  BoxSelect,
  ChartNoAxesCombined,
  Eraser,
  LineChart,
  MousePointer2,
  Pencil,
  RotateCcw,
  Settings2,
  Spline,
  Square,
  X,
} from "lucide-react";
import type { ChartAnalysisState, DrawingTool } from "./chartAnalysisTypes";

interface ChartAnalysisToolbarProps {
  analysisState: ChartAnalysisState;
  panelOpen: boolean;
  onToolChange: (tool: DrawingTool) => void;
  onTogglePanel: () => void;
  onToggleVwap: () => void;
  onToggleVolumeProfile: () => void;
  onUndo: () => void;
  onDeleteSelected: () => void;
  onClearDrawings: () => void;
}

const tools: Array<{ id: DrawingTool; label: string; icon: typeof MousePointer2 }> = [
  { id: "select", label: "Seleziona", icon: MousePointer2 },
  { id: "line", label: "Linea", icon: LineChart },
  { id: "rectangle", label: "Rettangolo", icon: Square },
  { id: "fibonacci", label: "Fibonacci", icon: Spline },
];

function ToolButton({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-md border text-xs transition-colors ${
        active
          ? "border-primary/50 bg-primary/20 text-primary"
          : "border-border/40 bg-background/75 text-muted-foreground hover:border-border hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function ChartAnalysisToolbar({
  analysisState,
  panelOpen,
  onToolChange,
  onTogglePanel,
  onToggleVwap,
  onToggleVolumeProfile,
  onUndo,
  onDeleteSelected,
  onClearDrawings,
}: ChartAnalysisToolbarProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  return (
    <div
      data-testid="chart-analysis-toolbar"
      className="absolute left-2 top-2 z-20 flex flex-row sm:flex-col items-center gap-1 rounded-md border border-border/50 bg-background/85 p-1 shadow-lg backdrop-blur-md max-sm:max-w-[calc(100vw-1rem)] max-sm:overflow-x-auto"
    >
      {/* Mobile compact toggle */}
      <button
        type="button"
        onClick={() => setMobileExpanded((prev) => !prev)}
        aria-label={mobileExpanded ? uiText("mobile.chart.tools_close") : uiText("mobile.chart.tools")}
        className={`sm:hidden grid h-8 px-2 place-items-center rounded-md border text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 transition-colors ${
          mobileExpanded || analysisState.activeTool !== "select"
            ? "border-primary/50 bg-primary/20 text-primary"
            : "border-border/40 bg-background/75 text-muted-foreground"
        }`}
      >
        <span className="flex items-center justify-center">
          {mobileExpanded ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
        </span>
      </button>

      {/* Desktop always visible; Mobile visible when expanded */}
      <div className={`${mobileExpanded ? "flex" : "hidden"} sm:flex flex-row sm:flex-col items-center gap-1`}>
        <ToolButton active={panelOpen} label="Indicatori e impostazioni" onClick={onTogglePanel}>
          <Settings2 className="h-4 w-4" />
        </ToolButton>
        <div className="mx-0.5 h-5 w-px sm:mx-0 sm:my-1 sm:h-px sm:w-full bg-border/50 shrink-0" />
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <ToolButton
              key={tool.id}
              active={analysisState.activeTool === tool.id}
              label={tool.label}
              onClick={() => onToolChange(tool.id)}
            >
              <Icon className="h-4 w-4" />
            </ToolButton>
          );
        })}
        <div className="mx-0.5 h-5 w-px sm:mx-0 sm:my-1 sm:h-px sm:w-full bg-border/50 shrink-0" />
        <ToolButton active={analysisState.indicators.vwap.enabled} label="VWAP giornaliero" onClick={onToggleVwap}>
          <ChartNoAxesCombined className="h-4 w-4" />
        </ToolButton>
        <ToolButton active={analysisState.indicators.volumeProfile.enabled} label="Volume Profile giornaliero" onClick={onToggleVolumeProfile}>
          <BoxSelect className="h-4 w-4" />
        </ToolButton>
        <div className="mx-0.5 h-5 w-px sm:mx-0 sm:my-1 sm:h-px sm:w-full bg-border/50 shrink-0" />
        <ToolButton label="Annulla disegno" onClick={onUndo}>
          <RotateCcw className="h-4 w-4" />
        </ToolButton>
        <ToolButton active={Boolean(analysisState.selectedDrawingId)} label="Elimina selezionato" onClick={onDeleteSelected}>
          <Eraser className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Pulisci disegni" onClick={onClearDrawings}>
          <span className="text-[10px] font-bold">CLR</span>
        </ToolButton>
      </div>
    </div>
  );
}
