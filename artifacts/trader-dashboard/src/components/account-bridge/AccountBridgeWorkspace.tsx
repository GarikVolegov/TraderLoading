import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  PlugZap,
  Send,
  Trash2,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAccountBridgeSocket } from "./useAccountBridgeSocket";
import { useAccountConnections } from "./useAccountConnections";
import { TradingViewMonitor } from "./TradingViewMonitor";
import type { AccountBridgeWorkspaceTab, AccountConnectionProfile, AccountOrderDraft } from "./types";

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function profileTitle(profile: AccountConnectionProfile, demoLabel: string): string {
  return profile.mode === "live" ? profile.label : demoLabel;
}

function ConnectionStatusPanel({
  snapshot,
  lastError,
  reconnect,
}: {
  snapshot: ReturnType<typeof useAccountBridgeSocket>["snapshot"];
  lastError: string | null;
  reconnect: () => void;
}) {
  const { t } = useLanguage();
  const isRealMt5 = snapshot.mode === "live" && snapshot.adapter === "mt5-local-socket";

  return (
    <div className="space-y-3">
      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          snapshot.mode === "live"
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-primary/30 bg-primary/10 text-primary"
        }`}
      >
        {snapshot.mode === "live"
          ? t("account_bridge.live_active")
          : t("account_bridge.demo_active")}
      </div>

      {isRealMt5 && (
        <div className="grid gap-3 rounded-xl border border-border/40 bg-card/60 p-4 text-sm md:grid-cols-3">
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">{t("account_bridge.account")}</p>
            <p className="mt-1 font-mono font-bold">{snapshot.account?.login ?? t("account_bridge.mt5_connected")}</p>
            {snapshot.account?.name && <p className="text-xs text-muted-foreground">{snapshot.account.name}</p>}
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">{t("account_bridge.broker_server")}</p>
            <p className="mt-1 font-mono font-bold">{snapshot.account?.broker ?? t("account_bridge.mt5_broker")}</p>
            {snapshot.account?.server && <p className="text-xs text-muted-foreground">{snapshot.account.server}</p>}
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">{t("account_bridge.trading")}</p>
            <p className="mt-1 font-mono font-bold">{snapshot.orderEnabled ? t("account_bridge.orders_enabled") : t("account_bridge.read_only")}</p>
            <p className="text-xs text-muted-foreground">
              {snapshot.account?.tradeMode ?? "real"} {snapshot.account?.leverage ? `- 1:${snapshot.account.leverage}` : ""}
            </p>
          </div>
        </div>
      )}

      {(lastError || snapshot.status !== "connected") && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="flex items-center gap-2">
            <WifiOff className="h-4 w-4" />
            {lastError ?? snapshot.error ?? t("account_bridge.not_connected")}
          </span>
          <Button variant="outline" size="sm" onClick={reconnect}>
            {t("account_bridge.reconnect")}
          </Button>
        </div>
      )}
    </div>
  );
}

function ConnectPanel({
  onConnected,
}: {
  onConnected: () => void;
}) {
  const { t } = useLanguage();
  const { saveProfile, activateProfile, message } = useAccountConnections();
  const [label, setLabel] = useState("FP Trading");
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState(8765);
  const [terminalPath, setTerminalPath] = useState("");
  const [orderEnabled, setOrderEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localMessage, setLocalMessage] = useState<string | null>(null);

  const connect = async () => {
    setSaving(true);
    setLocalMessage(null);
    try {
      const profile = await saveProfile({
        label,
        adapter: "mt5-local-socket",
        mode: "live",
        host,
        port,
        terminalPath: terminalPath.trim() || undefined,
        importJournal: true,
        orderEnabled,
        orderAckTimeoutMs: 10_000,
      });
      await activateProfile(profile.id);
      setLocalMessage(t("account_bridge.profile_activated"));
      onConnected();
    } catch (error) {
      setLocalMessage(error instanceof Error ? error.message : t("account_bridge.connection_failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="space-y-3 rounded-xl border border-border/40 bg-card/60 p-4">
        <div className="flex items-center gap-2 text-sm font-bold">
          <PlugZap className="h-4 w-4 text-primary" />
          {t("account_bridge.connect_fp")}
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-label">{t("account_bridge.profile_name")}</Label>
          <Input id="account-label" value={label} onChange={(event) => setLabel(event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="terminal-path">{t("account_bridge.terminal_path")}</Label>
          <Input
            id="terminal-path"
            value={terminalPath}
            placeholder="C:\\Program Files\\MetaTrader 5\\terminal64.exe"
            onChange={(event) => setTerminalPath(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2">
          <div className="space-y-2">
            <Label htmlFor="bridge-host">{t("account_bridge.bridge_host")}</Label>
            <Input id="bridge-host" value={host} onChange={(event) => setHost(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bridge-port">{t("account_bridge.port")}</Label>
            <Input
              id="bridge-port"
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(event) => setPort(Number(event.target.value))}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/25 px-3 py-2">
          <div>
            <p className="text-sm font-bold">{t("account_bridge.real_orders")}</p>
            <p className="text-xs text-muted-foreground">{t("account_bridge.real_orders_desc")}</p>
          </div>
          <Switch checked={orderEnabled} onCheckedChange={setOrderEnabled} />
        </div>

        <Button className="w-full gap-2" onClick={connect} disabled={saving || !label.trim()}>
          <PlugZap className="h-4 w-4" />
          {saving ? t("account_bridge.connecting") : t("account_bridge.save_connect")}
        </Button>
        {(localMessage || message) && <p className="text-xs text-muted-foreground">{localMessage ?? message}</p>}
      </div>

      <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 text-sm">
        <p className="font-bold">{t("account_bridge.real_security")}</p>
        <div className="mt-3 grid gap-2 text-muted-foreground">
          <p>{t("account_bridge.security_1")}</p>
          <p>{t("account_bridge.security_2")}</p>
          <p>{t("account_bridge.security_3")}</p>
        </div>
      </div>
    </div>
  );
}

function AccountsPanel({
  onActivated,
}: {
  onActivated: () => void;
}) {
  const { t } = useLanguage();
  const { connections, loading, message, activateProfile, deleteProfile, testProfile } = useAccountConnections();
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = async (id: string, action: (id: string) => Promise<unknown>) => {
    setBusyId(id);
    try {
      await action(id);
      onActivated();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold">
        <ListChecks className="h-4 w-4 text-primary" />
        {t("account_bridge.connected_accounts")}
      </div>

      {loading && <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 text-sm">{t("common.loading")}</div>}
      {!loading && connections.profiles.length === 0 && (
        <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 text-sm text-muted-foreground">
          {t("account_bridge.no_accounts")}
        </div>
      )}

      <div className="grid gap-3">
        {connections.profiles.map((profile) => {
          const active = connections.activeProfileId === profile.id;
          return (
            <div key={profile.id} className="rounded-xl border border-border/40 bg-card/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{profileTitle(profile, t("account_bridge.demo_account"))}</p>
                    {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {profile.adapter} / {profile.host}:{profile.port}
                  </p>
                  {profile.terminalPath && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">{profile.terminalPath}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={active ? "secondary" : "default"}
                    disabled={busyId === profile.id}
                    onClick={() => run(profile.id, activateProfile)}
                  >
                    {active ? t("account_bridge.active") : t("account_bridge.activate")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === profile.id}
                    onClick={() => run(profile.id, testProfile)}
                  >
                    {t("account_bridge.test")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === profile.id}
                    onClick={() => run(profile.id, deleteProfile)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full border border-border/40 px-2 py-1">
                  {profile.orderEnabled ? t("account_bridge.live_orders_enabled") : t("account_bridge.read_only")}
                </span>
                <span className="rounded-full border border-border/40 px-2 py-1">
                  {t("account_bridge.journal")} {profile.importJournal ? t("account_bridge.journal_active") : t("account_bridge.journal_off")}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}

function OrderPanel({
  snapshot,
  draft,
  setDraft,
  canSend,
  lastOrderMessage,
  submit,
  primarySymbol,
}: {
  snapshot: ReturnType<typeof useAccountBridgeSocket>["snapshot"];
  draft: AccountOrderDraft;
  setDraft: Dispatch<SetStateAction<AccountOrderDraft>>;
  canSend: boolean;
  lastOrderMessage: string | null;
  submit: () => void;
  primarySymbol: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-3 rounded-xl border border-border/40 bg-card/60 p-4">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Send className="h-4 w-4 text-primary" />
          {t("account_bridge.order_ticket")}
        </div>
        <Input
          value={draft.symbol}
          aria-label={t("account_bridge.symbol")}
          onChange={(event) => setDraft((prev) => ({ ...prev, symbol: event.target.value.toUpperCase() }))}
        />
        <div className="grid grid-cols-2 gap-2">
          {(["buy", "sell"] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              onClick={() => setDraft((prev) => ({ ...prev, direction }))}
              className={`h-10 rounded-xl border text-sm font-bold uppercase ${
                draft.direction === direction
                  ? direction === "buy"
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-destructive bg-destructive/15 text-destructive"
                  : "border-border/40 text-muted-foreground"
              }`}
            >
              {direction}
            </button>
          ))}
        </div>
        <Input
          type="number"
          step="0.01"
          value={draft.volume}
          aria-label={t("account_bridge.volume")}
          onChange={(event) => setDraft((prev) => ({ ...prev, volume: Number(event.target.value) }))}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            step="any"
            placeholder="SL"
            aria-label={t("account_bridge.stop_loss")}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, stopLoss: event.target.value ? Number(event.target.value) : undefined }))
            }
          />
          <Input
            type="number"
            step="any"
            placeholder="TP"
            aria-label={t("account_bridge.take_profit")}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                takeProfit: event.target.value ? Number(event.target.value) : undefined,
              }))
            }
          />
        </div>
        <Button className="w-full gap-2" disabled={!canSend} onClick={submit}>
          <Send className="h-4 w-4" />
          {snapshot.mode === "live" ? t("account_bridge.send_live") : t("account_bridge.send_demo")}
        </Button>
        {lastOrderMessage && <p className="text-xs text-muted-foreground">{lastOrderMessage}</p>}
        {!snapshot.orderEnabled && snapshot.mode === "live" && (
          <p className="flex items-center gap-1.5 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t("account_bridge.live_orders_disabled")}
          </p>
        )}
      </div>

      <TradingViewMonitor brokerSymbol={primarySymbol} />
    </div>
  );
}

function MetricsGrid({ snapshot }: { snapshot: ReturnType<typeof useAccountBridgeSocket>["snapshot"] }) {
  const { t } = useLanguage();
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {[
        [t("account_bridge.metric.balance"), snapshot.metrics.balance],
        [t("account_bridge.metric.equity"), snapshot.metrics.equity],
        [t("account_bridge.metric.free_margin"), snapshot.metrics.freeMargin],
        [t("account_bridge.metric.daily_pl"), snapshot.metrics.dailyProfit],
      ].map(([label, value]) => (
        <div key={label} className="rounded-xl border border-border/40 bg-secondary/25 p-3">
          <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
          <p className="mt-1 font-mono text-lg font-bold">{formatNumber(Number(value))}</p>
        </div>
      ))}
    </div>
  );
}

function OpenTrades({ snapshot }: { snapshot: ReturnType<typeof useAccountBridgeSocket>["snapshot"] }) {
  const { t } = useLanguage();
  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-4">
      <p className="mb-3 text-sm font-bold">{t("account_bridge.open_positions")}</p>
      <div className="space-y-2">
        {snapshot.openTrades.length === 0 && <p className="text-sm text-muted-foreground">{t("account_bridge.no_open_positions")}</p>}
        {snapshot.openTrades.map((trade) => (
          <div
            key={trade.ticket}
            className="grid grid-cols-5 gap-2 rounded-lg border border-border/30 bg-secondary/20 px-3 py-2 text-xs"
          >
            <span className="font-mono">{trade.symbol}</span>
            <span className={trade.direction === "buy" ? "text-primary" : "text-destructive"}>
              {trade.direction.toUpperCase()}
            </span>
            <span>{trade.volume}</span>
            <span>{trade.entryPrice}</span>
            <span className="truncate text-muted-foreground">{trade.ticket}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AccountBridgeWorkspace({ initialTab = "connect" }: { initialTab?: AccountBridgeWorkspaceTab }) {
  const { t } = useLanguage();
  const { snapshot, lastError, lastOrderMessage, reconnect, sendOrder } = useAccountBridgeSocket();
  const [tab, setTab] = useState<AccountBridgeWorkspaceTab>(initialTab);
  const [draft, setDraft] = useState<AccountOrderDraft>({ symbol: "EURUSD", direction: "buy", volume: 0.1 });
  const canSend = snapshot.status === "connected" && (snapshot.mode === "demo" || snapshot.orderEnabled);
  const primarySymbol = useMemo(
    () => snapshot.openTrades[0]?.symbol ?? draft.symbol,
    [snapshot.openTrades, draft.symbol],
  );

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const submit = () => {
    const label = snapshot.mode === "live" ? t("account_bridge.confirm_live") : t("account_bridge.confirm_demo");
    if (!window.confirm(label)) return;
    sendOrder(draft);
  };

  const afterAccountChange = () => {
    reconnect();
    setTab("accounts");
  };

  return (
    <div className="space-y-4">
      <ConnectionStatusPanel snapshot={snapshot} lastError={lastError} reconnect={reconnect} />
      <MetricsGrid snapshot={snapshot} />

      <Tabs value={tab} onValueChange={(value) => setTab(value as AccountBridgeWorkspaceTab)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="connect" className="gap-2">
            <PlugZap className="h-3.5 w-3.5" />
            {t("account_bridge.tab.connect")}
          </TabsTrigger>
          <TabsTrigger value="accounts" className="gap-2">
            <ListChecks className="h-3.5 w-3.5" />
            {t("account_bridge.tab.accounts")}
          </TabsTrigger>
          <TabsTrigger value="order" className="gap-2">
            <Send className="h-3.5 w-3.5" />
            {t("account_bridge.tab.order")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connect">
          <ConnectPanel onConnected={afterAccountChange} />
        </TabsContent>
        <TabsContent value="accounts">
          <AccountsPanel onActivated={afterAccountChange} />
        </TabsContent>
        <TabsContent value="order">
          <OrderPanel
            snapshot={snapshot}
            draft={draft}
            setDraft={setDraft}
            canSend={canSend}
            lastOrderMessage={lastOrderMessage}
            submit={submit}
            primarySymbol={primarySymbol}
          />
        </TabsContent>
      </Tabs>

      <OpenTrades snapshot={snapshot} />
    </div>
  );
}
