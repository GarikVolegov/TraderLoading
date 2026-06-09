import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  acceptCookieConsent,
  hasAcceptedCookieConsent,
} from "@/lib/cookieConsent";

export function CookieConsentPopup() {
  const [visible, setVisible] = useState(() => !hasAcceptedCookieConsent());

  if (!visible) return null;

  const handleAccept = () => {
    acceptCookieConsent();
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-xl rounded-lg border border-border bg-background/95 p-4 shadow-2xl backdrop-blur md:bottom-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-5 text-muted-foreground">
          Usiamo cookie tecnici per mantenere attiva la sessione e salvare i
          tuoi dati durante refresh e aggiornamenti dell'app.
        </p>
        <Button type="button" onClick={handleAccept} className="shrink-0">
          Accetta
        </Button>
      </div>
    </div>
  );
}
