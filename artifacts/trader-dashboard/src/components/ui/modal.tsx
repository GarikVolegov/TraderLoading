import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

// Only elements the browser can actually focus. Hidden nodes (display:none,
// visibility:hidden, [hidden]) have no client rects, so they must not count as
// focus-trap boundaries — otherwise a trailing hidden control (e.g. a hidden file
// input) lets Tab escape the dialog onto the page behind it.
function focusableWithin(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.getClientRects().length > 0,
  );
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  const titleId = React.useId();
  const panelRef = React.useRef<HTMLDivElement>(null);

  // One ordered effect so setup/teardown interleave correctly:
  //  open  → capture opener (before inerting blurs it) → lock scroll → inert the
  //          rest of the page → move focus into the dialog.
  //  close → restore scroll → un-inert → THEN restore focus (the opener is only
  //          focusable again once its subtree is no longer inert).
  React.useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Inert everything except this modal's own portal root, so a screen-reader
    // virtual cursor (which a Tab trap does not constrain) and pointer/tab focus
    // cannot reach the obscured background. aria-modal alone is not reliable.
    const panel = panelRef.current;
    const portalRoot = panel?.closest("body > *") ?? null;
    const restoreInert: Array<() => void> = [];
    for (const el of Array.from(document.body.children) as HTMLElement[]) {
      if (el === portalRoot) continue;
      const hadAriaHidden = el.getAttribute("aria-hidden");
      const hadInert = el.hasAttribute("inert");
      el.setAttribute("aria-hidden", "true");
      el.setAttribute("inert", "");
      restoreInert.push(() => {
        if (hadAriaHidden === null) el.removeAttribute("aria-hidden");
        else el.setAttribute("aria-hidden", hadAriaHidden);
        if (!hadInert) el.removeAttribute("inert");
      });
    }

    const first = panel ? focusableWithin(panel)[0] : undefined;
    (first ?? panel)?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      restoreInert.forEach((restore) => restore());
      opener?.focus?.();
    };
  }, [isOpen]);

  // Keydown is handled on the panel (not a document-capture listener) so only the
  // focused/topmost modal responds — stacked modals and nested overlays each keep
  // their own Escape, and a child that already handled Escape (defaultPrevented)
  // suppresses the close.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (event.defaultPrevented) return;
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = focusableWithin(panel);
    if (focusables.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !panel.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.1 }}
            className={cn(
              "relative z-[100] w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl focus:outline-none",
              className
            )}
          >
            <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
              <h2 id={titleId} className="text-lg font-semibold font-mono">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(modal, document.body);
}
