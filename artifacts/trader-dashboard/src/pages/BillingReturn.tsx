import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Clock3, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageLayout } from "@/components/PageLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  billingQueryKey,
  billingStatusQueryOptions,
  confirmCheckoutSession,
} from "@/lib/billingApi";

const POLL_INTERVAL_MS = 2500;
// Il webhook Stripe può arrivare con qualche secondo di ritardo: oltre questo
// limite si smette di pollare e si lascia il refresh manuale all'utente.
const POLL_TIMEOUT_MS = 30_000;

export default function BillingReturn() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [timedOut, setTimedOut] = useState(false);
  const billing = useQuery({
    ...billingStatusQueryOptions(),
    refetchInterval: (query) =>
      query.state.data?.pro || timedOut ? false : POLL_INTERVAL_MS,
  });

  useEffect(() => {
    // Conferma attiva della sessione: non si dipende dal webhook (in locale o
    // se ritarda, è questa chiamata a sbloccare subito il piano Pro). Il
    // polling su /billing/me resta come fallback se la conferma fallisce.
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (sessionId) {
      confirmCheckoutSession(sessionId)
        .then((status) => queryClient.setQueryData(billingQueryKey, status))
        .catch(() => queryClient.invalidateQueries({ queryKey: billingQueryKey }));
    } else {
      queryClient.invalidateQueries({ queryKey: billingQueryKey });
    }
    const timer = window.setTimeout(() => setTimedOut(true), POLL_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [queryClient]);

  const isPro = billing.data?.pro === true;

  return (
    <PageLayout>
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md border-primary/25 bg-card/80">
          <CardContent className="p-6 sm:p-8">
            {isPro ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                  <BadgeCheck className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{t("billing.return.welcome")}</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("billing.return.welcome_sub")}
                  </p>
                </div>
                <div className="flex flex-col justify-center gap-2 sm:flex-row">
                  <Link href="/backtest">
                    <Button type="button" className="w-full sm:w-auto">
                      {t("billing.return.go_backtest")}
                    </Button>
                  </Link>
                  <Link href="/settings?section=abbonamento">
                    <Button type="button" variant="outline" className="w-full sm:w-auto">
                      {t("billing.manage_subscription")}
                    </Button>
                  </Link>
                </div>
              </div>
            ) : !timedOut ? (
              <div className="space-y-4 text-center">
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
                <div>
                  <h1 className="text-xl font-bold">{t("billing.return.confirming")}</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("billing.return.confirming_sub")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-secondary/30 text-muted-foreground">
                  <Clock3 className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">{t("billing.return.processing")}</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("billing.return.processing_sub")}
                  </p>
                </div>
                <div className="flex flex-col justify-center gap-2 sm:flex-row">
                  <Button type="button" onClick={() => billing.refetch()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t("billing.update_status")}
                  </Button>
                  <Link href="/settings?section=abbonamento">
                    <Button type="button" variant="outline" className="w-full sm:w-auto">
                      {t("billing.return.go_subscription")}
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
