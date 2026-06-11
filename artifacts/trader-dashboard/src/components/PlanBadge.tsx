import { Link } from "wouter";
import { Crown, Sparkles } from "lucide-react";
import { useBillingStatus } from "@/lib/billingApi";
import { useLanguage } from "@/contexts/LanguageContext";

export function PlanBadge() {
  const billing = useBillingStatus();
  const { t } = useLanguage();

  if (billing.isLoading) {
    return <div className="h-6 w-12 animate-pulse rounded-full bg-card/60" />;
  }

  if (billing.data?.pro) {
    return (
      <Link
        href="/settings?section=abbonamento"
        aria-label={t("billing.badge.pro_title")}
        title={t("billing.manage_subscription")}
        className="inline-flex h-6 items-center gap-1 rounded-full bg-gradient-to-r from-primary to-emerald-400 px-2.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-[0_0_12px_rgba(34,197,94,0.35)]"
      >
        <Crown className="h-3 w-3" />
        Pro
      </Link>
    );
  }

  return (
    <Link
      href="/pro"
      aria-label={t("billing.badge.free_title")}
      title={t("billing.badge.free_title")}
      className="inline-flex h-6 items-center gap-1 rounded-full border border-border/55 bg-card/60 px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
    >
      <Sparkles className="h-3 w-3" />
      Free
    </Link>
  );
}
