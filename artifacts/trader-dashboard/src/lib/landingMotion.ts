const REVEAL_TARGETS = [
  ".landing-hero-copy > *",
  ".landing-mission",
  ".landing-section-intro",
  ".landing-problem-list > li",
  ".landing-desired-path",
  ".landing-process-tabs > button",
  ".landing-process-layout",
  ".landing-reason-list > article",
  ".landing-evidence-stats > div",
  ".landing-quotes > figure",
  ".landing-comparison-cards > article",
  ".landing-offers > article",
  ".landing-faq details",
  ".landing-closing .landing-container > *",
  ".landing-footer-head",
  ".landing-footer-directory > details",
  ".landing-footer-bottom",
].join(",");

/** Progressive enhancement: no hidden CSS or inline styles survive a snapshot or a missing API. */
export function startLandingMotion(root: HTMLElement): () => void {
  const document = root.ownerDocument;
  const view = document.defaultView;
  if (!view?.matchMedia || !view.IntersectionObserver || typeof root.animate !== "function") {
    return () => {};
  }
  const preference = view.matchMedia("(prefers-reduced-motion: reduce)");
  let observer: IntersectionObserver | undefined;
  let mutations: MutationObserver | undefined;
  const animations = new Set<Animation>();
  const stop = () => {
    observer?.disconnect();
    mutations?.disconnect();
    animations.forEach((animation) => animation.cancel());
    animations.clear();
    // Includes brief animations started by native footer disclosures.
    root.getAnimations?.({ subtree: true }).forEach((animation) => animation.cancel());
  };
  const setup = () => {
    stop();
    // Background tabs can suspend their animation timeline before the first frame.
    if (preference.matches || document.visibilityState === "hidden") return;
    const seen = new WeakSet<Element>();
    observer = new view.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || document.visibilityState === "hidden") continue;
          const element = entry.target as HTMLElement;
          observer?.unobserve(element);
          element.dataset.landingRevealed = "true";
          const siblings = element.parentElement?.children;
          const order = siblings ? Array.from(siblings).indexOf(element) : 0;
          const animation = element.animate(
            [
              { opacity: 0, transform: "translateY(18px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            {
              duration: 620,
              delay: Math.min(Math.max(order, 0) * 75, 225),
              easing: "cubic-bezier(.22, 1, .36, 1)",
              fill: "backwards",
            },
          );
          animations.add(animation);
          const release = () => animations.delete(animation);
          animation.addEventListener("finish", release, { once: true });
          animation.addEventListener("cancel", release, { once: true });
        }
      },
      { threshold: 0.08 },
    );
    const observe = (element: Element) => {
      if (seen.has(element) || (element as HTMLElement).dataset.landingRevealed) return;
      seen.add(element);
      observer?.observe(element);
    };
    const register = (element: Element) => {
      if (element.matches(REVEAL_TARGETS)) observe(element);
      element.querySelectorAll(REVEAL_TARGETS).forEach(observe);
    };
    register(root);
    if (view.MutationObserver) {
      mutations = new view.MutationObserver((records) => {
        for (const record of records) {
          record.addedNodes.forEach((node) => {
            if (node instanceof view.Element) register(node);
          });
        }
      });
      mutations.observe(root, { childList: true, subtree: true });
    }
  };
  const finishFocused = (event: FocusEvent) => {
    const focused = event.target;
    if (!(focused instanceof view.Node)) return;
    animations.forEach((animation) => {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      if (target?.contains(focused)) animation.finish();
    });
  };
  setup();
  preference.addEventListener("change", setup);
  document.addEventListener("visibilitychange", setup);
  root.addEventListener("focusin", finishFocused);
  return () => {
    stop();
    preference.removeEventListener("change", setup);
    document.removeEventListener("visibilitychange", setup);
    root.removeEventListener("focusin", finishFocused);
  };
}
