import {
  BoxSelect,
  ChartNoAxesCombined,
  Eraser,
  LineChart,
  MousePointer2,
  RotateCcw,
  Settings2,
  Spline,
  Square,
} from "lucide-react";
import type { ReactNode } from "react";
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
  return (
    <div
      data-testid="chart-analysis-toolbar"
      className="absolute left-2 top-2 z-20 flex flex-col gap-1 rounded-lg border border-border/50 bg-background/85 p-1 shadow-lg backdrop-blur-md"
    >
      <ToolButton active={panelOpen} label="Indicatori e impostazioni" onClick={onTogglePanel}>
        <Settings2 className="h-4 w-4" />
      </ToolButton>
      <div className="my-1 h-px bg-border/50" />
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
      <div className="my-1 h-px bg-border/50" />
      <ToolButton active={analysisState.indicators.vwap.enabled} label="VWAP giornaliero" onClick={onToggleVwap}>
        <ChartNoAxesCombined className="h-4 w-4" />
      </ToolButton>
      <ToolButton active={analysisState.indicators.volumeProfile.enabled} label="Volume Profile giornaliero" onClick={onToggleVolumeProfile}>
        <BoxSelect className="h-4 w-4" />
      </ToolButton>
      <div className="my-1 h-px bg-border/50" />
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
  );
}
