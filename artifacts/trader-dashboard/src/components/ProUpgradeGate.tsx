import { useState } from "react";
import { Link } from "wouter";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProCheckoutDialog } from "@/components/ProCheckoutDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBillingStatus } from "@/lib/billingApi";

export type ProFeature = "backtest" | "leaderboard" | "broker" | "wiki";

const FEATURE_COPY_KEYS: Record<ProFeature, { title: string; subtitle: string }> = {
  backtest: {
    title: "billing.gate.backtest.title",
    subtitle: "billing.gate.backtest.subtitle",
  },
  leaderboard: {
    title: "billing.gate.leaderboard.title",
    subtitle: "billing.gate.leaderboard.subtitle",
  },
  broker: {
    title: "billing.gate.broker.title",
    subtitle: "billing.gate.broker.subtitle",
  },
  wiki: {
    title: "billing.gate.wiki.title",
    subtitle: "billing.gate.wiki.subtitle",
  },
};

const FEATURE_ITEMS = [
  "billing.feature.backtesting",
  "billing.feature.leaderboards",
  "billing.feature.account_sync",
];

function PaywallCard({ feature, onUpgrade }: { feature: ProFeature; onUpgrade: () => void }) {
  const { t } = useLanguage();
  const copy = FEATURE_COPY_KEYS[feature];

  return (
    <Card className="w-full max-w-md border-primary/25 bg-card/95 shadow-xl">
      <CardContent className="p-5 sm:p-6">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{t(copy.title)}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t(copy.subtitle)}</p>
          </div>
          <div className="grid gap-2 text-xs sm:grid-cols-3">
            {FEATURE_ITEMS.map((item) => (
              <div key={item} className="rounded-lg border border-border/60 bg-background/50 px-2 py-2">
                <Sparkles className="mx-auto mb-1 h-4 w-4 text-primary" />
                <span className="font-medium">{t(item)}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-2xl font-bold">{t("billing.price_month")}</p>
            <p className="text-xs text-muted-foreground">{t("billing.stripe_note")}</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button type="button" className="w-full sm:w-auto sm:px-8" onClick={onUpgrade}>
              {t("billing.upgrade_cta")}
            </Button>
            <Link href="/pro">
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
                {t("billing.discover_cta")}
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProUpgradeGate({ feature, children }: { feature: ProFeature; children: React.ReactNode }) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const billing = useBillingStatus();

  if (billing.isPending) {
    return <div className="min-h-[320px] rounded-lg bg-card/40 animate-pulse" />;
  }

  if (billing.data?.pro) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-[420px]">
      <div inert aria-hidden className="pointer-events-none select-none blur-[3px] opacity-50">
        {children}
      </div>
      <div className="absolute inset-0 z-10 rounded-lg bg-background/40 p-4 backdrop-blur-[1px]">
        <div className="sticky top-24 flex justify-center">
          <PaywallCard feature={feature} onUpgrade={() => setCheckoutOpen(true)} />
        </div>
      </div>
      <ProCheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  );
}
