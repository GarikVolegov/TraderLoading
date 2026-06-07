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
      className="flex items-start sm:items-center justify-between gap-3 pb-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="min-w-0 flex items-start sm:items-center gap-3">
        {/* Accent bar */}
        <motion.div
          className="w-1 h-8 sm:h-9 lg:h-10 rounded-full bg-gradient-to-b from-primary to-primary/30 shrink-0 mt-0.5 sm:mt-0"
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
              className="text-2xl sm:text-3xl lg:text-3xl font-bold font-mono tracking-tight leading-tight"
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
              className="text-xs sm:text-sm text-muted-foreground/80 mt-0.5 leading-snug"
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
