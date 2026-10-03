import * as React from "react";

/** Reactively track a CSS media query. SSR-safe (defaults to `false` off-DOM). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState<boolean>(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * True when the viewport is desktop-wide (`lg` ≥ 1024px) — the breakpoint at which
 * the ClockWidget banner reveals its inline daily quote (`lg:flex`).
 */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
