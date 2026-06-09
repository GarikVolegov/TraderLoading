import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { useBrokerHub } from "./useBrokerHub";

type FxBlueStep = "details" | "fxblue" | "profile" | "done";

const FXBLUE_ACCOUNT_SYNC_URL = "https://diagnostics.fxblue.com/accountsync.aspx";

export function FxBlueAccountSyncWizard({
  hub,
  onConnected,
  onBack,
}: {
  hub: ReturnType<typeof useBrokerHub>;
  onConnected: () => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState<FxBlueStep>("details");
  const [platform, setPlatform] = useState<"MT4" | "MT5">("MT5");
  const [brokerName, setBrokerName] = useState("FX Blue");
  const [server, setServer] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [environment, setEnvironment] = useState<"demo" | "live">("live");
  const [investorPassword, setInvestorPassword] = useState("");
  const [fxBlueProfileRef, setFxBlueProfileRef] = useState("");
  const [intentId, setIntentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailsReady = Boolean(accountNumber.trim() && server.trim());
  const existingSyncReady = Boolean(accountNumber.trim() && server.trim() && fxBlueProfileRef.trim());

  const setupPayload = () => ({
    platform,
    brokerName: brokerName.trim() || "FX Blue",
    server: server.trim(),
    accountNumber: accountNumber.trim(),
    environment,
    ...(investorPassword.trim() ? { investorPassword: investorPassword.trim() } : {}),
  });

  const connectExistingSync = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await hub.createFxBlueSetupIntent(setupPayload());
      setInvestorPassword("");
      setIntentId(created.intent.id);

      const verified = await hub.verifyFxBlueProfile(created.intent.id, { fxBlueProfileRef: fxBlueProfileRef.trim() });
      if (verified.error) {
        setError(verified.error);
        return;
      }

      const completed = await hub.completeFxBlueSetupIntent(created.intent.id);
      if (completed.profile) {
        setStep("done");
        onConnected();
        return;
      }
      setError(completed.error ?? "Profilo FX Blue non collegato");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profilo FX Blue non collegato");
    } finally {
      setBusy(false);
    }
  };

  const createIntent = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await hub.createFxBlueSetupIntent(setupPayload());
      setInvestorPassword("");
      setIntentId(created.intent.id);
      setStep("fxblue");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup FX Blue non avviato");
    } finally {
      setBusy(false);
    }
  };

  const verifyProfile = async () => {
    if (!intentId) return;
    setBusy(true);
    setError(null);
    try {
      const data = await hub.verifyFxBlueProfile(intentId, { fxBlueProfileRef: fxBlueProfileRef.trim() });
      if (data.error) {
        setError(data.error);
        return;
      }
      if (data.intent?.id) setIntentId(data.intent.id);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profilo FX Blue non verificato");
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    if (!intentId) return;
    setBusy(true);
    setError(null);
    try {
      const data = await hub.completeFxBlueSetupIntent(intentId);
      if (data.profile) {
        setStep("done");
        onConnected();
      }
      if (data.error) setError(data.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account Sync FX Blue non completato");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/40 bg-secondary/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold">FX Blue Account Sync</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Collega il profilo FX Blue già sincronizzato e importa i dati in Sola lettura.
          </p>
        </div>
        <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase text-primary">
          Sola lettura
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {step === "details" && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Piattaforma</Label>
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value as "MT4" | "MT5")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="MT5">MT5</option>
                <option value="MT4">MT4</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <select
                value={environment}
                onChange={(event) => setEnvironment(event.target.value as "demo" | "live")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="live">Live</option>
                <option value="demo">Demo</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Broker</Label>
            <Input value={brokerName} onChange={(event) => setBrokerName(event.target.value)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Numero conto</Label>
              <Input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Server broker</Label>
              <Input value={server} onChange={(event) => setServer(event.target.value)} />
            </div>
          </div>

          <div className="-mx-4 space-y-3 border-y border-primary/20 bg-primary/5 px-4 py-3">
            <div className="space-y-1">
              <p className="text-sm font-bold">Hai già configurato FX Blue?</p>
              <p className="text-xs text-muted-foreground">
                Inserisci username o URL pubblico del profilo FX Blue. Broker Hub non richiede la password del conto per questo collegamento.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Username o URL profilo FX Blue</Label>
              <Input
                value={fxBlueProfileRef}
                onChange={(event) => setFxBlueProfileRef(event.target.value)}
                placeholder="82364482 oppure https://www.fxblue.com/users/tuo-username"
              />
            </div>
            <Button className="w-full gap-2" disabled={busy || !existingSyncReady} onClick={connectExistingSync}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Collega profilo già sincronizzato
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <LockKeyhole className="h-3.5 w-3.5" />
              password investor/read-only opzionale
            </Label>
            <Input type="password" autoComplete="off" value={investorPassword} onChange={(event) => setInvestorPassword(event.target.value)} />
            <p className="text-xs text-amber-400">Serve solo se devi ancora configurare FX Blue. Non inserire la password master del conto.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={onBack}>
              Indietro
            </Button>
            <Button className="gap-2" disabled={busy || !detailsReady} onClick={createIntent}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Prepara setup FX Blue
            </Button>
          </div>
        </div>
      )}

      {step === "fxblue" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border/40 bg-background/40 p-3 text-sm text-muted-foreground">
            <p>1. Accedi o registrati su FX Blue.</p>
            <p>2. Apri Account Sync e seleziona {platform}.</p>
            <p>3. Inserisci numero conto, server e password investor/read-only.</p>
            <p>4. Avvia la raccolta e torna qui.</p>
          </div>
          <a href={FXBLUE_ACCOUNT_SYNC_URL} target="_blank" rel="noreferrer" className={`${buttonVariants()} w-full gap-2`}>
            <ExternalLink className="h-4 w-4" />
            Apri FX Blue Account Sync
          </a>
          <Button variant="outline" className="w-full" onClick={() => setStep("profile")}>
            Ho completato il setup su FX Blue
          </Button>
        </div>
      )}

      {step === "profile" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Username o URL profilo FX Blue</Label>
            <Input
              value={fxBlueProfileRef}
              onChange={(event) => setFxBlueProfileRef(event.target.value)}
              placeholder="trader-one oppure https://www.fxblue.com/users/trader-one"
            />
          </div>
          <Button className="w-full gap-2" disabled={busy || !fxBlueProfileRef.trim()} onClick={verifyProfile}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Verifica dati FX Blue
          </Button>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-primary">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="h-5 w-5" />
            Profilo FX Blue verificato
          </div>
          <p className="text-sm text-primary/80">Completa il collegamento per visualizzare il conto nel Broker Hub.</p>
          <Button className="w-full" onClick={complete} disabled={busy}>
            Completa collegamento
          </Button>
        </div>
      )}
    </div>
  );
}
