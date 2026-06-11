import { useEffect, useMemo, useState } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { billingQueryKey, createCheckoutSession } from "@/lib/billingApi";
import { stripePromise } from "@/lib/stripe";

type Translate = ReturnType<typeof useLanguage>["t"];

function checkoutErrorMessage(error: unknown, t: Translate): string {
  if (error instanceof Error && error.message === "503") {
    return t("billing.checkout.not_configured");
  }
  return t("billing.checkout.error");
}

export function ProCheckoutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setError(null);
      return;
    }

    let cancelled = false;
    createCheckoutSession()
      .then((session) => {
        if (!cancelled) setClientSecret(session.clientSecret);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(checkoutErrorMessage(err, t));
      });

    return () => {
      cancelled = true;
    };
  }, [open, t]);

  const checkoutOptions = useMemo(
    () =>
      clientSecret
        ? {
            clientSecret,
            onComplete: () => {
              queryClient.invalidateQueries({ queryKey: billingQueryKey });
            },
          }
        : null,
    [clientSecret, queryClient],
  );

  function retry() {
    setError(null);
    createCheckoutSession()
      .then((session) => setClientSecret(session.clientSecret))
      .catch((err: unknown) => setError(checkoutErrorMessage(err, t)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-primary/25 bg-card">
        <DialogHeader>
          <DialogTitle>{t("billing.checkout.title")}</DialogTitle>
          <DialogDescription>{t("billing.checkout.subtitle")}</DialogDescription>
        </DialogHeader>
        {error && (
          <div className="space-y-3 py-2 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button type="button" variant="outline" onClick={retry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("billing.checkout.retry")}
            </Button>
          </div>
        )}
        {!error && !clientSecret && (
          <div className="h-72 rounded-lg bg-background/60 animate-pulse" />
        )}
        {clientSecret && checkoutOptions && stripePromise && (
          <div className="rounded-lg border border-border/60 bg-background p-3">
            <EmbeddedCheckoutProvider stripe={stripePromise} options={checkoutOptions}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
        {clientSecret && !stripePromise && (
          <p className="text-center text-sm text-destructive">{t("billing.checkout.missing_key")}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
