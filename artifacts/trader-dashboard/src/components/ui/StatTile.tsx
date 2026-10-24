import * as React from "react";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<
  "default" | "primary" | "success" | "destructive" | "gold" | "warning",
  string
> = {
  default: "text-foreground",
  primary: "text-primary",
  gold: "text-primary",
  success: "text-success",
  destructive: "text-destructive",
  warning: "text-warning",
};

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  subtitle?: string;
  tone?: "default" | "primary" | "success" | "destructive" | "gold" | "warning";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function StatTile({
  label,
  value,
  unit,
  subtitle,
  tone = "default",
  size = "md",
  className,
}: StatTileProps) {
  const sizeClasses = {
    sm: "text-base sm:text-lg",
    md: "text-lg sm:text-xl",
    lg: "text-xl sm:text-2xl",
    xl: "text-2xl sm:text-3xl",
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card/90 p-3 sm:p-4 transition-all duration-200 hover:border-border-strong",
        className,
      )}
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-mono font-black leading-tight tabular-nums tracking-tight",
          sizeClasses[size],
          TONE_CLASS[tone],
        )}
      >
        {value}
        {unit ? (
          <span className="ml-1 text-xs font-semibold text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </p>
      {subtitle ? (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground truncate">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
