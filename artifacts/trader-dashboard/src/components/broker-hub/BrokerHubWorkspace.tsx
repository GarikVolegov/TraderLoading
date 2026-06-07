import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Cable, CheckCircle2, History, Landmark, ListChecks, Send, TerminalSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TradingViewMonitor } from "@/components/account-bridge/TradingViewMonitor";
import { ConnectAccountWizard } from "./ConnectAccountWizard";
import { useBrokerHub } from "./useBrokerHub";
import type { BrokerHubTab, BrokerOrderDraft } from "./types";

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
        <p className="text-[11px] uppercase text-muted-foreground">Conto attivo</p>
        <p className="mt-1 font-mono text-sm font-bold">{snapshot.brokerName}</p>
        <p className="text-xs text-muted-foreground">{snapshot.status}</p>
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
        <div className="md:col-span-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
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
        <ListChecks className="h-4 w-4 text-primary" />
        Conti collegati
      </div>
      {hub.profiles.profiles.length === 0 && (
        <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 text-sm text-muted-foreground">Nessun conto collegato.</div>
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
                  {active ? "Riconnetti" : "Connetti"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void hub.deleteProfile(profile.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full border border-border/40 px-2 py-1">{profile.environment}</span>
              <span className="rounded-full border border-border/40 px-2 py-1">{profile.health ?? profile.connectionStatus ?? "offline"}</span>
              {capabilities.requiresTerminal && <span className="rounded-full border border-border/40 px-2 py-1">Terminale richiesto</span>}
              <span className="rounded-full border border-border/40 px-2 py-1">{profile.tradingEnabled ? "Trading live ON" : "Trading bloccato"}</span>
              {!capabilities.placeOrders && <span className="rounded-full border border-border/40 px-2 py-1">Sola lettura</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TerminalPanel({ hub }: { hub: ReturnType<typeof useBrokerHub> }) {
  const symbol = hub.snapshot.positions[0]?.symbol ?? "EURUSD";
  const canClose =
    !!hub.profiles.activeProfileId &&
    hub.snapshot.status === "connected" &&
    hub.activeProfile?.tradingEnabled &&
    (hub.activeProfile.capabilities ?? DEFAULT_CAPABILITIES).closePositions;

  const closePosition = async (positionId: string, symbolName: string) => {
    if (!hub.profiles.activeProfileId) return;
    if (!window.confirm(`Chiudere la posizione LIVE su ${symbolName}?`)) return;
    await hub.closePosition(hub.profiles.activeProfileId, positionId);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <TradingViewMonitor brokerSymbol={symbol} />
      <div className="rounded-xl border border-border/40 bg-card/60 p-4">
        <div className="flex items-center gap-2 text-sm font-bold">
          <TerminalSquare className="h-4 w-4 text-primary" />
          Posizioni
        </div>
        <div className="mt-3 space-y-2">
          {hub.snapshot.positions.length === 0 && <p className="text-sm text-muted-foreground">Nessuna posizione aperta.</p>}
          {hub.snapshot.positions.map((position) => (
            <div key={position.id} className="grid grid-cols-[1fr_64px_64px_72px_auto] items-center gap-2 rounded-lg border border-border/30 bg-secondary/20 px-3 py-2 text-xs">
              <span className="font-mono">{position.symbol}</span>
              <span className={position.side === "buy" ? "text-primary" : "text-destructive"}>{position.side.toUpperCase()}</span>
              <span>{position.volume}</span>
              <span>{format(position.profit ?? 0)}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                disabled={!canClose}
                onClick={() => void closePosition(position.brokerPositionId, position.symbol)}
              >
                Chiudi
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrderPanel({ hub }: { hub: ReturnType<typeof useBrokerHub> }) {
  const [draft, setDraft] = useState<BrokerOrderDraft>({ symbol: "EURUSD", side: "buy", type: "market", volume: 0.1 });
  const activeId = hub.profiles.activeProfileId;
  const canSend =
    !!activeId &&
    hub.snapshot.status === "connected" &&
    hub.activeProfile?.tradingEnabled &&
    (hub.activeProfile.capabilities ?? DEFAULT_CAPABILITIES).placeOrders;

  const submit = async () => {
    if (!activeId) return;
    if (!window.confirm("Inviare ordine LIVE dal Broker Hub?")) return;
    await hub.placeOrder(activeId, draft);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="space-y-3 rounded-xl border border-border/40 bg-card/60 p-4">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Send className="h-4 w-4 text-primary" />
          Ticket ordine normalizzato
        </div>
        <Input value={draft.symbol} onChange={(event) => setDraft((prev) => ({ ...prev, symbol: event.target.value.toUpperCase() }))} />
        <div className="grid grid-cols-2 gap-2">
          {(["buy", "sell"] as const).map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => setDraft((prev) => ({ ...prev, side }))}
              className={`h-10 rounded-xl border text-sm font-bold uppercase ${
                draft.side === side
                  ? side === "buy" ? "border-primary bg-primary/15 text-primary" : "border-destructive bg-destructive/15 text-destructive"
                  : "border-border/40 text-muted-foreground"
              }`}
            >
              {side}
            </button>
          ))}
        </div>
        <select
          value={draft.type}
          onChange={(event) => setDraft((prev) => ({ ...prev, type: event.target.value as BrokerOrderDraft["type"] }))}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="market">Market</option>
          <option value="limit">Limit</option>
          <option value="stop">Stop</option>
        </select>
        <Input type="number" step="0.01" value={draft.volume} onChange={(event) => setDraft((prev) => ({ ...prev, volume: Number(event.target.value) }))} />
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" step="any" placeholder="Limit" onChange={(event) => setDraft((prev) => ({ ...prev, limitPrice: event.target.value ? Number(event.target.value) : undefined }))} />
          <Input type="number" step="any" placeholder="Stop" onChange={(event) => setDraft((prev) => ({ ...prev, stopPrice: event.target.value ? Number(event.target.value) : undefined }))} />
          <Input type="number" step="any" placeholder="SL" onChange={(event) => setDraft((prev) => ({ ...prev, stopLoss: event.target.value ? Number(event.target.value) : undefined }))} />
          <Input type="number" step="any" placeholder="TP" onChange={(event) => setDraft((prev) => ({ ...prev, takeProfit: event.target.value ? Number(event.target.value) : undefined }))} />
        </div>
        <Button className="w-full gap-2" disabled={!canSend} onClick={submit}>
          <Send className="h-4 w-4" />
          Invia live
        </Button>
        {!canSend && (
          <p className="flex items-center gap-1.5 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Connetti un conto con trading live disponibile.
          </p>
        )}
      </div>
      <TerminalPanel hub={hub} />
    </div>
  );
}

function HistoryPanel({ hub }: { hub: ReturnType<typeof useBrokerHub> }) {
  useEffect(() => {
    if (hub.profiles.activeProfileId) void hub.refreshHistory(hub.profiles.activeProfileId);
  }, [hub]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold">
        <History className="h-4 w-4 text-primary" />
        Storico / Diario
      </div>
      {hub.history.length === 0 && <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 text-sm text-muted-foreground">Nessun deal nello storico normalizzato.</div>}
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
  const activeSymbol = useMemo(() => hub.snapshot.positions[0]?.symbol ?? "EURUSD", [hub.snapshot.positions]);

  useEffect(() => setTab(initialTab), [initialTab]);

  return (
    <div className="space-y-4">
      <StatusStrip {...hub} />
      <Tabs value={tab} onValueChange={(value) => setTab(value as BrokerHubTab)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="connect" className="gap-2"><Cable className="h-3.5 w-3.5" />Collega</TabsTrigger>
          <TabsTrigger value="accounts" className="gap-2"><ListChecks className="h-3.5 w-3.5" />Account</TabsTrigger>
          <TabsTrigger value="terminal" className="gap-2"><TerminalSquare className="h-3.5 w-3.5" />Terminale</TabsTrigger>
          <TabsTrigger value="order" className="gap-2"><Send className="h-3.5 w-3.5" />Ordini</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-3.5 w-3.5" />Storico</TabsTrigger>
        </TabsList>
        <TabsContent value="connect"><ConnectAccountWizard hub={hub} onConnected={() => setTab("accounts")} /></TabsContent>
        <TabsContent value="accounts"><AccountsPanel hub={hub} onConnected={() => setTab("terminal")} /></TabsContent>
        <TabsContent value="terminal"><TerminalPanel hub={hub} /></TabsContent>
        <TabsContent value="order"><OrderPanel hub={hub} /></TabsContent>
        <TabsContent value="history"><HistoryPanel hub={hub} /></TabsContent>
      </Tabs>
      <div className="rounded-xl border border-border/40 bg-card/60 p-4">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Landmark className="h-4 w-4 text-primary" />
          Monitor simbolo
        </div>
        <div className="mt-3">
          <TradingViewMonitor brokerSymbol={activeSymbol} />
        </div>
      </div>
    </div>
  );
}
