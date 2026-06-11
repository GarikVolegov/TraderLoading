import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Header standard dei widget (Gate A: C2-Verde sobria).
 * Sostituisce le classi sparse .widget-header/.widget-icon/.widget-title/.widget-subtitle.
 */
interface WidgetHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  /** Tinta del chip icona, es. "bg-primary/10 border border-primary/20" */
  iconClassName?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Contenuto allineato a destra (badge stato, bottoni refresh…) */
  actions?: React.ReactNode;
}

const WidgetHeader = React.forwardRef<HTMLDivElement, WidgetHeaderProps>(
  ({ icon, iconClassName, title, subtitle, actions, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/45",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
              iconClassName
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold font-mono tracking-tight">{title}</p>
          {subtitle != null && (
            <div className="mt-0.5 text-[10px] leading-none text-muted-foreground/80">
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  )
);
WidgetHeader.displayName = "WidgetHeader";

export { WidgetHeader };
