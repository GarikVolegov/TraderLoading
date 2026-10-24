import React from "react";
import { cn } from "@/lib/utils";

export interface LimenMedallionProps {
  readonly grade: number; // 1..5
  readonly size?: number; // base size in pixels
  readonly className?: string;
  readonly glow?: boolean; // soft metallic aura matching the grade
  readonly animate?: boolean; // subtle hover scale & shine
  readonly alt?: string;
}

const GRADE_GLOW_COLORS: Record<number, string> = {
  1: "rgba(180, 120, 60, 0.35)",  // Warm Bronze
  2: "rgba(195, 140, 75, 0.4)",   // Burnished Bronze
  3: "rgba(225, 185, 95, 0.45)",  // Pure Gold
  4: "rgba(235, 215, 140, 0.5)",  // Solar White-Gold
  5: "rgba(245, 195, 70, 0.6)",   // Imperial Crown Gold
};

export const LimenMedallion: React.FC<LimenMedallionProps> = ({
  grade,
  size = 80,
  className,
  glow = false,
  animate = true,
  alt,
}) => {
  const clampedGrade = Math.max(1, Math.min(5, Math.floor(grade || 1)));
  const isGrade5 = clampedGrade === 5;
  const glowColor = GRADE_GLOW_COLORS[clampedGrade] || GRADE_GLOW_COLORS[1];

  // Grade 5 has the crown on top, so height is proportionally slightly taller (~1.23x)
  const width = size;
  const height = isGrade5 ? Math.round(size * 1.22) : size;

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center select-none shrink-0 transition-transform duration-300",
        animate && "hover:scale-105 group-hover:scale-105",
        className
      )}
      style={{ width, height }}
    >
      {/* Ambient Metallic Aura Glow */}
      {glow && (
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full blur-xl pointer-events-none transition-opacity duration-500 opacity-60 group-hover:opacity-90"
          style={{
            background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
            transform: isGrade5 ? "scale(1.15) translateY(4%)" : "scale(1.2)",
          }}
        />
      )}

      {/* High-Resolution Medallion Artwork */}
      <picture className="relative z-10 w-full h-full flex items-center justify-center">
        <source
          srcSet={`/images/medallions/grado-${clampedGrade}.webp`}
          type="image/webp"
        />
        <img
          src={`/images/medallions/grado-${clampedGrade}.png`}
          alt={alt || `Medaglione Ufficiale Grado ${clampedGrade}`}
          width={width}
          height={height}
          loading="eager"
          decoding="async"
          className={cn(
            "w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)] pointer-events-none"
          )}
        />
      </picture>
    </div>
  );
};
