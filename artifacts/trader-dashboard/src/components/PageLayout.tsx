import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { useBackground } from "@/contexts/BackgroundContext";

interface PageLayoutProps {
  children: ReactNode;
  /** Optional: removes the max-width constraint for full-bleed pages */
  fullWidth?: boolean;
}

const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.32,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

export function PageLayout({ children, fullWidth }: PageLayoutProps) {
  const { activeBackgroundUrl, darkness } = useBackground();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background pb-[var(--bottom-nav-clearance)] pl-[var(--app-inset-left)]">
      {/* ── Fixed background layer ─────────────────────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none select-none">
        {activeBackgroundUrl ? (
          <>
            <img
              src={activeBackgroundUrl}
              alt=""
              className="w-full h-full object-cover"
              style={{ opacity: (100 - darkness) / 100 }}
            />
            <div
              className="absolute inset-0 bg-background"
              style={{ opacity: darkness / 100 }}
            />
          </>
        ) : (
          <img
            src={`${import.meta.env.BASE_URL}images/dashboard-bg.webp`}
            alt=""
            className="h-full w-full object-cover opacity-[0.1] mix-blend-screen"
          />
        )}
      </div>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <motion.div
        className={`relative z-10 ${
          fullWidth ? "w-full" : "mx-auto max-w-[1760px]"
        } space-y-3 px-3 pt-[3.85rem] sm:space-y-4 sm:px-5 lg:px-5 lg:pt-[3.65rem] xl:px-7`}
        variants={pageVariants}
        initial="hidden"
        animate="visible"
      >
        {children}
      </motion.div>
    </div>
  );
}
