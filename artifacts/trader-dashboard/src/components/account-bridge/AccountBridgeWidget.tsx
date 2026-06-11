import { Activity, ListChecks, PlugZap, Send, Wallet, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAccountBridgeSocket } from "./useAccountBridgeSocket";
import type { AccountBridgeWorkspaceTab } from "./types";
import { uiText } from "@/contexts/LanguageContext";

function money(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function openWorkspace(tab: AccountBridgeWorkspaceTab) {
  window.dispatchEvent(
    new CustomEvent("tl-open-dashboard-workspace", {
      detail: { workspaceId: "account", accountTab: tab },
    }),
  );
}

export function AccountBridgeWidget() {
  const { snapshot } = useAccountBridgeSocket();
  const connected = snapshot.status === "connected";
  const accountLabel = snapshot.account?.login
    ? `${snapshot.account.login}${snapshot.account.server ? ` @ ${snapshot.account.server}` : ""}`
    : snapshot.adapter === "mt5-local-socket"
      ? "MT5 reale"
      : "Conto demo";

  return (
    <Card className="relative overflow-hidden border-border/30 bg-card/60">
      <div className="widget-header">
        <div className="flex items-center gap-2.5">
          <div className="widget-icon border border-primary/20 bg-primary/10">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="widget-title">{uiText("auto.ui.486c14b32d")}</p>
            <p className="text-[10px] text-muted-foreground">
              {snapshot.mode === "live" ? accountLabel : "Modalita demo"}
            </p>
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
          {snapshot.status}
        </div>
      </div>

      <CardContent className="grid grid-cols-2 gap-2 p-4">
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
          <span className="font-mono font-bold">{snapshot.openTrades.length}</span>
        </div>
        <div className="col-span-2 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => openWorkspace("connect")}
            className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border/40 bg-background/35 text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            title={uiText("auto.ui.b2a1267ce5")}
          >
            <PlugZap className="h-3.5 w-3.5" />{uiText("auto.ui.2671bbd8db")}</button>
          <button
            type="button"
            onClick={() => openWorkspace("accounts")}
            className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border/40 bg-background/35 text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            title={uiText("auto.ui.c61faab915")}
          >
            <ListChecks className="h-3.5 w-3.5" />
            Conti
          </button>
          <button
            type="button"
            onClick={() => openWorkspace("order")}
            className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border/40 bg-background/35 text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            title={uiText("auto.ui.ab99ace5d7")}
          >
            <Send className="h-3.5 w-3.5" />
            Ordine
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
