import { Link } from "wouter";
import { cn } from "@/lib/utils";

export interface SectionTab {
  value: string;
  label: string;
  href?: string;
}

/** Local navigation leaves the four global destinations visible on every page. */
export function SectionTabs({ items, value, onValueChange, ariaLabel, className }: {
  items: readonly SectionTab[];
  value: string;
  onValueChange?: (value: string) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return <nav aria-label={ariaLabel} className={cn("workspace-tabs", className)}>
    {items.map(item => {
      const classes = cn("workspace-tab", value === item.value && "workspace-tab-active");
      return item.href
        ? <Link key={item.value} href={item.href} aria-current={value === item.value ? "page" : undefined} className={classes}>{item.label}</Link>
        : <button key={item.value} type="button" aria-pressed={value === item.value} className={classes} onClick={() => onValueChange?.(item.value)}>{item.label}</button>;
    })}
  </nav>;
}
