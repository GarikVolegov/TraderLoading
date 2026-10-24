import { useId } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SectionTab {
  value: string;
  label: string;
  href?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

/** Local navigation leaves the global destinations visible on every page. */
export function SectionTabs({ items, value, onValueChange, ariaLabel, className }: {
  items: readonly SectionTab[];
  value: string;
  onValueChange?: (value: string) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const groupId = useId();
  return (
    <nav aria-label={ariaLabel} className={cn("workspace-tabs relative", className)}>
      {items.map((item) => {
        const isActive = value === item.value;
        const classes = cn(
          "workspace-tab relative overflow-hidden transition-all duration-200 gap-2",
          isActive && "workspace-tab-active font-semibold",
        );
        const content = (
          <>
            {isActive && (
              <motion.span
                layoutId={`section-tab-indicator-${groupId}`}
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            {item.icon && <span className="relative z-10 shrink-0">{item.icon}</span>}
            <span className="relative z-10">{item.label}</span>
            {item.badge && <span className="relative z-10 shrink-0">{item.badge}</span>}
          </>
        );
        return item.href ? (
          <Link
            key={item.value}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={classes}
          >
            {content}
          </Link>
        ) : (
          <button
            key={item.value}
            type="button"
            aria-pressed={isActive}
            className={classes}
            onClick={() => onValueChange?.(item.value)}
          >
            {content}
          </button>
        );
      })}
    </nav>
  );
}
