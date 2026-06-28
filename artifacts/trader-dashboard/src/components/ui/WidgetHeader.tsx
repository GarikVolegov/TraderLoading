import * as React from "react";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<
  "primary" | "accent" | "warning" | "success" | "destructive",
  string
> = {
  primary: "text-primary border-primary/25 bg-primary/10",
  accent: "text-primary border-primary/25 bg-primary/10",
  warning: "text-warning border-warning/25 bg-warning/10",
  success: "text-success border-success/25 bg-success/10",
  destructive: "text-destructive border-destructive/25 bg-destructive/10",
};

export interface WidgetHeaderProps {
  icon: React.ReactNode;
  iconTone?: "primary" | "accent" | "warning" | "success" | "destructive";
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function WidgetHeader({
  icon,
  iconTone = "primary",
  title,
  subtitle,
  action,
  className,
}: WidgetHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3 p-4 sm:p-5", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
            TONE_CLASS[iconTone],
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-base font-mono font-semibold leading-tight text-foreground">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs leading-snug text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
