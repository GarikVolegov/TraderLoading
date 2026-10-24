import { useEffect } from "react";

/** Keep fixed mobile surfaces inside the visible viewport when the keyboard opens. */
export function useMobileViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;
    let fullHeight = window.innerHeight;
    let lastWidth = window.innerWidth;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = viewport?.height ?? window.innerHeight;
        const offset = viewport?.offsetTop ?? 0;
        const editable = document.activeElement?.matches(
          'textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]), [contenteditable="true"]',
        );
        // Android may resize the layout viewport as well as the visual viewport.
        // Keep the last unfocused height, resetting it after an orientation change.
        if (!editable || Math.abs(window.innerWidth - lastWidth) > 80) fullHeight = window.innerHeight;
        lastWidth = window.innerWidth;
        const keyboard = window.innerWidth < 1024 && editable && Math.max(fullHeight, window.innerHeight) - height > 120;
        root.style.setProperty("--visual-viewport-height", `${height}px`);
        root.style.setProperty("--visual-viewport-top", `${offset}px`);
        root.toggleAttribute("data-keyboard-open", Boolean(keyboard));
      });
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      root.removeAttribute("data-keyboard-open");
      root.style.removeProperty("--visual-viewport-height");
      root.style.removeProperty("--visual-viewport-top");
    };
  }, []);
}
