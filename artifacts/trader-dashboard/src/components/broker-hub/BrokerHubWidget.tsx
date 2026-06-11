import { Activity, Cable, History, Landmark, ListChecks, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WidgetHeader } from "@/components/ui/widget-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { useBillingStatus } from "@/lib/billingApi";
import { simpleStatusLabel } from "@/lib/uiCopyPolicy";
import { useBrokerHub } from "./useBrokerHub";
import { AccountEquityCurve } from "./AccountEquityCurve";
import type { BrokerHubTab } from "./types";
import { uiText } from "@/contexts/LanguageContext";

function money(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function openWorkspace(tab: BrokerHubTab) {
  window.dispatchEvent(
    new CustomEvent("tl-open-dashboard-workspace", {
      detail: { workspaceId: "account", accountTab: tab },
    }),
  );
}

export function BrokerHubWidget() {
  const billing = useBillingStatus();

  // Skeleton solo al primo caricamento: nei refetch in background si rende dai
  // dati in cache per evitare flash dello skeleton a ogni focus della finestra.
  if (billing.isPending) {
    return <Card className="h-[320px] border-border/30 bg-card/60 animate-pulse" />;
  }

  if (!billing.data?.pro) {
    return (
      <Card className="relative overflow-hidden border-primary/20 bg-card/60">
        <WidgetHeader
          icon={<Landmark className="h-4 w-4 text-primary" />}
          iconClassName="border border-primary/20 bg-primary/10"
          title={uiText("auto.ui.5ad4db1d5a")}
          subtitle={uiText("auto.ui.e6f450849b")}
          actions={
            <div className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{uiText("auto.ui.ce13284c4b")}</div>
          }
        />
        <CardContent className="space-y-3 p-4">
          <div className="rounded-lg border border-border/40 bg-secondary/20 px-3 py-3 text-xs text-muted-foreground">
            Sblocca Collegamento conto, storico e snapshot account con Pro.
          </div>
          <Button type="button" className="w-full" onClick={() => openWorkspace("connect")}>
            Passa a Pro
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <BrokerHubWidgetInner />;
}

function BrokerHubWidgetInner() {
  const { snapshot, activeProfile, history } = useBrokerHub();
  const connected = snapshot.status === "connected";
  const title = activeProfile?.label ?? "Nessun conto";
  const subtitle = activeProfile ? activeProfile.brokerName : "Collega il tuo conto trading";

  return (
    <Card className="relative overflow-hidden border-border/30 bg-card/60">
      <WidgetHeader
        icon={<Landmark className="h-4 w-4 text-primary" />}
        iconClassName="border border-primary/20 bg-primary/10"
        title={uiText("auto.ui.56c86a8f0d")}
        subtitle={<span className="block max-w-[210px] truncate">{title}</span>}
        actions={
          <div
            className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${
              connected
                ? "border-success/30 bg-success/10 text-success"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {simpleStatusLabel(snapshot.status)}
          </div>
        }
      />

      <CardContent className="grid grid-cols-2 gap-2 p-4">
        <div className="col-span-2 rounded-lg border border-border/40 bg-secondary/20 px-3 py-2 text-[11px] text-muted-foreground">
          {subtitle}
        </div>
        <MetricCard label="Balance" value={money(snapshot.metrics.balance)} unit={snapshot.metrics.currency} />
        <MetricCard label="Equity" value={money(snapshot.metrics.equity)} unit={snapshot.metrics.currency} />
        <AccountEquityCurve
          history={history}
          balance={snapshot.metrics.balance}
          currency={snapshot.metrics.currency}
          connected={connected}
        />
        <div className="col-span-2 flex items-center justify-between rounded-xl border border-border/40 bg-secondary/30 px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            Posizioni aperte
          </span>
          <span className="font-mono font-bold">{snapshot.positions.length}</span>
        </div>
        <div className="col-span-2 grid grid-cols-3 gap-2">
          {[
            ["connect", Cable, "Collega"],
            ["accounts", ListChecks, "Account"],
            ["history", History, "Storico"],
          ].map(([tab, Icon, label]) => (
            <button
              key={String(tab)}
              type="button"
              onClick={() => openWorkspace(tab as BrokerHubTab)}
              className="flex h-9 items-center justify-center gap-1 rounded-lg border border-border/40 bg-background/35 text-[10px] font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              title={tab === "connect" ? "Collega conto" : String(label)}
            >
              <Icon className="h-3.5 w-3.5" />
              {String(label)}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
