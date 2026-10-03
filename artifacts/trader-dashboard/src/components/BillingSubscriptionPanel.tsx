import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDateLocale, useLanguage } from "@/contexts/LanguageContext";
import {
  billingQueryKey,
  cancelSubscription,
  fetchBillingInvoices,
  resumeSubscription,
  type BillingStatus,
  useBillingStatus,
} from "@/lib/billingApi";

function formatDate(value: string | null | undefined, localeCode: string, fallback: string): string {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(localeCode, { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

function formatMoney(cents: number, currency: string, localeCode: string): string {
  return new Intl.NumberFormat(localeCode, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

function statusLabel(status: string, t: (key: string) => string): string {
  if (status === "active") return t("billing.status.active");
  if (status === "trialing") return t("billing.status.trialing");
  if (status === "past_due") return t("billing.status.past_due");
  if (status === "canceled") return t("billing.status.canceled");
  return status === "free" ? t("billing.status.free") : status;
}

function sourceLabel(status: BillingStatus | undefined, t: (key: string, vars?: Record<string, string | number>) => string): string | null {
  if (!status?.pro) return null;
  if (status.manualOverride) return t("billing.source.manual");
  if (status.source === "stripe") return t("billing.source.stripe");
  return status.source ? t("billing.source.other", { source: status.source }) : null;
}

const PRO_FEATURES = [
  { titleKey: "billing.feature.backtesting", detailKey: "billing.panel.detail.backtesting" },
  { titleKey: "billing.feature.leaderboards", detailKey: "billing.panel.detail.leaderboards" },
  { titleKey: "billing.feature.account_sync", detailKey: "billing.panel.detail.account_sync" },
] as const;

export function BillingSubscriptionPanel() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { language, t } = useLanguage();
  useDateLocale();
  const localeCode = language === "en" ? "en-US" : language;
  const billing = useBillingStatus();
  const invoices = useQuery({
    queryKey: ["/api/billing/invoices"],
    queryFn: () => fetchBillingInvoices(),
    enabled: billing.data?.canViewInvoices === true,
  });

  const cancel = useMutation({
    mutationFn: () => cancelSubscription(),
    onSuccess: (status: BillingStatus) => {
      queryClient.setQueryData(billingQueryKey, status);
      queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
    },
  });
  const resume = useMutation({
    mutationFn: () => resumeSubscription(),
    onSuccess: (status: BillingStatus) => {
      queryClient.setQueryData(billingQueryKey, status);
      queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
    },
  });

  const status = billing.data;
  const isBusy = cancel.isPending || resume.isPending;
  const isVerifyingStatus = billing.isLoading || (billing.isFetching && !status?.pro);
  const source = sourceLabel(status, t);
  const unavailableDate = t("billing.date_unavailable");
  const currentPeriodEnd = formatDate(status?.currentPeriodEnd, localeCode, unavailableDate);
  const renewalCopy = status?.pro
    ? status.cancelAtPeriodEnd
      ? t("billing.panel.renewal_until", { date: currentPeriodEnd })
      : t("billing.panel.renewal_pro", { date: currentPeriodEnd })
    : t("billing.panel.upsell");

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-primary/25 bg-card/75 shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
        <CardHeader className="border-b border-primary/15 bg-[linear-gradient(135deg,rgba(34,197,94,0.14),rgba(15,23,42,0)_48%,rgba(59,130,246,0.08))] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/35 bg-primary/10 text-primary">
                <Star className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl leading-tight">{t("billing.panel.title")}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{t("billing.panel.subtitle")}</p>
              </div>
            </div>
            <div className="rounded-lg border border-primary/25 bg-background/55 px-4 py-3 text-left sm:min-w-44 sm:text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("billing.panel.plan_label")}</p>
              <p className="mt-1 text-3xl font-black leading-none text-foreground">{t("billing.price_month")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("billing.per_month")}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-5 sm:p-6">
          {isVerifyingStatus ? (
            <div className="rounded-lg border border-border/50 bg-secondary/20 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary/50 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-40 rounded bg-secondary/50 animate-pulse" />
                  <div className="h-3 w-56 rounded bg-secondary/40 animate-pulse" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{t("billing.panel.verifying")}</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
                <div className="rounded-lg border border-border/60 bg-background/35 p-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge variant={status?.pro ? "default" : "secondary"} className="px-2.5">
                      {status?.pro ? "Pro" : t("billing.status.free")}
                    </Badge>
                    <span className="text-base font-bold">{statusLabel(status?.status ?? "free", t)}</span>
                    {status?.pro && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t("billing.panel.access_included")}
                      </span>
                    )}
                  </div>
                  {source && <p className="mt-2 text-xs text-muted-foreground">{source}</p>}
                  <div className="mt-4 flex gap-3 rounded-lg border border-primary/15 bg-primary/5 p-3">
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("billing.panel.coverage")}</p>
                      <p className="mt-1 text-sm text-foreground/90">{renewalCopy}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-secondary/15 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CreditCard className="h-4 w-4 text-primary" />
                    {t("billing.panel.management")}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {t("billing.panel.management_desc")}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("billing.panel.access_included")}</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {PRO_FEATURES.map((item) => (
                    <div key={item.titleKey} className="rounded-lg border border-border/55 bg-secondary/15 px-3 py-3">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        {t(item.titleKey)}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{t(item.detailKey)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  {status?.pro ? t("billing.panel.access_included") : t("billing.panel.upsell")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!status?.pro && status?.checkoutAvailable && (
                    <Button type="button" onClick={() => navigate("/pro")}>
                      {t("billing.upgrade_cta")}
                    </Button>
                  )}
                  {!status?.pro && !status?.checkoutAvailable && (
                    <p className="text-xs text-muted-foreground">{t("billing.checkout_unavailable")}</p>
                  )}
                  {status?.canCancel && (
                    <Button type="button" variant="outline" disabled={isBusy} onClick={() => cancel.mutate()}>
                      {cancel.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                      {t("billing.panel.cancel_renewal")}
                    </Button>
                  )}
                  {status?.canResume && (
                    <Button type="button" disabled={isBusy} onClick={() => resume.mutate()}>
                      {resume.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                      {t("billing.panel.resume")}
                    </Button>
                  )}
                  <Button type="button" variant="ghost" onClick={() => billing.refetch()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t("billing.update_status")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/70 bg-card/65">
        <CardHeader className="border-b border-border/50 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ReceiptText className="h-4 w-4 text-primary" />
              {t("billing.panel.invoices")}
            </CardTitle>
            <span className="text-xs text-muted-foreground">{t("billing.panel.management")}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          {!status?.canViewInvoices ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-secondary/10 p-4">
              <p className="text-sm font-semibold">{t("billing.panel.invoices_none")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("billing.panel.invoices_after")}
              </p>
            </div>
          ) : invoices.isLoading ? (
            <div className="h-24 rounded-lg bg-secondary/30 animate-pulse" />
          ) : (invoices.data?.invoices ?? []).length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-secondary/10 p-4">
              <p className="text-sm font-semibold">{t("billing.panel.invoices_none")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("billing.panel.invoices_none")}</p>
            </div>
          ) : (
            invoices.data!.invoices.map((invoice) => (
              <div key={invoice.id} className="flex flex-col gap-3 rounded-lg border border-border/55 bg-background/35 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{invoice.number ?? invoice.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(invoice.periodStart, localeCode, unavailableDate)} - {formatDate(invoice.periodEnd, localeCode, unavailableDate)} - {invoice.status ?? t("billing.panel.status_unknown")}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <span className="font-mono text-sm font-bold">{formatMoney(invoice.amountPaid, invoice.currency, localeCode)}</span>
                  {invoice.hostedInvoiceUrl && (
                    <a
                      href={invoice.hostedInvoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                      aria-label={t("billing.panel.invoice_open")}
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
