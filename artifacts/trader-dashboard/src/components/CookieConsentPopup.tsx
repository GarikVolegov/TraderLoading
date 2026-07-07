import { useState } from "react";
import { useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import {
  acceptCookieConsent,
  hasAcceptedCookieConsent,
} from "@/lib/cookieConsent";
import { initAnalytics, trackSignUpConversion } from "@/lib/analytics";

const analyticsConfigured = Boolean(
  (import.meta as ImportMeta & { env?: { VITE_GA_MEASUREMENT_ID?: string } }).env
    ?.VITE_GA_MEASUREMENT_ID,
);

export function CookieConsentPopup() {
  const [visible, setVisible] = useState(() => !hasAcceptedCookieConsent());
  const { user } = useUser();

  if (!visible) return null;

  const handleAccept = () => {
    acceptCookieConsent();
    initAnalytics();
    // Consent usually arrives AFTER the SignUpConversionTracker first ran (when
    // analytics was still off), so fire the sign_up conversion now that it's on.
    trackSignUpConversion(user?.createdAt);
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-[var(--bottom-nav-clearance)] lg:bottom-5 lg:left-[calc(var(--app-inset-left)+0.75rem)] z-[80] mx-auto max-w-xl rounded-lg border border-border bg-background/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-5 text-muted-foreground">
          {analyticsConfigured
            ? "Usiamo cookie tecnici per la sessione e, con il tuo consenso, statistiche anonime di utilizzo (Google Analytics con IP anonimizzato). Dettagli in Impostazioni → Termini & Privacy."
            : "Usiamo solo cookie tecnici necessari per mantenere attiva la sessione e salvare le preferenze essenziali dell'app. Dettagli in Impostazioni → Termini & Privacy."}
        </p>
        <Button type="button" onClick={handleAccept} className="shrink-0">
          Accetta
        </Button>
      </div>
    </div>
  );
}
