import React, { useState } from "react";
import { Check, ZoomIn } from "lucide-react";
import { getCockpitSchematic, type CockpitSchematic } from "@/lib/cockpitSchematics";

export type ReferenceSchemaSvgKind =
  | "sweep"
  | "compression"
  | "zone"
  | "liquidity"
  | "boxes"
  | "cycle_up"
  | "cycle_down"
  | "end_up"
  | "end_down"
  | "test"
  | "poc"
  | "jtc"
  | "bti"
  | "area_history"
  | "area_virgin";

const REFERENCE_SVG_PATHS: Record<string, string> = {
  // Reference site exact vector paths (viewBox 0 0 38 30)
  sweep: "M2 22h34M3 16l7-7 7 15 7-18 9 10M24 5l1 8 8-1",
  compression: "M2 5h34M2 27h34M3 17l6-6 6 10 6-12 7 13 6-8",
  zone: "M2 22h34M3 5l7 16 6-4 5 6 7-12 7-5M2 25h34",
  valid_zone: "M2 22h34M3 5l7 16 6-4 5 6 7-12 7-5M2 25h34",
  liquidity: "M2 14h34M3 6l8 14 7-10 8 15 9-6",
  no_zone: "M2 14h34M3 6l8 14 7-10 8 15 9-6",
  boxes: "M3 25h8v-7h8v-7h8V4h8M2 26h10m6-8h10m-2-8h10",
  intermediate: "M3 25h8v-7h8v-7h8V4h8M2 26h10m6-8h10m-2-8h10",
  reaccum: "M3 25h8v-7h8v-7h8V4h8M2 26h10m6-8h10m-2-8h10",
  // Additional cycle & trigger schematics in the same vector language
  cycle_up: "M3 25l8-8 5 5 9-11 4 4 6-9M29 6h6v6",
  cycle_down: "M3 5l8 8 5-5 9 11 4-4 6 9M29 24h6v-6",
  end_up: "M3 24l9-14 6 6 7-10 5 8 5-3M2 6h34",
  end_down: "M3 6l9 14 6-6 7 10 5-8 5 3M2 24h34",
  test: "M2 21h34M4 8l9 13 7-9 7 9 8-14",
  poc: "M2 15h34M4 23l8-8 6 4 7-11 9 7",
  jtc: "M3 24l10-10h9l12-10M13 14v5h9v-5",
  bti: "M2 16h34M4 25l12-9 5 4 13-14",
  area_history: "M2 18h34M4 18l5-8 5 8 6-6 6 10 8-12",
  area_virgin: "M2 18h16M22 25l12-18",
};

export function ReferenceSchemaSvg({
  kind,
  className = "w-9 h-7 text-[#E8C56A]",
}: {
  kind: string;
  className?: string;
}) {
  const pathData = REFERENCE_SVG_PATHS[kind] || REFERENCE_SVG_PATHS.sweep;
  return (
    <svg
      className={`schema-svg ${className}`}
      viewBox="0 0 38 30"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={pathData} />
    </svg>
  );
}

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
      className={`group relative flex items-center justify-between gap-2.5 ${
        compact ? "p-2" : "p-2.5"
      } rounded-lg border text-left transition-all cursor-pointer select-none ${
        disabled
          ? "opacity-40 cursor-not-allowed border-white/5 bg-white/[0.01]"
          : checked
          ? "border-[#C5A059] bg-[#C5A059]/12 shadow-[0_0_15px_rgba(197,160,89,0.15)] ring-1 ring-[#C5A059]/40"
          : "border-white/10 bg-[#0d0f14] hover:border-[#C5A059]/35 hover:bg-white/[0.03]"
      }`}
    >
      {/* Schema Vettoriale / Miniatura Affiancata */}
      {(schematicId || schematic) && (
        <div
          onClick={schematic && onInspect ? handleInspect : undefined}
          title={schematic ? "Tocca per ingrandire lo schema grafico" : undefined}
          className="relative w-12 h-10 shrink-0 rounded-md overflow-hidden bg-[#07080b] border border-white/10 group-hover:border-[#C5A059]/40 transition-colors flex items-center justify-center cursor-zoom-in"
        >
          {schematicId && REFERENCE_SVG_PATHS[schematicId] ? (
            <ReferenceSchemaSvg
              kind={schematicId}
              className={`w-9 h-7 transition-colors ${
                checked ? "text-[#E8C56A]" : "text-[#C5A059]/85 group-hover:text-[#E8C56A]"
              }`}
            />
          ) : schematic && !imgError ? (
            <img
              src={schematic.imageSrc}
              alt={schematic.title}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <ReferenceSchemaSvg
              kind={schematicId || "sweep"}
              className="w-9 h-7 text-[#C5A059]/80"
            />
          )}

          {/* Icona Zoom sovrapposta */}
          {schematic && onInspect && (
            <div className="absolute right-0.5 bottom-0.5 rounded bg-black/75 p-0.5 opacity-75 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <ZoomIn size={9} className="text-[#E8C56A]" />
            </div>
          )}
        </div>
      )}

      {/* Testi della Selezione */}
      <div className="flex-1 min-w-0">
        <strong className="text-xs font-semibold text-foreground block leading-snug">
          {title}
        </strong>
        {subtitle && (
          <small className="text-[10.5px] text-muted-foreground block line-clamp-2 leading-snug mt-0.5">
            {subtitle}
          </small>
        )}
      </div>

      {/* Pallino di selezione con spunta */}
      <div
        className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center transition-all ${
          checked
            ? "border-[#C5A059] bg-[#C5A059] text-black"
            : "border-white/20 bg-black/50 text-transparent"
        }`}
      >
        <Check size={11} strokeWidth={3} className={checked ? "block" : "hidden"} />
      </div>
    </div>
  );
}
