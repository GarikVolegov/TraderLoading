import React from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface ToolInfoTriggerProps {
  toolId: string;
  toolName?: string;
  onClick: (toolId: string) => void;
  tone?: "gold" | "emerald" | "crimson" | "slate";
  size?: "xs" | "sm" | "md";
  className?: string;
}

export const ToolInfoTrigger: React.FC<ToolInfoTriggerProps> = ({
  toolId,
  toolName,
  onClick,
  tone = "gold",
  size = "xs",
  className = "",
}) => {
  const toneClasses =
    tone === "emerald"
      ? "text-emerald-500/70 hover:text-emerald-300 hover:bg-emerald-950/40"
      : tone === "crimson"
        ? "text-red-400/70 hover:text-red-300 hover:bg-red-950/40"
        : tone === "slate"
          ? "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
          : "text-slate-500 hover:text-[#E8C56A] hover:bg-[#C5A059]/15";

  const iconSize = size === "xs" ? "h-3 w-3" : size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick(toolId);
            }}
            aria-label={`Dossier e logica operativa: ${toolName || toolId}`}
            className={`inline-flex items-center justify-center rounded-full p-1 transition-all duration-150 cursor-pointer select-none active:scale-95 shrink-0 ${toneClasses} ${className}`}
          >
            <Info className={`shrink-0 ${iconSize}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-[#0d0f14] border border-[#C5A059]/40 text-[#E8C56A] font-mono text-[10px] uppercase tracking-wider px-2 py-1 shadow-[0_0_15px_rgba(0,0,0,0.8)]"
        >
          Dossier Analitico // {toolName || toolId}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
