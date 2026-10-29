import React, { memo, useState } from "react";
import { cn } from "@/lib/utils";
import { SigilIcon, type SigilVariant } from "@/components/ui/SigilIcon";

export type LimenEmblemVariant =
  | "libro-della-verita"
  | "journal"
  | "il-varco"
  | "today"
  | "cockpit"
  | "la-forgia"
  | "backtest"
  | "patrimonio"
  | "financial"
  | "arsenale"
  | "resources"
  | "dottrina"
  | "academy"
  | "gradi-ascesa"
  | "milestones"
  | "fratellanza"
  | "chat"
  | "dossier"
  | "settings";

const EMBLEM_SRC_MAP: Record<string, string> = {
  "libro-della-verita": "/images/emblems/libro-della-verita.png",
  journal: "/images/emblems/libro-della-verita.png",
  "il-varco": "/images/emblems/il-varco.png",
  today: "/images/emblems/il-varco.png",
  cockpit: "/images/emblems/il-varco.png",
  "la-forgia": "/images/emblems/la-forgia.png",
  backtest: "/images/emblems/la-forgia.png",
  patrimonio: "/images/emblems/patrimonio.png",
  financial: "/images/emblems/patrimonio.png",
  arsenale: "/images/emblems/arsenale.png",
  resources: "/images/emblems/arsenale.png",
  dottrina: "/images/emblems/dottrina.png",
  academy: "/images/emblems/dottrina.png",
  "gradi-ascesa": "/images/emblems/gradi-ascesa.png",
  milestones: "/images/emblems/gradi-ascesa.png",
  fratellanza: "/images/emblems/fratellanza.png",
  chat: "/images/emblems/fratellanza.png",
  dossier: "/images/emblems/dossier.png",
  settings: "/images/emblems/dossier.png",
};

const SIGIL_FALLBACK_MAP: Record<string, SigilVariant> = {
  "libro-della-verita": "book-of-truth",
  journal: "book-of-truth",
  "il-varco": "threshold",
  today: "threshold",
  cockpit: "threshold",
  "la-forgia": "forge",
  backtest: "forge",
  patrimonio: "keeper",
  financial: "keeper",
  arsenale: "arsenale",
  resources: "arsenale",
  dottrina: "doctrine",
  academy: "doctrine",
  "gradi-ascesa": "hierarchy",
  milestones: "hierarchy",
  fratellanza: "brotherhood",
  chat: "brotherhood",
  dossier: "dossier",
  settings: "dossier",
};

interface LimenPageEmblemProps {
  variant: LimenEmblemVariant;
  size?: number | "sm" | "md" | "lg";
  className?: string;
  alt?: string;
}

/**
 * LimenPageEmblem
 * Museum-grade 3D Blender + NanoBanana sculpted obsidian & burnished gold emblem
 * replaces flat emojis and plain wireframe icons in page headers across LIMEN PROTOCOL.
 */
export const LimenPageEmblem = memo(function LimenPageEmblem({
  variant,
  size = "md",
  className,
  alt = "AUREUS Emblem",
}: LimenPageEmblemProps) {
  const [loadFailed, setLoadFailed] = useState(false);

  const dim =
    typeof size === "number"
      ? size
      : size === "sm"
      ? 28
      : size === "lg"
      ? 44
      : 36;

  const src = EMBLEM_SRC_MAP[variant] ?? EMBLEM_SRC_MAP["libro-della-verita"];
  const sigilVariant = SIGIL_FALLBACK_MAP[variant] ?? "book-of-truth";

  return (
    <div
      style={{ width: `${dim}px`, height: `${dim}px` }}
      className={cn(
        "relative shrink-0 flex items-center justify-center select-none pointer-events-none transition-[transform,opacity] duration-200",
        className,
      )}
      aria-hidden="true"
    >
      {!loadFailed ? (
        <img
          src={`${src}?v=20261021master3d`}
          alt={alt}
          width={dim}
          height={dim}
          className="relative z-10 w-full h-full object-contain select-none pointer-events-none"
          onError={() => setLoadFailed(true)}
          decoding="async"
        />
      ) : (
        <SigilIcon variant={sigilVariant} size={Math.round(dim * 0.75)} className="text-[#C5A059]" />
      )}
    </div>
  );
});
