import { useEffect, useState } from "react";
import {
  Cloud, PlugZap, Send, LogOut, Wifi, WifiOff, AlertTriangle, Lock, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useBrokerHub } from "./useBrokerHub";
import { suggestServers } from "./brokerServers";
import type { BrokerOrderDraft } from "./types";

const DEFAULT_BROKER = "Qualsiasi broker MetaTrader";

function fmt(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function CloudAccountConnect() {
  const hub = useBrokerHub();
  const { snapshot, activeProfile } = hub;

  const [broker, setBroker] = useState(DEFAULT_BROKER);
  const [accountNumber, setAccountNumber] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState("");
  const [tradingEnabled, setTradingEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<BrokerOrderDraft>({ symbol: "EURUSD", side: "buy", type: "market", volume: 0.1 });

  const connected = snapshot.status === "connected" && !!activeProfile;
  const canSend = connected && snapshot.tradingEnabled && (activeProfile?.capabilities.placeOrders ?? false);

  // Aggiornamento live: ricarica lo snapshot del profilo attivo ogni 5s.
  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => { void hub.refreshProfiles(); }, 5000);
    return () => clearInterval(id);
  }, [connected, hub]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const intent = await hub.createConnectionIntent(broker.trim() || DEFAULT_BROKER);
      const data = await hub.completeConnectionIntent(intent.id, {
        mode: "credentials",
        accountNumber: accountNumber.trim(),
        accountPassword: password,
        server: server.trim() || undefined,
        tradingEnabled,
      });
      setPassword(""); // non conservare la password dopo l'invio
      if (data.error || data.snapshot?.status !== "connected") {
        setError(data.error ?? data.snapshot?.error ?? "Conto non collegato. Verifica credenziali e server.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Collegamento non riuscito");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!activeProfile) return;
    await hub.deleteProfile(activeProfile.id);
  };

  const submitOrder = async () => {
    if (!activeProfile) return;
    if (!window.confirm("Inviare ordine reale sul conto?")) return;
    await hub.placeOrder(activeProfile.id, draft);
  };

  return (
    <div className="space-y-4">
      {/* Banner di trasparenza */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
        <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="text-sm">
          <p className="font-bold text-primary">Collegamento senza installare nulla</p>
          <p className="text-muted-foreground">
            Inserisci le credenziali del tuo conto MetaTrader: il collegamento avviene tramite il
            ponte <strong>cloud MetaApi</strong>, che le usa solo per connettersi al tuo broker. Nessun
            terminale o software da installare.
          </p>
        </div>
      </div>

      {/* Stato connessione */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-card/60 px-4 py-2.5 text-sm">
        <span className="flex items-center gap-2">
          {connected ? <Wifi className="h-4 w-4 text-green-400" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
          <span className="font-medium">
            {connected
              ? `Collegato · ${activeProfile?.brokerName ?? "Broker"} ${activeProfile?.accountId ?? ""}`
              : "Nessun conto collegato"}
          </span>
          {connected && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              snapshot.tradingEnabled ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
            }`}>
              {snapshot.tradingEnabled ? "ORDINI ON" : "SOLA LETTURA"}
            </span>
          )}
        </span>
        {connected && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={disconnect}>
            <LogOut className="h-3.5 w-3.5" /> Scollega
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* Form credenziali */}
        <div className="space-y-3 rounded-xl border border-border/40 bg-card/60 p-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <PlugZap className="h-4 w-4 text-primary" /> Collega il tuo conto
          </div>

          <div className="space-y-2">
            <Label htmlFor="cl-broker">Broker</Label>
            <Input id="cl-broker" value={broker} onChange={(e) => setBroker(e.target.value)} />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <div className="space-y-2">
              <Label htmlFor="cl-account">Numero conto</Label>
              <Input id="cl-account" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cl-server">Server</Label>
              <Input
                id="cl-server"
                list="cloud-server-suggestions"
                placeholder="Scegli o digita…"
                value={server}
                onChange={(e) => setServer(e.target.value)}
              />
              <datalist id="cloud-server-suggestions">
                {suggestServers(broker).map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cl-password" className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Password
            </Label>
            <Input id="cl-password" type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <p className="text-[11px] text-muted-foreground">
            Scrivi il nome del broker qui sopra per filtrare i server suggeriti nel menu. Trovi il server
            esatto nell'app/email del broker.
          </p>

          <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/25 px-3 py-2">
            <div>
              <p className="text-sm font-bold">Ordini reali</p>
              <p className="text-xs text-muted-foreground">Disattivato = solo lettura (consigliato all'inizio)</p>
            </div>
            <Switch checked={tradingEnabled} onCheckedChange={setTradingEnabled} />
          </div>

          <Button
            className="w-full gap-2"
            onClick={connect}
            disabled={busy || !accountNumber.trim() || !password || !server.trim()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
            {busy ? "Collegamento…" : "Collega"}
          </Button>
          {hub.message && !error && <p className="text-xs text-muted-foreground">{hub.message}</p>}
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
              {(["buy", "sell"] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => setDraft((p) => ({ ...p, side }))}
                  className={`h-9 rounded-lg border text-xs font-bold uppercase ${
                    draft.side === side
                      ? side === "buy"
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-destructive bg-destructive/15 text-destructive"
                      : "border-border/40 text-muted-foreground"
                  }`}
                >
                  {side}
                </button>
              ))}
            </div>
            <Button className="w-full gap-2" disabled={!canSend} onClick={submitOrder}>
              <Send className="h-4 w-4" /> Invia ordine
            </Button>
            {connected && !snapshot.tradingEnabled && (
              <p className="flex items-center gap-1.5 text-xs text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Sola lettura: ricollega con "Ordini reali" attivo per operare.
              </p>
            )}
          </div>

          {/* Posizioni aperte */}
          <div className="rounded-xl border border-border/40 bg-card/60 p-4">
            <p className="mb-3 text-sm font-bold">Posizioni aperte</p>
            {snapshot.positions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna posizione aperta.</p>
            ) : (
              <div className="space-y-2">
                {snapshot.positions.map((pos) => (
                  <div key={pos.id} className="grid grid-cols-5 items-center gap-2 rounded-lg border border-border/30 bg-secondary/20 px-3 py-2 text-xs">
                    <span className="font-mono font-bold">{pos.symbol}</span>
                    <span className={pos.side === "buy" ? "text-primary" : "text-destructive"}>{pos.side.toUpperCase()}</span>
                    <span>{pos.volume}</span>
                    <span className={`font-mono ${(pos.profit ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>{fmt(pos.profit ?? 0)}</span>
                    <button
                      className="text-right text-muted-foreground hover:text-red-400"
                      onClick={() => activeProfile && hub.closePosition(activeProfile.id, pos.brokerPositionId || pos.id)}
                      title="Chiudi posizione"
                    >
                      Chiudi
                    </button>
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
