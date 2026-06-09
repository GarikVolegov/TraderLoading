import { Activity, Cable, History, Landmark, ListChecks, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { simpleStatusLabel } from "@/lib/uiCopyPolicy";
import { useBrokerHub } from "./useBrokerHub";
import type { BrokerHubTab } from "./types";

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
  const { snapshot, activeProfile } = useBrokerHub();
  const connected = snapshot.status === "connected";
  const title = activeProfile?.label ?? "Nessun conto";
  const subtitle = activeProfile ? activeProfile.brokerName : "Collega il tuo conto trading";

  return (
    <Card className="relative overflow-hidden border-border/30 bg-card/60">
      <div className="widget-header">
        <div className="flex items-center gap-2.5">
          <div className="widget-icon border border-primary/20 bg-primary/10">
            <Landmark className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="widget-title">Broker Hub</p>
            <p className="max-w-[210px] truncate text-[10px] text-muted-foreground">{title}</p>
          </div>
        </div>
        <div
          className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${
            connected
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {simpleStatusLabel(snapshot.status)}
        </div>
      </div>

      <CardContent className="grid grid-cols-2 gap-2 p-4">
        <div className="col-span-2 rounded-lg border border-border/40 bg-secondary/20 px-3 py-2 text-[11px] text-muted-foreground">
          {subtitle}
        </div>
        <div className="metric-card">
          <span className="metric-label">Balance</span>
          <span className="metric-value">{money(snapshot.metrics.balance)}</span>
          <span className="metric-unit">{snapshot.metrics.currency}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Equity</span>
          <span className="metric-value">{money(snapshot.metrics.equity)}</span>
          <span className="metric-unit">{snapshot.metrics.currency}</span>
        </div>
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
