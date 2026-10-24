import React, { useState } from "react";
import { Check, ZoomIn, Image as ImageIcon } from "lucide-react";
import { getCockpitSchematic, type CockpitSchematic } from "@/lib/cockpitSchematics";

interface CockpitVisualChoiceProps {
  checked: boolean;
  title: string;
  subtitle?: string;
  schematicId?: string;
  onClick: () => void;
  onInspect?: (schematic: CockpitSchematic) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function CockpitVisualChoice({
  checked,
  title,
  subtitle,
  schematicId,
  onClick,
  onInspect,
  disabled = false,
  compact = false,
}: CockpitVisualChoiceProps) {
  const schematic = schematicId ? getCockpitSchematic(schematicId) : undefined;
  const [imgError, setImgError] = useState(false);

  const handleInspect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (schematic && onInspect) {
      onInspect(schematic);
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={checked}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group relative flex items-center justify-between gap-3 p-2.5 rounded-lg border text-left transition-all cursor-pointer select-none ${
        disabled
          ? "opacity-50 cursor-not-allowed border-white/5 bg-white/[0.01]"
          : checked
          ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(197,160,89,0.15)] ring-1 ring-primary/40"
          : "border-white/10 bg-black/40 hover:border-white/20 hover:bg-white/[0.03]"
      }`}
    >
      {/* Miniatura Schematica Affiancata */}
      {schematic && (
        <div
          onClick={handleInspect}
          title="Clicca per ingrandire lo schema grafico"
          className="relative w-14 h-10 shrink-0 rounded-md overflow-hidden bg-black/70 border border-white/10 group-hover:border-primary/40 transition-colors flex items-center justify-center cursor-zoom-in"
        >
          {!imgError ? (
            <img
              src={schematic.imageSrc}
              alt={schematic.title}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-white/[0.02]">
              <ImageIcon size={14} className="text-primary/60" />
              <span className="text-[7px] font-mono text-muted-foreground/80 mt-0.5">Schema</span>
            </div>
          )}

          {/* Icona Zoom sovrapposta */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <ZoomIn size={12} className="text-primary drop-shadow" />
          </div>
        </div>
      )}

      {/* Testi della Selezione */}
      <div className="flex-1 min-w-0">
        <strong className="text-xs font-semibold text-foreground block truncate">
          {title}
        </strong>
        {subtitle && (
          <small className="text-[10px] text-muted-foreground block line-clamp-2 leading-snug mt-0.5">
            {subtitle}
          </small>
        )}
      </div>

      {/* Pallino di selezione con spunta */}
      <div
        className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center transition-all ${
          checked
            ? "border-primary bg-primary text-black"
            : "border-white/20 bg-black/50 text-transparent"
        }`}
      >
        <Check size={11} strokeWidth={3} className={checked ? "block" : "hidden"} />
      </div>
    </div>
  );
}
