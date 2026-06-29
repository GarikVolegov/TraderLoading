import { type ReactNode } from "react";
import { motion } from "framer-motion";

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
      className="flex flex-col gap-3 pb-1 max-sm:pb-0 sm:flex-row sm:items-end sm:justify-between"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Title cluster (accent bar + icon + title + badge + subtitle) — hidden on mobile, shown sm+ */}
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
