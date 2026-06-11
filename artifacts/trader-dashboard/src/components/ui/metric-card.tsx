import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Card metrica compatta (label / valore / unità).
 * Sostituisce le classi sparse .metric-card/.metric-label/.metric-value/.metric-unit.
 * Regola tone: direzione mercato → profit/loss; stato → warning; brand → brand.
 */
const metricCardVariants = cva(
  "flex flex-col items-center justify-center gap-0.5 rounded-xl border p-2.5 text-center shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)]",
  {
    variants: {
      tone: {
        neutral: "border-border/60 bg-secondary/55",
        profit: "border-profit/30 bg-profit/10",
        loss: "border-loss/30 bg-loss/10",
        warning: "border-warning/30 bg-warning/10",
        brand: "border-primary/25 bg-primary/8",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
);

const metricValueTone: Record<string, string> = {
  neutral: "",
  profit: "text-profit",
  loss: "text-loss",
  warning: "text-warning",
  brand: "text-primary",
};

interface MetricCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof metricCardVariants> {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
}

const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  ({ tone, label, value, unit, className, ...props }, ref) => (
    <div ref={ref} className={cn(metricCardVariants({ tone }), className)} {...props}>
      <span className="text-[9px] uppercase leading-none tracking-wider text-muted-foreground/85">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-lg font-bold leading-tight tabular-nums",
          metricValueTone[tone ?? "neutral"]
        )}
      >
        {value}
      </span>
      {unit != null && (
        <span className="text-[9px] leading-none text-muted-foreground/75">{unit}</span>
      )}
    </div>
  )
);
MetricCard.displayName = "MetricCard";

export { MetricCard, metricCardVariants };
