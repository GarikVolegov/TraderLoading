import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { trackEvent } from "@/lib/analytics";

export function SignupCta({
  placement,
  pro = false,
  compact = false,
}: {
  placement: string;
  pro?: boolean;
  compact?: boolean;
}) {
  const { language, t } = useLanguage();
  return (
    <Link
      href="/sign-up"
      className="landing-button landing-button-primary"
      aria-label={compact ? t("landing.hero.start_free") : undefined}
      onClick={() =>
        trackEvent("landing_cta_click", { placement, language, destination: "free_signup" })
      }
    >
      {compact ? (
        <>
          <span className="landing-cta-full">{t("landing.hero.start_free")}</span>
          <span className="landing-cta-short" aria-hidden="true">
            {t("landing.nav.free")}
          </span>
        </>
      ) : (
        t(pro ? "landing.pricing.pro_cta" : "landing.hero.start_free")
      )}
      <ArrowRight size={20} aria-hidden="true" />
    </Link>
  );
}

export function SectionIntro({
  eyebrowKey,
  titleKey,
  bodyKey,
  id,
}: {
  eyebrowKey?: string;
  titleKey: string;
  bodyKey?: string;
  id: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="landing-section-intro">
      {eyebrowKey && <p className="landing-eyebrow">{t(eyebrowKey)}</p>}
      <h2 id={id}>{t(titleKey)}</h2>
      {bodyKey && <p className="landing-lede">{t(bodyKey)}</p>}
    </div>
  );
}
