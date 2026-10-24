import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, AlertTriangle, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { uiText } from "@/contexts/LanguageContext";
import { reportClientError } from "@/lib/clientErrorReporter";

export function AccountDeletionSection({ onDeleted }: { onDeleted: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const canDelete = confirmation.trim().toUpperCase() === "ELIMINA";

  const handleDelete = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Non siamo riusciti a eliminare l'account.",
        );
      }
      toast({ description: "Account eliminato. I dati collegati sono stati rimossi." });
      setOpen(false);
      onDeleted();
    } catch (error) {
      reportClientError(error, {
        context: "account deletion",
        fallbackMessage:
          "Non siamo riusciti a eliminare l'account. Contatta il supporto.",
        toast,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#ef4444]/35 bg-[#0d0f14] p-5 sm:p-6 space-y-4 shadow-xl shadow-black/40">
      <div className="flex items-center justify-between gap-3 border-b border-[#ef4444]/20 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/10 text-[#ef4444]">
            <Trash2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#ef4444]">
              Revoca del Patto & Distruzione Account
            </h3>
            <p className="text-xs font-mono text-muted-foreground/80">
              Eliminazione permanente e irrevocabile delle credenziali e dell&apos;anagrafica.
            </p>
          </div>
        </div>

        <span className="hidden sm:inline-flex rounded border border-[#ef4444]/40 bg-[#ef4444]/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#ef4444]">
          <ShieldAlert className="w-3 h-3 mr-1 text-[#ef4444]" />
          Azione Irreversibile
        </span>
      </div>

      <div className="rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/5 p-4 space-y-2">
        <p className="text-xs font-mono text-muted-foreground/90 leading-relaxed">
          Cancella profilo, diario, dati di trading, notifiche, social, chat e connessioni broker collegate al tuo account. Alcuni log tecnici minimi possono restare per sicurezza, antifrode o obblighi legali.
        </p>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-center gap-2 border-[#ef4444]/40 bg-[#ef4444]/10 hover:bg-[#ef4444]/20 hover:border-[#ef4444] text-[#ef4444] font-mono text-xs py-5 rounded-xl transition-all shadow-md"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="w-4 h-4" />
          <span>Elimina account</span>
        </Button>

        <AlertDialogContent className="rounded-2xl border border-[#ef4444]/35 bg-[#0d0f14] p-6 shadow-2xl text-[#F4F4F6]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-lg font-bold text-[#ef4444] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#ef4444]" />
              {uiText("auto.ui.f5e7dd8614")}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 font-mono text-xs text-muted-foreground pt-2">
              <span className="block">
                Questa azione elimina in modo permanente profilo, preferenze, journal, immagini, backtest, messaggi, notifiche push e connessioni broker salvate.
              </span>
              <span className="block text-[#F4F4F6]">
                Per confermare definitivamente, digita <span className="font-bold text-[#ef4444] bg-[#ef4444]/10 px-1.5 py-0.5 rounded border border-[#ef4444]/30">ELIMINA</span> nel campo sottostante:
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="Digita ELIMINA"
            aria-label={uiText("auto.ui.527bbda0b4")}
            autoComplete="off"
            className="bg-[#07080b] border-[#ef4444]/40 font-mono text-center tracking-widest text-[#F4F4F6] focus:border-[#ef4444] my-2"
          />

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={deleting} className="border-[#26262E] font-mono text-xs">
              {uiText("auto.ui.6c3de5381b")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!canDelete || deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              className="bg-[#ef4444] text-white hover:bg-[#ef4444]/90 font-mono text-xs font-bold"
            >
              {deleting ? "Eliminazione..." : "Elimina definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
