import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LimenPageEmblem, type LimenEmblemVariant } from "@/components/ui/LimenPageEmblem";

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  badge?: ReactNode;
  icon?: ReactNode;
  emblemVariant?: LimenEmblemVariant;
  sigil?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  badge,
  icon,
  emblemVariant,
  sigil,
  className,
}: PageHeaderProps) {
  const displayIcon = emblemVariant ? (
    <LimenPageEmblem variant={emblemVariant} size="md" />
  ) : (
    icon
  );

  return (
    <header
      className={cn(
        "flex shrink-0 flex-col gap-3 border-b border-border/80 pb-4 pt-1 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <div className="flex items-center gap-2 mb-1.5">
            {sigil && <span className="shrink-0 text-primary">{sigil}</span>}
            <span className="font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
              {eyebrow}
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          {!eyebrow && sigil && <span className="shrink-0 text-primary">{sigil}</span>}
          {displayIcon && <span className="shrink-0">{displayIcon}</span>}
          <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold uppercase tracking-tight text-foreground leading-tight">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className="mt-1 max-w-3xl text-xs sm:text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:self-center">
          {action}
        </div>
      )}
    </header>
  );
}
