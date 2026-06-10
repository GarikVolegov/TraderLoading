import { useEffect } from "react";
import { useUser } from "@clerk/react";
import { initAnalytics, trackSignUpConversion } from "@/lib/analytics";

/**
 * Registra la conversione `sign_up` su GA4 quando un utente appena creato
 * arriva autenticato per la prima volta. No-op senza VITE_GA_MEASUREMENT_ID
 * o senza consenso cookie.
 */
export function SignUpConversionTracker() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !user) return;
    // Riverifica l'init: il consenso può essere arrivato in una sessione precedente.
    initAnalytics();
    trackSignUpConversion(user.createdAt);
  }, [isLoaded, user]);

  return null;
}
