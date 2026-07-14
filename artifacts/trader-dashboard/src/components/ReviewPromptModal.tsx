import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ReviewForm } from "@/components/ReviewForm";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import {
  fetchReviewPromptStatus,
  snoozeReviewPrompt,
  optOutReviewPrompt,
  reviewPromptStatusKey,
} from "@/lib/reviewsApi";

// Mostra il prompt al massimo una volta per sessione del browser; lo stato
// persistente (snooze/opt-out) è deciso lato server.
const SESSION_FLAG = "tl_review_prompt_shown";

function alreadyShownThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_FLAG) === "1";
  } catch {
    return false;
  }
}

function markShownThisSession() {
  try {
    sessionStorage.setItem(SESSION_FLAG, "1");
  } catch {
    /* ignore */
  }
}

export function ReviewPromptModal() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: reviewPromptStatusKey(),
    queryFn: () => fetchReviewPromptStatus(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (!data?.shouldPrompt || alreadyShownThisSession()) return undefined;
    markShownThisSession();
    const timer = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(timer);
  }, [data?.shouldPrompt]);

  const snooze = useMutation({
    mutationFn: () => snoozeReviewPrompt(),
    onSettled: () => qc.invalidateQueries({ queryKey: reviewPromptStatusKey() }),
  });
  const optOut = useMutation({
    mutationFn: () => optOutReviewPrompt(),
    onSettled: () => qc.invalidateQueries({ queryKey: reviewPromptStatusKey() }),
  });

  const handleSnooze = () => {
    snooze.mutate();
    setOpen(false);
  };
  const handleOptOut = () => {
    optOut.mutate();
    setOpen(false);
  };

  const panelRef = useRef<HTMLDivElement>(null);
  const { titleId, panelProps } = useDialogA11y({ isOpen: open, onClose: handleSnooze, panelRef });

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            ref={panelRef}
            {...panelProps}
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-2xl shadow-primary/10 focus:outline-none"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/15 to-transparent" />

            <button
              type="button"
              onClick={handleSnooze}
              aria-label={t("review.prompt.snooze")}
              className="absolute right-4 top-4 z-10 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative p-6">
              <div className="mb-4 flex flex-col items-center text-center">
                <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/15">
                  <Star className="h-7 w-7 text-primary" />
                </div>
                <h2 id={titleId} className="text-xl font-bold text-foreground">{t("review.prompt.title")}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{t("review.prompt.body")}</p>
              </div>

              <ReviewForm onDone={() => setOpen(false)} />

              <div className="mt-4 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleSnooze}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("review.prompt.snooze")}
                </button>
                <button
                  type="button"
                  onClick={handleOptOut}
                  className="text-muted-foreground/70 transition-colors hover:text-foreground"
                >
                  {t("review.prompt.optout")}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
