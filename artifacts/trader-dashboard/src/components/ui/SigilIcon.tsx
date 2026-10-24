import React from "react";
import { cn } from "@/lib/utils";
import type { LimenSigilId } from "../../../../../contracts/limenGrades";

export type SigilVariant =
  | "limen"
  | LimenSigilId
  | "grade-1"
  | "grade-2"
  | "grade-3"
  | "grade-4"
  | "grade-5"
  | "threshold"
  | "daily-order"
  | "scenario"
  | "pivot"
  | "action-seal"
  | "keeper"
  | "forge"
  | "book-of-truth"
  | "libro"
  | "brotherhood"
  | "fratellanza"
  | "hierarchy"
  | "trials-by-fire"
  | "dossier"
  | "doctrine"
  | "arsenal"
  | "arsenale"
  | "drift-warning";

interface SigilIconProps {
  readonly variant?: SigilVariant;
  readonly name?: SigilVariant;
  readonly size?: number;
  readonly className?: string;
}

/**
 * Geometric, architectural SVG sigils for LIMEN PROTOCOL.
 * Replaces playful icons and retail emojis with stoic, surgical geometry.
 */
export function SigilIcon({ variant, name, size = 18, className }: SigilIconProps) {
  const resolved = variant ?? name ?? "threshold";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {renderSigilPaths(resolved)}
    </svg>
  );
}

function renderSigilPaths(variant: SigilVariant): React.ReactNode {
  switch (variant) {
    case "limen":
    case "threshold":
    case "sigil-grade-1":
    case "grade-1":
      // LIMEN: Il Varco Sovrano / The Sovereign Architectural Threshold & Golden Singularity
      return (
        <>
          {/* Limen Inferum: Ground Threshold Sill */}
          <line x1="2" y1="20.5" x2="22" y2="20.5" />
          {/* Limen Superum: Architectural Lintel Beam */}
          <line x1="3.5" y1="6.5" x2="20.5" y2="6.5" />
          {/* Monolith Pillars & Apex Pediment */}
          <path d="M5.5 20.5V6.5L12 2.5L18.5 6.5V20.5" />
          {/* Inner Sacred Portal */}
          <path d="M8.5 20.5V11L12 8.5L15.5 11V20.5" />
          {/* Central Singularity Diamond (Il Varco di Liquidità) */}
          <polygon points="12,10.5 14.5,13.25 12,16 9.5,13.25" fill="currentColor" fillOpacity={0.28} />
          {/* Sovereign Vertical Plumbline Axis */}
          <line x1="12" y1="2.5" x2="12" y2="8.5" />
          <line x1="12" y1="16" x2="12" y2="20.5" />
        </>
      );
    case "sigil-grade-2":
    case "grade-2":
    case "keeper":
      // Il Custode della Soglia / Grado II — Twin pillars & diamond lock
      return (
        <>
          <polygon points="12,3 20,12 12,21 4,12" />
          <rect x="9" y="9" width="6" height="6" />
          <line x1="12" y1="3" x2="12" y2="9" />
          <line x1="12" y1="15" x2="12" y2="21" />
        </>
      );
    case "sigil-grade-3":
    case "grade-3":
    case "scenario":
      // L'Osservatore Sovrano / Contemplazione dello Scenario — Sovereign eye / apex triangle
      return (
        <>
          <polygon points="12,3 22,19 2,19" />
          <circle cx="12" cy="13" r="3" />
          <line x1="12" y1="3" x2="12" y2="10" />
        </>
      );
    case "sigil-grade-4":
    case "grade-4":
    case "arsenal":
    case "arsenale":
      // L'Architetto del Reale / L'Arsenale — Octagonal architectural compass/keystone
      return (
        <>
          <polygon points="12,2 20,6 22,14 16,21 8,21 2,14 4,6" />
          <polygon points="12,7 17,12 12,17 7,12" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" />
        </>
      );
    case "sigil-grade-5":
    case "grade-5":
      // Il Fondatore d'Eredità — Crowned Double Seal of the Inner Circle
      return (
        <>
          <polygon points="12,2 22,12 12,22 2,12" />
          <rect x="7" y="7" width="10" height="10" />
          <polygon points="12,9 15,12 12,15 9,12" fill="currentColor" />
        </>
      );
    case "daily-order":
      // L'Ordine Giornaliero — Three aligned steps / monoliths
      return (
        <>
          <rect x="3" y="4" width="18" height="4" />
          <rect x="3" y="10" width="18" height="4" />
          <rect x="3" y="16" width="18" height="4" />
          <line x1="8" y1="4" x2="8" y2="20" />
        </>
      );
    case "pivot":
      // Il Punto di Svolta — Axis shift geometry
      return (
        <>
          <polyline points="4,18 12,6 20,18" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <circle cx="12" cy="6" r="2" fill="currentColor" />
        </>
      );
    case "action-seal":
      // Il Sigillo d'Azione — Precision convergence crosshair
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <polygon points="12,7 17,12 12,17 7,12" />
          <line x1="12" y1="2" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="2" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="22" y2="12" />
        </>
      );
    case "forge":
      // La Forgia del Passato — Anvil & Hourglass geometry
      return (
        <>
          <polygon points="5,4 19,4 14,12 19,20 5,20 10,12" />
          <line x1="3" y1="4" x2="21" y2="4" />
          <line x1="3" y1="20" x2="21" y2="20" />
        </>
      );
    case "book-of-truth":
    case "libro":
      // Il Libro della Verità — Open tablet of law & central spine
      return (
        <>
          <path d="M3 5H11L12 6L13 5H21V19H13L12 20L11 19H3V5Z" />
          <line x1="12" y1="6" x2="12" y2="20" />
          <line x1="6" y1="9" x2="9" y2="9" />
          <line x1="6" y1="13" x2="9" y2="13" />
          <line x1="15" y1="9" x2="18" y2="9" />
          <line x1="15" y1="13" x2="18" y2="13" />
        </>
      );
    case "brotherhood":
    case "fratellanza":
      // La Fratellanza — Agora columns & pediment
      return (
        <>
          <polygon points="12,3 21,8 3,8" />
          <line x1="6" y1="8" x2="6" y2="19" />
          <line x1="12" y1="8" x2="12" y2="19" />
          <line x1="18" y1="8" x2="18" y2="19" />
          <line x1="3" y1="19" x2="21" y2="19" />
        </>
      );
    case "hierarchy":
      // La Gerarchia dell'Integrità — Stepped pyramid / obelisk
      return (
        <>
          <polygon points="12,3 16,9 8,9" />
          <rect x="6" y="10" width="12" height="4" />
          <rect x="4" y="15" width="16" height="5" />
        </>
      );
    case "trials-by-fire":
      // Le Prove del Fuoco — Geometric brazier & blade
      return (
        <>
          <polygon points="12,2 17,11 12,16 7,11" />
          <path d="M5 17H19L17 21H7L5 17Z" />
          <line x1="12" y1="6" x2="12" y2="14" />
        </>
      );
    case "doctrine":
      // La Dottrina del Tempo — Sundial / Astrolabe
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <polygon points="12,5 15,12 12,19 9,12" />
          <line x1="3" y1="12" x2="21" y2="12" />
        </>
      );
    case "dossier":
      // Dossier dell'Operatore — Inscribed monolith badge
      return (
        <>
          <rect x="5" y="3" width="14" height="18" />
          <polygon points="12,6 15,9 12,12 9,9" />
          <line x1="8" y1="15" x2="16" y2="15" />
          <line x1="8" y1="18" x2="14" y2="18" />
        </>
      );
    case "drift-warning":
      // Cedimento alla Deriva — Fractured triangle alert
      return (
        <>
          <polygon points="12,3 22,20 2,20" />
          <line x1="12" y1="9" x2="12" y2="14" />
          <rect x="11.25" y="16" width="1.5" height="1.5" fill="currentColor" />
        </>
      );
  }
}
