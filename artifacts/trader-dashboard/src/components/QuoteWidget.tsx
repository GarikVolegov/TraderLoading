import { motion, AnimatePresence } from "framer-motion";
import { getGetRandomQuoteQueryKey, useGetRandomQuote } from "@workspace/api-client-react";
import { Quote } from "lucide-react";

export function QuoteWidget() {
  // Rotate to a fresh random quote every 8s (paused automatically while the tab
  // is hidden). The backend now returns a genuinely random quote per call.
  const { data: quote } = useGetRandomQuote({
    query: {
      queryKey: getGetRandomQuoteQueryKey(),
      staleTime: 0,
      refetchInterval: 8000,
    },
  });

  return (
    <AnimatePresence mode="wait">
      {quote ? (
        <motion.div
          key={quote.text}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm px-5 py-4 overflow-hidden group hover:border-primary/25 transition-all duration-300"
        >
          {/* Large decorative quote mark */}
          <Quote
            className="absolute -top-1 left-3 w-12 h-12 text-primary/8 pointer-events-none select-none"
            aria-hidden
          />

          {/* Hover glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/4 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl" />

          {/* Left accent bar */}
          <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full bg-gradient-to-b from-primary/60 via-primary/20 to-transparent" />

          <div className="pl-3 relative z-10">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="text-sm sm:text-base italic text-foreground/80 leading-relaxed"
            >
              &ldquo;{quote.text}&rdquo;
            </motion.p>
            {quote.author && (
              <motion.p
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="text-xs text-primary/60 mt-2 font-semibold font-mono tracking-wide"
              >
                — {quote.author}
              </motion.p>
            )}
          </div>
        </motion.div>
      ) : (
        /* Skeleton */
        <div className="rounded-2xl border border-border/20 bg-card/40 px-5 py-4">
          <div className="space-y-2">
            <div className="h-3.5 rounded-full bg-secondary/60 animate-shimmer w-full" />
            <div className="h-3.5 rounded-full bg-secondary/60 animate-shimmer w-4/5" />
            <div className="h-2.5 rounded-full bg-secondary/40 animate-shimmer w-24 mt-3" />
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
