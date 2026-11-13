import * as React from "react";
import { cn } from "@/lib/utils";
import { InfoButton } from "@/components/ui/InfoButton";

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
  /** Optional extended description shown inside the tap-friendly Info button */
  infoText?: string;
  action?: React.ReactNode;
  className?: string;
}

export function WidgetHeader({
  icon,
  iconTone = "primary",
  title,
  subtitle,
  infoText,
  action,
  className,
}: WidgetHeaderProps) {
  const mobileInfo = infoText ?? subtitle;

  return (
    <div className={cn("flex items-center justify-between gap-2 px-3 py-2.5 sm:items-start sm:gap-3 sm:p-5", className)}>
      <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border sm:h-8 sm:w-8",
            TONE_CLASS[iconTone],
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-mono text-[11px] font-semibold uppercase tracking-[0.1em] leading-tight text-foreground sm:text-base sm:normal-case sm:tracking-normal">
              {title}
            </h3>
            {mobileInfo ? (
              <InfoButton
                title={title}
                description={mobileInfo}
                className={infoText ? "h-5 w-5 sm:h-6 sm:w-6" : "h-5 w-5 sm:hidden"}
              />
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-0.5 hidden truncate text-xs leading-snug text-muted-foreground sm:block">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
