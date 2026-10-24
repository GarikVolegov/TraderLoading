import React from "react";
import { cn } from "@/lib/utils";

export interface LimenLogoProps {
  size?: number;
  showWordmark?: boolean;
  subtitle?: string;
  className?: string;
  symbolClassName?: string;
  wordmarkClassName?: string;
}

/**
 * AUREUS PROTOCOL // CICLO OPERATIVO
 * Bespoke Architectural Emblem and Wordmark for AUREUS.
 */
export function LimenLogo({
  size = 22,
  showWordmark = true,
  subtitle = "CICLO OPERATIVO",
  className,
  symbolClassName,
  wordmarkClassName,
}: LimenLogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-3.5 group shrink-0 whitespace-nowrap", className)}>
      {/* Architectural Obsidian & Gold Shield Symbol Container */}
      <div
        className={cn(
          "h-10 w-10 rounded-lg bg-[#121216] border border-[#C5A059]/40 flex items-center justify-center text-[#C5A059] shadow-[0_0_15px_rgba(197,160,89,0.18)] group-hover:border-[#C5A059] group-hover:shadow-[0_0_20px_rgba(197,160,89,0.35)] transition-all shrink-0 overflow-hidden",
          symbolClassName,
        )}
      >
        <img src="/app-icon-192.png?v=20261021g" alt="AUREUS" className="w-full h-full object-cover" />
      </div>

      {showWordmark && (
        <div className={cn("flex flex-col whitespace-nowrap", wordmarkClassName)}>
          <span className="font-serif tracking-[0.25em] font-black text-xl text-[#F4F4F6] group-hover:text-[#C5A059] transition-colors uppercase leading-none">
            AUREUS
          </span>
          {subtitle && (
            <span className="font-mono text-[9px] tracking-[0.22em] text-[#C5A059] uppercase leading-none mt-1 whitespace-nowrap">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export const AureusLogo = LimenLogo;
