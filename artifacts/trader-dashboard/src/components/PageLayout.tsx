import { ProcessReturn } from "@/components/process/ProcessReturn";
import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useBackground } from "@/contexts/BackgroundContext";

interface PageLayoutProps {
  children: ReactNode;
  /** Optional: removes the max-width constraint for full-bleed pages */
  fullWidth?: boolean;
  quiet?: boolean;
  className?: string;
}

const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.22,
      ease: [0.22, 1, 0.36, 1] as const,
      staggerChildren: 0.03,
    },
  },
};

export function PageLayout({ children, fullWidth, quiet = false, className = "" }: PageLayoutProps) {
  const { activeBackgroundUrl, darkness } = useBackground();
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  return (
    <div
      className={`app-page ${className} relative min-h-dvh overflow-x-clip bg-background pb-[var(--bottom-nav-clearance)] pl-[var(--app-inset-left)] ${
        quiet ? "lg:h-[100dvh] lg:overflow-hidden" : ""
      }`}
    >
      {/* ── Fixed background layer ─────────────────────────────────────── */}
      <div className={`fixed inset-0 z-0 pointer-events-none select-none ${quiet ? "opacity-[0.15]" : ""}`}>
        {activeBackgroundUrl && !activeBackgroundUrl.includes("nero-ossidiana") ? (
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
        ) : null}
      </div>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <motion.div
        className={`app-page-content relative z-10 ${
          fullWidth ? "w-full" : "mx-auto max-w-[1840px]"
        } ${
          quiet ? "lg:flex lg:h-full lg:flex-col lg:overflow-hidden" : ""
        } space-y-2.5 px-3 pt-[calc(var(--safe-top)+3.85rem)] sm:space-y-3 sm:px-5 lg:px-5 lg:pt-[calc(var(--safe-top)+3.65rem)] xl:px-6`}
        variants={reduceMotion ? { visible: { opacity: 1 } } : pageVariants}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
      >
        <ProcessReturn />
        {children}
      </motion.div>
    </div>
  );
}
