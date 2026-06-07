import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  KeyRound,
  Landmark,
  Loader2,
  MonitorCheck,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { type Mt5SmartLinkDiagnosticCheck, type Mt5SmartLinkStatus, useBrokerHub } from "./useBrokerHub";

type WizardStep = "broker" | "connect" | "verify" | "done";
type BrokerChoice = "FP Trading" | "Qualsiasi broker MetaTrader" | "cTrader" | "Broker azioni/crypto supportati" | "Altro broker";
type RouteChoice = "smartlink" | "oauth" | "portal" | "import";

const BROKER_CHOICES: Array<{
  id: BrokerChoice;
  title: string;
  detail: string;
  route: RouteChoice;
}> = [
  {
    id: "FP Trading",
    title: "FP Trading",
    detail: "Collegamento conto con terminale locale o credenziali broker.",
    route: "smartlink",
  },
  {
    id: "Qualsiasi broker MetaTrader",
    title: "Broker MetaTrader",
    detail: "Collega il conto anche senza avere MetaTrader installato.",
    route: "smartlink",
  },
  {
    id: "cTrader",
    title: "cTrader",
    detail: "Accesso ufficiale quando il broker lo supporta.",
    route: "oauth",
  },
  {
    id: "Broker azioni/crypto supportati",
    title: "Azioni / crypto",
    detail: "Portale broker sicuro dove disponibile.",
    route: "portal",
  },
  {
    id: "Altro broker",
    title: "Altro broker",
    detail: "Import report per diario e statistiche.",
    route: "import",
  },
];

const SMARTLINK_STEPS = [
  "Rilevo MetaTrader",
  "Accedi al conto",
  "Sincronizzo",
  "Conto collegato",
];

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
          done
            ? "border-primary bg-primary text-primary-foreground"
            : active
              ? "border-primary/70 bg-primary/10 text-primary"
              : "border-border/50 text-muted-foreground"
        }`}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : label.slice(0, 1)}
      </div>
      <span className={`truncate text-xs font-bold ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}

function SmartLinkTimeline({ status }: { status: Mt5SmartLinkStatus | null }) {
  const activeIndex = status?.connected ? 3 : status?.terminalDetected ? 2 : 0;
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {SMARTLINK_STEPS.map((label, index) => (
        <div
          key={label}
          className={`rounded-lg border px-3 py-2 text-xs ${
            index < activeIndex
              ? "border-primary/25 bg-primary/10 text-primary"
              : index === activeIndex
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-border/40 bg-background/30 text-muted-foreground"
          }`}
        >
          <p className="font-bold">{label}</p>
        </div>
      ))}
    </div>
  );
}

function DiagnosticList({ checks }: { checks: Mt5SmartLinkDiagnosticCheck[] }) {
  if (checks.length === 0) return null;
  return (
    <div className="grid gap-2">
      {checks.map((check) => (
        <div key={check.id} className="flex items-start gap-2 rounded-lg border border-border/40 bg-background/35 px-3 py-2 text-sm">
          {check.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />}
          <div>
            <p className="font-bold">{check.label}</p>
            <p className="text-xs text-muted-foreground">{check.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConnectAccountWizard({ hub, onConnected }: { hub: ReturnType<typeof useBrokerHub>; onConnected: () => void }) {
  const [step, setStep] = useState<WizardStep>("broker");
  const [busy, setBusy] = useState(false);
  const [brokerName, setBrokerName] = useState<BrokerChoice>("FP Trading");
  const [tradingEnabled, setTradingEnabled] = useState(false);
  const [smartLinkStatus, setSmartLinkStatus] = useState<Mt5SmartLinkStatus | null>(null);
  const [smartLinkProfileId, setSmartLinkProfileId] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<Mt5SmartLinkDiagnosticCheck[]>([]);
  const [accountNumber, setAccountNumber] = useState("");
  const [server, setServer] = useState("");
  const [password, setPassword] = useState("");
  const [importText, setImportText] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedPairing, setAdvancedPairing] = useState<{ profileId: string; token: string } | null>(null);

  const selected = BROKER_CHOICES.find((choice) => choice.id === brokerName) ?? BROKER_CHOICES[0];

  useEffect(() => {
    if (!hub.connectionIntent) void hub.createConnectionIntent(brokerName);
  }, [brokerName, hub]);

  const status = hub.connectionIntent?.safeDisplayStatus ?? hub.connectionIntent?.displayStatus ?? "Preparazione collegamento conto";
  const steps = useMemo(
    () =>
      [
        ["broker", "Broker"],
        ["connect", "Collega"],
        ["verify", "Verifica"],
        ["done", "Fine"],
      ] as const,
    [],
  );

  const continueFromBroker = async () => {
    setBusy(true);
    try {
      await hub.createConnectionIntent(brokerName);
      setStep("connect");
    } finally {
      setBusy(false);
    }
  };

  const parseImportDeals = () =>
    importText
      .split(/\r?\n/)
      .map((line, index) => {
        const [symbol, side, volume, profit] = line.split(",").map((part) => part.trim());
        if (!symbol || (side?.toLowerCase() !== "buy" && side?.toLowerCase() !== "sell")) return null;
        const parsedVolume = Number(volume);
        if (!Number.isFinite(parsedVolume) || parsedVolume <= 0) return null;
        const parsedProfit = Number(profit);
        return {
          id: `import-${Date.now()}-${index}`,
          symbol: symbol.toUpperCase(),
          side: side.toLowerCase() as "buy" | "sell",
          volume: parsedVolume,
          profit: Number.isFinite(parsedProfit) ? parsedProfit : 0,
        };
      })
      .filter(Boolean) as Array<{ id: string; symbol: string; side: "buy" | "sell"; volume: number; profit: number }>;

  const startConnection = async () => {
    setBusy(true);
    try {
      if (selected.route === "smartlink") {
        const created = await hub.startMt5SmartLink({ brokerName, tradingEnabled });
        setSmartLinkProfileId(created.profile.id);
        setSmartLinkStatus(created.status);
        setStep("verify");
        return;
      }
      if (selected.route === "portal") {
        const intent = hub.connectionIntent ?? (await hub.createConnectionIntent(brokerName));
        await hub.verifyAccountCredentials(intent.id, { accountNumber: "portal", accountPassword: "portal", tradingEnabled });
        setStep("verify");
        return;
      }
      if (selected.route === "oauth") {
        setStep("verify");
        return;
      }
      await hub.importBrokerHistory({
        brokerName,
        accountLabel: `${brokerName} import`,
        accountId: `IMPORT-${Date.now()}`,
        deals: parseImportDeals(),
      });
      setStep("done");
      onConnected();
    } finally {
      setBusy(false);
    }
  };

  const refreshSmartLink = async () => {
    if (!smartLinkProfileId) return;
    setBusy(true);
    try {
      const next = await hub.getMt5SmartLinkStatus(smartLinkProfileId);
      setSmartLinkStatus(next);
      await hub.refreshProfiles();
      if (next.connected) {
        setStep("done");
        onConnected();
      }
    } finally {
      setBusy(false);
    }
  };

  const loginWithCredentials = async () => {
    if (!smartLinkProfileId) return;
    setBusy(true);
    try {
      const result = await hub.loginMt5SmartLink({ profileId: smartLinkProfileId, accountNumber, password, server });
      setSmartLinkStatus(result.status);
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  const connectWithoutTerminal = async () => {
    setBusy(true);
    try {
      const intent = hub.connectionIntent ?? (await hub.createConnectionIntent(brokerName));
      const result = await hub.completeConnectionIntent(intent.id, {
        mode: "credentials",
        accountNumber,
        accountPassword: password,
        server,
        tradingEnabled,
      });
      setPassword("");
      if (result.snapshot?.status === "connected") {
        setStep("done");
        onConnected();
      }
    } finally {
      setBusy(false);
    }
  };

  const runDiagnostics = async () => {
    if (!smartLinkProfileId) return;
    setBusy(true);
    try {
      const result = await hub.getMt5SmartLinkDiagnostics(smartLinkProfileId);
      setDiagnostics(result.checks);
    } finally {
      setBusy(false);
    }
  };

  const startAdvancedConnector = async () => {
    setBusy(true);
    try {
      const created = await hub.createCompanionPairing({ brokerName, tradingEnabled });
      setAdvancedPairing({ profileId: created.profile.id, token: created.pairing.token });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4 rounded-xl border border-border/40 bg-card/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">Collega conto</p>
            <p className="text-xs text-muted-foreground">{status}</p>
          </div>
          <div className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase text-primary">
            SmartLink
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          {steps.map(([id, label]) => (
            <StepDot
              key={id}
              label={label}
              active={step === id}
              done={steps.findIndex(([candidate]) => candidate === id) < steps.findIndex(([candidate]) => candidate === step)}
            />
          ))}
        </div>

        {step === "broker" && (
          <div className="space-y-4 rounded-xl border border-border/40 bg-secondary/20 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-primary/20 bg-primary/10 p-2">
                <Landmark className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold">Scegli il conto da collegare</p>
                <p className="mt-1 text-sm text-muted-foreground">Per MetaTrader puoi usare il terminale se lo hai, oppure collegarti con le credenziali del broker.</p>
              </div>
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              {BROKER_CHOICES.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => setBrokerName(choice.id)}
                  className={`min-h-20 rounded-lg border px-3 py-2 text-left text-sm transition ${
                    brokerName === choice.id ? "border-primary bg-primary/10 text-primary" : "border-border/40 bg-background/30 hover:bg-secondary/30"
                  }`}
                >
                  <span className="font-bold">{choice.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{choice.detail}</span>
                </button>
              ))}
            </div>
            <Button className="w-full gap-2" onClick={continueFromBroker} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
              Collega conto
            </Button>
          </div>
        )}

        {step === "connect" && (
          <div className="space-y-4 rounded-xl border border-border/40 bg-secondary/20 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-primary/20 bg-primary/10 p-2">
                {selected.route === "import" ? <FileUp className="h-5 w-5 text-primary" /> : <MonitorCheck className="h-5 w-5 text-primary" />}
              </div>
              <div>
                <p className="font-bold">
                  {selected.route === "smartlink"
                    ? "Avvia SmartLink MetaTrader"
                    : selected.route === "oauth"
                      ? "Accedi con il broker"
                      : selected.route === "portal"
                        ? "Apri il portale sicuro"
                        : "Importa un report"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.route === "smartlink"
                    ? "Se hai MetaTrader 5 sul PC, SmartLink legge saldo, equity, posizioni e storico dal terminale. Se non lo hai, puoi collegarti con numero conto, server e password."
                    : selected.route === "import"
                      ? "Usa questa strada quando il broker non offre un collegamento diretto gratuito."
                      : "Non dovrai inserire chiavi tecniche nel percorso principale."}
                </p>
              </div>
            </div>

            {selected.route === "smartlink" && (
              <div className="rounded-lg border border-border/40 bg-background/40 p-3 text-sm text-muted-foreground">
                <p>1. Se hai MetaTrader 5, aprilo con il tuo conto broker.</p>
                <p>2. Se non lo hai installato, continua e usa le credenziali fornite dal broker.</p>
                <p>3. Il conto comparira' solo dopo una verifica reale.</p>
              </div>
            )}

            {selected.route === "import" && (
              <div className="space-y-2">
                <Textarea
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  placeholder={"EURUSD,buy,0.10,24.5\nXAUUSD,sell,0.20,-8.1"}
                  className="min-h-28 font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">Formato rapido: simbolo, buy/sell, volume, profitto. Una riga per trade.</p>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/25 px-3 py-2">
              <div>
                <p className="text-sm font-bold">Trading live</p>
                <p className="text-xs text-muted-foreground">Resta bloccato finche' il conto non e' sincronizzato.</p>
              </div>
              <Switch checked={tradingEnabled} onCheckedChange={setTradingEnabled} />
            </div>

            <Button className="w-full gap-2" onClick={startConnection} disabled={busy || (selected.route === "import" && !importText.trim())}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {selected.route === "smartlink" ? "Avvia SmartLink" : selected.route === "import" ? "Importa report" : "Collega conto"}
            </Button>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-4 rounded-xl border border-border/40 bg-secondary/20 p-4">
            {selected.route === "smartlink" ? (
              <>
                <SmartLinkTimeline status={smartLinkStatus} />
                <div
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    smartLinkStatus?.connected
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  }`}
                >
                  <p className="font-bold">{smartLinkStatus?.connected ? "Conto collegato" : "Connessione in corso"}</p>
                  <p className="mt-1 text-xs opacity-85">
                    {smartLinkStatus?.message ?? "Scegli SmartLink locale oppure collega il conto con le credenziali broker."}
                  </p>
                </div>

                <div className="space-y-2 rounded-lg border border-border/40 bg-background/40 p-3">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <KeyRound className="h-4 w-4 text-primary" />
                    Accesso conto
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Se MetaTrader e' gia' aperto e loggato non serve compilare nulla. Se non hai MetaTrader installato, usa questi campi per collegarti con il provider cloud configurato.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      value={accountNumber}
                      onChange={(event) => setAccountNumber(event.target.value)}
                      placeholder="Numero conto"
                      className="h-10 rounded-md border border-border/50 bg-background px-3 text-sm outline-none focus:border-primary/60"
                    />
                    <input
                      value={server}
                      onChange={(event) => setServer(event.target.value)}
                      placeholder="Server broker"
                      className="h-10 rounded-md border border-border/50 bg-background px-3 text-sm outline-none focus:border-primary/60"
                    />
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Password"
                      type="password"
                      className="h-10 rounded-md border border-border/50 bg-background px-3 text-sm outline-none focus:border-primary/60"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={loginWithCredentials}
                      disabled={busy || !smartLinkProfileId || !accountNumber.trim() || !server.trim() || !password}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                      Accedi nel terminale
                    </Button>
                    <Button
                      className="gap-2"
                      onClick={connectWithoutTerminal}
                      disabled={busy || !accountNumber.trim() || !server.trim() || !password}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Collega senza MetaTrader
                    </Button>
                  </div>
                </div>

                <DiagnosticList checks={diagnostics} />

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="outline" className="gap-2" onClick={runDiagnostics} disabled={busy || !smartLinkProfileId}>
                    <Wrench className="h-4 w-4" />
                    Risolvi automaticamente
                  </Button>
                  <Button className="gap-2" onClick={refreshSmartLink} disabled={busy || !smartLinkProfileId}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Verifica connessione
                  </Button>
                </div>

                <div className="rounded-lg border border-border/40 bg-background/30">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-bold"
                    onClick={() => setAdvancedOpen((value) => !value)}
                  >
                    Impostazioni avanzate
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                  </button>
                  {advancedOpen && (
                    <div className="space-y-3 border-t border-border/40 p-3 text-sm text-muted-foreground">
                      <p>Usa il Connector EA solo se SmartLink non riesce a leggere il terminale MT5 sul tuo PC.</p>
                      <Button variant="outline" className="w-full" onClick={startAdvancedConnector} disabled={busy}>
                        Prepara fallback avanzato
                      </Button>
                      {advancedPairing && (
                        <div className="rounded-md border border-border/40 bg-secondary/20 p-2 text-xs">
                          <p>Fallback preparato. Il supporto puo' usare questo profilo avanzato se necessario.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-border/40 bg-background/40 p-4 text-sm text-muted-foreground">
                Collegamento avviato. Completa il passaggio nel broker e torna qui.
              </div>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-primary">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="h-5 w-5" />
              Conto collegato
            </div>
            <p className="mt-2 text-sm text-primary/80">Il conto e' disponibile in Conti collegati con dati reali sincronizzati.</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 text-sm">
        <p className="font-bold">Sicurezza e compatibilita'</p>
        <div className="mt-3 grid gap-2 text-muted-foreground">
          <p>MetaTrader installato e' consigliato per la strada locale gratuita, ma non e' obbligatorio.</p>
          <p>Senza terminale, il collegamento usa il provider cloud configurato lato server.</p>
          <p>La password non viene salvata nel profilo conto.</p>
          <p>Gli ordini live richiedono conto sincronizzato e conferma manuale.</p>
        </div>
      </div>
    </div>
  );
}
