import { useLayoutEffect, useRef, type ReactNode } from "react";

/** A conversation fills the space below its actual header, including wrapped translations. */
export function ViewportPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        // Resolve the shared clearance token to pixels (it may contain env()/calc()).
        const clearance = getComputedStyle(element.closest(".app-page") ?? element).paddingBottom;
        const bottom = parseFloat(clearance) || 0;
        const top = element.getBoundingClientRect().top;
        const height = Math.max(160, (viewport?.height ?? innerHeight) + (viewport?.offsetTop ?? 0) - top - bottom - 12);
        element.style.height = `${height}px`;
        element.scrollTop = 0;
      });
    };
    const observer = new ResizeObserver(measure);
    if (element.parentElement) observer.observe(element.parentElement);
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-keyboard-open"] });
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, []);
  return <section ref={ref} className={`viewport-panel min-h-0 overflow-hidden rounded-2xl border border-border/60 bg-card/40 ${className}`}>
    <div className="h-full min-h-0 overflow-hidden">{children}</div>
  </section>;
}
