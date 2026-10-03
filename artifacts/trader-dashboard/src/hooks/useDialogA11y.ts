import * as React from "react";

// Reusable dialog a11y behavior, extracted from components/ui/modal.tsx (the
// hardened focus-trap shipped for audit finding 3.4): dialog semantics, Escape,
// Tab trap, scroll lock, inert background and focus capture/restore. Custom
// overlays that can't adopt <Modal> (bespoke styling, full-screen chrome) apply
// this hook to their panel element instead.

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

type UseDialogA11yOptions = {
  isOpen: boolean;
  onClose: () => void;
  panelRef: React.RefObject<HTMLElement | null>;
  // Element to focus on open instead of the panel's first focusable child —
  // e.g. a form's main input, so a pre-existing `autoFocus` isn't silently
  // overridden by the hook's default "first focusable in DOM order" pick.
  initialFocusRef?: React.RefObject<HTMLElement | null>;
};

type DialogPanelProps = {
  role: "dialog";
  "aria-modal": true;
  "aria-labelledby": string;
  tabIndex: -1;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
};

export function useDialogA11y({ isOpen, onClose, panelRef, initialFocusRef }: UseDialogA11yOptions): {
  titleId: string;
  panelProps: DialogPanelProps;
} {
  const titleId = React.useId();

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

    // Inert everything except the dialog's own portal root, so a screen-reader
    // virtual cursor (which a Tab trap does not constrain) and pointer/tab focus
    // cannot reach the obscured background. aria-modal alone is not reliable.
    // Overlays rendered INLINE inside the app root (#root) skip this step: their
    // "portal root" is the whole app, so inerting its siblings would only hide
    // unrelated portals (toasts) without shielding the background — the Tab trap
    // below still constrains keyboard focus.
    const panel = panelRef.current;
    const portalRoot = panel?.closest("body > *") ?? null;
    const appRoot = document.getElementById("root");
    const isPortaled = portalRoot !== null && portalRoot !== appRoot;
    const restoreInert: Array<() => void> = [];
    if (isPortaled) {
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
    }

    const first = initialFocusRef?.current ?? (panel ? focusableWithin(panel)[0] : undefined);
    (first ?? panel)?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      restoreInert.forEach((restore) => restore());
      opener?.focus?.();
    };
  }, [isOpen, panelRef, initialFocusRef]);

  // Keydown is handled on the panel (not a document-capture listener) so only the
  // focused/topmost dialog responds — stacked overlays each keep their own Escape,
  // and a child that already handled Escape (defaultPrevented) suppresses the close.
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
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
    },
    [onClose, panelRef],
  );

  return {
    titleId,
    panelProps: {
      role: "dialog",
      "aria-modal": true,
      "aria-labelledby": titleId,
      tabIndex: -1,
      onKeyDown: handleKeyDown,
    },
  };
}
