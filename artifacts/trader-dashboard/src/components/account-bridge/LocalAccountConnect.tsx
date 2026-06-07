import { useState } from "react";
import {
  ShieldCheck, PlugZap, Send, LogOut, Wifi, WifiOff, AlertTriangle, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLocalAccountAgent } from "./useLocalAccountAgent";
import type { AccountOrderDraft } from "./types";

const DEFAULT_AGENT_URL = "http://127.0.0.1:8765";

function fmt(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function LocalAccountConnect() {
  const [agentUrl, setAgentUrl] = useState(DEFAULT_AGENT_URL);
  const { snapshot, streamConnected, lastError, lastOrderMessage, login, sendOrder, logout } =
    useLocalAccountAgent(agentUrl);

  const [broker, setBroker] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState("");
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [orderEnabled, setOrderEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const [draft, setDraft] = useState<AccountOrderDraft>({ symbol: "EURUSD", direction: "buy", volume: 0.1 });

  const connected = snapshot.status === "connected";
  const canSend = connected && (snapshot.mode === "demo" || snapshot.orderEnabled);

  const connect = async () => {
    setBusy(true);
    try {
      await login({
        broker: broker.trim() || "Broker",
        accountNumber: accountNumber.trim(),
        password,
        server: server.trim(),
        mode,
        orderEnabled,
      });
      setPassword(""); // non conservare la password nello stato dopo l'invio
    } catch {
      /* errore mostrato via lastError */
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    await logout();
  };

  const submitOrder = async () => {
    const label = snapshot.mode === "live" ? "Inviare ordine LIVE sul conto reale?" : "Inviare ordine demo?";
    if (!window.confirm(label)) return;
    await sendOrder(draft);
  };

  return (
    <div className="space-y-4">
      {/* Banner di fiducia */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="text-sm">
          <p className="font-bold text-primary">Le tue credenziali restano sul tuo computer</p>
          <p className="text-muted-foreground">
            Numero conto e password vengono inviati <strong>solo all'agente locale</strong> sul tuo PC
            (127.0.0.1): non passano dai nostri server e non vengono mai salvati.
          </p>
        </div>
      </div>

      {/* Stato connessione */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-card/60 px-4 py-2.5 text-sm">
        <span className="flex items-center gap-2">
          {connected ? (
            <Wifi className="h-4 w-4 text-green-400" />
          ) : (
            <WifiOff className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium">
            {connected
              ? `Collegato · ${snapshot.account?.broker ?? "Broker"} ${snapshot.account?.login ?? ""}`
              : streamConnected
                ? "Agente locale pronto — inserisci le credenziali"
                : "Agente locale non rilevato"}
          </span>
          {connected && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              snapshot.mode === "live" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
            }`}>
              {snapshot.mode === "live" ? "LIVE" : "DEMO"}
            </span>
          )}
        </span>
        {connected && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={disconnect}>
            <LogOut className="h-3.5 w-3.5" /> Scollega
          </Button>
        )}
      </div>

      {lastError && !connected && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {lastError}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* Form credenziali */}
        <div className="space-y-3 rounded-xl border border-border/40 bg-card/60 p-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <PlugZap className="h-4 w-4 text-primary" /> Collega il tuo conto
          </div>

          <div className="space-y-2">
            <Label htmlFor="la-broker">Broker</Label>
            <Input id="la-broker" placeholder="Es. IC Markets, Pepperstone…" value={broker} onChange={(e) => setBroker(e.target.value)} />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <div className="space-y-2">
              <Label htmlFor="la-account">Numero conto</Label>
              <Input id="la-account" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="la-server">Server</Label>
              <Input id="la-server" placeholder="Es. ICMarkets-Live01" value={server} onChange={(e) => setServer(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="la-password" className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Password
            </Label>
            <Input id="la-password" type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(["demo", "live"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`h-9 rounded-lg border text-xs font-bold uppercase transition-colors ${
                  mode === m
                    ? m === "live"
                      ? "border-destructive bg-destructive/15 text-destructive"
                      : "border-primary bg-primary/15 text-primary"
                    : "border-border/40 text-muted-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/25 px-3 py-2">
            <div>
              <p className="text-sm font-bold">Ordini reali</p>
              <p className="text-xs text-muted-foreground">Necessario per inviare ordini in modalità live</p>
            </div>
            <Switch checked={orderEnabled} onCheckedChange={setOrderEnabled} />
          </div>

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">Agente locale ({agentUrl})</summary>
            <div className="mt-2 space-y-2">
              <Input value={agentUrl} onChange={(e) => setAgentUrl(e.target.value)} />
              <p>Avvia l'agente con: <code className="rounded bg-secondary/50 px-1">node scripts/account-agent/agent.mjs</code></p>
            </div>
          </details>

          <Button
            className="w-full gap-2"
            onClick={connect}
            disabled={busy || !accountNumber.trim() || !password || !server.trim()}
          >
            <PlugZap className="h-4 w-4" />
            {busy ? "Collegamento…" : "Collega"}
          </Button>
        </div>

        {/* Pannello live */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Balance", snapshot.metrics.balance],
              ["Equity", snapshot.metrics.equity],
              ["Free margin", snapshot.metrics.freeMargin],
              ["Daily P/L", snapshot.metrics.dailyProfit],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl border border-border/40 bg-secondary/25 p-3">
                <p className="text-[11px] uppercase text-muted-foreground">{label as string}</p>
                <p className="mt-1 font-mono text-lg font-bold">{fmt(Number(value))}</p>
              </div>
            ))}
          </div>

          {/* Ticket ordine */}
          <div className="space-y-3 rounded-xl border border-border/40 bg-card/60 p-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Send className="h-4 w-4 text-primary" /> Ticket ordine
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
              <Input
                aria-label="Simbolo"
                value={draft.symbol}
                onChange={(e) => setDraft((p) => ({ ...p, symbol: e.target.value.toUpperCase() }))}
              />
              <Input
                aria-label="Volume"
                type="number"
                step="0.01"
                value={draft.volume}
                onChange={(e) => setDraft((p) => ({ ...p, volume: Number(e.target.value) }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["buy", "sell"] as const).map((direction) => (
                <button
                  key={direction}
                  type="button"
                  onClick={() => setDraft((p) => ({ ...p, direction }))}
                  className={`h-9 rounded-lg border text-xs font-bold uppercase ${
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
            <Button className="w-full gap-2" disabled={!canSend} onClick={submitOrder}>
              <Send className="h-4 w-4" /> {snapshot.mode === "live" ? "Invia LIVE" : "Invia demo"}
            </Button>
            {!canSend && connected && snapshot.mode === "live" && (
              <p className="flex items-center gap-1.5 text-xs text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Abilita "Ordini reali" per inviare in live.
              </p>
            )}
            {lastOrderMessage && <p className="text-xs text-muted-foreground">{lastOrderMessage}</p>}
          </div>

          {/* Posizioni aperte */}
          <div className="rounded-xl border border-border/40 bg-card/60 p-4">
            <p className="mb-3 text-sm font-bold">Posizioni aperte</p>
            {snapshot.openTrades.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna posizione aperta.</p>
            ) : (
              <div className="space-y-2">
                {snapshot.openTrades.map((trade) => (
                  <div key={trade.ticket} className="grid grid-cols-5 items-center gap-2 rounded-lg border border-border/30 bg-secondary/20 px-3 py-2 text-xs">
                    <span className="font-mono font-bold">{trade.symbol}</span>
                    <span className={trade.direction === "buy" ? "text-primary" : "text-destructive"}>
                      {trade.direction.toUpperCase()}
                    </span>
                    <span>{trade.volume}</span>
                    <span className={`font-mono ${(trade.profit ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {fmt(trade.profit ?? 0)}
                    </span>
                    <span className="truncate text-right text-muted-foreground">{trade.ticket}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
