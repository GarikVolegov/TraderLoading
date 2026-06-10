import { useMemo, useState } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { billingQueryKey, createCheckoutSession, fetchBillingStatus } from "@/lib/billingApi";

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

export type ProFeature = "backtest" | "leaderboard" | "broker";

const FEATURE_COPY: Record<ProFeature, { title: string; subtitle: string }> = {
  backtest: {
    title: "Sblocca il Backtesting",
    subtitle: "Replay, sessioni storiche e statistiche avanzate restano riservate al piano Pro.",
  },
  leaderboard: {
    title: "Sblocca le Classifiche",
    subtitle: "Accedi al ranking trader e confronta progressi, XP e livelli.",
  },
  broker: {
    title: "Sblocca il Collegamento conto",
    subtitle: "Collega il Broker Hub e sincronizza il conto con il piano Pro.",
  },
};

export function ProUpgradeGate({ feature, children }: { feature: ProFeature; children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutComplete, setCheckoutComplete] = useState(false);
  const billing = useQuery({
    queryKey: billingQueryKey,
    queryFn: () => fetchBillingStatus(),
  });

  const checkoutOptions = useMemo(
    () =>
      clientSecret
        ? {
            clientSecret,
            onComplete: () => {
              setCheckoutComplete(true);
              queryClient.invalidateQueries({ queryKey: billingQueryKey });
            },
          }
        : null,
    [clientSecret, queryClient],
  );

  if (billing.isLoading) {
    return <div className="min-h-[320px] rounded-lg bg-card/40 animate-pulse" />;
  }

  if (billing.data?.pro) {
    return <>{children}</>;
  }

  const copy = FEATURE_COPY[feature];

  async function startCheckout() {
    setError(null);
    try {
      const session = await createCheckoutSession();
      setClientSecret(session.clientSecret);
    } catch {
      setError("Checkout non disponibile. Controlla la configurazione Stripe e riprova.");
    }
  }

  return (
    <Card className="border-primary/20 bg-card/70">
      <CardContent className="p-5 sm:p-8">
        <div className="mx-auto max-w-2xl text-center space-y-5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{copy.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{copy.subtitle}</p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            {["Backtesting", "Classifiche", "Collegamento conto"].map((item) => (
              <div key={item} className="rounded-lg border border-border/60 bg-background/50 px-3 py-2">
                <Sparkles className="mx-auto mb-1 h-4 w-4 text-primary" />
                <span className="font-medium">{item}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-3xl font-bold">7 EUR/mese</p>
            <p className="text-xs text-muted-foreground">Abbonamento mensile Pro gestito in sicurezza da Stripe.</p>
          </div>
          {checkoutComplete && (
            <p className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary">
              Pagamento ricevuto. Sto aggiornando lo stato Pro.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!clientSecret && (
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={startCheckout}>Passa a Pro</Button>
              <Button variant="outline" onClick={() => billing.refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Aggiorna stato
              </Button>
            </div>
          )}
        </div>
        {clientSecret && checkoutOptions && stripePromise && (
          <div className="mx-auto mt-6 max-w-2xl rounded-lg border border-border/60 bg-background p-3">
            <EmbeddedCheckoutProvider stripe={stripePromise} options={checkoutOptions}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
        {clientSecret && !stripePromise && (
          <p className="mt-4 text-center text-sm text-destructive">Chiave pubblicabile Stripe mancante.</p>
        )}
      </CardContent>
    </Card>
  );
}
