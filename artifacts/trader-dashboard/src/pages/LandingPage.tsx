import { useEffect, useReducer, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Seo } from "@/components/Seo";
import { absoluteUrl, faqJsonLd, landingAlternates, landingPath } from "@/lib/seo";
import { initialTourState, isTourComplete, tourReducer } from "@/lib/landingTour";
import { trackEvent } from "@/lib/analytics";
import { startLandingMotion } from "@/lib/landingMotion";
import { LandingProcess } from "@/components/landing/LandingProcess";
import {
  LandingHero,
  LandingMission,
  LandingProblem,
  LandingDesired,
  LandingReasons,
  LandingEvidence,
  LandingComparison,
  LandingPricing,
  LandingFaq,
  LandingClosing,
  LandingFooter,
} from "@/components/landing/LandingSections";
import { LandingNavigation } from "@/components/landing/LandingNavigation";
import "./LandingPage.css";

export const FAQ_ITEMS = [
  { questionKey: "landing.faq.free.question", answerKey: "landing.faq.free.answer" },
  { questionKey: "landing.faq.difference.question", answerKey: "landing.faq.difference.answer" },
  { questionKey: "landing.faq.results.question", answerKey: "landing.faq.results.answer" },
  { questionKey: "landing.faq.sync.question", answerKey: "landing.faq.sync.answer" },
  { questionKey: "landing.faq.safety.question", answerKey: "landing.faq.safety.answer" },
  { questionKey: "landing.faq.cancel.question", answerKey: "landing.faq.cancel.answer" },
  { questionKey: "landing.faq.install.question", answerKey: "landing.faq.install.answer" },
] as const;

export default function LandingPage() {
  const { t, language } = useLanguage();
  const [process, dispatch] = useReducer(tourReducer, initialTourState);
  const root = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const tracked = useRef({ start: false, complete: false });
  useEffect(() => {
    if (root.current) return startLandingMotion(root.current);
    return undefined;
  }, []);
  useEffect(() => {
    const element = header.current;
    if (!element) return;
    const update = () =>
      root.current?.style.setProperty(
        "--landing-header-height",
        `${element.getBoundingClientRect().bottom}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (process.started && !tracked.current.start) {
      trackEvent("landing_demo_start", { language });
      tracked.current.start = true;
    }
    if (isTourComplete(process) && !tracked.current.complete) {
      trackEvent("landing_demo_complete", { language, steps: process.visited.length });
      tracked.current.complete = true;
    }
  }, [process, language]);

  const faqSchema = faqJsonLd(
    language,
    FAQ_ITEMS.map(({ questionKey, answerKey }) => ({
      question: t(questionKey),
      answer: t(answerKey),
    })),
  );
  return (
    <div className="landing-page" ref={root}>
      <Seo
        title={t("landing.meta.title")}
        description={t("landing.meta.description")}
        keywords={t("landing.meta.keywords")}
        lang={language}
        canonical={absoluteUrl(landingPath(language))}
        alternates={landingAlternates()}
        jsonLd={[faqSchema]}
      />
      <a className="landing-skip" href="#landing-main">
        {t("landing.skip")}
      </a>
      <LandingNavigation headerRef={header} onStart={() => dispatch({ type: "start" })} />
      <main id="landing-main" tabIndex={-1}>
        <LandingHero onStart={() => dispatch({ type: "start" })} />
        <LandingMission />
        <LandingProblem />
        <LandingDesired />
        <LandingProcess state={process} dispatch={dispatch} />
        <LandingReasons />
        <LandingEvidence />
        <LandingComparison />
        <LandingPricing />
        <LandingFaq items={FAQ_ITEMS} />
        <LandingClosing />
      </main>
      <LandingFooter />
    </div>
  );
}
