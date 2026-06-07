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
  const { backgroundUrl, darkness } = useBackground();

  return (
    <div className="min-h-screen relative bg-background pb-22 sm:pb-24 lg:pb-6 lg:pl-20">
      {/* ── Fixed background layer ─────────────────────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none select-none">
        {backgroundUrl ? (
          <>
            <img
              src={backgroundUrl}
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
            src={`${import.meta.env.BASE_URL}images/dashboard-bg.png`}
            alt=""
            className="w-full h-full object-cover opacity-[0.15] mix-blend-screen"
          />
        )}
      </div>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <motion.div
        className={`relative z-10 ${
          fullWidth ? "w-full" : "max-w-[1760px] mx-auto"
        } px-3 sm:px-5 lg:px-5 xl:px-7 pt-[3.75rem] sm:pt-[3.75rem] lg:pt-[3rem] space-y-4 sm:space-y-5 lg:space-y-3 xl:space-y-4`}
        variants={pageVariants}
        initial="hidden"
        animate="visible"
      >
        {children}
      </motion.div>
    </div>
  );
}
