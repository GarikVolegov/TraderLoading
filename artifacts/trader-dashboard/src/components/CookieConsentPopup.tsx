import { useState } from "react";
import { useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import {
  acceptCookieConsent,
  declineCookieConsent,
  hasRespondedToCookieConsent,
} from "@/lib/cookieConsent";
import { initAnalytics, trackSignUpConversion } from "@/lib/analytics";
import { useLanguage } from "@/contexts/LanguageContext";

const analyticsConfigured = Boolean(
  (import.meta as ImportMeta & { env?: { VITE_GA_MEASUREMENT_ID?: string } }).env
    ?.VITE_GA_MEASUREMENT_ID,
);

export function CookieConsentPopup() {
  const [visible, setVisible] = useState(() => !hasRespondedToCookieConsent());
  const { user } = useUser();
  const { t } = useLanguage();

  if (!visible) return null;

  const handleAccept = () => {
    acceptCookieConsent();
    initAnalytics();
    // Consent usually arrives AFTER the SignUpConversionTracker first ran (when
    // analytics was still off), so fire the sign_up conversion now that it's on.
    trackSignUpConversion(user?.createdAt);
    setVisible(false);
  };

  const handleDecline = () => {
    declineCookieConsent();
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-[var(--bottom-nav-clearance)] lg:bottom-5 lg:left-[calc(var(--app-inset-left)+0.75rem)] z-[80] mx-auto max-w-xl rounded-lg border border-border bg-background/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-5 text-muted-foreground">
          {analyticsConfigured
            ? t("cookie.banner.analytics")
            : t("cookie.banner.technical")}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {/* Con GA configurato il rifiuto è un obbligo GDPR; con soli cookie
              tecnici non c'è nulla da rifiutare, basta prendere atto. */}
          {analyticsConfigured && (
            <Button type="button" variant="outline" onClick={handleDecline}>
              {t("cookie.banner.decline")}
            </Button>
          )}
          <Button type="button" onClick={handleAccept}>
            {t(analyticsConfigured ? "cookie.banner.accept" : "cookie.banner.ok")}
          </Button>
        </div>
      </div>
    </div>
  );
}
