import { useState, useId, useMemo, useEffect } from "react";
import {
  ShieldCheck,
  Zap,
  Sparkles,
  CheckCircle2,
  Lock,
  Server,
  ArrowRight,
  ExternalLink,
  Loader2,
  AlertTriangle,
  HelpCircle,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { synestheticConfirm, synestheticClick } from "@/lib/soundFx";
import { suggestServers, BROKER_SERVERS } from "./brokerServers";
import type { useBrokerHub } from "./useBrokerHub";

export interface SimpleBrokerConnectWizardProps {
  hub: ReturnType<typeof useBrokerHub>;
  onConnected: () => void;
  preselectedBroker?: string;
  preselectedServer?: string;
}

const QUICK_BROKERS = [
  { name: "FTMO", category: "prop", badge: "5% Daily · 10% Total", defaultServer: "FTMO-Server" },
  { name: "The 5%ers", category: "prop", badge: "5% Daily · 8% Total", defaultServer: "The5ers-Live" },
  { name: "FundedNext", category: "prop", badge: "5% Daily · 10% Total", defaultServer: "FundedNext-Server" },
  { name: "Alpha Capital Group", category: "prop", badge: "5% Daily · 10% Total", defaultServer: "AlphaCapital-Live" },
  { name: "IC Markets", category: "broker", badge: "Raw Spread ECN", defaultServer: "ICMarketsSC-Live01" },
  { name: "Pepperstone", category: "broker", badge: "Razor Spread", defaultServer: "Pepperstone-Live01" },
];

export function SimpleBrokerConnectWizard({
  hub,
  onConnected,
  preselectedBroker,
  preselectedServer,
}: SimpleBrokerConnectWizardProps) {
  const { toast } = useToast();
  const fieldId = useId();

  const [mode, setMode] = useState<"quick_credentials" | "demo_instant" | "fxblue_sync">("quick_credentials");
  const [platform, setPlatform] = useState<"MT5" | "MT4">("MT5");
  const [environment, setEnvironment] = useState<"live" | "demo">("live");
  const [selectedBrokerName, setSelectedBrokerName] = useState(preselectedBroker || "FTMO");
  const [server, setServer] = useState(preselectedServer || "FTMO-Server");
  const [accountNumber, setAccountNumber] = useState("");
  const [investorPassword, setInvestorPassword] = useState("");
  const [fxBlueProfileRef, setFxBlueProfileRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedBroker) {
      setSelectedBrokerName(preselectedBroker);
      const matched = QUICK_BROKERS.find((b) => b.name.toLowerCase() === preselectedBroker.toLowerCase());
      if (preselectedServer) {
        setServer(preselectedServer);
      } else if (matched) {
        setServer(matched.defaultServer);
      }
    }
  }, [preselectedBroker, preselectedServer]);

  // Suggerimenti server dinamici per il broker selezionato
  const serverOptions = useMemo(() => {
    return suggestServers(selectedBrokerName);
  }, [selectedBrokerName]);

  const handleSelectQuickBroker = (broker: (typeof QUICK_BROKERS)[number]) => {
    synestheticClick();
    setSelectedBrokerName(broker.name);
    setServer(broker.defaultServer);
    setError(null);
  };

  // 1-Click Sovrano Demo 100k (Nessun inserimento credenziali richiesto)
  const handleActivateInstantDemo = async (customLabel = "FTMO Challenge 100k (Simulato)") => {
    setBusy(true);
    setError(null);
    try {
      synestheticClick();
      const intent = await hub.createConnectionIntent(selectedBrokerName || "FTMO");
      const res = await hub.completeConnectionIntent(intent.id, {
        mode: "demo",
        accountLabel: customLabel,
        accountNumber: "DEMO-100K",
        server: server || "FTMO-Demo",
      });

      synestheticConfirm();
      toast({
        title: "Conto Sovrano Attivato con Successo",
        description: `Conto simulato collegato con €100.000,00 di capitale. Presidio Drawdown e Varco operativi.`,
      });
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante l'attivazione del conto prova");
    } finally {
      setBusy(false);
    }
  };

  // Collegamento Credenziali Read-Only / Investor
  const handleConnectCredentials = async () => {
    if (!accountNumber.trim()) {
      setError("Inserisci il numero di conto (Login MT4/MT5)");
      return;
    }
    if (!server.trim()) {
      setError("Seleziona o inserisci il server del tuo conto");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      synestheticClick();
      const payload = {
        platform,
        brokerName: selectedBrokerName.trim() || "Broker",
        server: server.trim(),
        accountNumber: accountNumber.trim(),
        environment,
        ...(investorPassword.trim() ? { investorPassword: investorPassword.trim() } : {}),
      };

      const created = await hub.createFxBlueSetupIntent(payload);
      setInvestorPassword("");

      // Se fornita credenziale investor, tentiamo completamento soft o intent
      toast({
        title: "Sincronizzazione Conto Avviata",
        description: `Connessione a ${selectedBrokerName} (${accountNumber}) in corso. I dati verranno importati in sola lettura.`,
      });
      synestheticConfirm();
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile collegare il conto con i parametri forniti");
    } finally {
      setBusy(false);
    }
  };

  // Collegamento profilo FX Blue già sincronizzato
  const handleConnectExistingFxBlue = async () => {
    if (!fxBlueProfileRef.trim()) {
      setError("Inserisci il nome utente o l'URL del tuo profilo FX Blue");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      synestheticClick();
      const payload = {
        platform,
        brokerName: selectedBrokerName.trim() || "FX Blue",
        server: server.trim() || "Live",
        accountNumber: accountNumber.trim() || "SYNC",
        environment,
        fxBlueProfileRef: fxBlueProfileRef.trim(),
      };

      const created = await hub.createFxBlueSetupIntent(payload);
      const verified = await hub.verifyFxBlueProfile(created.intent.id, {
        fxBlueProfileRef: fxBlueProfileRef.trim(),
      });

      if (verified.error) {
        setError(verified.error);
        return;
      }

      await hub.completeFxBlueSetupIntent(created.intent.id);
      synestheticConfirm();
      toast({
        title: "Profilo FX Blue Collegato",
        description: "Lo storico e l'equity del tuo conto sono sincronizzati in sola lettura.",
      });
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profilo FX Blue non verificato");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Intestazione Intuitiva & Rassicurante ── */}
      <div className="rounded-xl border border-[#C5A059]/35 bg-[#0d0f14]/90 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.6)] font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#E8C56A]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Collega Conto Broker &amp; Prop Firm
              </h3>
              <span className="px-2 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider bg-[#10b981]/15 border border-[#10b981]/40 text-[#10b981]">
                Sola Lettura (Zero Rischi)
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Sincronizza il tuo conto MT4 / MT5 per monitorare il Max Daily Drawdown in tempo reale ed esportare setup con 1 click.
            </p>
          </div>

          {/* Quick 1-Click Demo Launcher */}
          <button
            type="button"
            disabled={busy}
            onClick={() => handleActivateInstantDemo()}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#C5A059]/30 to-[#E8C56A]/20 hover:from-[#C5A059]/45 hover:to-[#E8C56A]/35 border border-[#C5A059]/50 text-[#E8C56A] hover:text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(197,160,89,0.15)] whitespace-nowrap active:scale-95"
            title="Attiva istantaneamente un conto FTMO 100k simulato per testare subito il cockpit"
          >
            <Zap size={13} className="text-[#E8C56A]" />
            <span>⚡ Prova Istantanea 100k Demo</span>
          </button>
        </div>

        {/* Tab di Selezione Modalità Semplice */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-white/10 text-xs">
          <button
            type="button"
            onClick={() => {
              synestheticClick();
              setMode("quick_credentials");
            }}
            className={`px-3 py-1.5 rounded-lg border text-left font-bold transition-all cursor-pointer ${
              mode === "quick_credentials"
                ? "bg-[#C5A059]/20 border-[#C5A059]/60 text-[#E8C56A]"
                : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            <span className="block text-[11px] uppercase">1. Credenziali MT4/MT5</span>
            <span className="text-[9.5px] font-normal text-slate-400 block">Password investor protetta</span>
          </button>

          <button
            type="button"
            onClick={() => {
              synestheticClick();
              setMode("demo_instant");
            }}
            className={`px-3 py-1.5 rounded-lg border text-left font-bold transition-all cursor-pointer ${
              mode === "demo_instant"
                ? "bg-[#C5A059]/20 border-[#C5A059]/60 text-[#E8C56A]"
                : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            <span className="block text-[11px] uppercase">2. Conto Prova Sovrano</span>
            <span className="text-[9.5px] font-normal text-slate-400 block">Simulazione FTMO 100k</span>
          </button>

          <button
            type="button"
            onClick={() => {
              synestheticClick();
              setMode("fxblue_sync");
            }}
            className={`px-3 py-1.5 rounded-lg border text-left font-bold transition-all cursor-pointer col-span-2 sm:col-span-1 ${
              mode === "fxblue_sync"
                ? "bg-[#C5A059]/20 border-[#C5A059]/60 text-[#E8C56A]"
                : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            <span className="block text-[11px] uppercase">3. Link FX Blue / Web</span>
            <span className="text-[9.5px] font-normal text-slate-400 block">Profilo già esistente</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-300 font-mono">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* ── MODALITÀ 1: CREDENZIALI DIRETTE MT4 / MT5 (PIÙ INTUITIVA) ── */}
      {mode === "quick_credentials" && (
        <div className="rounded-xl border border-white/10 bg-[#0d0f14]/80 p-4 space-y-4 font-mono">
          {/* Selezione Rapida Broker / Prop Firm */}
          <div>
            <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
              Seleziona la tua Prop Firm o il tuo Broker
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUICK_BROKERS.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => handleSelectQuickBroker(b)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    selectedBrokerName === b.name
                      ? "border-[#C5A059] bg-[#C5A059]/20 text-[#E8C56A] shadow-md"
                      : "border-white/10 bg-black/40 text-slate-300 hover:border-[#C5A059]/40 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">{b.name}</span>
                    {selectedBrokerName === b.name && <CheckCircle2 size={13} className="text-[#E8C56A]" />}
                  </div>
                  <span className="text-[9.5px] text-slate-400 block mt-0.5 truncate">{b.badge}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dettagli Conto */}
          <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-white/10">
            {/* Piattaforma */}
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-platform`} className="text-xs text-slate-300">
                Piattaforma di Trading
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {(["MT5", "MT4"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={`h-9 rounded-md border text-xs font-bold transition-all cursor-pointer ${
                      platform === p
                        ? "border-[#C5A059] bg-[#C5A059]/20 text-[#E8C56A]"
                        : "border-white/10 bg-black/40 text-slate-400 hover:text-white"
                    }`}
                  >
                    {p} {p === "MT5" ? "(Consigliata)" : ""}
                  </button>
                ))}
              </div>
            </div>

            {/* Ambiente Live / Demo */}
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-env`} className="text-xs text-slate-300">
                Tipo di Conto
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "live", label: "Live / Funded" },
                  { id: "demo", label: "Demo / Challenge" },
                ].map((env) => (
                  <button
                    key={env.id}
                    type="button"
                    onClick={() => setEnvironment(env.id as any)}
                    className={`h-9 rounded-md border text-xs font-bold transition-all cursor-pointer ${
                      environment === env.id
                        ? "border-[#C5A059] bg-[#C5A059]/20 text-[#E8C56A]"
                        : "border-white/10 bg-black/40 text-slate-400 hover:text-white"
                    }`}
                  >
                    {env.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Server con autocomplete suggeriti */}
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-server`} className="text-xs text-slate-300 flex items-center justify-between">
                <span>Server MT4/MT5</span>
                <span className="text-[10px] text-slate-500">Es. FTMO-Server</span>
              </Label>
              <div className="relative">
                <Input
                  id={`${fieldId}-server`}
                  value={server}
                  list={`${fieldId}-server-list`}
                  onChange={(e) => setServer(e.target.value)}
                  placeholder="Seleziona o digita il server"
                  className="h-9 bg-black/50 border-white/15 text-xs text-foreground focus:border-[#C5A059]"
                />
                <datalist id={`${fieldId}-server-list`}>
                  {serverOptions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Numero di Conto */}
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-account`} className="text-xs text-slate-300">
                Numero di Conto (Login ID)
              </Label>
              <Input
                id={`${fieldId}-account`}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Es. 1048291"
                className="h-9 bg-black/50 border-white/15 text-xs text-foreground focus:border-[#C5A059]"
              />
            </div>
          </div>

          {/* Password Investor */}
          <div className="space-y-1.5 p-3 rounded-lg bg-black/40 border border-white/10">
            <div className="flex items-center justify-between">
              <Label htmlFor={`${fieldId}-investor`} className="text-xs text-slate-300 flex items-center gap-1.5">
                <Lock size={12} className="text-[#C5A059]" />
                <span>Password Investor / Sola Lettura</span>
              </Label>
              <span className="text-[9.5px] text-emerald-400 font-bold uppercase whitespace-nowrap">
                100% Sicuro · Solo Consultazione
              </span>
            </div>
            <Input
              id={`${fieldId}-investor`}
              type="password"
              autoComplete="off"
              value={investorPassword}
              onChange={(e) => setInvestorPassword(e.target.value)}
              placeholder="Inserisci password investor del broker"
              className="h-9 bg-black/70 border-white/15 text-xs text-foreground focus:border-[#C5A059]"
            />
            <p className="text-[10.5px] text-slate-400">
              La password investor non consente di aprire, modificare o chiudere posizioni. Viene utilizzata solo per scaricare equity e drawdown.
            </p>
          </div>

          {/* Bottone di Conferma */}
          <Button
            className="w-full h-10 gap-2 bg-[#C5A059] hover:bg-[#E8C56A] text-black font-bold uppercase tracking-wider text-xs transition-all cursor-pointer shadow-lg active:scale-98"
            disabled={busy || !accountNumber.trim() || !server.trim()}
            onClick={handleConnectCredentials}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            <span>Collega Conto {selectedBrokerName} Ora</span>
            <ArrowRight size={14} />
          </Button>
        </div>
      )}

      {/* ── MODALITÀ 2: CONTO PROVA SOVRANO SIMULATO (1-CLICK) ── */}
      {mode === "demo_instant" && (
        <div className="rounded-xl border border-[#C5A059]/40 bg-[#0d0f14]/90 p-5 space-y-4 font-mono text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-[#C5A059]/15 border border-[#C5A059]/40 flex items-center justify-center text-[#E8C56A]">
            <Award size={24} />
          </div>

          <div className="space-y-1">
            <h4 className="text-base font-bold text-white uppercase tracking-tight">
              Conto Prova Sovrano AUREUS (FTMO 100k)
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Non vuoi inserire credenziali adesso? Attiva un conto simulato da €100.000,00 con le regole esatte di FTMO per testare il calcolatore di Drawdown e il Bio-Lock.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto text-center py-2 border-y border-white/10 text-xs">
            <div>
              <span className="text-[9px] text-slate-400 uppercase block">Capitale</span>
              <strong className="text-emerald-400 font-bold">€100.000,00</strong>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 uppercase block">Max Daily DD</span>
              <strong className="text-[#E8C56A] font-bold">5.0% (€5.000)</strong>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 uppercase block">Bio-Lock 75%</span>
              <strong className="text-rose-400 font-bold">3.75% (€3.750)</strong>
            </div>
          </div>

          <Button
            className="w-full max-w-sm mx-auto h-11 gap-2 bg-[#C5A059] hover:bg-[#E8C56A] text-black font-bold uppercase tracking-wider text-xs transition-all cursor-pointer shadow-xl active:scale-98"
            disabled={busy}
            onClick={() => handleActivateInstantDemo("Conto Sovrano FTMO 100k")}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            <span>Attiva Conto Prova con 1 Click</span>
          </Button>
        </div>
      )}

      {/* ── MODALITÀ 3: LINK FX BLUE PUBBLICO ── */}
      {mode === "fxblue_sync" && (
        <div className="rounded-xl border border-white/10 bg-[#0d0f14]/80 p-4 space-y-4 font-mono">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Collega Profilo FX Blue già Sincronizzato
            </h4>
            <p className="text-[11px] text-slate-400">
              Se hai già sincronizzato il tuo conto su FX Blue o su una piattaforma partner, inserisci semplicemente l'URL o lo username del profilo.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-fxblue`} className="text-xs text-slate-300">
              Username o URL Pubblico FX Blue
            </Label>
            <Input
              id={`${fieldId}-fxblue`}
              value={fxBlueProfileRef}
              onChange={(e) => setFxBlueProfileRef(e.target.value)}
              placeholder="Es. https://www.fxblue.com/users/tuo-profilo oppure tuo-profilo"
              className="h-9 bg-black/50 border-white/15 text-xs text-foreground focus:border-[#C5A059]"
            />
          </div>

          <Button
            className="w-full h-10 gap-2 bg-[#C5A059] hover:bg-[#E8C56A] text-black font-bold uppercase tracking-wider text-xs transition-all cursor-pointer shadow-lg active:scale-98"
            disabled={busy || !fxBlueProfileRef.trim()}
            onClick={handleConnectExistingFxBlue}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            <span>Sincronizza Profilo FX Blue</span>
          </Button>
        </div>
      )}
    </div>
  );
}
