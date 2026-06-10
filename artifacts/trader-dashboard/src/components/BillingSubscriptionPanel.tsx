import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, FileText, RefreshCw, ShieldCheck, Star } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  billingQueryKey,
  cancelSubscription,
  fetchBillingInvoices,
  fetchBillingStatus,
  resumeSubscription,
  type BillingStatus,
} from "@/lib/billingApi";

function formatDate(value?: string | null): string {
  if (!value) return "Non disponibile";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

function statusLabel(status: string): string {
  if (status === "active") return "Attivo";
  if (status === "trialing") return "Trial";
  if (status === "past_due") return "Pagamento da verificare";
  if (status === "canceled") return "Cancellato";
  return status === "free" ? "Free" : status;
}

export function BillingSubscriptionPanel() {
  const queryClient = useQueryClient();
  const billing = useQuery({ queryKey: billingQueryKey, queryFn: () => fetchBillingStatus() });
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

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-primary/20 bg-card/70">
        <CardHeader className="border-b border-border/50 bg-secondary/10">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="h-5 w-5 text-primary" />
            Abbonamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          {billing.isLoading ? (
            <div className="h-28 rounded-lg bg-secondary/30 animate-pulse" />
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={status?.pro ? "default" : "secondary"}>
                      {status?.pro ? "Pro" : "Free"}
                    </Badge>
                    <span className="text-sm font-semibold">{statusLabel(status?.status ?? "free")}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {status?.pro
                      ? status.cancelAtPeriodEnd
                        ? `Accesso Pro attivo fino al ${formatDate(status.currentPeriodEnd)}.`
                        : `Pro attivo. Prossimo rinnovo: ${formatDate(status.currentPeriodEnd)}.`
                      : "Passa a Pro per sbloccare Backtesting, Classifiche e Collegamento conto."}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/45 px-4 py-3 text-left sm:text-right">
                  <p className="text-xs text-muted-foreground">Piano Pro</p>
                  <p className="text-2xl font-bold">7 EUR/mese</p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {["Backtesting", "Classifiche", "Collegamento conto"].map((item) => (
                  <div key={item} className="rounded-lg border border-border/50 bg-secondary/20 px-3 py-2 text-sm font-medium">
                    <ShieldCheck className="mr-2 inline h-4 w-4 text-primary" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {!status?.pro && (
                  <Button type="button" onClick={() => window.location.assign("/backtest")}>
                    Passa a Pro
                  </Button>
                )}
                {status?.canCancel && (
                  <Button type="button" variant="outline" disabled={isBusy} onClick={() => cancel.mutate()}>
                    {cancel.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                    Annulla rinnovo
                  </Button>
                )}
                {status?.canResume && (
                  <Button type="button" disabled={isBusy} onClick={() => resume.mutate()}>
                    {resume.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                    Riattiva abbonamento
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={() => billing.refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Aggiorna stato
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Fatture
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!status?.canViewInvoices ? (
            <p className="text-sm text-muted-foreground">Le fatture saranno disponibili dopo il primo pagamento Pro.</p>
          ) : invoices.isLoading ? (
            <div className="h-20 rounded-lg bg-secondary/30 animate-pulse" />
          ) : (invoices.data?.invoices ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna fattura disponibile.</p>
          ) : (
            invoices.data!.invoices.map((invoice) => (
              <div key={invoice.id} className="flex flex-col gap-2 rounded-lg border border-border/50 bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">{invoice.number ?? invoice.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)} · {invoice.status ?? "stato sconosciuto"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold">{formatMoney(invoice.amountPaid, invoice.currency)}</span>
                  {invoice.hostedInvoiceUrl && (
                    <a
                      href={invoice.hostedInvoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                      aria-label="Apri fattura Stripe"
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
