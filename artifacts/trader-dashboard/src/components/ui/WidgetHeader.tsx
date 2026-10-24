import * as React from "react";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<
  "primary" | "accent" | "warning" | "success" | "destructive" | "gold" | "crimson",
  string
> = {
  primary: "text-primary border-primary/30 bg-primary/10 shadow-[0_0_10px_rgba(197,160,89,0.12)]",
  accent: "text-primary border-primary/30 bg-primary/10 shadow-[0_0_10px_rgba(197,160,89,0.12)]",
  gold: "text-primary border-primary/35 bg-primary/15 shadow-[0_0_12px_rgba(197,160,89,0.18)]",
  warning: "text-warning border-warning/30 bg-warning/10",
  success: "text-success border-success/30 bg-success/10",
  destructive: "text-destructive border-destructive/30 bg-destructive/10",
  crimson: "text-destructive border-destructive/35 bg-destructive/15",
};

export interface WidgetHeaderProps {
  icon: React.ReactNode;
  iconTone?: "primary" | "accent" | "warning" | "success" | "destructive" | "gold" | "crimson";
  title: string;
  subtitle?: string;
  eyebrow?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function WidgetHeader({
  icon,
  iconTone = "primary",
  title,
  subtitle,
  eyebrow,
  badge,
  action,
  className,
}: WidgetHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-border/40", className)}>
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-transform duration-200 group-hover:scale-105",
            TONE_CLASS[iconTone],
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          {eyebrow && (
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-primary/80 mb-0.5 leading-none">
              {eyebrow}
            </p>
          )}
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm sm:text-base font-sans font-semibold leading-tight text-foreground">
              {title}
            </h3>
            {badge}
          </div>
          {subtitle ? (
            <p className="mt-1 truncate text-xs leading-snug text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
