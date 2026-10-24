import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, ChevronRight, Check, Shield, KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePinLock } from "@/contexts/PinLockContext";

export function PinSettings() {
  const { isPinSet, setPin, removePin, unlock } = usePinLock();
  const { toast } = useToast();
  const [mode, setMode] = useState<
    "idle" | "set" | "change-old" | "change-new"
  >("idle");
  const [pin, setLocalPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [oldPin, setOldPin] = useState("");
  const [error, setError] = useState("");

  const handleReset = () => {
    setMode("idle");
    setLocalPin("");
    setConfirm("");
    setOldPin("");
    setError("");
  };

  const handleSet = async () => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError("Il PIN deve essere esattamente di 4 cifre numeriche");
      return;
    }
    if (pin !== confirm) {
      setError("I codici PIN non coincidono");
      return;
    }
    await setPin(pin);
    toast({
      title: "Codice PIN Configurato",
      description: "Il cockpit è ora presidiato e protetto.",
    });
    handleReset();
  };

  const handleVerifyOld = async () => {
    const ok = await unlock(oldPin);
    if (!ok) {
      setError("PIN corrente non corretto");
      return;
    }
    setMode("change-new");
    setOldPin("");
    setError("");
  };

  const handleChangeNew = async () => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError("Il PIN deve essere di 4 cifre");
      return;
    }
    if (pin !== confirm) {
      setError("I codici PIN non coincidono");
      return;
    }
    await setPin(pin);
    toast({ title: "Codice PIN Aggiornato con successo" });
    handleReset();
  };

  const handleRemove = () => {
    removePin();
    toast({
      title: "Codice PIN Rimosso",
      description: "Il presidio locale del cockpit è stato disattivato.",
    });
    handleReset();
  };

  return (
    <div className="rounded-2xl border border-[#C5A059]/25 bg-[#0d0f14] p-5 sm:p-6 space-y-5 shadow-xl shadow-black/40">
      {/* Status banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-[#C5A059]/20 bg-[#11131c]/80">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
              isPinSet
                ? "bg-[#10b981]/15 border-[#10b981]/40 text-[#10b981] shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                : "bg-[#07080b] border-[#C5A059]/25 text-[#C5A059]/60"
            }`}
          >
            {isPinSet ? <ShieldCheck className="w-5 h-5 text-[#10b981]" /> : <Shield className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold tracking-wide text-[#F4F4F6]">
                {isPinSet ? "Presidio Cockpit Attivo" : "Nessuna Protezione Locale"}
              </span>
              <span
                className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[9px] uppercase font-bold tracking-wider border ${
                  isPinSet
                    ? "bg-[#10b981]/15 border-[#10b981]/40 text-[#10b981]"
                    : "bg-[#07080b] border-[#26262E] text-muted-foreground"
                }`}
              >
                {isPinSet ? "Protetto" : "Non impostato"}
              </span>
            </div>
            <p className="text-xs font-mono text-muted-foreground/80 mt-0.5">
              {isPinSet
                ? "L'applicazione richiede il PIN numerico a ogni avvio della sessione operativa."
                : "Configura un PIN di sicurezza per impedire accessi non autorizzati al tuo terminale."}
            </p>
          </div>
        </div>

        {/* Visual Pulse Status */}
        <div className="flex items-center gap-2 self-end sm:self-center font-mono text-xs text-muted-foreground">
          <span className="text-[11px] uppercase tracking-wider">{isPinSet ? "Attivo" : "Disattivo"}</span>
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isPinSet ? "bg-[#10b981] shadow-[0_0_8px_#10b981] animate-pulse" : "bg-muted-foreground/30"
            }`}
          />
        </div>
      </div>

      {/* Mode IDLE actions */}
      {mode === "idle" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {!isPinSet ? (
            <Button
              onClick={() => setMode("set")}
              className="w-full justify-center gap-2.5 bg-[#C5A059] hover:bg-[#E8C56A] text-black font-mono font-semibold text-xs py-5 rounded-xl transition-all shadow-md"
            >
              <KeyRound className="w-4 h-4 text-black" />
              <span>Configura Codice PIN</span>
            </Button>
          ) : (
            <>
              <Button
                onClick={() => setMode("change-old")}
                className="w-full justify-center gap-2.5 border-[#C5A059]/35 bg-[#07080b] hover:bg-[#C5A059]/15 hover:border-[#C5A059] text-[#E8C56A] font-mono text-xs py-5 rounded-xl transition-all"
                variant="outline"
              >
                <KeyRound className="w-4 h-4 text-[#C5A059]" />
                <span>Modifica Codice PIN</span>
              </Button>
              <Button
                onClick={handleRemove}
                className="w-full justify-center gap-2.5 text-[#ef4444] border-[#ef4444]/30 bg-[#ef4444]/5 hover:bg-[#ef4444]/15 hover:border-[#ef4444] font-mono text-xs py-5 rounded-xl transition-all"
                variant="outline"
              >
                <X className="w-4 h-4" />
                <span>Rimuovi Protezione PIN</span>
              </Button>
            </>
          )}
        </div>
      )}

      {/* Mode CHANGE-OLD: Verify existing PIN */}
      {mode === "change-old" && (
        <div className="space-y-4 rounded-xl border border-[#C5A059]/25 bg-[#07080b] p-4 sm:p-5">
          <div className="space-y-1">
            <label className="text-xs font-mono uppercase tracking-wider text-[#C5A059] block">
              Inserisci il PIN Attuale
            </label>
            <p className="text-xs text-muted-foreground font-mono">
              Verifica le credenziali esistenti prima di impostare la nuova sequenza.
            </p>
          </div>

          <div className="max-w-xs mx-auto">
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              value={oldPin}
              onChange={(e) => {
                setOldPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                setError("");
              }}
              className="font-mono text-center tracking-[0.6em] text-2xl h-14 bg-[#11131c] border-[#C5A059]/40 text-[#E8C56A]"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-xs text-[#ef4444] font-mono text-center flex items-center justify-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" /> {error}
            </p>
          )}

          <div className="flex gap-2.5 pt-2 max-w-sm mx-auto">
            <Button
              onClick={handleVerifyOld}
              className="flex-1 bg-[#C5A059] hover:bg-[#E8C56A] text-black font-mono font-semibold text-xs"
              disabled={oldPin.length < 4}
            >
              <ChevronRight className="w-4 h-4 mr-1.5 text-black" /> Procedi
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1 border-[#26262E] text-xs font-mono text-muted-foreground hover:text-[#F4F4F6]"
            >
              Annulla
            </Button>
          </div>
        </div>
      )}

      {/* Mode SET or CHANGE-NEW: Define and confirm new PIN */}
      {(mode === "set" || mode === "change-new") && (
        <div className="space-y-4 rounded-xl border border-[#C5A059]/25 bg-[#07080b] p-4 sm:p-5">
          <div className="space-y-1">
            <label className="text-xs font-mono uppercase tracking-wider text-[#C5A059] block">
              {mode === "set" ? "Definisci Nuovo Codice PIN (4 Cifre)" : "Nuovo Codice PIN"}
            </label>
            <p className="text-xs text-muted-foreground font-mono">
              Inserisci e conferma una sequenza numerica di 4 cifre per proteggere la sessione.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
            <div>
              <label className="text-[10px] font-mono uppercase text-muted-foreground/70 mb-1 block text-center">
                Nuovo PIN
              </label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={pin}
                onChange={(e) => {
                  setLocalPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                  setError("");
                }}
                className="font-mono text-center tracking-[0.6em] text-xl h-12 bg-[#11131c] border-[#C5A059]/40 text-[#E8C56A]"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-muted-foreground/70 mb-1 block text-center">
                Conferma PIN
              </label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value.replace(/\D/g, "").slice(0, 4));
                  setError("");
                }}
                className="font-mono text-center tracking-[0.6em] text-xl h-12 bg-[#11131c] border-[#C5A059]/40 text-[#E8C56A]"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-[#ef4444] font-mono text-center flex items-center justify-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" /> {error}
            </p>
          )}

          <div className="flex gap-2.5 pt-2 max-w-sm mx-auto">
            <Button
              onClick={mode === "set" ? handleSet : handleChangeNew}
              className="flex-1 bg-[#C5A059] hover:bg-[#E8C56A] text-black font-mono font-semibold text-xs"
              disabled={pin.length < 4 || confirm.length < 4}
            >
              <Check className="w-4 h-4 mr-1.5 text-black" /> Salva Codice
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1 border-[#26262E] text-xs font-mono text-muted-foreground hover:text-[#F4F4F6]"
            >
              Annulla
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
