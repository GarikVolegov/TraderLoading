import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { InfoButton } from "@/components/ui/InfoButton";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  badge?: ReactNode;
  icon?: ReactNode;
}

export function PageHeader({ title, subtitle, action, badge, icon }: PageHeaderProps) {
  return (
    <motion.div
      className="flex flex-row items-center justify-between gap-2 pb-0.5 sm:items-end sm:gap-3 sm:pb-1"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Mobile compact title cluster (branded small uppercase + optional Info button) */}
      <div className="flex min-w-0 items-center gap-2 sm:hidden">
        <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-primary" />
        <h2 className="truncate font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-foreground">
          {title}
        </h2>
        {subtitle ? <InfoButton title={title} description={subtitle} className="h-5 w-5" /> : null}
      </div>

      {/* Title cluster (accent bar + icon + title + badge + subtitle) — desktop sm+ */}
      <div className="hidden min-w-0 items-start gap-3 sm:flex sm:items-center">
        {/* Accent bar */}
        <motion.div
          className="mt-0.5 h-8 w-0.5 shrink-0 rounded-full bg-primary sm:h-9"
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ delay: 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        />

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {icon && <div className="shrink-0">{icon}</div>}
            <motion.h2
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="text-xl font-bold leading-tight sm:text-2xl lg:text-[1.65rem]"
            >
              {title}
            </motion.h2>
            {badge && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.12 }}
              >
                {badge}
              </motion.div>
            )}
          </div>
          {subtitle && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="mt-1 max-w-3xl text-sm leading-snug text-muted-foreground"
            >
              {subtitle}
            </motion.p>
          )}
        </div>
      </div>

      {action && (
        <motion.div
          initial={{ opacity: 0, scale: 0.88, x: 8 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ delay: 0.12, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
          className="shrink-0"
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}
