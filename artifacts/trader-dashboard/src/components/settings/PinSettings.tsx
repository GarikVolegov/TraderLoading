import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, ChevronRight, Check, Shield, KeyRound } from "lucide-react";
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
      setError("Il PIN deve essere di 4 cifre numeriche");
      return;
    }
    if (pin !== confirm) {
      setError("I PIN non coincidono");
      return;
    }
    await setPin(pin);
    toast({
      title: "PIN impostato",
      description: "L'app è ora protetta da PIN.",
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
      setError("I PIN non coincidono");
      return;
    }
    await setPin(pin);
    toast({ title: "PIN aggiornato" });
    handleReset();
  };

  const handleRemove = () => {
    removePin();
    toast({
      title: "PIN rimosso",
      description: "L'app non richiede più autenticazione.",
    });
    handleReset();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${isPinSet ? "bg-primary/15 border border-primary/40" : "bg-secondary border border-border"}`}
          >
            <Shield
              className={`w-5 h-5 ${isPinSet ? "text-primary" : "text-muted-foreground"}`}
            />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {isPinSet ? "PIN attivo" : "PIN non impostato"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPinSet
                ? "L'app richiede PIN ad ogni avvio"
                : "Nessuna protezione PIN"}
            </p>
          </div>
        </div>
        <div
          className={`w-2 h-2 rounded-full ${isPinSet ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`}
        />
      </div>

      {mode === "idle" && (
        <div className="grid grid-cols-1 gap-2">
          {!isPinSet ? (
            <Button
              onClick={() => setMode("set")}
              className="w-full justify-start gap-3"
              variant="outline"
            >
              <KeyRound className="w-4 h-4 text-primary" /> Imposta PIN
            </Button>
          ) : (
            <>
              <Button
                onClick={() => setMode("change-old")}
                className="w-full justify-start gap-3"
                variant="outline"
              >
                <KeyRound className="w-4 h-4 text-primary" /> Cambia PIN
              </Button>
              <Button
                onClick={handleRemove}
                className="w-full justify-start gap-3 text-destructive border-destructive/30 hover:bg-destructive/10"
                variant="outline"
              >
                <X className="w-4 h-4" /> Rimuovi PIN
              </Button>
            </>
          )}
        </div>
      )}

      {mode === "change-old" && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              PIN attuale
            </label>
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
              className="font-mono text-center tracking-[0.5em] text-lg"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              onClick={handleVerifyOld}
              className="flex-1"
              disabled={oldPin.length < 4}
            >
              <ChevronRight className="w-4 h-4 mr-2" /> Avanti
            </Button>
            <Button variant="outline" onClick={handleReset} className="flex-1">
              Annulla
            </Button>
          </div>
        </div>
      )}

      {(mode === "set" || mode === "change-new") && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Nuovo PIN (4 cifre)
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
              className="font-mono text-center tracking-[0.5em] text-lg"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
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
              className="font-mono text-center tracking-[0.5em] text-lg"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              onClick={mode === "set" ? handleSet : handleChangeNew}
              className="flex-1"
              disabled={pin.length < 4 || confirm.length < 4}
            >
              <Check className="w-4 h-4 mr-2" /> Conferma
            </Button>
            <Button variant="outline" onClick={handleReset} className="flex-1">
              Annulla
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
