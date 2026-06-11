import { type LucideIcon } from "lucide-react";

interface AdminMetricCardProps {
  label: string;
  value: number | string;
  detail: string;
  icon: LucideIcon;
}

export function AdminMetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: AdminMetricCardProps) {
  return (
    <section className="rounded-lg border border-border bg-card/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background">
          <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
