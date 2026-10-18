import { type ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  badge?: ReactNode;
  icon?: ReactNode;
}

export function PageHeader({ title, subtitle, action, badge, icon }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-5 pt-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
          <h1 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}
