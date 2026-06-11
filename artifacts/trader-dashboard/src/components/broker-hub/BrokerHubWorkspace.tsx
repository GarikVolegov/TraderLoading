import { useEffect, useState } from "react";
import { Cable, CheckCircle2, History, ListChecks, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { simpleStatusLabel } from "@/lib/uiCopyPolicy";
import { ConnectAccountWizard } from "./ConnectAccountWizard";
import { AccountEquityCurve } from "./AccountEquityCurve";
import { useBrokerHub } from "./useBrokerHub";
import type { BrokerHubTab } from "./types";
import { uiText } from "@/contexts/LanguageContext";

const DEFAULT_CAPABILITIES = {
  readAccount: true,
  readPositions: true,
  readHistory: true,
  placeOrders: false,
  closePositions: false,
  realtimeUpdates: false,
  requiresTerminal: false,
};

function format(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function StatusStrip({ snapshot, message }: ReturnType<typeof useBrokerHub>) {
  return (
    <div className="grid gap-3 md:grid-cols-[1.3fr_repeat(4,1fr)]">
      <div className="rounded-xl border border-border/40 bg-card/60 p-3">
        <p className="text-[11px] uppercase text-muted-foreground">{uiText("auto.ui.02570c50be")}</p>
        <p className="mt-1 font-mono text-sm font-bold">{snapshot.brokerName}</p>
        <p className="text-xs text-muted-foreground">{simpleStatusLabel(snapshot.status)}</p>
      </div>
      {[
        ["Balance", snapshot.metrics.balance],
        ["Equity", snapshot.metrics.equity],
        ["Free margin", snapshot.metrics.freeMargin],
        ["Daily P/L", snapshot.metrics.dailyProfit],
      ].map(([label, value]) => (
        <div key={label} className="rounded-xl border border-border/40 bg-secondary/25 p-3">
          <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
          <p className="mt-1 font-mono text-lg font-bold">{format(Number(value))}</p>
        </div>
      ))}
      {(snapshot.error || message) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 md:col-span-5">
          {snapshot.error ?? message}
        </div>
      )}
    </div>
  );
}

function AccountsPanel({ hub, onConnected }: { hub: ReturnType<typeof useBrokerHub>; onConnected: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold">
        <ListChecks className="h-4 w-4 text-primary" />{uiText("auto.ui.c61faab915")}</div>
      {hub.profiles.profiles.length === 0 && (
        <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 text-sm text-muted-foreground">{uiText("auto.ui.7bbe2e6cd5")}</div>
      )}
      {hub.profiles.profiles.map((profile) => {
        const active = hub.profiles.activeProfileId === profile.id;
        const capabilities = profile.capabilities ?? DEFAULT_CAPABILITIES;
        return (
          <div key={profile.id} className="rounded-xl border border-border/40 bg-card/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold">{profile.label}</p>
                  {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{profile.brokerName}</p>
                <p className="text-xs text-muted-foreground">{profile.accountId || "account non selezionato"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void hub.connectProfile(profile.id).then(onConnected)}>
                  {active ? "Aggiorna" : "Connetti"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void hub.deleteProfile(profile.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full border border-border/40 px-2 py-1">{profile.environment === "live" ? "Reale" : "Demo"}</span>
              <span className="rounded-full border border-border/40 px-2 py-1">{simpleStatusLabel(profile.health ?? profile.connectionStatus)}</span>
              <span className="rounded-full border border-border/40 px-2 py-1">{profile.tradingEnabled ? "Trading non disponibile" : "Trading bloccato"}</span>
              {!capabilities.placeOrders && <span className="rounded-full border border-border/40 px-2 py-1">{uiText("auto.ui.6c3cdfe1cc")}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HistoryPanel({ hub }: { hub: ReturnType<typeof useBrokerHub> }) {
  useEffect(() => {
    if (hub.profiles.activeProfileId) void hub.refreshHistory(hub.profiles.activeProfileId);
  }, [hub.profiles.activeProfileId, hub.refreshHistory]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold">
        <History className="h-4 w-4 text-primary" />
        Storico / Diario
      </div>
      {hub.history.length === 0 && <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 text-sm text-muted-foreground">{uiText("broker_hub.history_empty")}</div>}
      {hub.history.map((deal) => (
        <div key={deal.id} className="grid grid-cols-4 gap-2 rounded-lg border border-border/30 bg-secondary/20 px-3 py-2 text-xs">
          <span className="font-mono">{deal.symbol}</span>
          <span className={deal.side === "buy" ? "text-primary" : "text-destructive"}>{deal.side.toUpperCase()}</span>
          <span>{deal.volume}</span>
          <span>{format(deal.profit ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}

export function BrokerHubWorkspace({ initialTab = "connect" }: { initialTab?: BrokerHubTab }) {
  const hub = useBrokerHub();
  const [tab, setTab] = useState<BrokerHubTab>(initialTab);

  useEffect(() => setTab(initialTab), [initialTab]);

  return (
    <div className="space-y-4">
      <StatusStrip {...hub} />
      <AccountEquityCurve
        history={hub.history}
        balance={hub.snapshot.metrics.balance}
        currency={hub.snapshot.metrics.currency}
        connected={hub.snapshot.status === "connected"}
      />
      <Tabs value={tab} onValueChange={(value) => setTab(value as BrokerHubTab)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="connect" className="gap-2"><Cable className="h-3.5 w-3.5" />{uiText("auto.ui.2671bbd8db")}</TabsTrigger>
          <TabsTrigger value="accounts" className="gap-2"><ListChecks className="h-3.5 w-3.5" />Account</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-3.5 w-3.5" />{uiText("auto.ui.b38270fe36")}</TabsTrigger>
        </TabsList>
        <TabsContent value="connect"><ConnectAccountWizard hub={hub} onConnected={() => setTab("accounts")} /></TabsContent>
        <TabsContent value="accounts"><AccountsPanel hub={hub} onConnected={() => setTab("accounts")} /></TabsContent>
        <TabsContent value="history"><HistoryPanel hub={hub} /></TabsContent>
      </Tabs>
    </div>
  );
}
